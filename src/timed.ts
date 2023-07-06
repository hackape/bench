import { now } from "./now";
import type { TimingResult } from "./api";

/**
 * Calls function `fn` without args, prints elapsed time and returns
 * fn's result. The optional `prefix` will be displayed with the output,
 * allowing to label different measurements.
 *
 * @param fn - function to time
 * @param prefix - log prefix
 */
export const timed = <T>(fn: () => T, prefix = "") => {
  const result = timedResult(fn);
  if (isPromise(result)) {
    return result.then((result) => {
      const [res, t] = result;
      console.log(`${prefix} ${t.toFixed(2)}ms`);
      return res;
    });
  } else {
    const [res, t] = result;
    console.log(`${prefix} ${t.toFixed(2)}ms`);
    return res;
  }
};

/**
 * Similar to {@link timed}, but produces no output and instead returns
 * tuple of `fn`'s result and the time measurement (in milliseconds).
 *
 * @param fn - function to time
 */
export function timedResult(
  fn: () => any
): TimingResult<any> | Promise<TimingResult<any>> {
  const t0 = now();
  const res = fn();
  if (isPromise(res)) {
    return res.then(() => {
      const t1 = now();
      return [
        res,
        (typeof BigInt !== "undefined"
          ? Number(<bigint>t1 - <bigint>t0)
          : <number>t1 - <number>t0) * 1e-6,
      ];
    });
  } else {
    const t1 = now();
    return [
      res,
      (typeof BigInt !== "undefined"
        ? Number(<bigint>t1 - <bigint>t0)
        : <number>t1 - <number>t0) * 1e-6,
    ];
  }
}

function isPromise(target: any): target is Promise<any> {
  if (target instanceof Promise) return true;
  if (target && typeof target.then === "function") return true;
  return false;
}
