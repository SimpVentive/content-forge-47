import { beforeEach, describe, expect, it, vi } from "vitest";

const remoteRows: any[] = [];
const upserts: any[] = [];

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getSession: vi.fn(async () => ({ data: { session: { user: { id: "user-a" } } } })) },
    from: vi.fn(() => ({
      select: () => ({ order: async () => ({ data: remoteRows, error: null }) }),
      upsert: async (row: any) => {
        upserts.push(row);
        return { error: null };
      },
      delete: () => ({ eq: async () => ({ error: null }) }),
    })),
  },
}));

import { listCourseDraftsCloudFirst } from "@/lib/courseDrafts";

const draft = (id: string, ownerUserId?: string) => ({
  id,
  title: id,
  inputText: "",
  courseParams: null,
  workflowClips: [],
  rawOutputs: {},
  outputData: { outline: "", script: "", assessment: "", package: "" },
  savedAt: "2026-11-01T00:00:00.000Z",
  ...(ownerUserId ? { ownerUserId } : {}),
});

describe("My Courses list", () => {
  beforeEach(() => {
    remoteRows.length = 0;
    upserts.length = 0;
    localStorage.clear();
  });

  it("shows courses saved to the signed-in account", async () => {
    remoteRows.push({ id: "cloud-1", title: "Cloud course", owner_user_id: "user-a", saved_at: "2026-11-02T00:00:00.000Z" });
    const list = await listCourseDraftsCloudFirst();
    expect(list.map((d) => d.id)).toEqual(["cloud-1"]);
  });

  it("uploads courses that only existed in this browser to the account", async () => {
    localStorage.setItem("contentforge.courseDrafts", JSON.stringify([draft("browser-only")]));
    const list = await listCourseDraftsCloudFirst();
    expect(list.map((d) => d.id)).toEqual(["browser-only"]);
    expect(upserts.map((r) => [r.id, r.owner_user_id])).toEqual([["browser-only", "user-a"]]);
  });

  it("never shows another account's courses cached in this browser", async () => {
    localStorage.setItem("contentforge.courseDrafts", JSON.stringify([draft("someone-else", "user-b")]));
    const list = await listCourseDraftsCloudFirst();
    expect(list).toEqual([]);
    expect(upserts).toEqual([]);
  });
});
