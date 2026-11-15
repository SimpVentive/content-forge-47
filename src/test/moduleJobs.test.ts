import { describe, expect, it } from "vitest";
import {
  LATENTSYNC_USD_PER_PIECE,
  MAX_CONCURRENT_JOBS_PER_USER,
  canReview,
  canStartJob,
  estimateSeconds,
  estimateUsd,
  piecesFor,
  statusLabel,
  type JobStatus,
} from "@/lib/moduleJobs";

const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("piecesFor", () => {
  it("never makes a piece over 40 seconds", () => {
    expect(piecesFor(40)).toBe(1);
    expect(piecesFor(40.1)).toBe(2);
    expect(piecesFor(137.5)).toBe(4);
  });
  it("is zero for no narration", () => {
    expect(piecesFor(0)).toBe(0);
  });
});

describe("estimateUsd", () => {
  it("prices each piece at the LatentSync rate", () => {
    // 150 words is one minute: 2 pieces of up to 40 s, so 2 x $0.20.
    expect(estimateSeconds(words(150))).toBeCloseTo(60, 5);
    expect(estimateUsd(words(150))).toBeCloseTo(2 * LATENTSYNC_USD_PER_PIECE, 2);
  });
  it("is zero for an empty script", () => {
    expect(estimateUsd("   ")).toBe(0);
  });
});

describe("canStartJob", () => {
  const base = {
    estimateUsd: 1,
    capUsd: 10,
    activeJobsForUser: 0,
    consentRecorded: true,
    hasBaseClips: true,
    trainerInTeam: true,
    userRole: "creator",
  };
  it("allows a creator with consent under the cap", () => {
    expect(canStartJob(base).ok).toBe(true);
  });
  it("allows an admin", () => {
    expect(canStartJob({ ...base, userRole: "admin" }).ok).toBe(true);
  });
  it("blocks members", () => {
    expect(canStartJob({ ...base, userRole: "member" }).ok).toBe(false);
  });
  it("blocks when consent is not recorded", () => {
    const r = canStartJob({ ...base, consentRecorded: false });
    expect(r.ok).toBe(false);
  });
  it("blocks a trainer with no uploaded base clips", () => {
    expect(canStartJob({ ...base, hasBaseClips: false }).ok).toBe(false);
  });
  it("blocks a trainer from another team", () => {
    expect(canStartJob({ ...base, trainerInTeam: false }).ok).toBe(false);
  });
  it("blocks an estimate over the hard cap", () => {
    expect(canStartJob({ ...base, estimateUsd: 11, capUsd: 10 }).ok).toBe(false);
  });
  it("allows exactly the cap", () => {
    expect(canStartJob({ ...base, estimateUsd: 10, capUsd: 10 }).ok).toBe(true);
  });
  it("blocks when the user already has the maximum number of jobs running", () => {
    expect(canStartJob({ ...base, activeJobsForUser: MAX_CONCURRENT_JOBS_PER_USER }).ok).toBe(false);
    expect(canStartJob({ ...base, activeJobsForUser: MAX_CONCURRENT_JOBS_PER_USER - 1 }).ok).toBe(true);
  });
});

describe("status", () => {
  it("has a label for every status", () => {
    const all: JobStatus[] = ["queued", "generating", "ready_for_review", "failed", "published", "rejected"];
    for (const s of all) expect(statusLabel(s).length).toBeGreaterThan(0);
  });
  it("only a job ready for review can be approved or rejected", () => {
    expect(canReview("ready_for_review")).toBe(true);
    expect(canReview("queued")).toBe(false);
    expect(canReview("published")).toBe(false);
  });
});
