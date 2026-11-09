// Everything a custom trainer needs inside the SCORM package: its own name, photo, voice narration and talking videos.
import { supabase } from "@/lib/supabase";
import { getCustomTrainer, signedPhotoUrl } from "@/lib/customTrainers";
import { lookupTalkingClips } from "@/lib/customTrainerVideo";

export type PackagedCustomTrainer = {
  name: string;
  voiceId: string;
  /** The photo as a data URL, so the package needs no network access for it. */
  photoDataUrl: string;
  /** Saved talking videos keyed by the screen's narration text; each file is written into the zip. */
  videos: Record<string, { file: Blob; path: string }>;
  /** Option 2: the mouth and blink photos as data URLs, so the package makes no network requests. */
  photoSprites: { slight: string; open: string; blink: string } | null;
};

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}

async function fetchBlob(url: string): Promise<Blob> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`A file for the trainer could not be downloaded (${response.status})`);
  return response.blob();
}

/** Loads the trainer's photo, voice and saved videos for the screens' narration texts. Fails if the trainer is not ready. */
export async function loadCustomTrainerForPackage(trainerId: string, narrations: string[], report: (message: string) => void): Promise<PackagedCustomTrainer> {
  const trainer = await getCustomTrainer(trainerId);
  if (!trainer) throw new Error("This custom trainer no longer exists. Choose another trainer for the course.");
  if (trainer.voice_status !== "ready" || !trainer.voice_id) throw new Error(`The voice for ${trainer.name} is not ready. Retry the voice in Course Setup before packaging.`);
  const photoUrl = await signedPhotoUrl(trainer.photo_path);
  if (!photoUrl) throw new Error(`The photo for ${trainer.name} could not be opened.`);
  report(`Including ${trainer.name}'s photo...`);
  const photoDataUrl = await blobToDataUrl(await fetchBlob(photoUrl));

  const texts = narrations.filter((text) => text.trim());
  const videos: PackagedCustomTrainer["videos"] = {};
  if (texts.length) {
    const clips = await lookupTalkingClips(trainerId, texts);
    let index = 0;
    for (const text of texts) {
      const clip = clips[text];
      if (clip?.status !== "ready" || !clip.video_url) continue;
      report(`Including the talking video for screen ${index + 1}...`);
      const file = await fetchBlob(clip.video_url);
      videos[text] = { file, path: `assets/clips/clip_${index}.mp4` };
      index++;
    }
  }
  let photoSprites: PackagedCustomTrainer["photoSprites"] = null;
  if (trainer.animation_mode === "photos" && trainer.photo_set) {
    const set = trainer.photo_set as Record<string, string>;
    const [eh, ah, blink] = await Promise.all([set.eh, set.ah, set.blink].map(async (path) => {
      const url = await signedPhotoUrl(path ?? null);
      if (!url) throw new Error(`A photo for ${trainer.name} could not be opened. Re-save the five photos.`);
      return blobToDataUrl(await fetchBlob(url));
    }));
    photoSprites = { slight: eh, open: ah, blink };
  }
  return { name: trainer.name, voiceId: trainer.voice_id, photoDataUrl, videos, photoSprites };
}

/** One screen spoken with the trainer's own voice, as a data URL. Null if the voice service fails. */
export async function narrateWithCustomVoice(text: string, voiceId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke("elevenlabs-tts", { body: { text: text.slice(0, 2500), voiceId } });
  if (error || !data?.audioBase64) return null;
  return `data:audio/mpeg;base64,${data.audioBase64}`;
}
