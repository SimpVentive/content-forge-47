#!/usr/bin/env python
"""Trainer-avatar job worker.

Polls the module_jobs table for queued jobs, claims one, fetches the trainer's files from storage, runs
tools/make_module.py, uploads the results, and sets the job to ready_for_review (or failed).

Environment (set in the host's secret store, never in code):
    SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ELEVENLABS_API_KEY, FAL_KEY
Optional: WORKER_POLL_SECONDS (default 15), WORK_DIR (default ./work), MODULE_WORKERS (default 4).

Pieces are cached in the trainer-clips bucket (trainers/<owner>/<trainer>/cache/), so a restart does not pay again.
Keys are never logged. Only job ids, statuses and costs are written to the job rows.
"""
import json, os, pathlib, subprocess, sys, time, urllib.error, urllib.parse, urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
MODULE_TOOL = REPO / "tools" / "make_module.py"
WORK = pathlib.Path(os.environ.get("WORK_DIR", REPO / "worker" / "work")).resolve()
POLL = int(os.environ.get("WORKER_POLL_SECONDS", "15"))
WORKERS = os.environ.get("MODULE_WORKERS", "4")
URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY", "")
VOICE_SETTINGS = {"stability": 0.5, "similarity_boost": 0.75, "style": 0.3, "use_speaker_boost": True}


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def _req(method, path, body=None, headers=None, raw=False):
    data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode("utf8"))
    h = {"apikey": KEY, "Authorization": f"Bearer {KEY}"}
    if body is not None and not isinstance(body, bytes):
        h["Content-Type"] = "application/json"
    h.update(headers or {})
    req = urllib.request.Request(f"{URL}{path}", data=data, headers=h, method=method)
    with urllib.request.urlopen(req, timeout=300) as resp:
        payload = resp.read()
    if raw:
        return payload
    return json.loads(payload) if payload else None


def rest(method, table_query, body=None, prefer=None):
    headers = {"Prefer": prefer} if prefer else {}
    return _req(method, f"/rest/v1/{table_query}", body, headers)


def claim_next_job():
    rows = rest("GET", "module_jobs?status=eq.queued&select=*&order=created_at.asc&limit=1")
    if not rows:
        return None
    job = rows[0]
    # Claim only if still queued (a conditional update, so two workers cannot take the same job).
    claimed = rest("PATCH", f"module_jobs?id=eq.{job['id']}&status=eq.queued",
                   {"status": "generating", "progress": "Preparing the trainer", "updated_at": now()},
                   prefer="return=representation")
    if not claimed:
        return None
    event(job["id"], "generating", "Worker started")
    return claimed[0]


def now():
    return time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())


def event(job_id, status, message):
    rest("POST", "module_job_events", {"job_id": job_id, "status": status, "message": message})


def set_job(job_id, **fields):
    fields["updated_at"] = now()
    rest("PATCH", f"module_jobs?id=eq.{job_id}", fields)


def storage_list(bucket, prefix):
    body = {"prefix": prefix, "limit": 1000, "offset": 0}
    out = _req("POST", f"/storage/v1/object/list/{bucket}", body)
    return out or []


def storage_download(bucket, path, dest):
    data = _req("GET", f"/storage/v1/object/authenticated/{bucket}/{urllib.parse.quote(path)}", raw=True)
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(data)


def storage_upload(bucket, path, src, content_type):
    data = pathlib.Path(src).read_bytes()
    req = urllib.request.Request(
        f"{URL}/storage/v1/object/{bucket}/{urllib.parse.quote(path)}", data=data,
        headers={"apikey": KEY, "Authorization": f"Bearer {KEY}", "Content-Type": content_type, "x-upsert": "true"},
        method="POST")
    with urllib.request.urlopen(req, timeout=900):
        pass


