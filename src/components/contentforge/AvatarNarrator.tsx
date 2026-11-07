import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { getTrainerLipSyncProfile, type VisemeKey } from "@/lib/avatarTrainers";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface AvatarNarratorProps {
  topic: string;
  moduleContent: string;
  systemHint: string;
  trainerName?: string;
  avatarImageUrl?: string;
  avatarVideoUrl?: string;
  avatarPosterUrl?: string;
  trainerId?: string;
  isVoiceActive?: boolean;
  isVoiceLoading?: boolean;
  currentViseme?: VisemeKey;
  /** Language for the narrator's spoken reply (also used for the on-screen bubble). */
  narratorLanguage?: string;
}

type RequestMode = "initial" | "example";
type MouthState  = "rest" | "slight" | "open";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const CONCISE_RESPONSE_HINT = "Keep the response concise: maximum 90 words, 4 short paragraphs or fewer, and avoid repetition.";
const EXAMPLE_HINT  = `Give one vivid real-world workplace example in 2 sentences. ${CONCISE_RESPONSE_HINT}`;
const BUBBLE_BG     = "#EEEDFE";
const BUBBLE_BORDER = "#AFA9EC";
const BUBBLE_TEXT   = "#26215C";

const STREAMING_VISEME_SEQUENCE: VisemeKey[] = ["aa", "oh", "ee", "l", "mbp", "aa", "ih", "r", "oh", "aa"];

// CSS-overlay facial coordinates — exact pctX/pctY from narrator_config.json
// These are percentages of the original 1024×1536 image.
const FACE_COORDS: Record<string, { eyeLeft: { x: number; y: number }; eyeRight: { x: number; y: number }; mouth: { x: number; y: number } }> = {
  priya:      { eyeLeft: { x: 56.64, y: 27.99 }, eyeRight: { x: 43.65, y: 27.99 }, mouth: { x: 49.32, y: 35.81 } },
  arjun:      { eyeLeft: { x: 54.98, y: 26.43 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 47.66, y: 34.64 } },
  soumya:     { eyeLeft: { x: 55.66, y: 26.69 }, eyeRight: { x: 42.97, y: 26.89 }, mouth: { x: 48.63, y: 34.44 } },
  vedprakash: { eyeLeft: { x: 54.30, y: 25.59 }, eyeRight: { x: 42.68, y: 25.59 }, mouth: { x: 48.34, y: 33.33 } },
  atul:       { eyeLeft: { x: 53.71, y: 25.98 }, eyeRight: { x: 41.99, y: 25.98 }, mouth: { x: 47.36, y: 34.24 } },
  irina:      { eyeLeft: { x: 55.37, y: 26.69 }, eyeRight: { x: 42.68, y: 26.69 }, mouth: { x: 48.63, y: 34.64 } },
  john:       { eyeLeft: { x: 53.32, y: 25.98 }, eyeRight: { x: 42.29, y: 25.98 }, mouth: { x: 46.97, y: 33.79 } },
};
const DEFAULT_FACE = { eyeLeft: { x: 55, y: 27 }, eyeRight: { x: 43, y: 27 }, mouth: { x: 48.5, y: 34.5 } };

// Source image is 1024×1536 (2:3). The face layer keeps that ratio and every overlay
// is positioned in % of it, so the eyes and mouth stay on the face at any width.
const ORIG_W  = 1024, ORIG_H  = 1536;

const EYE_W = (90 / ORIG_W) * 100;   // % of face width
const EYE_H = (32 / ORIG_H) * 100;   // % of face height
// Lip size, measured on the trainer art: the dark lip line is 51–59 px wide on a 512 px image,
// and the lips are about 2.8% of the image height. Percent of the image, so the overlay
// scales with the face at any render width.
const MOUTH_LIP_W_PCT = 11.5; // % of image width
const MOUTH_LIP_H_PCT = 2.8;  // % of image height

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function buildDefaultSpeech(topic: string, moduleContent: string, trainerName: string) {
  const preview = moduleContent.trim().replace(/\s+/g, " ");
  if (!preview) return `Tap the explain icon and ${trainerName} will walk you through ${topic}.`;
  const short = preview.length > 180 ? `${preview.slice(0, 177).trimEnd()}...` : preview;
  return `Tap the explain icon and ${trainerName} will break down ${topic}. Quick preview: ${short}`;
}

