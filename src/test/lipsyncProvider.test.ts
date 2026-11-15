import { describe, expect, it } from "vitest";

import config from "../../supabase/functions/_shared/lipsync-provider.json";
import cases from "../../tools/fixtures/lipsync_billing_cases.json";
import * as server from "../../supabase/functions/_shared/module-jobs";
import * as app from "@/lib/moduleJobs";

// The Python worker (tools/make_module.py) is checked against the same fixture in tools/test_lipsync_provider.py.
const words = (n: number) => Array.from({ length: n }, () => "word").join(" ");

describe("lip-sync provider config", () => {
  it("the server and the app read the same provider", () => {
    expect(server.LIPSYNC_PROVIDER).toEqual(config);
    expect(app.LIPSYNC_PROVIDER).toEqual(config);
  });
});

describe("billing per clip", () => {
  it.each(cases.billing)("bills $seconds s as $usd (server and app)", ({ seconds, usd }) => {
    expect(server.billedUsd(seconds)).toBeCloseTo(usd, 4);
    expect(app.billedUsd(seconds)).toBeCloseTo(usd, 4);
  });
});

describe("estimates", () => {
  it.each(cases.estimates)("a $words-word script estimates $usd (server and app)", ({ words: n, usd }) => {
    expect(server.estimateUsd(words(n))).toBeCloseTo(usd, 2);
    expect(app.estimateUsd(words(n))).toBeCloseTo(usd, 2);
  });

  it("the server and the app agree across a range of scripts", () => {
    for (let n = 0; n <= 2000; n += 37) {
      expect(server.estimateUsd(words(n))).toBeCloseTo(app.estimateUsd(words(n)), 6);
    }
  });
});
