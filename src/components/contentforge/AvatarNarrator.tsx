import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AvatarNarratorProps {
  topic: string;
  moduleContent: string;
  systemHint: string;
}

const EXAMPLE_HINT = "Give one vivid real-world workplace example in 2 sentences.";
const AVATAR_BG = "#EEEDFE";
const AVATAR_TEXT = "#3C3489";
const BUBBLE_BG = "#EEEDFE";
const BUBBLE_BORDER = "#AFA9EC";
const BUBBLE_TEXT = "#26215C";

type RequestMode = "initial" | "example";

export function AvatarNarrator({ topic, moduleContent, systemHint }: AvatarNarratorProps) {
  const [speechText, setSpeechText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [hasCompletedInitialResponse, setHasCompletedInitialResponse] = useState(false);

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
          systemHint: mode === "initial" ? systemHint : EXAMPLE_HINT,
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
    return () => {
      abortControllerRef.current?.abort();
      stopFlushLoop();
    };
  }, []);

  return (
    <section className="flex w-full max-w-2xl flex-col gap-4">
      <div className="flex items-center gap-4">
        <div
          className="flex h-16 w-16 items-center justify-center rounded-full text-lg font-semibold"
          style={{ backgroundColor: AVATAR_BG, color: AVATAR_TEXT }}
        >
          SC
        </div>
        <div className="min-w-0">
          <p className="text-base font-semibold text-foreground">Sarah</p>
          <p className="text-sm text-muted-foreground">Your learning guide</p>
        </div>
      </div>

      <div
        className="min-h-36 rounded-[24px] border px-5 py-4 text-sm leading-7 shadow-sm"
        style={{ backgroundColor: BUBBLE_BG, borderColor: BUBBLE_BORDER, color: BUBBLE_TEXT }}
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