/**
 * Map a viseme key → one of three mouth states used to pick the sprite PNG.
 *   rest   → mouth closed  (mbp bilabials, silence)
 *   slight → lips parted   (fricatives, liquids, glides)
 *   open   → jaw dropped   (vowels)
 */
function getVisemeMouthState(viseme: VisemeKey, isTalking: boolean): MouthState {
  if (!isTalking) return "rest";
  if (viseme === "mbp") return "rest";
  if ((["fv", "th", "l", "r", "wq", "ih"] as VisemeKey[]).includes(viseme)) return "slight";
  return "open"; // aa, ee, oh, ou, ch — and anything else while talking
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export function AvatarNarrator({
  topic, moduleContent, systemHint,
  trainerName = "Sarah",
  avatarImageUrl, avatarVideoUrl, avatarPosterUrl,
  trainerId = "priya",
  isVoiceActive, isVoiceLoading,
  currentViseme = "rest",
  narratorLanguage = "English",
}: AvatarNarratorProps) {
  const [speechText,    setSpeechText]    = useState(() => buildDefaultSpeech(topic, moduleContent, trainerName));
  const [isStreaming,   setIsStreaming]   = useState(false);
  const [hasSpoken,     setHasSpoken]     = useState(false);
  const [hasAvatarImage,setHasAvatarImage]= useState(true);
  const [videoMuted,    setVideoMuted]    = useState(true);
  const [videoPlaying,  setVideoPlaying]  = useState(true);
  const [isMouthHold,   setIsMouthHold]   = useState(false);
  const [streamingViseme, setStreamingViseme] = useState<VisemeKey>("rest");

  // Sprite readiness: null = probing, true = PNG found, false = not found → CSS fallback
  // No sprite PNGs ship with the app. The mouth is drawn (SVG) and eyes blink with a CSS lid,
  // and sprite files are never requested, so nothing is fetched from /trainers/ inside an LMS.
  const hasMouthSprite = false;
  const hasBlinkSprite = false;
  const [isBlinking,     setIsBlinking]     = useState(false);

  const avatarVideoRef          = useRef<HTMLVideoElement | null>(null);
  const abortControllerRef      = useRef<AbortController | null>(null);
  const flushIntervalRef        = useRef<number | null>(null);
  const queuedCharactersRef     = useRef<string[]>([]);
  const currentRequestRef       = useRef(0);
  const pendingCompletionRef    = useRef<RequestMode | null>(null);
  const mouthHoldTimeoutRef     = useRef<number | null>(null);
  const streamVisemeIdxRef      = useRef(0);
  const streamVisemeIntervalRef = useRef<number | null>(null);
  const blinkTimeoutRef         = useRef<number | null>(null);

  // Viseme resolution: ElevenLabs takes priority; cycling fallback while streaming
  const effectiveViseme: VisemeKey =
    (isStreaming || isMouthHold) && currentViseme === "rest" ? streamingViseme : currentViseme;

  const isTalking  = Boolean(isVoiceActive || isVoiceLoading || isStreaming || isMouthHold);
  const lipSyncProfile = getTrainerLipSyncProfile(trainerId);
  const mouthState = getVisemeMouthState(effectiveViseme, isTalking);

  const trainerInitials = trainerName
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "").join("") || "AV";

  // ──────────────────────────────────────────────────────
  // Schedules itself recursively with a random 2–6 s interval.
  // Blink lasts 140 ms. Works with a sprite PNG or is silently skipped
  // if hasBlinkSprite === false.
  const scheduleNextBlink = useCallback(() => {
    const delay = Math.random() * 4000 + 2000;
    blinkTimeoutRef.current = window.setTimeout(() => {
      setIsBlinking(true);
      window.setTimeout(() => {
        setIsBlinking(false);
        scheduleNextBlink();
      }, 140);
    }, delay);
  }, []);

  useEffect(() => {
    scheduleNextBlink();
    return () => {
      if (blinkTimeoutRef.current !== null) window.clearTimeout(blinkTimeoutRef.current);
    };
  }, [scheduleNextBlink]);

  // ── stream helpers ────────────────────────────────────────────────────────
  const clearMouthHold = () => {
    if (mouthHoldTimeoutRef.current !== null) {
      window.clearTimeout(mouthHoldTimeoutRef.current);
      mouthHoldTimeoutRef.current = null;
    }
  };

  const stopStreamViseme = () => {
    if (streamVisemeIntervalRef.current !== null) {
      window.clearInterval(streamVisemeIntervalRef.current);
      streamVisemeIntervalRef.current = null;
    }
    streamVisemeIdxRef.current = 0;
    setStreamingViseme("rest");
  };

  const startStreamViseme = () => {
    stopStreamViseme();
    streamVisemeIntervalRef.current = window.setInterval(() => {
      const idx = streamVisemeIdxRef.current % STREAMING_VISEME_SEQUENCE.length;
      setStreamingViseme(STREAMING_VISEME_SEQUENCE[idx]);
      streamVisemeIdxRef.current += 1;
    }, 110);
  };

  const stopFlushLoop = () => {
    if (flushIntervalRef.current !== null) {
      window.clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
  };

  const finalizeStream = () => {
    stopFlushLoop();
    stopStreamViseme();
    setIsStreaming(false);
    clearMouthHold();
    mouthHoldTimeoutRef.current = window.setTimeout(() => {
      setIsMouthHold(false);
      mouthHoldTimeoutRef.current = null;
    }, 1200);
    if (pendingCompletionRef.current === "initial") setHasSpoken(true);
    pendingCompletionRef.current = null;
  };

  const startFlushLoop = () => {
    stopFlushLoop();
    flushIntervalRef.current = window.setInterval(() => {
      const ch = queuedCharactersRef.current.shift();
      if (ch) { setSpeechText((t) => t + ch); return; }
      if (pendingCompletionRef.current) finalizeStream();
    }, 18);
  };

  const resetForRequest = () => {
    queuedCharactersRef.current = [];
    pendingCompletionRef.current = null;
    clearMouthHold();
    setIsMouthHold(true);
    setSpeechText("");
    setIsStreaming(true);
    startFlushLoop();
    startStreamViseme();
  };

  const handleFailure = (mode: RequestMode) => {
    queuedCharactersRef.current = [];
    pendingCompletionRef.current = null;
    clearMouthHold();
    stopFlushLoop();
    stopStreamViseme();
    setSpeechText(`Here is the key point: ${moduleContent}`);
    setIsStreaming(false);
    setIsMouthHold(false);
    if (mode === "initial") setHasSpoken(true);
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    queuedCharactersRef.current = [];
    pendingCompletionRef.current = null;
    clearMouthHold();
    stopFlushLoop();
    stopStreamViseme();
    setIsStreaming(false);
    setIsMouthHold(false);
  };

  // ── narration fetch ───────────────────────────────────────────────────────
  const runNarration = async (mode: RequestMode) => {
    if (isStreaming) return;
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;
    currentRequestRef.current += 1;
    const requestId = currentRequestRef.current;
    resetForRequest();

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-avatar`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            topic, moduleContent,
            systemHint: mode === "initial" ? `${systemHint} ${CONCISE_RESPONSE_HINT}` : EXAMPLE_HINT,
            language: narratorLanguage,
            trainerName,
          }),
          signal: controller.signal,
        }
      );
      if (!response.ok || !response.body) throw new Error(`Avatar narration failed: ${response.status}`);
      const reader  = response.body.getReader();
      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          if (requestId === currentRequestRef.current) {
            pendingCompletionRef.current = mode;
            if (queuedCharactersRef.current.length === 0) finalizeStream();
          }
          break;
        }
        if (requestId !== currentRequestRef.current) { reader.cancel(); break; }
        const chunk = decoder.decode(value, { stream: true });
        if (chunk) queuedCharactersRef.current.push(...chunk.split(""));
      }
    } catch (err) {
      if ((err as Error).name === "AbortError") return;
      if (requestId === currentRequestRef.current) handleFailure(mode);
    } finally {
      if (abortControllerRef.current === controller) abortControllerRef.current = null;
    }
  };

  // ── effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    setSpeechText(buildDefaultSpeech(topic, moduleContent, trainerName));
    setHasSpoken(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    queuedCharactersRef.current = [];
    pendingCompletionRef.current = null;
    clearMouthHold();
    stopFlushLoop();
    stopStreamViseme();
    setIsStreaming(false);
    setIsMouthHold(false);
  }, [topic, moduleContent, trainerName]);

  useEffect(() => () => {
    abortControllerRef.current?.abort();
    stopFlushLoop();
    clearMouthHold();
    stopStreamViseme();
    if (blinkTimeoutRef.current !== null) window.clearTimeout(blinkTimeoutRef.current);
  }, []);

  useEffect(() => { setHasAvatarImage(true); }, [avatarImageUrl, trainerName]);

  // The talking-head video follows the narration: it plays while the narration plays, and
  // when the narration pauses or ends it stops on the first frame (the closed-mouth pose).
  const narrationActiveRef = useRef(false);
  useEffect(() => {
    narrationActiveRef.current = Boolean(isVoiceActive);
    const v = avatarVideoRef.current;
    if (!avatarVideoUrl || !v) return;
    if (isVoiceActive) {
      v.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    } else {
      v.pause();
      v.currentTime = 0;
      setVideoPlaying(false);
    }
  }, [avatarVideoUrl, isVoiceActive]);

  // Browsers block video playback until the learner clicks. If the narration started before
  // that, the video is retried on the first click so it doesn't stay frozen mid-speech.
  useEffect(() => {
    if (!avatarVideoUrl) return;
    const resumeOnClick = () => {
      const v = avatarVideoRef.current;
      if (narrationActiveRef.current && v && v.paused) {
        v.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
      }
    };
    document.addEventListener("pointerdown", resumeOnClick);
    return () => document.removeEventListener("pointerdown", resumeOnClick);
  }, [avatarVideoUrl]);

  const toggleVideoPlayback = () => {
    const v = avatarVideoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    else { v.pause(); setVideoPlaying(false); }
  };

  const captionText = speechText.trim().replace(/\s+/g, " ").slice(0, 80);

  // ── render ────────────────────────────────────────────────────────────────
  return (
    <section className="flex w-full flex-col items-center gap-3">
      <style>{`
        @keyframes avatarNarratorEnter {
          0%   { opacity: 0; transform: translateY(14px) scale(0.96); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes bubbleGlow {
          0%, 100% { box-shadow: 0 10px 24px rgba(60,52,137,0.08); }
          50%       { box-shadow: 0 14px 32px rgba(60,52,137,0.16); }
        }
        @keyframes headTilt {
          0%,  100% { transform: scale(1.02) rotate(0deg)     translateX(0px);   }
          20%        { transform: scale(1.02) rotate(0.8deg)   translateX(1px);   }
          55%        { transform: scale(1.02) rotate(-0.5deg)  translateX(-0.5px);}
          80%        { transform: scale(1.02) rotate(0.6deg)   translateX(0.8px); }
        }
      `}</style>

      {avatarVideoUrl ? (
        /* ── video avatar ─────────────────────────────────────────────────── */
        <div
          className="relative w-full max-w-[360px] overflow-hidden rounded-[22px] border border-[#d8deea] bg-black shadow-[0_14px_30px_rgba(15,23,42,0.2)]"
          style={{ animation: "avatarNarratorEnter 420ms cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <video
            ref={avatarVideoRef} src={avatarVideoUrl} poster={avatarPosterUrl}
            className="aspect-[9/12] w-full max-h-[420px] object-cover object-top"
            playsInline muted={videoMuted} controls={false} preload="metadata"
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={() => setVideoPlaying(false)}
          />
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/35 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" /> Lip-sync mode
          </div>
          <button type="button" onClick={toggleVideoPlayback}
            className="absolute right-14 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            aria-label={videoPlaying ? "Pause" : "Play"}>
            {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button type="button" onClick={() => setVideoMuted((p) => !p)}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            aria-label={videoMuted ? "Unmute" : "Mute"}>
            {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-4 pb-4 pt-10">
            <p className="text-[20px] font-[900] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {captionText || `Explaining ${topic}`}
            </p>
          </div>
        </div>
      ) : (
        /* ── illustrated avatar — layered sprite system ───────────────────── */
        <div
          className="w-full max-w-[360px] overflow-hidden rounded-[20px] bg-white transition-all duration-300"
          style={{
            border: isTalking ? "2.5px solid #4f8ef7" : "2.5px solid #d8deea",
            boxShadow: isTalking
              ? "0 0 0 4px rgba(79,142,247,0.15), 0 12px 28px rgba(15,23,42,0.12)"
              : "0 12px 28px rgba(15,23,42,0.12)",
            animation: "avatarNarratorEnter 420ms cubic-bezier(0.22,1,0.36,1) both",
          }}
        >
          <div className="relative aspect-[3/4] w-full overflow-hidden bg-[#eef2ff]">
            {hasAvatarImage ? (
              <>
                {/*
                  Face layer — holds the base image and every overlay below. It has the
                  source image's 2:3 ratio and the head tilt is applied here, so the
                  overlays move with the face. Its bottom edge is cropped by the parent.
                */}
                <div
                  className="absolute inset-x-0 top-0 aspect-[2/3]"
                  style={{
                    transform: "scale(1.02)",
                    animation: isTalking ? "headTilt 9s ease-in-out infinite" : "none",
                    transformOrigin: "50% 71%",
                  }}
                >
                {/*
                  LAYER 0 — base head image
                  Subtle 9 s head-tilt animation gives life without being distracting.
                */}
                <img
                  src={avatarImageUrl}
                  alt={trainerName}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  onError={() => setHasAvatarImage(false)}
                />

                {/* LAYER 1b — CSS blink overlay fallback (when no sprite PNG) */}
                {hasBlinkSprite === false && (() => {
                  const face = FACE_COORDS[trainerId] || DEFAULT_FACE;
                  return (
                    <>
                      <div aria-hidden="true" className="pointer-events-none absolute" style={{
                        left: `${face.eyeLeft.x}%`, top: `${face.eyeLeft.y}%`,
                        width: `${EYE_W}%`, height: `${EYE_H}%`, borderRadius: "50%", overflow: "hidden",
                        transform: "translate(-50%, -50%)",
                      }}>
                        <div style={{
                          width: "100%", height: "100%", borderRadius: "50%",
                          background: "rgba(20,10,5,0.82)",
                          transform: isBlinking ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "top center",
                          transition: "transform 70ms ease-in",
                        }} />
                      </div>
                      <div aria-hidden="true" className="pointer-events-none absolute" style={{
                        left: `${face.eyeRight.x}%`, top: `${face.eyeRight.y}%`,
                        width: `${EYE_W}%`, height: `${EYE_H}%`, borderRadius: "50%", overflow: "hidden",
                        transform: "translate(-50%, -50%)",
                      }}>
                        <div style={{
                          width: "100%", height: "100%", borderRadius: "50%",
                          background: "rgba(20,10,5,0.82)",
                          transform: isBlinking ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "top center",
                          transition: "transform 70ms ease-in",
                        }} />
                      </div>
                    </>
                  );
                })()}
                {/*
                  LAYER 2b — CSS mouth overlay fallback (when no sprite PNG).
                  Lips and opening are sized from MOUTH_LIP_* and follow the viseme, so the mouth opens and closes with speech.
                  It sits in the same head-tilt wrapper as the face, so it moves with the head.
                */}
                {hasMouthSprite === false && (() => {
                  const face = FACE_COORDS[trainerId] || DEFAULT_FACE;
                  const shape = lipSyncProfile.visemes[effectiveViseme];
                  // 0 = closed, 1 = fully open. Vowels open the jaw; rest/mbp stay closed.
                  const openness = isTalking ? Math.min(1, Math.max(0, shape.height / 1.1)) : 0;
                  const openRy = 1.5 + 15 * openness;   // half the mouth opening, in SVG units (0–100)
                  const lipRy = openRy + 9;             // lips sit just outside the opening
                  const teethVisible = openness > 0.15;
                  const clipId = `narrator-mouth-${trainerId}`;
                  return (
                    <div aria-hidden="true" className="pointer-events-none absolute inset-0" style={{
                      animation: isTalking ? "headTilt 9s ease-in-out infinite" : "none",
                      transformOrigin: "50% 80%",
                    }}>
                      <div className="absolute" style={{
                        left: `${face.mouth.x}%`, top: `${face.mouth.y}%`,
                        width: `${MOUTH_LIP_W_PCT * shape.width}%`,
                        height: `${MOUTH_LIP_H_PCT * 3.4}%`,
                        opacity: isTalking ? 1 : 0,
                        transform: "translate(-50%, -50%)",
                        transition: "width 50ms ease-out, opacity 120ms ease-out",
                      }}>
                        <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: "100%", height: "100%", display: "block", overflow: "visible" }}>
                          <defs>
                            <clipPath id={clipId}>
                              <ellipse cx="50" cy="50" rx="42" ry={openRy} />
                            </clipPath>
                          </defs>
                          {/* Lips */}
                          <ellipse cx="50" cy="50" rx="47" ry={lipRy} fill="#A8524A" stroke="#5E2622" strokeWidth="2" vectorEffect="non-scaling-stroke" />
                          {/* Mouth interior */}
                          <ellipse cx="50" cy="50" rx="42" ry={openRy} fill="#2B0F0C" />
                          <g clipPath={`url(#${clipId})`}>
                            {/* Tongue */}
                            <ellipse cx="50" cy={50 + openRy * 0.7} rx="24" ry={openRy * 0.6} fill="#C9646D" />
                            {/* Upper teeth */}
                            <rect x="8" y={50 - openRy} width="84" height="10" fill="#FFFFFF" opacity={teethVisible ? 1 : 0} />
                            <line x1="8" x2="92" y1={50 - openRy + 10} y2={50 - openRy + 10} stroke="#B9B2A6" strokeWidth="1" vectorEffect="non-scaling-stroke" opacity={teethVisible ? 1 : 0} />
                          </g>
                        </svg>
                      </div>
                    </div>
                  );
                })()}
                </div>
              </>
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-[#3C3489]">
                {trainerInitials}
              </div>
            )}

            {/* Speaking badge */}
            <div className="absolute left-3 top-3 z-10 inline-flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <span className={cn("inline-block h-2 w-2 rounded-full", isTalking ? "bg-emerald-400" : "bg-slate-300")} />
              {isTalking ? "Speaking" : "Ready"}
            </div>

            {/* Caption bar */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-black/60 px-4 pb-4 pt-10">
              <p className="text-[20px] font-[900] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
                {captionText || `Explaining ${topic}`}
              </p>
            </div>
          </div>

          <div className="px-4 py-3">
            <p className="text-[16px] font-semibold text-foreground">{trainerName}</p>
            <p className="text-[13px] text-muted-foreground">Your learning guide</p>
          </div>
        </div>
      )}

      {/* Speech bubble */}
      <div
        className="w-full max-w-[540px] rounded-[24px] border shadow-sm overflow-hidden"
        style={{
          backgroundColor: BUBBLE_BG, borderColor: BUBBLE_BORDER,
          animation: `avatarNarratorEnter 480ms cubic-bezier(0.22,1,0.36,1) both, ${isStreaming ? "bubbleGlow 1.8s ease-in-out infinite" : "none"}`,
        }}
      >
        <div className="max-h-44 overflow-y-auto px-5 pt-4 pb-3 text-[14px] leading-7" style={{ color: BUBBLE_TEXT }}>
          <p className="whitespace-pre-wrap break-words">
            {speechText}
            {isStreaming && (
              <span aria-hidden="true"
                className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse rounded-full"
                style={{ backgroundColor: BUBBLE_TEXT }}
              />
            )}
          </p>
        </div>

        {/* Trigger row */}
        <div className="flex items-center justify-between border-t px-4 py-2" style={{ borderColor: BUBBLE_BORDER }}>
          {isStreaming ? (
            <button type="button" onClick={stopStreaming}
              className="text-[12px] font-semibold text-red-400 hover:text-red-600 transition-colors">
              Stop
            </button>
          ) : (
            <button type="button" onClick={() => runNarration("initial")}
              className="text-[12px] font-semibold transition-colors"
              style={{ color: BUBBLE_TEXT, opacity: 0.7 }}>
              {hasSpoken ? "Ask again" : "Ask trainer ›"}
            </button>
          )}
          {hasSpoken && !isStreaming && (
            <button type="button" onClick={() => runNarration("example")}
              className="text-[12px] font-semibold transition-colors"
              style={{ color: BUBBLE_TEXT, opacity: 0.5 }}>
              Give example ›
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export type { AvatarNarratorProps };
