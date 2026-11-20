import { describe, expect, it } from "vitest";
import { withTimestamp } from "@/lib/customTrainers";

describe("withTimestamp (photo uploads get a new name each time)", () => {
  it("adds the time before the extension", () => {
    expect(withTimestamp("photos/eh.jpg", 1700000000000)).toBe("photos/eh-1700000000000.jpg");
    expect(withTimestamp("photo.jpg", 5)).toBe("photo-5.jpg");
  });

  it("keeps the folder and handles a name with no extension", () => {
    expect(withTimestamp("photos/closed", 7)).toBe("photos/closed-7");
  });

  it("gives a different name for a later upload of the same file", () => {
    expect(withTimestamp("photos/eh.jpg", 1)).not.toBe(withTimestamp("photos/eh.jpg", 2));
  });
});
