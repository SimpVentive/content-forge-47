#!/usr/bin/env python
"""End-to-end checks for the trainer-avatar job rules, against a THROWAWAY Supabase project only.

Set these in your environment (never in a file, never committed):
    THROWAWAY_SUPABASE_URL          e.g. https://abcd1234.supabase.co
    THROWAWAY_SUPABASE_ANON_KEY     the project's anon key
    THROWAWAY_SUPABASE_SERVICE_KEY  the project's service role key
Optional:
    THROWAWAY_CAP_USD               the MODULE_JOB_MAX_USD you set on the throwaway functions (default 10)
    THROWAWAY_CHECK_WORKER=1        wait for a worker to move a job to ready_for_review (costs about $0.20 per piece)

Run:    python tools/test_module_jobs.py            (creates test data, runs the checks, prints PASS/FAIL)
        python tools/test_module_jobs.py --cleanup  (removes the test users, team and jobs it created)

Refuses to run unless the URL contains the word "throwaway" or the environment says THROWAWAY_CONFIRM=yes,
so it cannot be pointed at the shared project by mistake.
Every request is shown as a method, a path and a status code. Keys, tokens and passwords are never printed.
"""
import json, os, secrets, sys, time, urllib.error, urllib.parse, urllib.request

URL = os.environ.get("THROWAWAY_SUPABASE_URL", "").rstrip("/")
ANON = os.environ.get("THROWAWAY_SUPABASE_ANON_KEY", "")
SERVICE = os.environ.get("THROWAWAY_SUPABASE_SERVICE_KEY", "")
CAP = float(os.environ.get("THROWAWAY_CAP_USD", "10"))
CHECK_WORKER = os.environ.get("THROWAWAY_CHECK_WORKER") == "1"
RUN = secrets.token_hex(3)
results = []


def guard():
    if not (URL and ANON and SERVICE):
        sys.exit("Set THROWAWAY_SUPABASE_URL, THROWAWAY_SUPABASE_ANON_KEY and THROWAWAY_SUPABASE_SERVICE_KEY first.")
    if "throwaway" not in URL.lower() and os.environ.get("THROWAWAY_CONFIRM") != "yes":
        sys.exit("The URL does not say 'throwaway'. Set THROWAWAY_CONFIRM=yes only if you are sure it is not the shared project.")


def call(method, path, body=None, token=None, service=False, prefer=None):
    """One request. Returns (status, parsed body or text). Prints method, path and status only."""
    headers = {"apikey": SERVICE if service else ANON, "Content-Type": "application/json"}
    headers["Authorization"] = f"Bearer {SERVICE if service else (token or ANON)}"
    if prefer:
        headers["Prefer"] = prefer
    data = None if body is None else (body if isinstance(body, bytes) else json.dumps(body).encode("utf8"))
    if isinstance(body, bytes):
        headers["Content-Type"] = "application/octet-stream"
    req = urllib.request.Request(f"{URL}{path}", data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw = resp.read()
            status = resp.status
    except urllib.error.HTTPError as err:
        raw = err.read()
        status = err.code
    try:
        payload = json.loads(raw) if raw else None
    except json.JSONDecodeError:
        payload = raw.decode("utf8", "replace")[:200]
    return status, payload


def check(name, ok, detail=""):
    results.append((name, ok, detail))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""), flush=True)


def make_user(label):
    email = f"test-{label}-{RUN}@example.test"
    password = secrets.token_urlsafe(18)
    status, body = call("POST", "/auth/v1/admin/users", {"email": email, "password": password, "email_confirm": True}, service=True)
    if status not in (200, 201):
        sys.exit(f"could not create test user {label}: HTTP {status}")
    status, tok = call("POST", "/auth/v1/token?grant_type=password", {"email": email, "password": password})
    if status != 200:
        sys.exit(f"could not sign in test user {label}: HTTP {status}")
    return {"id": body["id"], "token": tok["access_token"], "email": email, "label": label}


def script_of(chars):
    words = "the trainer explains each step clearly and calmly so the learner can follow along".split()
    out = []
    while sum(len(w) + 1 for w in out) < chars:
        out.append(words[len(out) % len(words)])
    return " ".join(out)[:chars]


