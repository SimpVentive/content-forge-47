import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Mic, Square, Upload, ShieldCheck } from "lucide-react";

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import {
  UPLOAD_GUIDELINES,
  VOICE_MAX_SECONDS,
  VOICE_MIN_SECONDS,
  audioDurationSeconds,
  createCustomTrainer,
  createCustomVoice,
  cropToPortrait,
  recordConsent,
  setTrainerFields,
  uploadTrainerFile,
  type CustomTrainer,
} from "@/lib/customTrainers";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (trainer: CustomTrainer) => void;
};

const AUDIO_FILE = /\.(mp3|m4a|wav|webm|ogg|oga|opus|aac|mp4)$/i;
const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const MAX_VOICE_BYTES = 50 * 1024 * 1024;

export function CustomTrainerDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [name, setName] = useState("");
  const [photoBlob, setPhotoBlob] = useState<Blob | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [voiceFile, setVoiceFile] = useState<File | null>(null);
  const [voiceSeconds, setVoiceSeconds] = useState<number | null>(null);
  const [consentRecording, setConsentRecording] = useState<Blob | null>(null);
  const [consentUrl, setConsentUrl] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState("");
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const consentSentence = `I, ${name.trim() || "[my name]"}, agree that ContentForge may create a synthetic copy of my face and voice to narrate courses I choose. I can delete it at any time.`;

  useEffect(() => {
    if (!open) {
      setName("");
      setPhotoBlob(null);
      setPhotoPreview((url) => { if (url) URL.revokeObjectURL(url); return null; });
      setVoiceFile(null);
      setVoiceSeconds(null);
      setConsentRecording(null);
      setConsentUrl((url) => { if (url) URL.revokeObjectURL(url); return null; });
      setAgreed(false);
      setProgress("");
    }
  }, [open]);

  useEffect(() => () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    if (consentUrl) URL.revokeObjectURL(consentUrl);
  }, [photoPreview, consentUrl]);

  async function handlePhoto(file: File | undefined) {
    if (!file) return;
    if (!/^image\/(jpeg|png|webp)$/.test(file.type)) return toast.error("Use a JPG, PNG or WebP photo");
    if (file.size > MAX_PHOTO_BYTES) return toast.error("The photo must be under 10 MB");
    try {
      const cropped = await cropToPortrait(file);
      setPhotoBlob(cropped);
      setPhotoPreview(URL.createObjectURL(cropped));
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function handleVoice(file: File | undefined) {
    if (!file) return;
    // Windows reports some audio files (for example .ogg) as video/*, so the extension counts too.
    if (!file.type.startsWith("audio/") && !AUDIO_FILE.test(file.name)) return toast.error("Use an audio file (MP3, M4A, WAV, WebM or OGG)");
    if (file.size > MAX_VOICE_BYTES) return toast.error("The recording must be under 50 MB");
    try {
      const seconds = await audioDurationSeconds(file);
      if (!Number.isFinite(seconds)) return toast.error("The length of this recording could not be read. Try an MP3 or WAV file.");
      if (seconds < VOICE_MIN_SECONDS || seconds > VOICE_MAX_SECONDS) {
        return toast.error(`The recording must be between ${VOICE_MIN_SECONDS / 60} and ${VOICE_MAX_SECONDS / 60} minutes (this one is ${Math.round(seconds)} s)`);
      }
      setVoiceFile(file);
      setVoiceSeconds(seconds);
    } catch (err) {
      toast.error((err as Error).message);
    }
  }

  async function startConsentRecording() {
    if (!name.trim()) return toast.error("Enter your name first, so the consent sentence reads correctly");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setConsentRecording(blob);
        setConsentUrl((old) => { if (old) URL.revokeObjectURL(old); return URL.createObjectURL(blob); });
        setRecording(false);
      };
      recorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      toast.error("Microphone access is needed to record the consent sentence");
    }
  }

  function stopConsentRecording() {
    recorderRef.current?.stop();
  }

  async function handleCreate() {
    if (!user) return toast.error("Sign in to create a trainer");
    if (!name.trim()) return toast.error("Enter a name for the trainer");
    if (!photoBlob) return toast.error("Add a front-facing photo");
    if (!voiceFile) return toast.error("Add a voice recording of 1 to 3 minutes");
    if (!consentRecording) return toast.error("Record the consent sentence");
    if (!agreed) return toast.error("Tick the consent box to continue");

    setBusy(true);
    let trainer: CustomTrainer | null = null;
    try {
      setProgress("Saving your trainer…");
      trainer = await createCustomTrainer(user.id, name);
      const photoPath = await uploadTrainerFile(user.id, trainer.id, "photo.jpg", photoBlob);
      const ext = voiceFile.name.split(".").pop()?.toLowerCase() || "audio";
      const voicePath = await uploadTrainerFile(user.id, trainer.id, `voice-sample.${ext}`, voiceFile);
      const consentPath = await uploadTrainerFile(user.id, trainer.id, "consent.webm", consentRecording);
      await setTrainerFields(trainer.id, { photo_path: photoPath, voice_sample_path: voicePath });
      await recordConsent(user.id, trainer.id, consentSentence, consentPath);

      setProgress("Creating your voice (this can take a minute)…");
      const voiceId = await createCustomVoice(trainer.id);
      const saved: CustomTrainer = { ...trainer, photo_path: photoPath, voice_sample_path: voicePath, voice_id: voiceId, voice_status: "ready" };
      toast.success("Your trainer is ready");
      onCreated(saved);
      onOpenChange(false);
    } catch (err) {
      const message = (err as Error).message;
      if (trainer) {
        toast.error(`Your trainer was saved, but the voice was not created: ${message}`);
        onCreated({ ...trainer, voice_status: "failed", voice_error: message });
      } else {
        toast.error(message);
      }
    } finally {
      setBusy(false);
      setProgress("");
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => !busy && onOpenChange(next)}>
      <DialogContent className="z-[10000] max-w-2xl max-h-[90vh] overflow-y-auto" overlayClassName="z-[10000]">
        <DialogHeader>
          <DialogTitle>Use my own photo and voice</DialogTitle>
          <DialogDescription>
            Create a trainer from your photo and a short recording of your voice. Only you can use it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-[12px] text-amber-900">
            <p className="font-semibold">Before you start</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5">
              {UPLOAD_GUIDELINES.map((g) => <li key={g}>{g}</li>)}
            </ul>
          </div>

          <div className="space-y-1.5">
            <label className="text-[13px] font-semibold">Name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={60}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="How learners will see your name"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-[160px_1fr]">
            <div className="space-y-1.5">
              <p className="text-[13px] font-semibold">Front-facing photo</p>
              <div className="flex aspect-[2/3] w-full items-center justify-center overflow-hidden rounded-lg border bg-muted">
                {photoPreview ? <img src={photoPreview} alt="Your trainer photo" className="h-full w-full object-cover" /> : <span className="px-2 text-center text-[11px] text-muted-foreground">Photo appears here (2:3)</span>}
              </div>
            </div>
            <div className="space-y-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
                <Upload className="h-4 w-4" /> Choose photo
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => handlePhoto(e.target.files?.[0])} />
              </label>
              <p className="text-[11px] text-muted-foreground">The photo is cropped to a 2:3 portrait. Your face should fill the frame from the shoulders up.</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[13px] font-semibold">Voice recording (1 to 3 minutes)</p>
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm hover:bg-muted">
              <Upload className="h-4 w-4" /> Choose recording
              <input type="file" accept=".mp3,.m4a,.wav,.webm,.ogg,.oga,.opus,.aac,.mp4,audio/*" className="hidden" onChange={(e) => handleVoice(e.target.files?.[0])} />
            </label>
            {voiceFile ? <p className="text-[12px] text-muted-foreground">{voiceFile.name} · {Math.round(voiceSeconds || 0)} s</p> : null}
          </div>

          <div className="space-y-2 rounded-lg border p-3">
            <p className="text-[13px] font-semibold">Consent</p>
            <p className="text-[13px] italic">"{consentSentence}"</p>
            <p className="text-[11px] text-muted-foreground">Read the sentence aloud and record it. This is kept as proof of your consent.</p>
            <div className="flex items-center gap-2">
              {recording ? (
                <Button type="button" variant="destructive" size="sm" onClick={stopConsentRecording}><Square className="mr-1 h-3.5 w-3.5" /> Stop</Button>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={startConsentRecording} disabled={busy}><Mic className="mr-1 h-3.5 w-3.5" /> {consentRecording ? "Record again" : "Record sentence"}</Button>
              )}
              {consentUrl && !recording ? <audio controls src={consentUrl} className="h-8" /> : null}
            </div>
            <label className="flex items-start gap-2 pt-1 text-[12px]">
              <Checkbox checked={agreed} onCheckedChange={(v) => setAgreed(v === true)} className="mt-0.5" />
              <span>I am the person in this photo and voice, and I agree to the consent above.</span>
            </label>
          </div>

          <p className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5" /> Narration made with this trainer is labelled "AI-generated". You can delete the trainer, its voice and its videos at any time.
          </p>
        </div>

        <DialogFooter>
          {progress ? <p className="mr-auto self-center text-[12px] text-muted-foreground">{progress}</p> : null}
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={busy}>Cancel</Button>
          <Button onClick={handleCreate} disabled={busy}>{busy ? "Creating…" : "Create my trainer"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