def fetch_trainer(job, folder):
    """Writes voice.json, base clips and cached pieces into the working folder for this trainer."""
    trainer = rest("GET", f"custom_trainers?id=eq.{job['trainer_id']}&select=id,owner_user_id,voice_id,voice_status,team_id")
    if not trainer:
        raise RuntimeError("trainer not found")
    t = trainer[0]
    if not t.get("voice_id") or t.get("voice_status") != "ready":
        raise RuntimeError("trainer voice is not ready")
    base = f"{t['owner_user_id']}/{t['id']}"
    (folder / "clips").mkdir(parents=True, exist_ok=True)
    (folder / "cache").mkdir(parents=True, exist_ok=True)
    (folder / "voice.json").write_text(json.dumps({
        "voice_id": t["voice_id"], "model_id": "eleven_multilingual_v2", "settings": VOICE_SETTINGS}), "utf8")
    clips = [o for o in storage_list("trainer-clips", f"{base}/clips") if o.get("name", "").endswith(".mp4")]
    if not clips:
        raise RuntimeError("no base clips uploaded for this trainer")
    for o in clips:
        storage_download("trainer-clips", f"{base}/clips/{o['name']}", folder / "clips" / o["name"])
    for o in storage_list("trainer-clips", f"{base}/cache"):
        if o.get("name"):
            storage_download("trainer-clips", f"{base}/cache/{o['name']}", folder / "cache" / o["name"])
    return base


def push_cache(base, folder):
    for f in (folder / "cache").glob("*"):
        if f.is_file():
            storage_upload("trainer-clips", f"{base}/cache/{f.name}", f,
                           "video/mp4" if f.suffix == ".mp4" else "application/octet-stream")


def run_module(job, folder, workdir):
    script = workdir / "script.txt"
    script.write_text(job["script_text"], "utf8")
    out = workdir / "out" / "module.mp4"
    cmd = [sys.executable, str(MODULE_TOOL), "--trainer", str(folder), "--script", str(script),
           "--out", str(out), "--workers", WORKERS, "--yes"]
    log_file = workdir / "make_module.log"
    with log_file.open("w", encoding="utf8") as lf:
        proc = subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT, cwd=str(REPO))
    return proc.returncode, out, workdir / "out" / "run_report.json"


def process(job):
    job_id = job["id"]
    workdir = WORK / job_id
    workdir.mkdir(parents=True, exist_ok=True)
    folder = workdir / "trainer"
    try:
        set_job(job_id, progress="Fetching the trainer's files")
        base = fetch_trainer(job, folder)
        set_job(job_id, progress="Generating (this takes several minutes)")
        code, out, report_path = run_module(job, folder, workdir)
        push_cache(base, folder)
        if code != 0 or not out.exists():
            raise RuntimeError(f"generation stopped (exit code {code}); see the worker log for this job")
        cost = None
        if report_path.exists():
            cost = json.loads(report_path.read_text("utf8")).get("costs", {}).get("total_usd")
        owner = job["owner_user_id"]
        final_path = f"{owner}/{job_id}/final.mp4"
        proof_path = f"{owner}/{job_id}/proof.mp4"
        report_remote = f"{owner}/{job_id}/run_report.json"
        storage_upload("generated-videos", final_path, out, "video/mp4")
        storage_upload("generated-videos", proof_path, out.with_name(out.stem + "-proof.mp4"), "video/mp4")
        if report_path.exists():
            storage_upload("generated-videos", report_remote, report_path, "application/json")
        set_job(job_id, status="ready_for_review", progress="Ready for review", output_path=final_path,
                proof_path=proof_path, report_path=report_remote, cost_usd=cost)
        event(job_id, "ready_for_review", "Generated and labelled. Waiting for review.")
        log(f"job {job_id}: ready for review")
    except Exception as err:  # the message never contains keys: only the exception type and our own text
        message = str(err)[:300]
        set_job(job_id, status="failed", progress="Failed", error=message)
        event(job_id, "failed", message)
        log(f"job {job_id}: failed ({type(err).__name__})")


def main():
    if not URL or not KEY:
        sys.exit("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment")
    for name in ("ELEVENLABS_API_KEY", "FAL_KEY"):
        if not os.environ.get(name):
            sys.exit(f"{name} must be set in the environment")
    WORK.mkdir(parents=True, exist_ok=True)
    log("worker started")
    while True:
        try:
            job = claim_next_job()
        except (urllib.error.URLError, OSError) as err:
            log(f"database not reachable ({type(err).__name__}); retrying")
            time.sleep(POLL)
            continue
        if job is None:
            time.sleep(POLL)
            continue
        process(job)


if __name__ == "__main__":
    main()
