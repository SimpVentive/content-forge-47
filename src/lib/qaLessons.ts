import { supabase } from "@/integrations/supabase/client";

/**
 * Lessons the course builder learns from Final QA.
 *
 * Final QA writes each problem it finds as a general rule ("Every lesson ends with a complete sentence").
 * Rules are stored per account, counted every time QA finds them again, and marked as confirmed when the
 * author accepts the fixes or dismissed when the author skips them. The strongest rules are added to every
 * agent's instructions on the next generation, so the same mistake is not made twice.
 */

export type QaLessonSection = "script" | "assessment" | "visual" | "overall";

export interface QaLesson {
  lessonKey: string;
  lesson: string;
  category: string;
  section: QaLessonSection;
  timesSeen: number;
  timesConfirmed: number;
  timesDismissed: number;
  lastSeenAt: string;
}

export interface QaLessonInput {
  lesson?: string | null;
  category?: string;
  severity?: string;
  location?: string;
}

const TABLE = "qa_lessons";
/** How many lessons are added to the agents' instructions. */
export const MAX_PROMPT_LESSONS = 8;
/** Lessons kept per account; the weakest and oldest are removed beyond this. */
export const MAX_STORED_LESSONS = 60;
const MIN_LESSON_CHARS = 15;
const MAX_LESSON_CHARS = 240;
const LEARNED_SEVERITIES = new Set(["critical", "high", "medium"]);
const LEGACY_BROWSER_KEY = "contentforge.qaLessons.v1";

/** Same rule written with different punctuation or capitals counts as one lesson. */
export function lessonKey(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 160);
}

/** Only general, reusable rules are learned; empty, tiny or essay-length text is not a rule. */
export function cleanLesson(text: string | null | undefined): string | null {
  const lesson = String(text ?? "").replace(/\s+/g, " ").trim();
  if (lesson.length < MIN_LESSON_CHARS || lesson.length > MAX_LESSON_CHARS) return null;
  if (/^(n\/?a|none|null)$/i.test(lesson)) return null;
  return lesson;
}

export function sectionOf(location?: string): QaLessonSection {
  const text = (location || "").toLowerCase();
  if (/assess|quiz|question/.test(text)) return "assessment";
  if (/visual|image|svg|infographic|storyboard/.test(text)) return "visual";
  if (/script|lesson|module|content|narrat/.test(text)) return "script";
  return "overall";
}

/** Accepted fixes weigh most; skipped fixes count against a lesson. */
export function lessonScore(l: Pick<QaLesson, "timesSeen" | "timesConfirmed" | "timesDismissed">): number {
  return l.timesConfirmed * 3 + l.timesSeen - l.timesDismissed * 2;
}

export function rankLessons(lessons: QaLesson[], limit = MAX_PROMPT_LESSONS): QaLesson[] {
  return lessons
    // A single unconfirmed finding is not a lesson yet: it must be accepted once, or found again.
    .filter((l) => lessonScore(l) > 0 && (l.timesConfirmed >= 1 || l.timesSeen >= 2))
    .sort((a, b) => lessonScore(b) - lessonScore(a) || b.lastSeenAt.localeCompare(a.lastSeenAt))
    .slice(0, limit);
}

export function lessonsPromptBlock(lessons: QaLesson[]): string {
  const ranked = rankLessons(lessons);
  if (!ranked.length) return "";
  const lines = ranked.map((l) => `- [${l.section}] ${l.lesson}`).join("\n");
  return `\n\nLESSONS LEARNED FROM EARLIER QUALITY CHECKS. These are general rules from problems found and fixed before. Follow every one:\n${lines}`;
}

/** Turns QA findings into lessons worth remembering (one per rule, medium severity or worse). */
export function lessonsFromIssues(issues: QaLessonInput[]): Array<Pick<QaLesson, "lessonKey" | "lesson" | "category" | "section">> {
  const seen = new Set<string>();
  const out: Array<Pick<QaLesson, "lessonKey" | "lesson" | "category" | "section">> = [];
  for (const issue of issues) {
    if (!LEARNED_SEVERITIES.has(String(issue.severity || "medium"))) continue;
    const lesson = cleanLesson(issue.lesson);
    if (!lesson) continue;
    const key = lessonKey(lesson);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push({ lessonKey: key, lesson, category: issue.category || "completeness", section: sectionOf(issue.location) });
  }
  return out;
}

