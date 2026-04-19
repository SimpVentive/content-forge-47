import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import type { VisemeKey } from "@/lib/avatarTrainers";

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

// CSS-overlay facial coordinates (percentage of image) used when sprite PNGs are unavailable.
const FACE_COORDS: Record<string, { eyeLeft: { x: number; y: number }; eyeRight: { x: number; y: number }; mouth: { x: number; y: number } }> = {
  priya:      { eyeLeft: { x: 56.25, y: 29.10 }, eyeRight: { x: 43.95, y: 29.10 }, mouth: { x: 49.80, y: 36.20 } },
  arjun:      { eyeLeft: { x: 55.47, y: 27.60 }, eyeRight: { x: 43.36, y: 27.80 }, mouth: { x: 49.02, y: 34.90 } },
  soumya:     { eyeLeft: { x: 55.27, y: 28.00 }, eyeRight: { x: 43.55, y: 28.20 }, mouth: { x: 49.22, y: 35.00 } },
  vedprakash: { eyeLeft: { x: 54.69, y: 27.00 }, eyeRight: { x: 43.16, y: 27.00 }, mouth: { x: 48.83, y: 34.00 } },
  atul:       { eyeLeft: { x: 55.08, y: 27.10 }, eyeRight: { x: 42.97, y: 27.10 }, mouth: { x: 48.63, y: 34.30 } },
  irina:      { eyeLeft: { x: 55.47, y: 28.00 }, eyeRight: { x: 43.55, y: 28.00 }, mouth: { x: 49.41, y: 35.20 } },
  john:       { eyeLeft: { x: 54.30, y: 27.20 }, eyeRight: { x: 42.97, y: 27.20 }, mouth: { x: 48.44, y: 34.20 } },
};
const DEFAULT_FACE = { eyeLeft: { x: 55, y: 28 }, eyeRight: { x: 43, y: 28 }, mouth: { x: 49, y: 35 } };

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
  const [hasMouthSprite, setHasMouthSprite] = useState<boolean | null>(null);
  const [hasBlinkSprite, setHasBlinkSprite] = useState<boolean | null>(null);
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
  const mouthState = getVisemeMouthState(effectiveViseme, isTalking);

  const trainerInitials = trainerName
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "").join("") || "AV";

  // ── sprite probing ────────────────────────────────────────────────────────
  // Probe once per trainer so we know whether PNG files exist.
  // Uses Image() instead of fetch — silent failure with onError, no console 404.
  useEffect(() => {
    setHasMouthSprite(null);
    const probe = new Image();
    probe.onload  = () => setHasMouthSprite(true);
    probe.onerror = () => setHasMouthSprite(false);
    probe.src = `/trainers/${trainerId}-mouth-slight.png`;
  }, [trainerId]);

  useEffect(() => {
    setHasBlinkSprite(null);
    const probe = new Image();
    probe.onload  = () => setHasBlinkSprite(true);
    probe.onerror = () => setHasBlinkSprite(false);
    probe.src = `/trainers/${trainerId}-blink.png`;
  }, [trainerId]);

  // ── random eye blink ──────────────────────────────────────────────────────
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

  useEffect(() => {
    if (!avatarVideoUrl || !avatarVideoRef.current) return;
    const v = avatarVideoRef.current;
    v.currentTime = 0;
    v.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
  }, [avatarVideoUrl, topic, moduleContent]);

  const toggleVideoPlayback = () => {
    const v = avatarVideoRef.current;
    if (!v) return;
    if (v.paused) v.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
    else { v.pause(); setVideoPlaying(false); }
  };

  const captionText = speechText.trim().replace(/\s+/g, " ").slice(0, 80);

  // Sprite URLs
  const blinkSpriteUrl       = `/trainers/${trainerId}-blink.png`;
  const mouthSlightSpriteUrl = `/trainers/${trainerId}-mouth-slight.png`;
  const mouthOpenSpriteUrl   = `/trainers/${trainerId}-mouth-open.png`;
  const activeMouthSpriteUrl = mouthState === "slight" ? mouthSlightSpriteUrl : mouthOpenSpriteUrl;

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
          0%,  100% { transform: rotate(0deg)     translateX(0px);   }
          20%        { transform: rotate(0.8deg)   translateX(1px);   }
          55%        { transform: rotate(-0.5deg)  translateX(-0.5px);}
          80%        { transform: rotate(0.6deg)   translateX(0.8px); }
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
            autoPlay playsInline muted={videoMuted} controls={false} preload="metadata"
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
                  LAYER 0 — base head image
                  Subtle 9 s head-tilt animation gives life without being distracting.
                  transform-origin "50% 80%" pivots around the shoulders so the tilt
                  feels like a natural head movement, not a full-body rock.
                */}
                <img
                  src={avatarImageUrl || "/trainers/priya.png"}
                  alt={trainerName}
                  className="absolute inset-0 h-full w-full object-cover object-top"
                  style={{
                    animation: "headTilt 9s ease-in-out infinite",
                    transformOrigin: "50% 80%",
                  }}
                  onError={() => setHasAvatarImage(false)}
                />

                {/*
                  LAYER 1 — eyes-closed blink sprite  (optional)
                  Drop  /public/trainers/{id}-blink.png  to enable.
                  Full-size PNG — transparent everywhere except closed-eyes area.
                  Fades in for 140 ms at random 2–6 s intervals.
                */}
                {hasBlinkSprite !== false && (
                  <img
                    src={blinkSpriteUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                    style={{
                      opacity: isBlinking ? 1 : 0,
                      transition: "opacity 60ms ease-in-out",
                    }}
                    onError={() => setHasBlinkSprite(false)}
                  />
                )}

                {/*
                  LAYER 2a — mouth sprites  (optional, preferred)
                  Drop  /public/trainers/{id}-mouth-slight.png
                  and   /public/trainers/{id}-mouth-open.png  to enable.
                  Full-size PNGs — transparent everywhere except the mouth area.
                  Three states driven by viseme groups:
                    rest   → no sprite shown (drawn closed mouth visible in layer 0)
                    slight → fricatives / liquids  → {id}-mouth-slight.png
                    open   → vowels                → {id}-mouth-open.png
                */}
                {hasMouthSprite === true && mouthState !== "rest" && (
                  <img
                    src={activeMouthSpriteUrl}
                    alt=""
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 h-full w-full object-cover object-top"
                    style={{ transition: "opacity 55ms ease-out" }}
                  />
                )}

                {/* LAYER 1b — CSS blink overlay fallback (when no sprite PNG) */}
                {/*
                  Y-correction: container is aspect-[3/4] (0.75) but images are
                  1024×1536 (0.667). With object-cover object-top the image is
                  scaled to match container width; its rendered height exceeds
                  the container, and the bottom is cropped.
                  Scale factor = (1536/1024) / (4/3) = 1.125
                */}
                {hasBlinkSprite === false && (() => {
                  const face = FACE_COORDS[trainerId] || DEFAULT_FACE;
                  const yScale = 1.125;
                  return (
                    <>
                      <div aria-hidden="true" className="pointer-events-none absolute" style={{
                        left: `${face.eyeLeft.x}%`, top: `${face.eyeLeft.y * yScale}%`,
                        width: 28, height: 10, borderRadius: "50%", overflow: "hidden",
                        transform: "translate(-50%, -50%)",
                      }}>
                        <div style={{
                          width: "100%", height: "100%", borderRadius: "50%",
                          background: "rgba(20,10,5,0.82)",
                          transform: isBlinking ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "center center",
                          transition: "transform 70ms ease-in",
                        }} />
                      </div>
                      <div aria-hidden="true" className="pointer-events-none absolute" style={{
                        left: `${face.eyeRight.x}%`, top: `${face.eyeRight.y * yScale}%`,
                        width: 28, height: 10, borderRadius: "50%", overflow: "hidden",
                        transform: "translate(-50%, -50%)",
                      }}>
                        <div style={{
                          width: "100%", height: "100%", borderRadius: "50%",
                          background: "rgba(20,10,5,0.82)",
                          transform: isBlinking ? "scaleY(1)" : "scaleY(0)",
                          transformOrigin: "center center",
                          transition: "transform 70ms ease-in",
                        }} />
                      </div>
                    </>
                  );
                })()}

                {/* LAYER 2b — CSS mouth overlay fallback (when no sprite PNG) */}
                {hasMouthSprite === false && (() => {
                  const face = FACE_COORDS[trainerId] || DEFAULT_FACE;
                  const yScale = 1.125;
                  const mouthScale = mouthState === "open" ? 0.85 : mouthState === "slight" ? 0.4 : 0;
                  return (
                    <div aria-hidden="true" className="pointer-events-none absolute" style={{
                      left: `${face.mouth.x}%`, top: `${face.mouth.y * yScale}%`,
                      width: 26, height: 12,
                      borderRadius: "50% 50% 60% 60%", overflow: "hidden",
                      transform: "translate(-50%, -50%)",
                    }}>
                      <div style={{
                        width: "100%", height: "100%",
                        background: "rgba(20,3,3,0.75)",
                        borderRadius: "50% 50% 60% 60%",
                        transform: `scaleY(${mouthScale})`,
                        transformOrigin: "center center",
                        transition: "transform 60ms ease-out",
                      }} />
                    </div>
                  );
                })()}
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
