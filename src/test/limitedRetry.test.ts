import { describe, expect, it } from "vitest";
import { isServiceBusy, retryWhenBusy, settleLimited } from "@/lib/limitedRetry";

const noWait = async () => {};

describe("isServiceBusy", () => {
  it("treats the picture service's low-credit rate limit as busy, and a refused photo as not busy", () => {
    expect(isServiceBusy('The image service refused the request (HTTP 429): {"detail":"Rate limited: your credit balance is low."}')).toBe(true);
    expect(isServiceBusy("Request Moderated")).toBe(false);
  });
});

describe("retryWhenBusy", () => {
  it("retries a busy failure and returns the later success", async () => {
    let calls = 0;
    const value = await retryWhenBusy(async () => {
      calls++;
      if (calls < 3) throw new Error("HTTP 429 rate limited");
      return "picture";
    }, 3, 1, noWait);
    expect(value).toBe("picture");
    expect(calls).toBe(3);
  });

  it("does not retry a non-busy failure", async () => {
    let calls = 0;
    await expect(retryWhenBusy(async () => { calls++; throw new Error("Request Moderated"); }, 3, 1, noWait)).rejects.toThrow("Request Moderated");
    expect(calls).toBe(1);
  });

  it("gives up after the allowed retries", async () => {
    let calls = 0;
    await expect(retryWhenBusy(async () => { calls++; throw new Error("HTTP 429"); }, 2, 1, noWait)).rejects.toThrow("HTTP 429");
    expect(calls).toBe(3);
  });
});

describe("settleLimited", () => {
  it("never runs more than the limit at once and keeps result order", async () => {
    let running = 0;
    let peak = 0;
    const jobs = [1, 2, 3, 4].map((n) => async () => {
      running++;
      peak = Math.max(peak, running);
      await new Promise((r) => setTimeout(r, 5));
      running--;
      if (n === 3) throw new Error("no");
      return n;
    });
    const results = await settleLimited(jobs, 2);
    expect(peak).toBe(2);
    expect(results.map((r) => r.status)).toEqual(["fulfilled", "fulfilled", "rejected", "fulfilled"]);
    expect((results[3] as PromiseFulfilledResult<number>).value).toBe(4);
  });
});
