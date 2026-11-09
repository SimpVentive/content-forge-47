import { useEffect, useMemo, useState } from "react";
import { Check, Loader2, Upload } from "lucide-react";
import { toast } from "sonner";

import {
  REQUIRED_SLOTS,
  PHOTO_SLOTS,
  alignmentError,
  landmarksOf,
  releaseFaceLandmarker,
  measure,
  reviewPhoto,
  type Metrics,
  type PhotoSlot,
  type Pt,
} from "@/lib/facePhotos";

// Photos farther apart than this (relative to face height) are rejected: the head moved too much to line up.
const ALIGN_LIMIT = 0.04;

const SLOT_INFO: Record<PhotoSlot, { title: string; instruction: string; example: string; required: boolean }> = {
  closed: { title: "Mouth closed", instruction: "Relaxed, natural, lips together.", example: "Neutral face, lips closed. This is the base photo for every other slot.", required: true },
  eh: { title: "Mouth slightly open", instruction: "As if saying 'eh'. Lips apart a little.", example: "Lips parted a little, teeth together.", required: true },
  ah: { title: "Mouth fully open", instruction: "As if saying 'ah'. Top teeth visible.", example: "Mouth wide open, top teeth showing.", required: true },
  blink: { title: "Eyes closed", instruction: "Close your eyes fully, as if blinking.", example: "Both eyes closed, the face otherwise unchanged.", required: true },
  oo: { title: "Lips rounded (optional)", instruction: "As if saying 'oo'. Lips rounded, mouth narrower.", example: "Lips pushed forward and rounded.", required: false },
};

export type SlotAnalysis = {
  /** True when every required slot is present and passes the checks. */
  ready: boolean;
  photos: Partial<Record<PhotoSlot, { file: File; bitmap: ImageBitmap; pts: Pt[]; metrics: Metrics }>>;
};

type Props = {
  onAnalysis: (analysis: SlotAnalysis) => void;
};

type Slot = {
  file: File;
  preview: string;
  bitmap: ImageBitmap;
  pts: Pt[];
  metrics: Metrics;
  alignError: number | null;
};

export function PhotoSlotsStep({ onAnalysis }: Props) {
  const [slots, setSlots] = useState<Partial<Record<PhotoSlot, Slot>>>({});
  const [busy, setBusy] = useState<PhotoSlot | null>(null);
  const [loadingModel, setLoadingModel] = useState(false);

  const closed = slots.closed;

  // The face model is only needed on this screen: free it when the step closes.
  useEffect(() => () => { void releaseFaceLandmarker(); }, []);

  // Feedback for each photo, compared with the closed photo.
  const feedback = useMemo(() => {
    const out: Partial<Record<PhotoSlot, string[]>> = {};
    if (!closed) return out;
    for (const slot of PHOTO_SLOTS) {
      const s = slots[slot];
      if (!s) continue;
      if (slot === "closed") {
        out[slot] = reviewPhoto("closed", s.metrics, s.metrics);
        continue;
      }
      const messages = reviewPhoto(slot, s.metrics, closed.metrics);
      if (s.alignError !== null && s.alignError / closed.metrics.faceH > ALIGN_LIMIT) {
        messages.push("The head moved too much from the closed photo. Keep the same spot, distance and angle.");
      }
      out[slot] = messages;
    }
    return out;
  }, [slots, closed]);

  const ready = REQUIRED_SLOTS.every((slot) => {
    const s = slots[slot];
    if (!s) return false;
    if (slot === "closed") return true;
    return closed !== undefined && (feedback[slot]?.length ?? 1) === 0;
  });

  useEffect(() => {
    const photos: SlotAnalysis["photos"] = {};
    for (const slot of PHOTO_SLOTS) {
      const s = slots[slot];
      if (s) photos[slot] = { file: s.file, bitmap: s.bitmap, pts: s.pts, metrics: s.metrics };
    }
    onAnalysis({ ready, photos });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, ready]);

  async function choose(slot: PhotoSlot, file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) && !/\.(png|jpe?g|webp)$/i.test(file.name)) return toast.error("Use a JPG, PNG or WebP photo");
    if (file.size > 12 * 1024 * 1024) return toast.error("Each photo must be under 12 MB");
    setBusy(slot);
    setLoadingModel(true);
    try {
      const bitmap = await createImageBitmap(file);
      const pts = await landmarksOf(bitmap);
      const metrics = measure(pts);
      if (slot !== "closed" && closed) {
        const err = alignmentError(pts, closed.pts);
        setSlots((prev) => ({ ...prev, [slot]: { file, preview: URL.createObjectURL(file), bitmap, pts, metrics, alignError: err } }));
      } else {
        setSlots((prev) => ({ ...prev, [slot]: { file, preview: URL.createObjectURL(file), bitmap, pts, metrics, alignError: null } }));
      }
      if (slot === "closed") {
        // Re-check the other photos against the new base photo.
        setSlots((prev) => {
          const next = { ...prev };
          for (const other of PHOTO_SLOTS) {
            const s = next[other];
            if (other !== "closed" && s) next[other] = { ...s, alignError: alignmentError(s.pts, pts) };
          }
          return next;
        });
      }
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
      setLoadingModel(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
        <p className="font-semibold">Put your phone on a stand.</p>
        <p className="mt-1">Sit in the same spot, in the same light, and don't move your head between shots. Take all the photos within one minute. The app checks each photo against the closed one and tells you what to change.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {PHOTO_SLOTS.map((slot) => {
          const info = SLOT_INFO[slot];
          const s = slots[slot];
          const messages = feedback[slot] ?? [];
          const passed = s && messages.length === 0 && (slot === "closed" ? true : closed !== undefined);
          return (
            <div key={slot} className="space-y-2 rounded-lg border p-3">
              <div className="flex items-center justify-between">
                <p className="text-[13px] font-semibold">{info.title}{info.required ? "" : " · optional"}</p>
                {passed ? <Check className="h-4 w-4 text-emerald-600" /> : null}
              </div>
              <p className="text-[11px] text-muted-foreground">{info.instruction}</p>
              <div className="flex gap-3">
                <div className="flex aspect-square w-24 items-center justify-center overflow-hidden rounded-md border bg-muted">
                  {s ? <img src={s.preview} alt={info.title} className="h-full w-full object-cover" /> : <span className="px-1 text-center text-[10px] text-muted-foreground">{info.example}</span>}
                </div>
                <div className="flex flex-col justify-between gap-2">
                  <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[12px] hover:bg-muted">
                    {busy === slot ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {s ? "Replace" : "Choose photo"}
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => choose(slot, e.target.files?.[0])} />
                  </label>
                  {loadingModel && busy === slot ? <p className="text-[10px] text-muted-foreground">Checking the face…</p> : null}
                </div>
              </div>
              {messages.length ? (
                <ul className="list-disc space-y-0.5 pl-4 text-[11px] text-red-700">
                  {messages.map((m) => <li key={m}>{m}</li>)}
                </ul>
              ) : null}
              {s && slot !== "closed" && !closed ? <p className="text-[11px] text-muted-foreground">Add the closed-mouth photo first, so this one can be checked against it.</p> : null}
            </div>
          );
        })}
      </div>

      <p className="text-[12px] text-muted-foreground">
        {ready ? "All required photos pass. You can continue." : "Add the four required photos (closed, slightly open, fully open, eyes closed) and fix any notes to continue."}
      </p>
    </div>
  );
}