def run():
    guard()
    print(f"Throwaway project: {urllib.parse.urlsplit(URL).netloc}   run id: {RUN}")
    print("Creating test users, team and trainers...", flush=True)
    creator = make_user("creator")
    admin = make_user("admin")
    member = make_user("member")
    outsider = make_user("outsider")

    status, team = call("POST", "/rest/v1/teams", {"name": f"test-team-{RUN}"}, service=True, prefer="return=representation")
    team_id = team[0]["id"]
    for user, role in ((creator, "creator"), (admin, "admin"), (member, "member")):
        call("POST", "/rest/v1/team_members", {"team_id": team_id, "user_id": user["id"], "role": role}, service=True)

    def trainer(name, consent, clips):
        status, rows = call("POST", "/rest/v1/custom_trainers", {
            "owner_user_id": creator["id"], "name": name, "team_id": team_id, "voice_id": f"voice-{RUN}",
            "voice_status": "ready", "consent_recorded": consent, "base_clip_count": clips,
        }, service=True, prefer="return=representation")
        return rows[0]["id"]

    t_ok = trainer(f"Trainer OK {RUN}", True, 1)
    status, team_b_rows = call("POST", "/rest/v1/teams", {"name": f"test-team-b-{RUN}"}, service=True, prefer="return=representation")
    team_b = team_b_rows[0]["id"]
    call("POST", "/rest/v1/team_members", {"team_id": team_b, "user_id": creator["id"], "role": "creator"}, service=True)
    t_no_consent = trainer(f"Trainer no consent {RUN}", False, 1)
    t_no_clips = trainer(f"Trainer no clips {RUN}", True, 0)
    created_jobs = []

    print("\n[step 3] Create-job rules", flush=True)
    s, _ = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_ok, "script_text": "Short test."}, token=member["token"])
    check("member cannot create a job (expect 403)", s == 403, f"HTTP {s}")
    s, _ = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_no_consent, "script_text": "Short test."}, token=creator["token"])
    check("trainer without consent is blocked (expect 403)", s == 403, f"HTTP {s}")
    s, _ = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_no_clips, "script_text": "Short test."}, token=creator["token"])
    check("trainer with no base clips is blocked (expect 400)", s == 400, f"HTTP {s}")
    # About 830 words is 9 pieces at $0.20 = $1.80. Over the cap -> 400; under it -> 200 (and we remove that test job).
    s, cap_body = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_ok, "script_text": script_of(5000)}, token=creator["token"])
    over_cap_expected = 400 if CAP < 1.8 else 200
    check(f"a script costing about $1.80 is {'refused' if over_cap_expected == 400 else 'allowed'} at cap ${CAP:.2f} (expect {over_cap_expected})",
          s == over_cap_expected, f"HTTP {s}")
    if s == 200 and isinstance(cap_body, dict) and cap_body.get("data", {}).get("id"):
        call("DELETE", f"/rest/v1/module_jobs?id=eq.{cap_body['data']['id']}", service=True)
    # Create the two jobs we need, checking the concurrency limit on the third.
    s1, j1 = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_ok, "script_text": "First short test."}, token=creator["token"])
    check("creator can create a job (expect 200)", s1 == 200, f"HTTP {s1}")
    job1 = (j1 or {}).get("data", {}).get("id") if isinstance(j1, dict) else None
    s2, j2 = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_ok, "script_text": "Second short test."}, token=creator["token"])
    check("second job is allowed (expect 200)", s2 == 200, f"HTTP {s2}")
    job2 = (j2 or {}).get("data", {}).get("id") if isinstance(j2, dict) else None
    created_jobs += [j for j in (job1, job2) if j]
    s3, _ = call("POST", "/functions/v1/module-job-create", {"team_id": team_id, "trainer_id": t_ok, "script_text": "Third short test."}, token=creator["token"])
    check("third job at once is refused (expect 400)", s3 == 400, f"HTTP {s3}")

    print("\n[step 4] Review rules (the worker is simulated by setting the status directly)", flush=True)
    if job1:
        s, _ = call("POST", "/functions/v1/module-job-review", {"job_id": job1, "action": "sign"}, token=creator["token"])
        check("cannot open a proof before the job is ready (expect 400)", s == 400, f"HTTP {s}")
        s, _ = call("POST", "/functions/v1/module-job-review", {"job_id": job1, "action": "approve"}, token=creator["token"])
        check("cannot approve a queued job (expect 400)", s == 400, f"HTTP {s}")
        call("PATCH", f"/rest/v1/module_jobs?id=eq.{job1}", {"status": "ready_for_review", "proof_path": f"{creator['id']}/{job1}/proof.mp4"}, service=True)
        s, _ = call("POST", "/functions/v1/module-job-review", {"job_id": job1, "action": "approve"}, token=member["token"])
        check("member cannot approve (expect 403)", s == 403, f"HTTP {s}")
        s, _ = call("POST", "/functions/v1/module-job-review", {"job_id": job1, "action": "approve"}, token=admin["token"])
        check("admin can approve a ready job (expect 200)", s == 200, f"HTTP {s}")
        status, rows = call("GET", f"/rest/v1/module_jobs?id=eq.{job1}&select=status", service=True)
        check("approved job is published", status == 200 and rows and rows[0]["status"] == "published", str(rows[0]["status"] if rows else rows))
    if job2:
        call("PATCH", f"/rest/v1/module_jobs?id=eq.{job2}", {"status": "ready_for_review"}, service=True)
        s, _ = call("POST", "/functions/v1/module-job-review", {"job_id": job2, "action": "reject"}, token=member["token"])
        check("member cannot reject (expect 403)", s == 403, f"HTTP {s}")
        s, _ = call("POST", "/functions/v1/module-job-review", {"job_id": job2, "action": "reject"}, token=creator["token"])
        check("creator can reject (expect 200)", s == 200, f"HTTP {s}")

    print("\n[step 5] Row-level security", flush=True)
    status, rows = call("GET", f"/rest/v1/module_jobs?team_id=eq.{team_id}&select=id", token=outsider["token"])
    check("outsider cannot see the team's jobs (expect empty)", status == 200 and rows == [], f"HTTP {status}, rows {len(rows) if isinstance(rows, list) else '?'}")
    status, rows = call("GET", f"/rest/v1/module_jobs?team_id=eq.{team_id}&select=id", token=member["token"])
    check("member can see the team's jobs", status == 200 and isinstance(rows, list) and len(rows) >= 1, f"HTTP {status}")
    s, _ = call("POST", "/rest/v1/module_jobs", {"team_id": team_id, "owner_user_id": creator["id"], "trainer_id": t_ok, "script_text": "x", "status": "queued"}, token=creator["token"])
    check("a creator cannot insert a job directly (expect 401 or 403)", s in (401, 403), f"HTTP {s}")
    s, _ = call("POST", "/rest/v1/module_jobs", {"team_id": team_id, "owner_user_id": member["id"], "trainer_id": t_ok, "script_text": "x", "status": "queued"}, token=member["token"])
    check("a member cannot insert a job directly (expect 401 or 403)", s in (401, 403), f"HTTP {s}")

    print("\n[step 5a] The anon key cannot call the helpers, and only the worker can write the piece cache", flush=True)
    for fn in ("is_team_member", "team_role"):
        # No token: the request carries only the anon key, as a visitor's browser would.
        s, _ = call("POST", f"/rest/v1/rpc/{fn}", {"p_team_id": team_id})
        check(f"anon key cannot call rpc/{fn} (expect 401, 403 or 404)", s in (401, 403, 404), f"HTTP {s}")
    s, _ = call("POST", f"/storage/v1/object/module-cache/{creator['id']}/{t_ok}/cache/intruder.mp4", b"\x00" * 1024, token=creator["token"])
    check("a creator cannot write to module-cache (expect 400 or 403)", s in (400, 403), f"HTTP {s}")

    print("\n[step 5b] Server-only columns: an owner cannot change consent, team or clip count", flush=True)
    for label, body in (("consent_recorded", {"consent_recorded": True}),
                        ("base_clip_count", {"base_clip_count": 7}),
                        ("team_id", {"team_id": team_b})):
        s, rows = call("PATCH", f"/rest/v1/custom_trainers?id=eq.{t_no_consent}", body, token=creator["token"], prefer="return=representation")
        changed = isinstance(rows, list) and len(rows) > 0
        check(f"owner cannot set {label} (expect 400 or 403, no rows changed)", s in (400, 403) and not changed, f"HTTP {s}")
    s, _ = call("POST", "/rest/v1/custom_trainers", {"owner_user_id": creator["id"], "name": f"Sneaky {RUN}", "voice_status": "ready", "consent_recorded": True}, token=creator["token"])
    check("owner cannot insert a trainer with consent already recorded (expect 400 or 403)", s in (400, 403), f"HTTP {s}")
    status, rows = call("GET", f"/rest/v1/custom_trainers?id=eq.{t_no_consent}&select=consent_recorded,team_id", service=True)
    check("the consent flag stayed false after the attempts", status == 200 and rows and rows[0]["consent_recorded"] is False, f"HTTP {status}")

    print("\n[step 5c] Cross-team job and the team helpers", flush=True)
    s, _ = call("POST", "/functions/v1/module-job-create", {"team_id": team_b, "trainer_id": t_ok, "script_text": "Cross team test."}, token=creator["token"])
    check("a job for a trainer of another team is refused (expect 403)", s == 403, f"HTTP {s}")

    print("\n[step 5d] Policies do not recurse", flush=True)
    for path, who in (("/rest/v1/team_members?select=team_id,user_id,role", member),
                      ("/rest/v1/teams?select=id,name", member),
                      ("/rest/v1/module_jobs?select=id,status", member),
                      ("/rest/v1/module_job_events?select=id,status", member),
                      (f"/rest/v1/custom_trainers?select=id,name&team_id=eq.{team_id}", member)):
        s, body = call("GET", path, token=who["token"])
        recursion = "recursion" in json.dumps(body).lower() if body is not None else False
        check(f"read succeeds without recursion: {path.split('?')[0]}", s == 200 and not recursion, f"HTTP {s}")

    print("\n[step 6] Trainer setup: storage and clip count", flush=True)
    clip = b"\x00" * 1024
    s, _ = call("POST", f"/storage/v1/object/trainer-clips/{creator['id']}/{t_ok}/clips/test.mp4", clip, token=creator["token"])
    check("owner can upload a clip to their own folder (expect 200)", s == 200, f"HTTP {s}")
    s, _ = call("POST", f"/storage/v1/object/trainer-clips/{creator['id']}/{t_ok}/clips/intruder.mp4", clip, token=outsider["token"])
    check("outsider cannot upload into the owner's folder (expect 400 or 403)", s in (400, 403), f"HTTP {s}")
    s, body = call("POST", "/functions/v1/trainer-clips-sync", {"trainer_id": t_ok}, token=creator["token"])
    count = (body or {}).get("data", {}).get("base_clip_count") if isinstance(body, dict) else None
    check("the server counts the uploaded clips (expect 200 and 1)", s == 200 and count == 1, f"HTTP {s}, count {count}")
    s, _ = call("POST", "/functions/v1/trainer-clips-sync", {"trainer_id": t_ok}, token=outsider["token"])
    check("only the owner can sync clips (expect 403)", s == 403, f"HTTP {s}")
    s, _ = call("POST", "/functions/v1/trainer-attach-team", {"trainer_id": t_no_clips, "team_id": team_b}, token=member["token"])
    check("a member cannot attach a trainer to a team (expect 403)", s == 403, f"HTTP {s}")
    s, _ = call("POST", "/functions/v1/trainer-attach-team", {"trainer_id": t_no_clips, "team_id": team_b}, token=creator["token"])
    check("the owner can attach a trainer to a team where they are a creator (expect 200)", s == 200, f"HTTP {s}")

    print("\n[step 7] Worker (optional)", flush=True)
    if CHECK_WORKER and job1:
        deadline = time.time() + 3600
        status_now = None
        while time.time() < deadline:
            _, rows = call("GET", f"/rest/v1/module_jobs?id=eq.{job1}&select=status,error", service=True)
            status_now = rows[0]["status"] if rows else None
            if status_now in ("ready_for_review", "failed"):
                break
            time.sleep(20)
        check("worker moves the job to ready_for_review", status_now == "ready_for_review", f"status {status_now}")
    else:
        print("  skipped (set THROWAWAY_CHECK_WORKER=1 with a worker running against this project)", flush=True)

    failed = [r for r in results if not r[1]]
    print(f"\nResult: {len(results) - len(failed)} passed, {len(failed)} failed.", flush=True)
    write_state(team_id, [creator, admin, member, outsider], created_jobs, extra_team=team_b)
    sys.exit(1 if failed else 0)


STATE = os.path.join(os.path.dirname(__file__), ".test_module_jobs_state.json")


def write_state(team_id, users, jobs, extra_team=None):
    with open(STATE, "w", encoding="utf8") as f:
        json.dump({"team_id": team_id, "extra_team_id": extra_team, "user_ids": [u["id"] for u in users], "job_ids": jobs}, f)


def cleanup():
    guard()
    if not os.path.exists(STATE):
        sys.exit("Nothing to clean up (no state file).")
    state = json.load(open(STATE, encoding="utf8"))
    call("DELETE", f"/rest/v1/teams?id=eq.{state['team_id']}", service=True)
    if state.get("extra_team_id"):
        call("DELETE", f"/rest/v1/teams?id=eq.{state['extra_team_id']}", service=True)
    for uid in state["user_ids"]:
        call("DELETE", f"/auth/v1/admin/users/{uid}", service=True)
    os.remove(STATE)
    print("Removed the test team and users (their trainers, jobs and team rows go with them).")


if __name__ == "__main__":
    if "--cleanup" in sys.argv:
        cleanup()
    else:
        run()
