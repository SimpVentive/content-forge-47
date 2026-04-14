import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import { cn } from "@/lib/utils";
import { getTrainerLipSyncProfile, type AvatarLipSyncProfile, type VisemeKey } from "@/lib/avatarTrainers";

// ---------------------------------------------------------------------------
// SVG parametric mouth — drawn on top of the illustrated avatar face
// ---------------------------------------------------------------------------
interface SvgMouthProps {
  profile: AvatarLipSyncProfile;
  viseme: VisemeKey;
  isTalking: boolean;
}

function SvgMouth({ profile, viseme, isTalking }: SvgMouthProps) {
  const shape   = profile.visemes[viseme];
  const halfW   = (profile.baseWidth / 2) * shape.width;
  const openH   = profile.baseHeight * shape.height * (isTalking ? 1 : 0.12);
  const liftPx  = shape.lift * 10;
  const isOpen  = openH > 2.5;

  // patch large enough to cover the drawn mouth in the illustration
  const patchRx = halfW + 7;
  const patchRy = 9;

  // Upper lip: Cupid's bow (M → left corner, C → left peak → dip → right peak → right corner)
  const ulPath = [
    `M${-halfW},${-liftPx}`,
    `C${-halfW * 0.55},${-5 - liftPx}`,
    `  ${-halfW * 0.12},${-4 - liftPx}`,
    `  0,${-3 - liftPx}`,
    `C${halfW * 0.12},${-4 - liftPx}`,
    `  ${halfW * 0.55},${-5 - liftPx}`,
    `  ${halfW},${-liftPx}`,
  ].join(" ");

  // Lower lip: single arc downward
  const llPath = isOpen
    ? `M${-halfW},${-liftPx} Q0,${openH + 5 - liftPx} ${halfW},${-liftPx}`
    : `M${-halfW},${-liftPx} Q0,${5 - liftPx} ${halfW},${-liftPx}`;

  const viewH  = Math.max(openH + patchRy + 10, patchRy * 2 + 4);
  const vbMinY = -(patchRy + 5);

  return (
    <svg
      width={patchRx * 2}
      height={viewH}
      viewBox={`${-patchRx} ${vbMinY} ${patchRx * 2} ${viewH}`}
      overflow="visible"
      style={{ pointerEvents: "none", display: "block" }}
    >
      {/* Skin patch — covers the existing illustrated closed mouth */}
      <ellipse cx="0" cy="0" rx={patchRx} ry={patchRy} fill={profile.skinTone} />

      {/* Dark interior — visible only when open */}
      {isOpen && (
        <ellipse
          cx="0"
          cy={openH / 2 - liftPx}
          rx={halfW * 0.82}
          ry={openH / 2 + 2}
          fill="#1a0808"
        />
      )}

      {/* Teeth strip — only for wide-open sounds (aa, oh) */}
      {openH > 12 && (
        <rect
          x={-halfW * 0.68}
          y={1 - liftPx}
          width={halfW * 1.36}
          height={Math.min(openH * 0.32, 6)}
          rx="2"
          fill="#f5f0ec"
        />
      )}

      {/* Upper lip */}
      <path
        d={ulPath}
        stroke={profile.lipColor}
        strokeWidth="2"
        fill={`${profile.lipColor}28`}
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Lower lip */}
      <path
        d={llPath}
        stroke={profile.lipColor}
        strokeWidth="2.5"
        fill={`${profile.lipColor}50`}
        strokeLinecap="round"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// AvatarNarrator
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
}

const CONCISE_RESPONSE_HINT = "Keep the response concise: maximum 90 words, 4 short paragraphs or fewer, and avoid repetition.";
const EXAMPLE_HINT = `Give one vivid real-world workplace example in 2 sentences. ${CONCISE_RESPONSE_HINT}`;
const BUBBLE_BG     = "#EEEDFE";
const BUBBLE_BORDER = "#AFA9EC";
const BUBBLE_TEXT   = "#26215C";

type RequestMode = "initial" | "example";

function buildDefaultSpeech(topic: string, moduleContent: string, trainerName: string) {
  const preview = moduleContent.trim().replace(/\s+/g, " ");
  if (!preview) {
    return `Tap the explain icon and ${trainerName} will walk you through ${topic}.`;
  }
  const short = preview.length > 180 ? `${preview.slice(0, 177).trimEnd()}...` : preview;
  return `Tap the explain icon and ${trainerName} will break down ${topic}. Quick preview: ${short}`;
}

const STREAMING_VISEME_SEQUENCE: VisemeKey[] = ["aa", "oh", "ee", "l", "mbp", "aa", "ih", "r", "oh", "aa"];

