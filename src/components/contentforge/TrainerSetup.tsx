import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";
import { VOICE_RANGES, checkClipFile, checkVoiceSettings, clipPath } from "@/lib/trainerSetup";

// The generated database types do not include the team columns until the migration is applied and the types are
// regenerated. Until then, these queries use an untyped handle.
// Untyped until the generated types include the new function. Consent comes from trainer_has_consent().
const db = supabase as unknown as {
  from: (table: string) => any;
  rpc: (fn: string, args: Record<string, unknown>) => any;
};

type Row = {
  id: string;
  name: string;
  team_id: string | null;
  voice_status: string;
  /** From trainer_has_consent() (not a column on the trainer). */
  consent: boolean;
  base_clip_count: number;
  voice_settings: { stability?: number; style?: number } | null;
};

/** Trainer setup: attach a trainer to the team, upload its base clips, and set its voice values. */
export function TrainerSetup({ userId, teamId }: { userId: string; teamId: string | null }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [selectedId, setSelectedId] = useState("");
  const [stability, setStability] = useState<number>(VOICE_RANGES.stability.default);
  const [style, setStyle] = useState<number>(VOICE_RANGES.style.default);

  const load = useCallback(async () => {
    const { data } = await db.from("custom_trainers")
      .select("id, name, team_id, voice_status, base_clip_count, voice_settings")
      .eq("owner_user_id", userId).is("deleted_at", null).order("name");
    const trainers = (data as Omit<Row, "consent">[]) ?? [];
    const withConsent: Row[] = await Promise.all(trainers.map(async (row) => {
      const { data: has } = await db.rpc("trainer_has_consent", { p_trainer_id: row.id });
      return { ...row, consent: has === true };
    }));
    setRows(withConsent);
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const selected = rows.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    if (selected?.voice_settings) {
      setStability(selected.voice_settings.stability ?? VOICE_RANGES.stability.default);
      setStyle(selected.voice_settings.style ?? VOICE_RANGES.style.default);
    }
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function attach() {
    if (!selected || !teamId) return;
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("trainer-attach-team", {
        body: { trainer_id: selected.id, team_id: teamId },
      });
      if (error) return toast.error("The trainer could not be added to the team.");
      toast.success(`${selected.name} is now in your team.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function uploadClips(files: FileList | null) {
    if (!selected || !files || files.length === 0) return;
    const list = Array.from(files);
    for (const f of list) {
      const check = checkClipFile(f.name, f.size);
      if (check.ok === false) return toast.error(check.reason);
    }
    setBusy(true);
    try {
      for (const f of list) {
        const path = clipPath(userId, selected.id, f.name);
        const { error } = await supabase.storage.from("trainer-clips").upload(path, f, {
          upsert: false, contentType: "video/mp4",
        });
        if (error) return toast.error(`${f.name} could not be uploaded.`);
      }
      // The server counts the clips in storage and saves the number.
      const { data: synced, error: syncError } = await supabase.functions.invoke("trainer-clips-sync", {
        body: { trainer_id: selected.id },
      });
      if (syncError) return toast.error("The clips were uploaded, but the count could not be updated.");
      const count = (synced as { data?: { base_clip_count?: number } })?.data?.base_clip_count ?? 0;
      toast.success(`${list.length} clip(s) uploaded. ${count} in total.`);
      await load();
    } finally {
      setBusy(false);
    }
  }

  async function saveVoice() {
    if (!selected) return;
    const check = checkVoiceSettings(stability, style);
    if (check.ok === false) return toast.error(check.reason);
    setBusy(true);
    try {
      const { error } = await db.from("custom_trainers").update({ voice_settings: check.settings }).eq("id", selected.id);
      if (error) return toast.error("The voice settings could not be saved.");
      toast.success("Voice settings saved.");
      await load();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4 rounded-xl border p-4">
      <div>
        <p className="text-[14px] font-semibold">Trainer setup</p>
        <p className="text-[12px] text-muted-foreground">
          Attach a trainer to your team, upload its base clips (10 to 30 seconds each, MP4), and set its voice values.
          Generation stays blocked until consent is recorded for the trainer.
        </p>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] font-semibold">Trainer</label>
        <select value={selectedId} onChange={(e) => setSelectedId(e.target.value)} className="w-full rounded-md border px-2 py-2 text-sm">
          <option value="">Choose a trainer</option>
          {rows.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {selected && (
        <div className="space-y-3">
          <ul className="space-y-1 text-[12px]">
            <li>Voice: {selected.voice_status === "ready" ? "ready" : `not ready (${selected.voice_status})`}</li>
            <li>Consent recorded: {selected.consent ? "yes" : "no (generation is blocked until it is recorded)"}</li>
            <li>Base clips uploaded: {selected.base_clip_count}</li>
            <li>In a team: {selected.team_id ? "yes" : "no"}</li>
          </ul>

          {!selected.team_id && teamId && (
            <button type="button" onClick={attach} disabled={busy} className="rounded-md border px-3 py-2 text-[13px]">
              Add this trainer to my team
            </button>
          )}

          <div className="space-y-1">
            <label className="text-[12px] font-semibold">Base clips (MP4)</label>
            <input
              type="file"
              accept="video/mp4,.mp4"
              multiple
              disabled={busy}
              onChange={(e) => uploadClips(e.target.files)}
              className="block text-[12px]"
            />
          </div>

          <div className="space-y-2">
            <p className="text-[12px] font-semibold">Voice values</p>
            <label className="block text-[12px]">
              Stability ({VOICE_RANGES.stability.min} to {VOICE_RANGES.stability.max})
              <input type="number" step="0.01" value={stability} onChange={(e) => setStability(Number(e.target.value))}
                className="ml-2 w-24 rounded-md border px-2 py-1 text-sm" />
            </label>
            <label className="block text-[12px]">
              Style ({VOICE_RANGES.style.min} to {VOICE_RANGES.style.max})
              <input type="number" step="0.01" value={style} onChange={(e) => setStyle(Number(e.target.value))}
                className="ml-2 w-24 rounded-md border px-2 py-1 text-sm" />
            </label>
            <button type="button" onClick={saveVoice} disabled={busy} className="rounded-md border px-3 py-2 text-[13px]">
              Save voice values
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
