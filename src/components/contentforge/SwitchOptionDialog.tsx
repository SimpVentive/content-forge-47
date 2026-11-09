import { useState } from "react";
import { toast } from "sonner";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhotoSlotsStep, type SlotAnalysis } from "@/components/contentforge/PhotoSlotsStep";
import { useAuth } from "@/hooks/useAuth";
import { setTrainerFields, uploadTrainerFile, type CustomTrainer } from "@/lib/customTrainers";
import { composeSlot, type PhotoSlot } from "@/lib/facePhotos";

type Props = {
  trainer: CustomTrainer | null;
  onOpenChange: (open: boolean) => void;
  onSwitched: () => void;
};

/** Changes how an existing custom trainer comes alive: Option 1 (one photo and video) or Option 2 (five photos). */
export function SwitchOptionDialog({ trainer, onOpenChange, onSwitched }: Props) {
  const { user } = useAuth();
  const [target, setTarget] = useState<"video" | "photos" | null>(null);
  const [analysis, setAnalysis] = useState<SlotAnalysis>({ ready: false, photos: {} });
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");

  const current = trainer?.animation_mode ?? "video";

  async function save() {
    if (!trainer || !user || !target) return;
    setBusy(true);
    try {
      if (target === "video") {
        // Option 1 needs the trainer's single photo and a video render; the existing photo stays in place.
        await setTrainerFields(trainer.id, { animation_mode: "video" });
      } else {
        const closed = analysis.photos.closed;
        if (!closed) throw new Error("The closed-mouth photo is missing");
        setProgress("Lining up your photos…");
        const closedExt = closed.file.name.split(".").pop()?.toLowerCase() || "png";
        const closedPath = await uploadTrainerFile(user.id, trainer.id, `photos/closed.${closedExt}`, closed.file);
        const photoSet: Record<string, string> = { closed: closedPath };
        for (const slot of ["eh", "ah", "blink", "oo"] as PhotoSlot[]) {
          const shot = analysis.photos[slot];
          if (!shot) continue;
          const blob = await composeSlot(closed.bitmap, closed.pts, shot.bitmap, shot.pts, slot === "blink" ? "eyes" : "mouth");
          photoSet[slot] = await uploadTrainerFile(user.id, trainer.id, `photos/${slot}.jpg`, blob);
        }
        await setTrainerFields(trainer.id, { animation_mode: "photos", photo_set: photoSet, photo_path: closedPath });
      }
      toast.success(`${trainer.name} now uses ${target === "photos" ? "Option 2 (photos)" : "Option 1 (video)"}`);
      onSwitched();
      onOpenChange(false);
    } catch (err) {
      toast.error(`Not changed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={!!trainer} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" overlayClassName="z-[10000]">
        <DialogHeader>
          <DialogTitle>Change how {trainer?.name} comes alive</DialogTitle>
          <DialogDescription>Currently: {current === "photos" ? "Option 2, five photos" : "Option 1, one photo and video"}.</DialogDescription>
        </DialogHeader>

        <div className="grid gap-3 sm:grid-cols-2">
          <button type="button" onClick={() => setTarget("video")} className={`rounded-xl border p-3 text-left ${target === "video" ? "border-indigo-500 bg-indigo-50/40" : ""}`}>
            <p className="text-[13px] font-semibold">Option 1: one photo and video</p>
            <p className="mt-1 text-[11px] text-slate-600">Video engine animation. Costs video credits per minute of narration.</p>
          </button>
          <button type="button" onClick={() => setTarget("photos")} className={`rounded-xl border p-3 text-left ${target === "photos" ? "border-indigo-500 bg-indigo-50/40" : ""}`}>
            <p className="text-[13px] font-semibold">Option 2: five photos</p>
            <p className="mt-1 text-[11px] text-slate-600">Our animation from your photos. No video cost.</p>
          </button>
        </div>

        {target === "photos" ? (
          <div className="mt-3">
            <PhotoSlotsStep onAnalysis={setAnalysis} />
          </div>
        ) : null}

        <DialogFooter>
          {progress ? <p className="mr-auto self-center text-[12px] text-muted-foreground">{progress}</p> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={save} disabled={busy || !target || (target === "photos" && !analysis.ready) || target === current}>
            {busy ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
