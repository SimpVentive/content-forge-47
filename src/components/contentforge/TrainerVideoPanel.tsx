import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase";

// The generated database types do not include the team and job tables until the migration is applied and the
// types are regenerated. Until then, these queries use an untyped handle. Row shapes are checked by the types below.
const db = supabase as unknown as { from: (table: string) => any };
import { useAuth } from "@/hooks/useAuth";
import {
  AI_LABEL,
  canReview,
  canStartJob,
  estimateUsd,
  statusLabel,
  type JobStatus,
} from "@/lib/moduleJobs";

type Role = "creator" | "admin" | "member";

type Trainer = {
  id: string;
  name: string;
  consent_recorded: boolean;
  voice_status: string;
  base_clip_count: number;
};

type Job = {
  id: string;
  status: JobStatus;
  progress: string | null;
  error: string | null;
  estimate_usd: number;
  cost_usd: number | null;
  created_at: string;
  trainer_id: string;
  proof_path: string | null;
};

/** The cap shown to the user. The server enforces the real cap (MODULE_JOB_MAX_USD). */
const DISPLAYED_CAP_USD = 10;
const POLL_MS = 10000;

async function invokeMessage(error: { message?: string; context?: unknown }): Promise<string> {
  const context = error.context as { json?: () => Promise<unknown> } | undefined;
  if (context && typeof context.json === "function") {
    try {
      const body = (await context.json()) as { error?: { message?: string } };
      if (body?.error?.message) return body.error.message;
    } catch {
      // Not JSON: fall through.
    }
  }
  return error.message || "The request failed.";
}

