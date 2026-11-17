#!/usr/bin/env python
"""Trainer-avatar job worker. It reaches Supabase only through the worker gateway (supabase/functions/worker-gateway).

It claims a queued job, downloads the trainer's clips and cached pieces through signed links, runs tools/make_module.py,
uploads the outputs and pieces through signed links, and reports the job complete or failed.

Environment (set in the host's secret store, never in code):
    WORKER_GATEWAY_URL   https://<project>.supabase.co/functions/v1/worker-gateway
    WORKER_PASS          the worker pass, sent as X-Worker-Pass
    SUPABASE_ANON_KEY    the public anon key, sent as the Bearer token (needed while the platform checks JWTs)
    ELEVENLABS_API_KEY   voice narration (used by tools/make_module.py)
    FAL_KEY              LatentSync on fal.ai (used by tools/make_module.py)
Optional: WORKER_POLL_SECONDS (default 15), MODULE_WORKERS (default 4), WORK_DIR (default worker/work).

Nothing is logged except job ids and fixed status words. The pass, claim tokens and signed URLs are never logged,
and the messages stored on a job are fixed texts, so an error message cannot carry a link or a token.
"""
import json, os, pathlib, re, shutil, subprocess, sys, threading, time, urllib.error, urllib.request

REPO = pathlib.Path(__file__).resolve().parent.parent
MODULE_TOOL = REPO / "tools" / "make_module.py"
WORK = pathlib.Path(os.environ.get("WORK_DIR", REPO / "worker" / "work")).resolve()
POLL = int(os.environ.get("WORKER_POLL_SECONDS", "15"))
WORKERS = os.environ.get("MODULE_WORKERS", "4")
GATEWAY = os.environ.get("WORKER_GATEWAY_URL", "").rstrip("/")
PASS = os.environ.get("WORKER_PASS", "")
ANON = os.environ.get("SUPABASE_ANON_KEY", "")
HEARTBEAT_SECONDS = 300  # a progress message this often keeps the job from going stale
SAFE_NAME = re.compile(r"^[A-Za-z0-9_-][A-Za-z0-9._-]{0,119}$")


class GatewayError(Exception):
    """The gateway refused or could not be reached. Carries only the HTTP status, never a URL or body."""

    def __init__(self, status):
        super().__init__(f"gateway status {status}")
        self.status = status


class StageError(Exception):
    """A failure with a fixed message for the job. The text never includes a link or a token."""

    def __init__(self, text):
        super().__init__(text)
        self.text = text


def log(msg):
    print(time.strftime("%H:%M:%S"), msg, flush=True)


def gateway(op, **fields):
    """One call to the gateway. The pass goes in a header and is never logged."""
    body = json.dumps({"op": op, **fields}).encode("utf8")
    req = urllib.request.Request(GATEWAY, data=body, method="POST", headers={
        "Content-Type": "application/json",
        "Authorization": f"Bearer {ANON}",
        "X-Worker-Pass": PASS,
    })
    try:
        with urllib.request.urlopen(req, timeout=60) as resp:
            return json.loads(resp.read() or b"{}")
    except urllib.error.HTTPError as err:
        raise GatewayError(err.code) from None
    except (urllib.error.URLError, OSError):
        raise GatewayError(0) from None


