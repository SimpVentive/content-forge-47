import type { CourseParameters } from "@/components/contentforge/CourseParametersDialog";
import type { OutputData, RawAgentOutputs } from "@/types/agents";

export interface CourseDraft {
  id: string;
  title: string;
  inputText: string;
  courseParams: CourseParameters | null;
  workflowClips: any[];
  rawOutputs: RawAgentOutputs;
  outputData: OutputData;
  savedAt: string;
}

const STORAGE_KEY = "contentforge.courseDrafts";
const REMOTE_TABLE = "course_drafts";

function getRemoteConfig() {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  if (!supabaseUrl || !supabaseKey) return null;
  return { supabaseUrl, supabaseKey };
}

async function remoteFetch(path: string, init?: RequestInit) {
  const cfg = getRemoteConfig();
  if (!cfg) throw new Error("Supabase config missing");

  const response = await fetch(`${cfg.supabaseUrl}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: cfg.supabaseKey,
      Authorization: `Bearer ${cfg.supabaseKey}`,
      "Content-Type": "application/json",
      Prefer: "return=representation",
      ...(init?.headers || {}),
    },
  });

  if (!response.ok) {
    const details = await response.text();
    throw new Error(details || `Remote draft request failed (${response.status})`);
  }

  return response;
}

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
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(drafts));
}

export function listCourseDrafts(): CourseDraft[] {
  return readDrafts().sort((a, b) => new Date(b.savedAt).getTime() - new Date(a.savedAt).getTime());
}

export async function listCourseDraftsCloudFirst(): Promise<CourseDraft[]> {
  try {
    const response = await remoteFetch(`${REMOTE_TABLE}?select=*&order=saved_at.desc`);
    const rows = await response.json();
    if (!Array.isArray(rows)) return listCourseDrafts();

    const mapped = rows.map((row: any) => ({
      id: String(row.id),
      title: row.title || "Untitled Course",
      inputText: row.input_text || "",
      courseParams: row.course_params || null,
      workflowClips: Array.isArray(row.workflow_clips) ? row.workflow_clips : [],
      rawOutputs: row.raw_outputs || {
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
      },
      outputData: row.output_data || { outline: "", script: "", assessment: "", package: "" },
      savedAt: row.saved_at || new Date().toISOString(),
    })) as CourseDraft[];

    writeDrafts(mapped);
    return mapped;
  } catch {
    return listCourseDrafts();
  }
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
  const local = saveCourseDraft(draft);

  try {
    await remoteFetch(REMOTE_TABLE, {
      method: "POST",
      body: JSON.stringify([
        {
          id: local.id,
          title: local.title,
          input_text: local.inputText,
          course_params: local.courseParams,
          workflow_clips: local.workflowClips,
          raw_outputs: local.rawOutputs,
          output_data: local.outputData,
          saved_at: local.savedAt,
        },
      ]),
      headers: {
        Prefer: "resolution=merge-duplicates,return=representation",
      },
    });
  } catch {
    // Keep local version when remote table/RLS is unavailable.
  }

  return local;
}

export function deleteCourseDraft(id: string) {
  const existing = readDrafts();
  writeDrafts(existing.filter((item) => item.id !== id));
}

export async function deleteCourseDraftCloudFirst(id: string) {
  deleteCourseDraft(id);
  try {
    await remoteFetch(`${REMOTE_TABLE}?id=eq.${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
  } catch {
    // Keep local delete even if remote is unavailable.
  }
}

export function createDraftId(): string {
  return `draft_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}
