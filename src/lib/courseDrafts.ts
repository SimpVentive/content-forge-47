import type { CourseParameters } from "@/components/contentforge/CourseParametersDialog";
import type { OutputData, RawAgentOutputs } from "@/types/agents";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface CourseDraft {
  id: string;
  title: string;
  inputText: string;
  courseParams: CourseParameters | null;
  workflowClips: any[];
  rawOutputs: RawAgentOutputs;
  outputData: OutputData;
  savedAt: string;
  /** Account that owns this course. Untagged entries are legacy browser-only drafts. */
  ownerUserId?: string;
}

const STORAGE_KEY = "contentforge.courseDrafts";
const REMOTE_TABLE = "course_drafts";

const EMPTY_RAW_OUTPUTS = {
  research: "",
  architect: "",
  writer: "",
  visual: "",
  animation: "",
  youtube: "",
  compliance: "",
  assessment: "",
  quality: "",
  voice: "",
  assembly: "",
} as RawAgentOutputs;

const EMPTY_OUTPUT_DATA = { outline: "", script: "", assessment: "", package: "" } as OutputData;

function readDrafts(): CourseDraft[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDrafts(drafts: CourseDraft[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
  } catch (err) {
    // Browser storage is only a cache; the backend copy is the source of truth.
    console.warn("Could not cache courses in this browser:", err);
  }
}

const sortNewestFirst = (drafts: CourseDraft[]) =>
  [...drafts].sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());

/** Drafts in this browser that belong to the given account (or to nobody yet). */
const visibleTo = (draft: CourseDraft, userId: string | null) =>
  !draft.ownerUserId || (userId !== null && draft.ownerUserId === userId);

async function currentUserId(): Promise<string | null> {
  try {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  } catch {
    return null;
  }
}

function toRow(draft: CourseDraft, userId: string) {
  return {
    id: draft.id,
    owner_user_id: userId,
    title: draft.title || "Untitled Course",
    input_text: draft.inputText || "",
    course_params: (draft.courseParams ?? null) as unknown as Json,
    workflow_clips: (Array.isArray(draft.workflowClips) ? draft.workflowClips : []) as unknown as Json,
    raw_outputs: (draft.rawOutputs ?? EMPTY_RAW_OUTPUTS) as unknown as Json,
    output_data: (draft.outputData ?? EMPTY_OUTPUT_DATA) as unknown as Json,
    saved_at: draft.savedAt,
  };
}

function fromRow(row: any): CourseDraft {
  return {
    id: String(row.id),
    title: row.title || "Untitled Course",
    inputText: row.input_text || "",
    courseParams: row.course_params || null,
    workflowClips: Array.isArray(row.workflow_clips) ? row.workflow_clips : [],
    rawOutputs: { ...EMPTY_RAW_OUTPUTS, ...(row.raw_outputs || {}) },
    outputData: { ...EMPTY_OUTPUT_DATA, ...(row.output_data || {}) },
    savedAt: row.saved_at || new Date().toISOString(),
    ownerUserId: row.owner_user_id,
  };
}

async function upsertRemote(draft: CourseDraft, userId: string) {
  const { error } = await supabase.from(REMOTE_TABLE).upsert(toRow(draft, userId), { onConflict: "id" });
  if (error) throw error;
}

export function listCourseDrafts(userId: string | null = null): CourseDraft[] {
  return sortNewestFirst(readDrafts().filter((d) => visibleTo(d, userId)));
}

/**
 * The signed-in person's courses. Backend copy first; any course that so far only
 * lived in this browser is uploaded to their account so it shows on every device.
 */
export async function listCourseDraftsCloudFirst(): Promise<CourseDraft[]> {
  const userId = await currentUserId();
  if (!userId) return listCourseDrafts(null);

  const { data, error } = await supabase
    .from(REMOTE_TABLE)
    .select("*")
    .order("saved_at", { ascending: false });

  if (error || !Array.isArray(data)) {
    console.warn("Could not load courses from the backend:", error);
    return listCourseDrafts(userId);
  }

  const remote = data.map(fromRow);
  const remoteIds = new Set(remote.map((d) => d.id));
  const all = readDrafts();
  const localOnly = all.filter((d) => visibleTo(d, userId) && !remoteIds.has(d.id));

  const uploaded: CourseDraft[] = [];
  for (const draft of localOnly) {
    const tagged = { ...draft, ownerUserId: userId };
    try {
      await upsertRemote(tagged, userId);
    } catch (err) {
      console.warn("Could not upload a browser-only course:", err);
    }
    uploaded.push(tagged);
  }

  const mine = sortNewestFirst([...remote, ...uploaded]);
  const others = all.filter((d) => d.ownerUserId && d.ownerUserId !== userId);
  writeDrafts([...others, ...mine]);
  return mine;
}

export async function getCourseDraftCloudFirst(id: string): Promise<CourseDraft | null> {
  const drafts = await listCourseDraftsCloudFirst();
  return drafts.find((d) => d.id === id) ?? null;
}

export function saveCourseDraft(draft: Omit<CourseDraft, "savedAt">): CourseDraft {
  const existing = readDrafts();
  const next: CourseDraft = {
    ...draft,
    savedAt: new Date().toISOString(),
  };

  const idx = existing.findIndex((item) => item.id === next.id);
  if (idx >= 0) {
    existing[idx] = next;
  } else {
    existing.push(next);
  }

  writeDrafts(existing);
  return next;
}

export async function saveCourseDraftCloudFirst(draft: Omit<CourseDraft, "savedAt">): Promise<CourseDraft> {
  const userId = await currentUserId();
  const local = saveCourseDraft({ ...draft, ownerUserId: userId ?? draft.ownerUserId });

  if (userId) {
    try {
      await upsertRemote(local, userId);
    } catch (err) {
      // Keep the browser copy; the next course list load retries the upload.
      console.warn("Failed to save course to the backend:", err);
    }
  }

  return local;
}

export function deleteCourseDraft(id: string) {
  const existing = readDrafts();
  writeDrafts(existing.filter((item) => item.id !== id));
}

export async function deleteCourseDraftCloudFirst(id: string) {
  deleteCourseDraft(id);
  const { error } = await supabase.from(REMOTE_TABLE).delete().eq("id", id);
  if (error) console.warn("Could not delete course from the backend:", error);
}

export function createDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