/** Applies one QA run to the stored lessons: found again, accepted, or skipped. Pure so it can be tested. */
export function mergeLessons(
  existing: QaLesson[],
  found: Array<Pick<QaLesson, "lessonKey" | "lesson" | "category" | "section">>,
  outcome: "seen" | "confirmed" | "dismissed",
  now = new Date().toISOString(),
): QaLesson[] {
  const byKey = new Map(existing.map((l) => [l.lessonKey, l]));
  return found.map((f) => {
    const prev = byKey.get(f.lessonKey);
    const base: QaLesson = prev ?? { ...f, timesSeen: 0, timesConfirmed: 0, timesDismissed: 0, lastSeenAt: now };
    return {
      ...base,
      lesson: f.lesson,
      category: f.category,
      section: f.section,
      timesSeen: base.timesSeen + (outcome === "seen" ? 1 : 0),
      timesConfirmed: base.timesConfirmed + (outcome === "confirmed" ? 1 : 0),
      timesDismissed: base.timesDismissed + (outcome === "dismissed" ? 1 : 0),
      lastSeenAt: now,
    };
  });
}

// ---- Stored lessons -------------------------------------------------------

let cachedLessons: QaLesson[] = [];

/** Instructions block for the current account's lessons, as last loaded. */
export function qaLessonsBlock(): string {
  return lessonsPromptBlock(cachedLessons);
}

function fromRow(row: any): QaLesson {
  return {
    lessonKey: row.lesson_key,
    lesson: row.lesson,
    category: row.category,
    section: row.section,
    timesSeen: row.times_seen,
    timesConfirmed: row.times_confirmed,
    timesDismissed: row.times_dismissed,
    lastSeenAt: row.last_seen_at,
  };
}

async function currentUserId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user?.id ?? null;
}

/** Loads the signed-in account's lessons before a generation. Failure leaves generation working without lessons. */
export async function loadQaLessons(): Promise<QaLesson[]> {
  try {
    // The old browser-only list kept course-specific findings and leaked them into unrelated courses.
    window.localStorage.removeItem(LEGACY_BROWSER_KEY);
  } catch {
    // Browser storage can be unavailable.
  }
  try {
    const userId = await currentUserId();
    if (!userId) {
      cachedLessons = [];
      return [];
    }
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .eq("owner_user_id", userId)
      .order("last_seen_at", { ascending: false })
      .limit(MAX_STORED_LESSONS);
    if (error) throw error;
    cachedLessons = (data ?? []).map(fromRow);
    return cachedLessons;
  } catch (err) {
    console.warn("Could not load quality-check lessons:", err);
    return cachedLessons;
  }
}

let writeQueue: Promise<unknown> = Promise.resolve();

/**
 * Records a QA run's findings (outcome "seen"), or the author's decision on them ("confirmed" / "dismissed").
 * Writes run one after another so a quick Apply cannot overwrite the "seen" count still being saved.
 */
export function recordQaLessons(issues: QaLessonInput[], outcome: "seen" | "confirmed" | "dismissed"): Promise<number> {
  const next = writeQueue.then(() => writeQaLessons(issues, outcome));
  writeQueue = next.catch(() => undefined);
  return next;
}

async function writeQaLessons(issues: QaLessonInput[], outcome: "seen" | "confirmed" | "dismissed"): Promise<number> {
  const found = lessonsFromIssues(issues);
  if (!found.length) return 0;
  try {
    const userId = await currentUserId();
    if (!userId) return 0;
    const { data: existingRows, error: readError } = await supabase
      .from(TABLE)
      .select("*")
      .eq("owner_user_id", userId)
      .in("lesson_key", found.map((f) => f.lessonKey));
    if (readError) throw readError;
    const merged = mergeLessons((existingRows ?? []).map(fromRow), found, outcome);
    const { error } = await supabase.from(TABLE).upsert(
      merged.map((l) => ({
        owner_user_id: userId,
        lesson_key: l.lessonKey,
        lesson: l.lesson,
        category: l.category,
        section: l.section,
        times_seen: l.timesSeen,
        times_confirmed: l.timesConfirmed,
        times_dismissed: l.timesDismissed,
        last_seen_at: l.lastSeenAt,
      })),
      { onConflict: "owner_user_id,lesson_key" },
    );
    if (error) throw error;
    const mergedKeys = new Set(merged.map((l) => l.lessonKey));
    cachedLessons = [...merged, ...cachedLessons.filter((l) => !mergedKeys.has(l.lessonKey))];
    await pruneQaLessons(userId);
    return merged.length;
  } catch (err) {
    console.warn("Could not save quality-check lessons:", err);
    return 0;
  }
}

async function pruneQaLessons(userId: string): Promise<void> {
  const { data } = await supabase.from(TABLE).select("*").eq("owner_user_id", userId);
  const all = (data ?? []).map(fromRow);
  if (all.length <= MAX_STORED_LESSONS) return;
  const keep = new Set(
    [...all]
      .sort((a, b) => lessonScore(b) - lessonScore(a) || b.lastSeenAt.localeCompare(a.lastSeenAt))
      .slice(0, MAX_STORED_LESSONS)
      .map((l) => l.lessonKey),
  );
  const drop = all.filter((l) => !keep.has(l.lessonKey)).map((l) => l.lessonKey);
  if (drop.length) await supabase.from(TABLE).delete().eq("owner_user_id", userId).in("lesson_key", drop);
}
