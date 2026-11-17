import { describe, expect, it } from "vitest";

import {
  base64Url,
  clampVoiceSettings,
  clipsPrefix,
  cachePrefix,
  constantTimeEqual,
  costFromReport,
  isClaimToken,
  isKnownOp,
  isUuid,
  LINK_TTL_SECONDS,
  outputPaths,
  safeName,
  sanitizeMessage,
  STALE_MINUTES,
} from "../../supabase/functions/worker-gateway/paths";

const OWNER = "11111111-1111-4111-8111-111111111111";
const TRAINER = "22222222-2222-4222-8222-222222222222";
const JOB = "33333333-3333-4333-8333-333333333333";

describe("worker gateway: fixed rules", () => {
  it("marks a job stale after 45 minutes and signs links for at most an hour", () => {
    expect(STALE_MINUTES).toBe(45);
    expect(LINK_TTL_SECONDS).toBeLessThanOrEqual(3600);
  });

  it("accepts only the seven operations", () => {
    for (const op of ["claim", "inputs", "links_download", "links_upload", "progress", "complete", "fail"]) {
      expect(isKnownOp(op)).toBe(true);
    }
    for (const op of ["select", "query", "storage", "delete", "", "CLAIM", "claim ", undefined, 42]) {
      expect(isKnownOp(op)).toBe(false);
    }
  });
});

describe("ids and claim tokens", () => {
  it("accepts UUIDs and rejects anything else", () => {
    expect(isUuid(JOB)).toBe(true);
    for (const bad of ["", "not-a-uuid", `${JOB}x`, "../" + JOB, JOB.toUpperCase().replace(/-/g, "_"), null, 7]) {
      expect(isUuid(bad)).toBe(false);
    }
  });

  it("accepts a 43-character base64url token and rejects other shapes", () => {
    const token = base64Url(new Uint8Array(32).fill(7));
    expect(token).toHaveLength(43);
    expect(isClaimToken(token)).toBe(true);
    for (const bad of [token.slice(0, 42), token + "A", token.slice(0, 10) + "/" + token.slice(11), token + "=", "", null]) {
      expect(isClaimToken(bad)).toBe(false);
    }
  });
});

describe("file names the worker may ask about", () => {
  it("accepts ordinary names", () => {
    for (const ok of ["harish-base-01.mp4", "run_report.json", "piece-0dcb2867eb514a57b6c8.mp4", "a.b.c", "X-1_2"]) {
      expect(safeName(ok)).toBe(ok);
    }
  });

  it("refuses path tricks, separators, dots and odd characters", () => {
    const bad = [
      "../secret.mp4", "..", ".", ".hidden", "a/b.mp4", "a\\b.mp4", "/etc/passwd", "..%2Fsecret.mp4", "%2e%2e/x",
      "x\u0000y.mp4", "x\ny.mp4", "name with space.mp4", "ünicode.mp4", "", " ", "x".repeat(121), null, 5, ["a.mp4"],
    ];
    for (const name of bad) expect(safeName(name)).toBeNull();
  });

  it("allows names of exactly 120 characters and refuses 121", () => {
    expect(safeName("a".repeat(120))).toBe("a".repeat(120));
    expect(safeName("a".repeat(121))).toBeNull();
  });
});

describe("paths are built only from the job's ids", () => {
  it("builds the clip, cache and output paths the storage layout uses", () => {
    expect(clipsPrefix(OWNER, TRAINER)).toBe(`${OWNER}/${TRAINER}/clips`);
    expect(cachePrefix(OWNER, TRAINER)).toBe(`${OWNER}/${TRAINER}/cache`);
    expect(outputPaths(OWNER, JOB)).toEqual({
      final: `${OWNER}/${JOB}/final.mp4`,
      proof: `${OWNER}/${JOB}/proof.mp4`,
      report: `${OWNER}/${JOB}/run_report.json`,
    });
  });
});

describe("messages stored on a job", () => {
  it("removes links and token-like strings", () => {
    const text = sanitizeMessage("failed at https://x.supabase.co/object/sign/a?token=abcdefghijklmnopqrstuvwxyz0123456789", 300);
    expect(text).not.toMatch(/https?:/);
    expect(text).not.toMatch(/token=/);
    expect(text).toContain("[link removed]");
  });

  it("removes control characters and collapses spaces", () => {
    expect(sanitizeMessage("line one\nline\u0000two\t\tthree", 300)).toBe("line one line two three");
  });

  it("truncates to the limit and falls back to a fixed text when empty", () => {
    expect(sanitizeMessage("word ".repeat(100), 300)).toHaveLength(300);
    expect(sanitizeMessage("x".repeat(500), 300)).toBe("[removed]");
    expect(sanitizeMessage("   ", 300)).toBe("Generation stopped.");
    expect(sanitizeMessage(undefined, 300)).toBe("Generation stopped.");
  });
});

describe("comparing the worker pass", () => {
  it("is true only for identical strings", () => {
    expect(constantTimeEqual("abc", "abc")).toBe(true);
    expect(constantTimeEqual("abc", "abd")).toBe(false);
    expect(constantTimeEqual("abc", "abcd")).toBe(false);
    expect(constantTimeEqual("", "")).toBe(true);
  });
});

describe("voice settings sent to the worker", () => {
  it("clamps stability and style into the approved ranges", () => {
    const s = clampVoiceSettings({ stability: 0.9, style: 0.0 });
    expect(s.stability).toBe(0.5);
    expect(s.style).toBe(0.2);
    expect(s.similarity_boost).toBe(0.75);
    expect(s.use_speaker_boost).toBe(true);
  });

  it("uses the defaults for missing, non-numeric or NaN values", () => {
    expect(clampVoiceSettings(null)).toMatchObject({ stability: 0.5, style: 0.3 });
    expect(clampVoiceSettings({ stability: "x", style: true })).toMatchObject({ stability: 0.5, style: 0.3 });
    expect(clampVoiceSettings({ stability: Number.NaN, style: 0.35 })).toMatchObject({ stability: 0.5, style: 0.35 });
  });
});

describe("cost in the run report", () => {
  it("accepts a sensible total and refuses anything else", () => {
    expect(costFromReport({ costs: { total_usd: 0.2 } })).toBe(0.2);
    expect(costFromReport({ costs: { total_usd: 1000 } })).toBe(1000);
    for (const bad of [{ costs: { total_usd: -1 } }, { costs: { total_usd: 1001 } }, { costs: { total_usd: "0.2" } }, {}, null]) {
      expect(costFromReport(bad)).toBeNull();
    }
  });
});
