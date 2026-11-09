import { useState } from "react";
import { Loader2, Play, Video } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  estimateCostUsd,
  estimateSeconds,
  sampleSentence,
  startTalkingClip,
  waitForClip,
  type TalkingClip,
} from "@/lib/customTrainerVideo";

type Props = {
  trainerId: string;
  trainerName: string;
  /** Narration for every screen of the course, in order. */
  narrations: string[];
  clips: Record<string, TalkingClip>;
  onClip: (text: string, clip: TalkingClip) => void;
};

/** Talking-photo video controls for a custom trainer: a 10-second test and the whole course, with cost first. */
export function TalkingVideoPanel({ trainerId, trainerName, narrations, clips, onClip }: Props) {
  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sample, setSample] = useState<TalkingClip | null>(null);

  const texts = narrations.filter((t) => t.trim());
  const pending = texts.filter((t) => clips[t]?.status !== "ready");
  const readyCount = texts.length - pending.length;
  const pendingSeconds = estimateSeconds(pending);
  const sampleText = sampleSentence(texts);

  async function generateOne(text: string, kind: "sample" | "course") {
    const started = await startTalkingClip(trainerId, text, kind);
    onClip(text, started);
    if (started.status === "ready") return started;
    const done = await waitForClip(started.id, (clip) => onClip(text, clip));
    onClip(text, done);
    return done;
  }

  async function runSample() {
    if (!sampleText) return toast.error("There is no narration text to test");
    setBusy("sample");
    setSample(null);
    try {
      const clip = await generateOne(sampleText, "sample");
      setSample(clip);
      if (clip.status === "ready") toast.success("Sample ready. Check the lip sync.");
      else toast.error(clip.error || "The sample could not be made");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
    }
  }

  async function runCourse() {
    setConfirming(false);
    setBusy("course");
    let done = 0;
    try {
      for (const text of pending) {
        setProgress(`${done + 1} of ${pending.length}`);
        const clip = await generateOne(text, "course");
        if (clip.status !== "ready") throw new Error(clip.error || "A clip could not be made. The clips already made are kept.");
        done++;
      }
      toast.success(`Talking video ready for all ${texts.length} screens`);
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setBusy(null);
      setProgress("");
    }
  }

  if (!trainerId || texts.length === 0) return null;

  return (
    <div className="mx-auto mb-3 max-w-[1280px] rounded-2xl border border-indigo-200 bg-white/95 p-4 text-[13px] text-slate-700 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Video className="h-4 w-4 text-indigo-600" />
          <p className="font-semibold text-slate-900">Talking video for {trainerName}</p>
          <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[11px] font-semibold text-indigo-700">AI-generated</span>
        </div>
        <p className="text-[12px] text-slate-500">
          {readyCount} of {texts.length} screens have video
        </p>
      </div>

      <p className="mt-2 text-[12px] text-slate-600">
        Still photo with the trainer's voice until a video exists. Videos are made once and kept, so an unchanged screen is never made again.
      </p>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" onClick={runSample} disabled={!!busy}>
          {busy === "sample" ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : <Play className="mr-1 h-3.5 w-3.5" />}
          Test 10-second sample
        </Button>

        {!confirming ? (
          <Button size="sm" onClick={() => setConfirming(true)} disabled={!!busy || pending.length === 0}>
            Generate talking video
          </Button>
        ) : (
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2">
            <span className="text-[12px] text-amber-900">
              About {Math.max(1, Math.round(pendingSeconds / 60))} min of video for {pending.length} screen{pending.length === 1 ? "" : "s"}, about ${estimateCostUsd(pendingSeconds).toFixed(2)} (estimate).
            </span>
            <Button size="sm" onClick={runCourse}>Confirm and generate</Button>
            <Button size="sm" variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
          </div>
        )}

        {busy === "course" ? <span className="text-[12px] text-slate-500">Making screen {progress}…</span> : null}
      </div>

      {sample ? (
        <div className="mt-3 flex flex-wrap items-start gap-3">
          {sample.status === "ready" && sample.video_url ? (
            <video src={sample.video_url} controls playsInline className="h-40 rounded-lg bg-black" />
          ) : (
            <p className="text-[12px] text-slate-500">
              {sample.status === "failed" ? `Sample failed: ${sample.error || "unknown error"}` : "Sample is being made. This takes a few minutes."}
            </p>
          )}
          <p className="max-w-[320px] text-[12px] text-slate-500">"{sampleText}"</p>
        </div>
      ) : null}
    </div>
  );
}
