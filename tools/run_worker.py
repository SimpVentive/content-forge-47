#!/usr/bin/env python
"""Start the trainer-module worker against the THROWAWAY project, in the background, with a log.

The worker talks to Supabase only through the worker gateway. This launcher never reads or passes the service role key.
Values come from the environment or the Supabase CLI. Nothing is read from a file, and nothing is printed:
    THROWAWAY_WORKER_PASS     the worker pass for the throwaway gateway (must be set; the pass is never printed)
    SUPABASE_ANON_KEY         the public anon key; if unset, the Supabase CLI is asked for it
    ELEVENLABS_API_KEY        set in the PowerShell window before you start
    FAL_KEY                   set in the PowerShell window before you start

Usage:
    python tools/run_worker.py          start the worker; it keeps polling for queued jobs
    python tools/run_worker.py --stop   stop the worker this launcher started

The worker spends money when it runs a job (fal and ElevenLabs). Check the estimate first.
Log: worker/work/worker-launcher.log (job ids and fixed status words only).
"""
import json, os, subprocess, sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
THROWAWAY_REF = "lzuvfygszngdhjpocmeg"
LIVE_REF = "licezkkahseilnmswxbc"
THROWAWAY_URL = f"https://{THROWAWAY_REF}.supabase.co"
GATEWAY_URL = f"{THROWAWAY_URL}/functions/v1/worker-gateway"
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


def anon_key():
    key = os.environ.get("SUPABASE_ANON_KEY", "")
    if key:
        return key
    raw = subprocess.run(["supabase", "projects", "api-keys", "--project-ref", THROWAWAY_REF, "-o", "json"],
                         capture_output=True, text=True, cwd=str(REPO)).stdout
    try:
        return next(k["api_key"] for k in json.loads(raw) if k["name"] == "anon")
    except (ValueError, StopIteration, TypeError):
        sys.exit("Could not get the anon key. Set SUPABASE_ANON_KEY, or sign in with the Supabase CLI.")


def start():
    if THROWAWAY_REF not in GATEWAY_URL or LIVE_REF in GATEWAY_URL:
        sys.exit("Refused: the gateway must be the throwaway project. Nothing was started.")
    missing = [n for n in ("THROWAWAY_WORKER_PASS", "ELEVENLABS_API_KEY", "FAL_KEY") if not os.environ.get(n)]
    if missing:
        sys.exit("Set these in this PowerShell window first: " + ", ".join(missing))
    if PIDFILE.exists():
        sys.exit("A worker from this launcher may already be running. Stop it with --stop first.")
    env = os.environ.copy()
    env.update({
        "WORKER_GATEWAY_URL": GATEWAY_URL,
        "WORKER_PASS": os.environ["THROWAWAY_WORKER_PASS"],
        "SUPABASE_ANON_KEY": anon_key(),
        "WORKER_POLL_SECONDS": env.get("WORKER_POLL_SECONDS", "5"),
    })
    # The service role key is deliberately not set: the worker has no use for it.
    env.pop("SUPABASE_SERVICE_ROLE_KEY", None)
    env.pop("SUPABASE_URL", None)
    WORK.mkdir(parents=True, exist_ok=True)
    with LOG.open("w", encoding="utf8") as log:
        proc = subprocess.Popen([sys.executable, str(REPO / "worker" / "worker.py")], cwd=str(REPO), env=env,
                                stdout=log, stderr=subprocess.STDOUT)
    PIDFILE.write_text(str(proc.pid), "utf8")
    print(f"worker started, pid {proc.pid}, gateway on project {THROWAWAY_REF}. Log: {LOG}")


if __name__ == "__main__":
    stop() if "--stop" in sys.argv else start()
