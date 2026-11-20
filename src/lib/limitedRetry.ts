// Shared helpers for calling a throttled service: run a few jobs at a time and retry when it says it is busy.

/** True when an error means "the service is busy or short of credit", not "the input was bad". */
export function isServiceBusy(message: string): boolean {
  return /HTTP (429|5\d\d)|rate limit|credit balance|temporarily unavailable|too many requests/i.test(message);
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Runs `job`; when it fails with a busy error it waits (baseMs, 2×baseMs, …) and tries again, up to `retries` extra times. */
export async function retryWhenBusy<T>(job: () => Promise<T>, retries = 3, baseMs = 3000, sleep: (ms: number) => Promise<void> = wait): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await job();
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (attempt >= retries || !isServiceBusy(message)) throw err;
      await sleep(baseMs * 2 ** attempt);
    }
  }
}

/** Like Promise.allSettled, but never runs more than `limit` jobs at once. Results keep the jobs' order. */
export async function settleLimited<T>(jobs: (() => Promise<T>)[], limit: number): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(jobs.length);
  let next = 0;
  const worker = async () => {
    while (next < jobs.length) {
      const i = next++;
      try {
        results[i] = { status: "fulfilled", value: await jobs[i]() };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, jobs.length)) }, worker));
  return results;
}
