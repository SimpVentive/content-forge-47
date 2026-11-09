import React from "react";
import { Check, Plus } from "lucide-react";

import { AVATAR_TRAINERS, getTrainerMedia } from "@/lib/avatarTrainers";
import type { CustomTrainer } from "@/lib/customTrainers";

// The one trainer grid used in every place the trainer is chosen, so the cards never drift apart.
type Props = {
  selectedId: string;
  onSelect: (id: string) => void;
  customTrainers: CustomTrainer[];
  customPhotoUrls: Record<string, string | null>;
  onCreateCustom: () => void;
  /** Retries the voice for a custom trainer whose voice was not created. */
  onRetryVoice?: (trainer: CustomTrainer) => void;
  retryingVoiceId?: string | null;
  /** Deletes a custom trainer (voice, photo, videos). The caller asks for confirmation. */
  onDeleteTrainer?: (trainer: CustomTrainer) => void;
  avatarEnv: Record<string, string | undefined>;
};

const CARD_SHADOW = "0 0 0 2px rgba(37,99,235,0.25), 0 8px 20px rgba(37,99,235,0.2)";

export function TrainerGrid({ selectedId, onSelect, customTrainers, customPhotoUrls, onCreateCustom, onRetryVoice, retryingVoiceId, onDeleteTrainer, avatarEnv }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
      {AVATAR_TRAINERS.map((trainer) => {
        const selected = selectedId === trainer.id;
        const trainerMedia = getTrainerMedia(trainer.id, avatarEnv);
        return (
          <TrainerCard
            key={trainer.id}
            selected={selected}
            onClick={() => onSelect(trainer.id)}
            imageUrl={trainerMedia.imageUrl}
            name={trainer.name}
            subtitle={trainer.region === "india" ? "India trainer" : "Global trainer"}
          />
        );
      })}

      {customTrainers.map((trainer) => {
        const selected = selectedId === trainer.id;
        const ready = trainer.voice_status === "ready";
        const processing = trainer.voice_status === "processing" || retryingVoiceId === trainer.id;
        // The photo is usable as soon as it is saved; narration needs the voice, which the course screens check.
        return (
          <TrainerCard
            key={trainer.id}
            selected={selected}
            onClick={() => onSelect(trainer.id)}
            imageUrl={customPhotoUrls[trainer.id] || "/placeholder.svg"}
            name={trainer.name}
            subtitle={ready ? "Your trainer · AI-generated" : processing ? "Creating voice…" : "Voice not created"}
            footer={(
              <span className="mt-1 flex flex-wrap gap-1">
                {!ready && !processing && onRetryVoice ? (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); onRetryVoice(trainer); }}
                    className="rounded-full border border-[#6EC1E4] px-2 py-0.5 text-[10px] font-semibold text-[#0369A1] hover:bg-[#F3F9FC]"
                    title={trainer.voice_error || "Create the voice from the recording"}
                  >
                    Retry voice
                  </button>
                ) : null}
                {onDeleteTrainer ? (
                  <button
                    type="button"
                    disabled={processing}
                    onClick={(e) => { e.stopPropagation(); onDeleteTrainer(trainer); }}
                    className="rounded-full border border-red-300 px-2 py-0.5 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                ) : null}
              </span>
            )}
          />
        );
      })}

      <button
        type="button"
        onClick={onCreateCustom}
        className="flex min-h-[152px] flex-col items-center justify-center gap-2 overflow-hidden rounded-[12px] border border-dashed border-[#6EC1E4] bg-white p-3 text-center transition-all hover:bg-[#F3F9FC]"
      >
        <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[#E0F2FE] text-[#0369A1]"><Plus className="h-5 w-5" /></span>
        <span className="text-[12px] font-bold text-foreground">Use my own photo and voice</span>
        <span className="text-[10px] text-muted-foreground">Create a trainer from your photo and voice</span>
      </button>
    </div>
  );
}

function TrainerCard({ selected, onClick, imageUrl, name, subtitle, disabled = false, footer = null }: {
  selected: boolean;
  onClick: () => void;
  imageUrl: string;
  name: string;
  subtitle: string;
  disabled?: boolean;
  footer?: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`overflow-hidden rounded-[12px] border bg-white text-left transition-all duration-200 ease-in-out disabled:cursor-not-allowed disabled:opacity-60 ${
        selected ? "border-transparent shadow-[0_8px_20px_rgba(181,126,220,0.2)]" : "border-[#E5E7EB] hover:border-[#6EC1E4]"
      }`}
      style={selected ? { boxShadow: CARD_SHADOW } : undefined}
    >
      <div className="relative flex h-[112px] items-center justify-center bg-[#F3F4F6]">
        <img
          src={imageUrl}
          alt={name}
          className={`h-24 w-24 rounded-full border-2 border-[#E5E7EB] object-cover transition-transform duration-300 ${selected ? "scale-[1.05]" : "scale-100"}`}
          onError={(event) => {
            event.currentTarget.src = "/placeholder.svg";
          }}
        />
        {selected ? (
          <span className="absolute bottom-2 right-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-black text-white shadow" style={{ background: "#2563EB" }}>
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <div className="px-2 py-1.5">
        <p className={`truncate text-[12px] font-bold ${selected ? "text-primary" : "text-foreground"}`}>{name}</p>
        <p className="truncate text-[10px] text-muted-foreground">{subtitle}</p>
        {footer}
      </div>
    </button>
  );
}
