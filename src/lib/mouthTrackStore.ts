// Saves each narration's mouth track, keyed by a hash of the audio bytes, so a track is measured once and
// reused by the app and the SCORM export. The track is recomputed only when the audio itself changes.
import { computeMouthTrackFromAudio } from "@/lib/mouthTrack";

const STORAGE_KEY = "contentforge.mouthTracks.v1";
const MAX_ENTRIES = 200;
const memory = new Map<string, string>();

function fnv1a(bytes: Uint8Array): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i];
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(16).padStart(8, "0") + "-" + bytes.length.toString(16);
}

function readStore(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

function writeStore(entries: Record<string, string>) {
  try {
    const keys = Object.keys(entries);
    const trimmed = keys.length > MAX_ENTRIES ? Object.fromEntries(keys.slice(-MAX_ENTRIES).map((k) => [k, entries[k]])) : entries;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(trimmed));
  } catch {
    // Storage can be unavailable (private window); the in-memory copy still works.
  }
}

/** The mouth track for this narration audio: from the saved copy if the audio is unchanged, otherwise measured and saved. */
export async function mouthTrackForAudio(bytes: ArrayBuffer): Promise<string | null> {
  const key = fnv1a(new Uint8Array(bytes));
  const known = memory.get(key) ?? readStore()[key];
  if (known) {
    memory.set(key, known);
    return known;
  }
  const track = await computeMouthTrackFromAudio(bytes);
  if (track) {
    memory.set(key, track);
    writeStore({ ...readStore(), [key]: track });
  }
  return track;
}
