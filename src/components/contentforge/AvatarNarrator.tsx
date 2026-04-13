import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AvatarNarratorProps {
  topic: string;
  moduleContent: string;
  systemHint: string;
  trainerName?: string;
  avatarImageUrl?: string;
  avatarVideoUrl?: string;
  avatarPosterUrl?: string;
}

const CONCISE_RESPONSE_HINT = "Keep the response concise: maximum 90 words, 4 short paragraphs or fewer, and avoid repetition.";
const EXAMPLE_HINT = `Give one vivid real-world workplace example in 2 sentences. ${CONCISE_RESPONSE_HINT}`;
const AVATAR_BG = "#EEEDFE";
const AVATAR_TEXT = "#3C3489";
const BUBBLE_BG = "#EEEDFE";
const BUBBLE_BORDER = "#AFA9EC";
const BUBBLE_TEXT = "#26215C";
const AVATAR_PULSE_ANIMATION = "avatarNarratorPulse 600ms ease-in-out infinite alternate";
const AVATAR_IDLE_ANIMATION = "avatarNarratorFloat 4.2s ease-in-out infinite";

type RequestMode = "initial" | "example";

function buildDefaultSpeech(topic: string, moduleContent: string, trainerName: string) {
  const preview = moduleContent.trim().replace(/\s+/g, " ");
  if (!preview) {
    return `Click Explain this and ${trainerName} will walk you through ${topic}.`;
  }

  const shortenedPreview = preview.length > 180 ? `${preview.slice(0, 177).trimEnd()}...` : preview;
  return `Click Explain this and ${trainerName} will break down ${topic}. Quick preview: ${shortenedPreview}`;
}

