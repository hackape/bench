import * as path from "path";
import * as readline from "readline";
import { benchmark } from "./benchmark";

const backspace = () => readline.moveCursor(process.stdout, -1, 0);

const config: BenchConfig = {
  iter: 1,
  warmup: 50,
  sample: 50,
  verbose: false,
};

function _loadTestCase(
  acc: TestCase[],
  filepath: string,
  testcase: TestCase | TestCase[],
  index?: number
) {
  if (Array.isArray(testcase)) {
    testcase.forEach((testcase, index) => {
      _loadTestCase(acc, filepath, testcase, index);
    });
  } else {
    let suffix = "";
    if (typeof index === "number") {
      suffix = ` (Case ${index + 1})`;
    }

    testcase = { ...testcase, ops: new Array(config.sample) };
    if (typeof testcase.run !== "function") {
      throw Error(
        `Error: Bad test case '${filepath}', must export \`run\` function.`
      );
    }
    if (typeof testcase.title !== "string") {
      const basename = path.basename(filepath);
      testcase.title = basename + suffix;
    }
    testcase.filepath = filepath;
    acc.push(testcase);
  }
  return acc;
}

function loadTestCases() {
  try {
    const args = process.argv.slice(2);
    return args.reduce((acc, filename) => {
      const filepath = path.resolve(filename);

      const testcase = require(filepath);
      return _loadTestCase(acc, filepath, testcase);
    }, [] as TestCase[]);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }
}

function sleep(ms: number) {
  let resolve: () => void;
  const p = new Promise((r) => (resolve = r));
  setTimeout(resolve!, ms);
  return p;
}

function spinnerFactory() {
  const spinner = "|/-\\";
  const spinnerLen = spinner.length;
  let spinnerCount = 0;
  return () => spinner[spinnerCount++ % spinnerLen];
}

function logHeaderFactory(title: string, verbose: boolean) {
  if (verbose) {
    let done = false;
    return () => {
      if (done) return;
      console.log(`benchmarking "${title}"...`);
      done = true;
    };
  } else {
    const spin = spinnerFactory();
    let init = false;
    return (end?: boolean) => {
      if (end) {
        backspace();
        process.stdout.write(" \n");
        return;
      } else if (init) {
        backspace();
        process.stdout.write(spin());
      } else {
        process.stdout.write(`benchmarking "${title}"...${spin()}`);
        init = true;
      }
    };
  }
}

async function main() {
  const testcases = loadTestCases();

  for (const testcase of testcases) {
    let sampleIndex = 0;
    const logHeader = logHeaderFactory(testcase.title, config.verbose);
    while (sampleIndex < config.sample) {
      logHeader();
      await runSample(testcase, sampleIndex++, config);
      global.gc();
    }
    logHeader(true);

    const stat = getOpsStat(testcase.ops);
    testcase.stat = stat;
    console.log(
      `[summary] min: ${stat.min} ops/s, max: ${
        stat.max
      } ops/s, avg: ${stat.avg.toFixed(2)} ops/s\n`
    );

    await sleep(100);
  }

  getReport(testcases);
}

function getReport(testcases: TestCase[]) {
  testcases.sort((a, b) => b.stat.avg - a.stat.avg);
  const fastest = testcases[0];
  testcases.forEach((testcase) => {
    if (testcase === fastest) testcase.lag = 0;
    const lag = 1 - testcase.stat.avg / fastest.stat.avg;
    testcase.lag = lag;
  });

  console.log("[report] =============");
  testcases.forEach((testcase) => {
    const remark = testcase.lag
      ? `${(testcase.lag * 100).toFixed(2)}% slower`
      : "fatest";
    console.log(
      `${testcase.title} ${testcase.stat.avg.toFixed(2)} ops/s ${remark}`
    );
  });
}

function getOpsStat(_ops: number[]) {
  const ops = _ops.slice();
  // remove the highest and lowest results:
  ops.sort();
  ops.pop();
  ops.shift();

  const stat = ops.reduce(
    (acc, op) => {
      acc.avg += op / config.sample;
      acc.min = Math.min(acc.min, op);
      acc.max = Math.max(acc.max, op);
      return acc;
    },
    { min: Infinity, max: 0, avg: 0 }
  );

  stat.avg = stat.avg;
  return stat;
}

async function runSample(testcase: TestCase, i: number, config: BenchConfig) {
  if (config.verbose) process.stdout.write(`[${i + 1}] ${testcase.title}...`);
  const result = await benchmark(testcase.run, {
    title: testcase.title,
    warmup: config.warmup,
    iter: config.iter,
    print: false,
  });

  testcase.ops[i] = Math.round((result.iter * 1000) / result.total);

  if (config.verbose) {
    console.log(
      `${result.iter} iterations, took ${result.total.toFixed(2)}ms, ${
        testcase.ops[i]
      } ops/s`
    );
  }
}

main();

type TestCase = {
  title: string;
  run: () => any;
  filepath: string;
  ops: number[];
  stat: {
    avg: number;
    min: number;
    max: number;
  };
  lag: number;
};

type BenchConfig = {
  iter: number;
  warmup: number;
  sample: number;
  verbose: boolean;
};