def fetch(url, dest):
    """Downloads a signed link to dest. Errors do not carry the URL."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    try:
        with urllib.request.urlopen(url, timeout=900) as resp, open(dest, "wb") as f:
            shutil.copyfileobj(resp, f)
    except (urllib.error.URLError, OSError):
        raise StageError("Could not fetch the trainer's files.") from None


def put(url, src, content_type):
    """Uploads a file to a signed upload link. Errors do not carry the URL."""
    data = pathlib.Path(src).read_bytes()
    req = urllib.request.Request(url, data=data, method="PUT", headers={"Content-Type": content_type})
    try:
        with urllib.request.urlopen(req, timeout=900):
            pass
    except (urllib.error.URLError, OSError):
        raise StageError("Could not upload the outputs.") from None


def write_voice(folder, trainer):
    settings = trainer["voice_settings"]
    (folder / "voice.json").write_text(json.dumps({
        "voice_id": trainer["voice_id"], "model_id": "eleven_multilingual_v2", "settings": settings}), "utf8")


def run_module(job_inputs_folder, script_text, workdir):
    script = workdir / "script.txt"
    script.write_text(script_text, "utf8")
    out = workdir / "out" / "module.mp4"
    cmd = [sys.executable, str(MODULE_TOOL), "--trainer", str(job_inputs_folder), "--script", str(script),
           "--out", str(out), "--workers", WORKERS, "--yes"]
    # The pass is not passed on to the tool.
    env = {k: v for k, v in os.environ.items() if k != "WORKER_PASS"}
    with (workdir / "make_module.log").open("w", encoding="utf8") as lf:
        proc = subprocess.run(cmd, stdout=lf, stderr=subprocess.STDOUT, cwd=str(REPO), env=env)
    return proc.returncode, out, workdir / "out" / "run_report.json"


class Heartbeat:
    """Sends a progress message every few minutes while the tool runs, so the job is not marked stale."""

    def __init__(self, job_id, token):
        self.job_id, self.token = job_id, token
        self.stop = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True)

    def _run(self):
        while not self.stop.wait(HEARTBEAT_SECONDS):
            try:
                gateway("progress", job_id=self.job_id, claim_token=self.token, message="Still generating")
            except GatewayError:
                pass  # the next call will report the problem

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *exc):
        self.stop.set()


def save_pieces(job_id, token, folder):
    """Uploads the cached pieces through signed links. Best effort: it never raises, so the job still
    ends through the normal path. Returns the upload links (including the output links), or None if it failed."""
    try:
        names = sorted(p.name for p in (folder / "cache").iterdir() if p.is_file() and SAFE_NAME.match(p.name))
        up = gateway("links_upload", job_id=job_id, claim_token=token, names=names)
        for item in up.get("cache", []):
            src = folder / "cache" / item["name"]
            put(item["url"], src, "video/mp4" if src.suffix == ".mp4" else "application/octet-stream")
        log(f"job {job_id}: pieces saved ({len(up.get('cache', []))})")
        return up
    except Exception as err:  # the error text is not logged: it can contain a link
        log(f"job {job_id}: pieces could not be saved ({type(err).__name__})")
        return None


def process(job_id, token):
    log(f"job {job_id}: claimed")
    workdir = WORK / job_id
    workdir.mkdir(parents=True, exist_ok=True)
    folder = workdir / "trainer"
    try:
        gateway("progress", job_id=job_id, claim_token=token, message="Fetching the trainer's files")
        inputs = gateway("inputs", job_id=job_id, claim_token=token)
        links = gateway("links_download", job_id=job_id, claim_token=token)
        if folder.exists():
            shutil.rmtree(folder)
        (folder / "clips").mkdir(parents=True)
        (folder / "cache").mkdir(parents=True)
        write_voice(folder, {"voice_id": inputs["trainer"]["voice_id"], "voice_settings": inputs["trainer"]["voice_settings"]})
        for item in links.get("clips", []):
            if SAFE_NAME.match(item["name"]):
                fetch(item["url"], folder / "clips" / item["name"])
        for item in links.get("cache", []):
            if SAFE_NAME.match(item["name"]):
                fetch(item["url"], folder / "cache" / item["name"])
        if not any((folder / "clips").glob("*.mp4")):
            raise StageError("This trainer has no base clips.")

        gateway("progress", job_id=job_id, claim_token=token, message="Generating (this takes several minutes)")
        with Heartbeat(job_id, token):
            code, out, report_path = run_module(folder, inputs["script_text"], workdir)
        # The paid pieces are saved first, whatever the exit code, so a failed or partial run keeps them.
        # Best effort: if this fails, it is logged and the job still ends through the normal path below.
        up = save_pieces(job_id, token, folder)
        if code != 0 or not out.exists():
            raise StageError("Generation stopped. See the worker log for this job.")

        if up is None:
            up = gateway("links_upload", job_id=job_id, claim_token=token, names=[])
        if not report_path.exists():
            raise StageError("Generation stopped. See the worker log for this job.")
        outputs = up["outputs"]
        put(outputs["final"], out, "video/mp4")
        put(outputs["proof"], out.with_name(out.stem + "-proof.mp4"), "video/mp4")
        put(outputs["report"], report_path, "application/json")

        gateway("complete", job_id=job_id, claim_token=token)
        log(f"job {job_id}: ready for review")
    except StageError as err:
        fail(job_id, token, err.text)
    except GatewayError as err:
        log(f"job {job_id}: gateway error (status {err.status})")
        fail(job_id, token, "The worker lost the connection to the server.")
    except Exception:  # the message is not stored: it could contain anything
        fail(job_id, token, "Generation stopped unexpectedly.")


def fail(job_id, token, text):
    try:
        gateway("fail", job_id=job_id, claim_token=token, message=text)
        log(f"job {job_id}: failed")
    except GatewayError as err:
        log(f"job {job_id}: could not record the failure (status {err.status})")


def check_settings():
    missing = [n for n, v in (("WORKER_GATEWAY_URL", GATEWAY), ("WORKER_PASS", PASS), ("SUPABASE_ANON_KEY", ANON),
                              ("ELEVENLABS_API_KEY", os.environ.get("ELEVENLABS_API_KEY")),
                              ("FAL_KEY", os.environ.get("FAL_KEY"))) if not v]
    if missing:
        sys.exit("Set these in the environment: " + ", ".join(missing))


def main():
    check_settings()
    WORK.mkdir(parents=True, exist_ok=True)
    log("worker started")
    while True:
        try:
            result = gateway("claim")
        except GatewayError as err:
            log(f"gateway not reachable (status {err.status}); retrying")
            time.sleep(POLL)
            continue
        if not result.get("job_id"):
            time.sleep(POLL)
            continue
        process(result["job_id"], result["claim_token"])


if __name__ == "__main__":
    main()