export function AvatarNarrator({
  topic, moduleContent, systemHint,
  trainerName = "Sarah",
  avatarImageUrl, avatarVideoUrl, avatarPosterUrl,
  trainerId = "priya",
  isVoiceActive, isVoiceLoading,
  currentViseme = "rest",
}: AvatarNarratorProps) {
  const [speechText, setSpeechText]   = useState(() => buildDefaultSpeech(topic, moduleContent, trainerName));
  const [isStreaming, setIsStreaming]  = useState(false);
  const [hasCompletedInitialResponse, setHasCompletedInitialResponse] = useState(false);
  const [hasAvatarImage, setHasAvatarImage] = useState(true);
  const [videoMuted, setVideoMuted]   = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const [isMouthHold, setIsMouthHold] = useState(false);
  const [streamingViseme, setStreamingViseme] = useState<VisemeKey>("rest");

  const avatarVideoRef        = useRef<HTMLVideoElement | null>(null);
  const abortControllerRef    = useRef<AbortController | null>(null);
  const flushIntervalRef      = useRef<number | null>(null);
  const queuedCharactersRef   = useRef<string[]>([]);
  const currentRequestRef     = useRef(0);
  const pendingCompletionRef  = useRef<RequestMode | null>(null);
  const mouthHoldTimeoutRef   = useRef<number | null>(null);
  const streamVisemeIdxRef    = useRef(0);
  const streamVisemeIntervalRef = useRef<number | null>(null);

  const lipSyncProfile = getTrainerLipSyncProfile(trainerId);

  // While streaming text we cycle through visemes so the mouth moves.
  // When real ElevenLabs visemes arrive (currentViseme), they take precedence.
  const effectiveViseme: VisemeKey =
    (isStreaming || isMouthHold) && currentViseme === "rest"
      ? streamingViseme
      : currentViseme;

  const isTalking = Boolean(isVoiceActive || isVoiceLoading || isStreaming || isMouthHold);

  const trainerInitials = trainerName
    .split(/\s+/).filter(Boolean).slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "").join("") || "AV";

  // ── helpers ──────────────────────────────────────────────────────────────

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
    if (pendingCompletionRef.current === "initial") setHasCompletedInitialResponse(true);
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
    if (mode === "initial") setHasCompletedInitialResponse(true);
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
            topic,
            moduleContent,
            systemHint: mode === "initial" ? `${systemHint} ${CONCISE_RESPONSE_HINT}` : EXAMPLE_HINT,
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
    setHasCompletedInitialResponse(false);
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
    if (v.paused) { v.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false)); }
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
      `}</style>

      {avatarVideoUrl ? (
        /* ── video avatar ─────────────────────────────────────────────────── */
        <div
          className="relative w-full max-w-[360px] overflow-hidden rounded-[22px] border border-[#d8deea] bg-black shadow-[0_14px_30px_rgba(15,23,42,0.2)]"
          style={{ animation: "avatarNarratorEnter 420ms cubic-bezier(0.22,1,0.36,1) both" }}
        >
          <video
            ref={avatarVideoRef}
            src={avatarVideoUrl}
            poster={avatarPosterUrl}
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
        /* ── illustrated photo avatar with SVG lip sync ──────────────────── */
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
          {/* Image + SVG mouth overlay */}
          <div className="relative aspect-[3/4] w-full bg-[#eef2ff]">
            {hasAvatarImage ? (
              <img
                src={avatarImageUrl || "/trainers/priya.png"}
                alt={trainerName}
                className="h-full w-full object-cover object-top"
                onError={() => setHasAvatarImage(false)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold text-[#3C3489]">
                {trainerInitials}
              </div>
            )}

            {/* SVG mouth overlay — only on illustrated avatars */}
            {hasAvatarImage && (
              <div
                className="pointer-events-none absolute"
                style={{
                  left: `${lipSyncProfile.mouthLeftPct}%`,
                  top:  `${lipSyncProfile.mouthTopPct}%`,
                  transform: "translate(-50%, -50%)",
                }}
              >
                <SvgMouth
                  profile={lipSyncProfile}
                  viseme={effectiveViseme}
                  isTalking={isTalking}
                />
              </div>
            )}

            {/* Speaking badge */}
            <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <span className={cn("inline-block h-2 w-2 rounded-full", isTalking ? "bg-emerald-400" : "bg-slate-300")} />
              {isTalking ? "Speaking" : "Ready"}
            </div>

            {/* Caption bar */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-4 pb-4 pt-10">
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
        className="min-h-28 max-h-44 w-full max-w-[540px] overflow-y-auto rounded-[24px] border px-5 py-4 text-[14px] leading-7 shadow-sm"
        style={{
          backgroundColor: BUBBLE_BG,
          borderColor: BUBBLE_BORDER,
          color: BUBBLE_TEXT,
          animation: `avatarNarratorEnter 480ms cubic-bezier(0.22,1,0.36,1) both, ${isStreaming ? "bubbleGlow 1.8s ease-in-out infinite" : "none"}`,
        }}
      >
        <p className="whitespace-pre-wrap break-words">
          {speechText}
          {isStreaming && (
            <span
              aria-hidden="true"
              className="ml-0.5 inline-block h-5 w-[2px] translate-y-1 animate-pulse rounded-full"
              style={{ backgroundColor: BUBBLE_TEXT }}
            />
          )}
        </p>
      </div>
    </section>
  );
}

export type { AvatarNarratorProps };