/** Module page panel: generate a trainer video, see its status, and review it before it is published. */
export function TrainerVideoPanel({ moduleTitle, initialScript = "" }: { moduleTitle: string; initialScript?: string }) {
  const { user } = useAuth();
  const [teamId, setTeamId] = useState<string | null>(null);
  const [role, setRole] = useState<Role | null>(null);
  const [trainers, setTrainers] = useState<Trainer[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [trainerId, setTrainerId] = useState("");
  const [script, setScript] = useState(initialScript);
  const [busy, setBusy] = useState(false);
  const [proofUrl, setProofUrl] = useState<string | null>(null);

  const latest = jobs[0] ?? null;
  const estimate = useMemo(() => estimateUsd(script), [script]);
  const activeJobs = jobs.filter((j) => j.status === "queued" || j.status === "generating").length;
  const selected = trainers.find((t) => t.id === trainerId) ?? null;
  const generatable = trainers.filter((t) => t.consent_recorded && t.voice_status === "ready" && t.base_clip_count > 0);
  const noClips = selected !== null && selected.base_clip_count <= 0;

  const loadTeam = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("team_members").select("team_id, role").eq("user_id", user.id).limit(1);
    const first = data?.[0];
    setTeamId(first?.team_id ?? null);
    setRole((first?.role as Role) ?? null);
  }, [user]);

  const loadTrainersAndJobs = useCallback(async () => {
    if (!teamId) return;
    const [{ data: t }, { data: j }] = await Promise.all([
      db.from("custom_trainers").select("id, name, consent_recorded, voice_status, base_clip_count")
        .eq("team_id", teamId).is("deleted_at", null).order("name"),
      db.from("module_jobs")
        .select("id, status, progress, error, estimate_usd, cost_usd, created_at, trainer_id, proof_path")
        .eq("team_id", teamId).order("created_at", { ascending: false }).limit(5),
    ]);
    setTrainers((t as Trainer[]) ?? []);
    setJobs((j as Job[]) ?? []);
  }, [teamId]);

  useEffect(() => { void loadTeam(); }, [loadTeam]);
  useEffect(() => { void loadTrainersAndJobs(); }, [loadTrainersAndJobs]);

  // Poll while a job is running.
  useEffect(() => {
    if (!latest || !(latest.status === "queued" || latest.status === "generating")) return;
    const timer = setInterval(() => { void loadTrainersAndJobs(); }, POLL_MS);
    return () => clearInterval(timer);
  }, [latest, loadTrainersAndJobs]);

  async function generate() {
    if (!teamId || !selected) return;
    const check = canStartJob({
      estimateUsd: estimate,
      capUsd: DISPLAYED_CAP_USD,
      activeJobsForUser: activeJobs,
      consentRecorded: selected.consent_recorded,
      hasBaseClips: selected.base_clip_count > 0,
      trainerInTeam: true,
      userRole: role,
    });
    if (check.ok === false) return toast.error(check.reason);
    if (!script.trim()) return toast.error("Add the script for the video first.");
    setBusy(true);
    try {
      const { error } = await supabase.functions.invoke("module-job-create", {
        body: { team_id: teamId, trainer_id: selected.id, script_text: script },
      });
      if (error) return toast.error(await invokeMessage(error));
      toast.success("Queued. The status will update here.");
      await loadTrainersAndJobs();
    } finally {
      setBusy(false);
    }
  }

  async function reviewAction(action: "sign" | "approve" | "reject", job: Job) {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("module-job-review", {
        body: { job_id: job.id, action },
      });
      if (error) return toast.error(await invokeMessage(error));
      if (action === "sign") {
        setProofUrl((data as { data?: { url?: string } })?.data?.url ?? null);
        return;
      }
      toast.success(action === "approve" ? "Published." : "Rejected.");
      setProofUrl(null);
      await loadTrainersAndJobs();
    } finally {
      setBusy(false);
    }
  }

  if (!user) return null;

  return (
    <section className="rounded-xl border p-4 space-y-4">
      <div>
        <p className="text-[14px] font-semibold">Trainer video</p>
        <p className="text-[12px] text-muted-foreground">
          Make a video of your trainer for "{moduleTitle}". Every video is labelled "{AI_LABEL}".
        </p>
      </div>

      {!teamId && <p className="text-[12px] text-muted-foreground">You are not in a team yet. Ask an admin to add you.</p>}

      {teamId && (
        <>
          {trainers.filter((t) => !(t.consent_recorded && t.voice_status === "ready")).map((t) => (
            <p key={t.id} className="rounded-md bg-muted px-3 py-2 text-[12px]">
              Video with {t.name} is coming up. Consent and a ready voice are needed first.
            </p>
          ))}

          <div className="space-y-2">
            <label className="text-[12px] font-semibold">Trainer</label>
            <select
              value={trainerId}
              onChange={(e) => setTrainerId(e.target.value)}
              className="w-full rounded-md border px-2 py-2 text-sm"
            >
              <option value="">Choose a trainer</option>
              {generatable.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <label className="text-[12px] font-semibold">Script</label>
            <textarea
              value={script}
              onChange={(e) => setScript(e.target.value)}
              rows={6}
              className="w-full rounded-md border px-2 py-2 text-sm"
              placeholder="The words the trainer will say"
            />
            {noClips && (
              <p className="rounded-md bg-amber-50 px-3 py-2 text-[12px] text-amber-900">
                {selected?.name} has no base clips uploaded yet, so a video cannot be made. Upload a clip first.
              </p>
            )}
            <p className="text-[12px] text-muted-foreground">
              Estimated cost ${estimate.toFixed(2)} (per-job cap ${DISPLAYED_CAP_USD.toFixed(2)}).
              Only creators and admins can start a video. Up to 2 can run at once.
            </p>
            <button
              type="button"
              onClick={generate}
              disabled={busy || !selected || noClips || role === "member" || role === null}
              className="rounded-md bg-indigo-600 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {busy ? "Working..." : "Generate trainer video"}
            </button>
          </div>

          {latest && (
            <div className="space-y-2 rounded-md border p-3">
              <p className="text-[13px] font-semibold">
                Status: {statusLabel(latest.status)}
                {latest.status === "failed" && latest.error ? ` - ${latest.error}` : ""}
              </p>
              {latest.progress && <p className="text-[12px] text-muted-foreground">{latest.progress}</p>}
              {canReview(latest.status) && (
                <div className="space-y-2">
                  {!proofUrl ? (
                    <button
                      type="button"
                      onClick={() => reviewAction("sign", latest)}
                      disabled={busy}
                      className="rounded-md border px-3 py-2 text-[13px]"
                    >
                      Review the video
                    </button>
                  ) : (
                    <video src={proofUrl} controls className="w-full rounded-md" />
                  )}
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => reviewAction("approve", latest)}
                      disabled={busy || (role !== "creator" && role !== "admin")}
                      className="rounded-md bg-emerald-600 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
                    >
                      Approve and publish
                    </button>
                    <button
                      type="button"
                      onClick={() => reviewAction("reject", latest)}
                      disabled={busy || (role !== "creator" && role !== "admin")}
                      className="rounded-md border px-3 py-2 text-[13px] disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">Nothing is published until you approve it.</p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
