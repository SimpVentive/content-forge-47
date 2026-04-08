import React, { useState, useCallback, useRef, useEffect } from "react";
import { Volume2, Loader2, AlertTriangle, ChevronDown } from "lucide-react";

interface NarrationSection {
  title: string;
  narration_text: string;
  word_count: number;
}

interface VoicePreviewProps {
  voiceRaw: string;
}

const VOICES = [
  { id: "21m00Tcm4TlvDq8ikWAM", name: "Rachel", label: "Rachel (Female, Professional)" },
  { id: "pNInz6obpgDQGcFmaJgB", name: "Adam", label: "Adam (Male, Authoritative)" },
  { id: "MF3mGyEYCl7XYWbV9V6O", name: "Elli", label: "Elli (Female, Warm)" },
  { id: "EXAVITQu4vr4xnSDxMaL", name: "Sarah", label: "Sarah (Female, Hindi/Multilingual)" },
  { id: "onwK4e9ZLuTAKqWW03F9", name: "Daniel", label: "Daniel (Male, Hindi/Multilingual)" },
  { id: "pFZP5JQG7iQjIQuC4Bku", name: "Lily", label: "Lily (Female, Indian English)" },
  { id: "TX3LPaxmHKxFdv7VOQHJ", name: "Liam", label: "Liam (Male, Indian English)" },
];

function tryParseJSON(raw: string): any | null {
  try { return JSON.parse(raw); } catch {
    const match = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) { try { return JSON.parse(match[1].trim()); } catch { return null; } }
    return null;
  }
}

export const VoicePreview: React.FC<VoicePreviewProps> = ({ voiceRaw }) => {
  const [selectedVoice, setSelectedVoice] = useState(VOICES[0]);
  const [audioUrls, setAudioUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState<Record<number, boolean>>({});
  const [error, setError] = useState<string | null>(null);
  const [generatedCount, setGeneratedCount] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const parsed = tryParseJSON(voiceRaw);
  const sections: NarrationSection[] = parsed?.sections || [];

  // Cleanup audio URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  const generateAudio = useCallback(async (index: number, text: string) => {
    setLoading((prev) => ({ ...prev, [index]: true }));
    setError(null);
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/elevenlabs-tts`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ text: text.slice(0, 2500), voiceId: selectedVoice.id }),
        }
      );

      if (!response.ok) {
        const errData = await response.json().catch(() => null);
        throw new Error(errData?.error || `TTS failed: ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setAudioUrls((prev) => ({ ...prev, [index]: url }));
      setGeneratedCount((c) => c + 1);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading((prev) => ({ ...prev, [index]: false }));
    }
  }, [selectedVoice]);

  // Auto-generate first 2 sections when component mounts or voice changes
  useEffect(() => {
    if (sections.length === 0) return;
    // Clear old audio
    Object.values(audioUrls).forEach((url) => URL.revokeObjectURL(url));
    setAudioUrls({});
    setGeneratedCount(0);
    
    const gen = async () => {
      for (let i = 0; i < Math.min(2, sections.length); i++) {
        await generateAudio(i, sections[i].narration_text);
      }
    };
    gen();
  }, [selectedVoice.id, voiceRaw]);

  const generateRemaining = async () => {
    for (let i = 2; i < sections.length; i++) {
      if (!audioUrls[i]) {
        await generateAudio(i, sections[i].narration_text);
      }
    }
  };

  if (sections.length === 0) return null;

  const formatTime = (words: number) => {
    const mins = Math.floor(words / 130);
    const secs = Math.round((words / 130 - mins) * 60);
    return `~${mins} min ${secs} sec`;
  };

  return (
    <div className="space-y-3 mt-6">
      {error && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-xl px-4 py-2.5 text-[13px]">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          Voice preview unavailable — {error}
        </div>
      )}

      {/* Voice Settings */}
      <div className="bg-white rounded-xl border border-border p-3 flex items-center gap-3">
        <span className="text-[13px] font-semibold text-foreground">Voice</span>
        <div className="relative flex-1 max-w-[260px]">
          <select
            value={selectedVoice.id}
            onChange={(e) => setSelectedVoice(VOICES.find((v) => v.id === e.target.value) || VOICES[0])}
            className="w-full h-9 border border-border rounded-lg px-3 pr-8 text-[13px] bg-white text-foreground appearance-none cursor-pointer focus:outline-none focus:border-primary"
          >
            {VOICES.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
          <ChevronDown className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
        </div>
      </div>

      {/* Audio Players */}
      {sections.map((section, i) => (
        <div key={i} className="bg-white rounded-xl shadow-sm border border-border p-3 space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Volume2 className="w-4 h-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[13px] font-semibold text-foreground truncate">{section.title}</p>
              {loading[i] ? (
                <div className="flex items-center gap-2 h-8">
                  <div className="flex gap-0.5">
                    {[...Array(12)].map((_, j) => (
                      <div
                        key={j}
                        className="w-1 bg-primary/30 rounded-full animate-pulse"
                        style={{ height: `${8 + Math.random() * 16}px`, animationDelay: `${j * 0.1}s` }}
                      />
                    ))}
                  </div>
                  <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                </div>
              ) : audioUrls[i] ? (
                <audio controls className="w-full h-8 mt-1" src={audioUrls[i]} />
              ) : (
                <button
                  onClick={() => generateAudio(i, section.narration_text)}
                  className="text-[12px] text-primary font-semibold hover:underline mt-1"
                >
                  Generate audio
                </button>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0">{selectedVoice.name} (ElevenLabs)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
              {formatTime(section.word_count)}
            </span>
            <span className="text-[11px] text-muted-foreground">{section.word_count} words</span>
          </div>
        </div>
      ))}

      {sections.length > 2 && generatedCount < sections.length && (
        <button
          onClick={generateRemaining}
          className="w-full h-10 rounded-xl border-2 border-dashed border-primary/25 text-[13px] font-semibold text-primary hover:bg-primary/5 transition-all"
        >
          Generate remaining {sections.length - Math.min(2, generatedCount)} sections
        </button>
      )}
    </div>
  );
};
