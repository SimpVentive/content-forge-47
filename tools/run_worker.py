#!/usr/bin/env python
"""Start the trainer-module worker against the THROWAWAY project, in the background, with a log.

Keys come from the environment or from the Supabase CLI. Nothing is read from a file, and nothing is printed:
    THROWAWAY_SUPABASE_URL          must be https://lzuvfygszngdhjpocmeg.supabase.co (anything else is refused)
    THROWAWAY_SUPABASE_SERVICE_KEY  the service role key; if unset, the Supabase CLI is asked for it
    ELEVENLABS_API_KEY              set in the PowerShell window before you start
    FAL_KEY                         set in the PowerShell window before you start

Usage:
    python tools/run_worker.py          start the worker; it keeps polling for queued jobs
    python tools/run_worker.py --stop   stop the worker this launcher started

The worker spends money when it runs a job (fal and ElevenLabs). Check the estimate first.
Log: worker/work/worker-launcher.log (job ids and statuses only; the worker never logs keys).
"""
import json, os, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
THROWAWAY_REF = "lzuvfygszngdhjpocmeg"
LIVE_REF = "licezkkahseilnmswxbc"
THROWAWAY_URL = f"https://{THROWAWAY_REF}.supabase.co"
WORK = REPO / "worker" / "work"
LOG = WORK / "worker-launcher.log"
PIDFILE = WORK / "worker-launcher.pid"


def stop():
    if not PIDFILE.exists():
        sys.exit("No worker started by this launcher (no pid file).")
    pid = PIDFILE.read_text("utf8").strip()
    subprocess.run(["taskkill", "/PID", pid, "/F"], capture_output=True, text=True)
    PIDFILE.unlink()
    print("stopped worker", pid)


def service_key():
    key = os.environ.get("THROWAWAY_SUPABASE_SERVICE_KEY", "")
    if key:
        return key
    raw = subprocess.run(["supabase", "projects", "api-keys", "--project-ref", THROWAWAY_REF, "-o", "json"],
                         capture_output=True, text=True, cwd=str(REPO)).stdout
    try:
        return next(k["api_key"] for k in json.loads(raw) if k["name"] == "service_role")
    except (ValueError, StopIteration, TypeError):
        sys.exit("Could not get the service role key. Set THROWAWAY_SUPABASE_SERVICE_KEY, or sign in with the Supabase CLI.")


def start():
    url = os.environ.get("THROWAWAY_SUPABASE_URL", THROWAWAY_URL).rstrip("/")
    if THROWAWAY_REF not in url or LIVE_REF in url or url != THROWAWAY_URL:
        sys.exit(f"Refused: the URL must be {THROWAWAY_URL}. Nothing was started.")
    missing = [n for n in ("ELEVENLABS_API_KEY", "FAL_KEY") if not os.environ.get(n)]
    if missing:
        sys.exit("Set these in this PowerShell window first: " + ", ".join(missing))
    if PIDFILE.exists():
        sys.exit("A worker from this launcher may already be running. Stop it with --stop first.")
    env = os.environ.copy()
    env.update({
        "SUPABASE_URL": THROWAWAY_URL,
        "SUPABASE_SERVICE_ROLE_KEY": service_key(),
        "WORKER_POLL_SECONDS": env.get("WORKER_POLL_SECONDS", "5"),
    })
    WORK.mkdir(parents=True, exist_ok=True)
    with LOG.open("w", encoding="utf8") as log:
        proc = subprocess.Popen([sys.executable, str(REPO / "worker" / "worker.py")], cwd=str(REPO), env=env,
                                stdout=log, stderr=subprocess.STDOUT)
    PIDFILE.write_text(str(proc.pid), "utf8")
    print(f"worker started, pid {proc.pid}, project {THROWAWAY_REF}. Log: {LOG}")


if __name__ == "__main__":
    stop() if "--stop" in sys.argv else start()
