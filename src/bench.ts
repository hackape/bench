import { timedResult } from "./timed";
/**
 * Similar to {@link bench}, but produces no output and instead returns
 * tuple of `fn`'s last result and the grand total time measurement.
 *
 * @param fn - function to time
 * @param n - number of iterations
 */
export async function benchResult<T>(fn: () => T, n = 1e6) {
  let res: T;
  return timedResult(async () => {
    while (n-- > 0) {
      res = await fn();
    }
    return res;
  });
}