export function AvatarNarrator({ topic, moduleContent, systemHint, trainerName = "Sarah", avatarImageUrl, avatarVideoUrl, avatarPosterUrl }: AvatarNarratorProps) {
  const [speechText, setSpeechText] = useState(() => buildDefaultSpeech(topic, moduleContent, trainerName));
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasCompletedInitialResponse, setHasCompletedInitialResponse] = useState(false);
  const [hasAvatarImage, setHasAvatarImage] = useState(true);
  const [videoMuted, setVideoMuted] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(true);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const trainerInitials = trainerName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || "")
    .join("") || "AV";

  const abortControllerRef = useRef<AbortController | null>(null);
  const flushIntervalRef = useRef<number | null>(null);
  const queuedCharactersRef = useRef<string[]>([]);
  const currentRequestRef = useRef(0);
  const pendingCompletionModeRef = useRef<RequestMode | null>(null);

  const stopFlushLoop = () => {
    if (flushIntervalRef.current !== null) {
      window.clearInterval(flushIntervalRef.current);
      flushIntervalRef.current = null;
    }
  };

  const finalizeStream = () => {
    stopFlushLoop();
    setIsStreaming(false);

    if (pendingCompletionModeRef.current === "initial") {
      setHasCompletedInitialResponse(true);
    }

    pendingCompletionModeRef.current = null;
  };

  const startFlushLoop = () => {
    stopFlushLoop();
    flushIntervalRef.current = window.setInterval(() => {
      const nextCharacter = queuedCharactersRef.current.shift();

      if (nextCharacter) {
        setSpeechText((current) => current + nextCharacter);
        return;
      }

      if (pendingCompletionModeRef.current) {
        finalizeStream();
      }
    }, 18);
  };

  const resetForRequest = () => {
    queuedCharactersRef.current = [];
    pendingCompletionModeRef.current = null;
    setSpeechText("");
    setIsStreaming(true);
    startFlushLoop();
  };

  const handleFailure = (mode: RequestMode) => {
    queuedCharactersRef.current = [];
    pendingCompletionModeRef.current = null;
    stopFlushLoop();
    setSpeechText(`Here is the key point: ${moduleContent}`);
    setIsStreaming(false);

    if (mode === "initial") {
      setHasCompletedInitialResponse(true);
    }
  };

  const stopStreaming = () => {
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    queuedCharactersRef.current = [];
    pendingCompletionModeRef.current = null;
    stopFlushLoop();
    setIsStreaming(false);
  };

  const runNarration = async (mode: RequestMode) => {
    if (isStreaming) return;

    abortControllerRef.current?.abort();

    const controller = new AbortController();
    abortControllerRef.current = controller;
    currentRequestRef.current += 1;
    const requestId = currentRequestRef.current;

    resetForRequest();

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/claude-avatar`, {
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
      });

      if (!response.ok || !response.body) {
        throw new Error(`Avatar narration failed with status ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();

        if (done) {
          if (requestId === currentRequestRef.current) {
            pendingCompletionModeRef.current = mode;
            if (queuedCharactersRef.current.length === 0) {
              finalizeStream();
            }
          }
          break;
        }

        if (requestId !== currentRequestRef.current) {
          reader.cancel();
          break;
        }

        const chunk = decoder.decode(value, { stream: true });
        if (chunk) {
          queuedCharactersRef.current.push(...chunk.split(""));
        }
      }
    } catch (error) {
      if ((error as Error).name === "AbortError") {
        return;
      }

      if (requestId === currentRequestRef.current) {
        handleFailure(mode);
      }
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  useEffect(() => {
    setSpeechText(buildDefaultSpeech(topic, moduleContent, trainerName));
    setHasCompletedInitialResponse(false);
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    queuedCharactersRef.current = [];
    pendingCompletionModeRef.current = null;
    stopFlushLoop();
    setIsStreaming(false);
  }, [topic, moduleContent, trainerName]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      stopFlushLoop();
    };
  }, []);

  useEffect(() => {
    setHasAvatarImage(true);
  }, [avatarImageUrl, trainerName]);

  useEffect(() => {
    if (!avatarVideoUrl || !avatarVideoRef.current) return;

    const video = avatarVideoRef.current;
    video.currentTime = 0;
    video.play().then(() => {
      setVideoPlaying(true);
    }).catch(() => {
      setVideoPlaying(false);
    });
  }, [avatarVideoUrl, topic, moduleContent]);

  const toggleVideoPlayback = () => {
    const video = avatarVideoRef.current;
    if (!video) return;

    if (video.paused) {
      video.play().then(() => setVideoPlaying(true)).catch(() => setVideoPlaying(false));
      return;
    }

    video.pause();
    setVideoPlaying(false);
  };

  const captionText = speechText.trim().replace(/\s+/g, " ").slice(0, 80);

  return (
    <section className="flex w-full flex-col gap-4">
      <style>
        {`@keyframes avatarNarratorPulse {
          from {
            transform: scale(1);
          }

          to {
            transform: scale(1.03);
          }
        }

        @keyframes avatarNarratorFloat {
          0%, 100% {
            transform: translateY(0px);
          }

          50% {
            transform: translateY(-4px);
          }
        }

        @keyframes avatarNarratorEnter {
          0% {
            opacity: 0;
            transform: translateY(14px) scale(0.96);
          }

          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }

        @keyframes bubbleGlow {
          0%, 100% {
            box-shadow: 0 10px 24px rgba(60, 52, 137, 0.08);
          }

          50% {
            box-shadow: 0 14px 32px rgba(60, 52, 137, 0.16);
          }
        }`}
      </style>
      {avatarVideoUrl ? (
        <div className="relative overflow-hidden rounded-[22px] border border-[#d8deea] bg-black shadow-[0_14px_30px_rgba(15,23,42,0.2)]" style={{ animation: "avatarNarratorEnter 420ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
          <video
            ref={avatarVideoRef}
            src={avatarVideoUrl}
            poster={avatarPosterUrl}
            className="aspect-[9/13] w-full max-h-[560px] object-cover object-top"
            autoPlay
            playsInline
            muted={videoMuted}
            controls={false}
            preload="metadata"
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
            onEnded={() => setVideoPlaying(false)}
          />
          <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/35 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-400" />
            Lip-sync mode
          </div>
          <button
            type="button"
            onClick={toggleVideoPlayback}
            className="absolute right-14 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            aria-label={videoPlaying ? "Pause avatar narration" : "Play avatar narration"}
          >
            {videoPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setVideoMuted((prev) => !prev)}
            className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur transition-colors hover:bg-black/55"
            aria-label={videoMuted ? "Unmute avatar video" : "Mute avatar video"}
          >
            {videoMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/60 px-4 pb-4 pt-10">
            <p className="text-[20px] font-[900] leading-tight text-white drop-shadow-[0_2px_8px_rgba(0,0,0,0.6)]">
              {captionText || `Explaining ${topic}`}
            </p>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-hidden rounded-[20px] border border-[#d8deea] bg-white shadow-[0_12px_28px_rgba(15,23,42,0.12)]" style={{ animation: "avatarNarratorEnter 420ms cubic-bezier(0.22, 1, 0.36, 1) both" }}>
          <div className="relative aspect-[3/4] w-full bg-[#eef2ff]">
            {hasAvatarImage ? (
              <img
                src={avatarImageUrl || "/avatar-sarah.jpg"}
                alt={trainerName}
                className="h-full w-full object-cover object-top"
                style={{ animation: isStreaming ? AVATAR_PULSE_ANIMATION : AVATAR_IDLE_ANIMATION }}
                onError={() => setHasAvatarImage(false)}
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-4xl font-bold" style={{ color: AVATAR_TEXT }}>
                {trainerInitials}
              </div>
            )}

            <div className="absolute left-3 top-3 inline-flex items-center gap-2 rounded-full bg-black/40 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
              <span className={cn("inline-block h-2 w-2 rounded-full", isStreaming ? "bg-emerald-400" : "bg-slate-300")} />
              {isStreaming ? "Speaking" : "Ready"}
            </div>

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

      <div
        className="min-h-36 max-h-60 overflow-y-auto rounded-[24px] border px-5 py-4 text-[14px] leading-7 shadow-sm"
        style={{ backgroundColor: BUBBLE_BG, borderColor: BUBBLE_BORDER, color: BUBBLE_TEXT, animation: `avatarNarratorEnter 480ms cubic-bezier(0.22, 1, 0.36, 1) both, ${isStreaming ? "bubbleGlow 1.8s ease-in-out infinite" : "none"}` }}
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

      <div className="flex flex-wrap gap-3">
        <Button
          type="button"
          onClick={() => void runNarration("initial")}
          disabled={isStreaming}
          className={cn("rounded-full px-5", isStreaming && "opacity-70")}
          style={{ backgroundColor: AVATAR_TEXT, color: "#FFFFFF" }}
        >
          Explain this
        </Button>

        {isStreaming && (
          <Button
            type="button"
            variant="outline"
            onClick={stopStreaming}
            className="rounded-full px-5"
            style={{ borderColor: BUBBLE_BORDER, color: BUBBLE_TEXT }}
          >
            Stop
          </Button>
        )}

        {hasCompletedInitialResponse && !isStreaming && (
          <Button
            type="button"
            variant="outline"
            onClick={() => void runNarration("example")}
            className="rounded-full px-5"
            style={{ backgroundColor: AVATAR_BG, borderColor: BUBBLE_BORDER, color: AVATAR_TEXT }}
          >
            Give me an example
          </Button>
        )}
      </div>
    </section>
  );
}

export type { AvatarNarratorProps };
