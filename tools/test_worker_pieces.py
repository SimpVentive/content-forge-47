#!/usr/bin/env python
"""Checks that a failed run still saves its paid pieces, against the THROWAWAY project. Spends nothing.

The worker's tool is replaced by a fake that writes one piece and exits 1, so no fal or ElevenLabs call is made.
  1. A failed run uploads its pieces to module-cache, then the job is marked failed.
  2. If the cache upload itself fails, the job still ends through the normal failure path.

Needs (PowerShell window only, never a file):
    THROWAWAY_SUPABASE_URL, THROWAWAY_SUPABASE_ANON_KEY, THROWAWAY_SUPABASE_SERVICE_KEY, THROWAWAY_CONFIRM=yes
    THROWAWAY_WORKER_PASS          the worker pass currently set on the throwaway function
Run:  python tools/test_worker_pieces.py
"""
import os, sys, tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "worker"))
import test_module_jobs as T  # noqa: E402

PASS = os.environ.get("THROWAWAY_WORKER_PASS", "")
GATEWAY = f"{T.URL}/functions/v1/worker-gateway"
# The worker reads these at import time. They point at the throwaway gateway only.
os.environ["WORKER_GATEWAY_URL"] = GATEWAY
os.environ["WORKER_PASS"] = PASS
os.environ["SUPABASE_ANON_KEY"] = T.ANON

FAKE_TOOL = '''
import pathlib, sys
args = sys.argv[1:]
trainer = pathlib.Path(args[args.index("--trainer") + 1])
(trainer / "cache").mkdir(parents=True, exist_ok=True)
(trainer / "cache" / "piece-fake-test.mp4").write_bytes(b"\\x00" * 2048)
sys.exit(1)
'''

results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""), flush=True)


def job_row(job_id):
    _, rows = T.call("GET", f"/rest/v1/module_jobs?id=eq.{job_id}&select=status,error", service=True)
    return rows[0] if rows else {}


def cache_names(owner, trainer):
    _, items = T.call("POST", "/storage/v1/object/list/module-cache",
                      {"prefix": f"{owner}/{trainer}/cache", "limit": 1000, "offset": 0}, service=True)
    return [i["name"] for i in items or [] if i.get("id") is not None]


def run():
    T.guard()
    if not PASS:
        sys.exit("Set THROWAWAY_WORKER_PASS first.")
    import worker  # imported after the environment is set above

    fake_dir = Path(tempfile.mkdtemp(prefix="worker_pieces_"))
    fake_tool = fake_dir / "fake_tool.py"
    fake_tool.write_text(FAKE_TOOL, "utf8")
    worker.MODULE_TOOL = fake_tool
    worker.WORK = fake_dir / "work"

    owner = T.make_user("pieces-owner")
    _, team = T.call("POST", "/rest/v1/teams", {"name": f"pieces-team-{T.RUN}"}, service=True, prefer="return=representation")
    team_id = team[0]["id"]
    T.call("POST", "/rest/v1/team_members", {"team_id": team_id, "user_id": owner["id"], "role": "creator"}, service=True)
    _, rows = T.call("POST", "/rest/v1/custom_trainers", {"owner_user_id": owner["id"], "name": f"pieces {T.RUN}",
                     "team_id": team_id, "voice_id": "voice-pieces", "voice_status": "ready"},
                     service=True, prefer="return=representation")
    trainer = rows[0]["id"]
    T.call("POST", "/rest/v1/custom_trainer_consents", {"trainer_id": trainer, "owner_user_id": owner["id"],
           "consent_sentence": "I agree to a synthetic copy for test purposes.",
           "consent_audio_path": f"{owner['id']}/{trainer}/consent.webm"}, service=True)
    T.call("POST", f"/storage/v1/object/trainer-clips/{owner['id']}/{trainer}/clips/clip.mp4", b"\x00" * 2048, token=owner["token"])
    T.call("POST", "/functions/v1/trainer-clips-sync", {"trainer_id": trainer}, token=owner["token"])

    def queue(text):
        _, body = T.call("POST", "/functions/v1/module-job-create",
                         {"team_id": team_id, "trainer_id": trainer, "script_text": text}, token=owner["token"])
        return body["data"]["id"]

    print("\n[1] a failed run still saves its pieces")
    job1 = queue("First piece test script.")
    claim = worker.gateway("claim")
    check("the test claims its own job", claim.get("job_id") == job1, "")
    worker.process(claim["job_id"], claim["claim_token"])
    check("the job is marked failed", job_row(job1).get("status") == "failed", str(job_row(job1).get("status")))
    check("the failure message is the fixed text", job_row(job1).get("error") == "Generation stopped. See the worker log for this job.",
          str(job_row(job1).get("error")))
    saved = cache_names(owner["id"], trainer)
    check("the piece from the failed run is in module-cache", "piece-fake-test.mp4" in saved, f"{len(saved)} object(s)")

    print("\n[2] a cache upload that fails does not stop the job from ending")
    job2 = queue("Second piece test script.")
    claim2 = worker.gateway("claim")
    check("the test claims its own second job", claim2.get("job_id") == job2, "")
    real_put = worker.put

    def failing_put(url, src, content_type):
        if "module-cache" in url:
            raise worker.StageError("Could not upload the outputs.")
        return real_put(url, src, content_type)

    worker.put = failing_put
    try:
        worker.process(claim2["job_id"], claim2["claim_token"])
    finally:
        worker.put = real_put
    check("the job still ends as failed through the normal path", job_row(job2).get("status") == "failed", str(job_row(job2).get("status")))
    check("the failure message is still the fixed text", job_row(job2).get("error") == "Generation stopped. See the worker log for this job.",
          str(job_row(job2).get("error")))

    print("\n[3] cleanup")
    import test_worker_gateway as G  # the shared cleanup for the gateway tests
    G.cleanup([owner["id"]], [team_id])
    failed = [n for n, ok in results if not ok]
    print(f"\nResult: {len(results) - len(failed)} passed, {len(failed)} failed.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(run())
