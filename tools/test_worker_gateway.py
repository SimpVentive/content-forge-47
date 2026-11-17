#!/usr/bin/env python
"""Integration checks for the worker gateway, against the THROWAWAY project only. Spends nothing: no fal, no ElevenLabs.

Needs (set in the PowerShell window only, never in a file):
    THROWAWAY_SUPABASE_URL, THROWAWAY_SUPABASE_ANON_KEY, THROWAWAY_SUPABASE_SERVICE_KEY, THROWAWAY_CONFIRM=yes
    THROWAWAY_WORKER_PASS          the worker pass currently set on the throwaway function
The gateway is https://<throwaway>/functions/v1/worker-gateway. Each check prints PASS or FAIL and an HTTP code.
Nothing printed contains the pass, a claim token or a signed link.

Run:  python tools/test_worker_gateway.py
"""
import datetime, json, os, sys, urllib.error, urllib.request
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_module_jobs as T  # noqa: E402  (shared request helper, throwaway guard, run id)

PASS = os.environ.get("THROWAWAY_WORKER_PASS", "")
GATEWAY = f"{T.URL}/functions/v1/worker-gateway"
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok)))
    print(f"  {'PASS' if ok else 'FAIL'}  {name}" + (f"  ({detail})" if detail else ""), flush=True)


def gw(op=None, body=None, *, pass_=PASS, anon=T.ANON, origin=None, method="POST", raw=None):
    """One call to the gateway. Returns (HTTP status, parsed JSON or text). Never prints headers or bodies."""
    data = raw if raw is not None else (None if op is None else json.dumps({"op": op, **(body or {})}).encode("utf8"))
    headers = {"Content-Type": "application/json"}
    if anon:
        headers["Authorization"] = f"Bearer {anon}"
    if pass_ is not None:
        headers["X-Worker-Pass"] = pass_
    if origin:
        headers["Origin"] = origin
    req = urllib.request.Request(GATEWAY, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            raw_body, status = resp.read(), resp.status
    except urllib.error.HTTPError as err:
        raw_body, status = err.read(), err.code
    try:
        return status, json.loads(raw_body) if raw_body else None
    except json.JSONDecodeError:
        return status, raw_body.decode("utf8", "replace")[:120]


def put_file(url, data, content_type):
    req = urllib.request.Request(url, data=data, method="PUT", headers={"Content-Type": content_type})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status
    except urllib.error.HTTPError as err:
        return err.code


def job_row(job_id):
    _, rows = T.call("GET", f"/rest/v1/module_jobs?id=eq.{job_id}&select=status,error,output_path,cost_usd", service=True)
    return rows[0] if rows else {}


def queue_job(team, trainer, owner_token, text):
    status, body = T.call("POST", "/functions/v1/module-job-create",
                          {"team_id": team, "trainer_id": trainer, "script_text": text}, token=owner_token)
    return (body or {}).get("data", {}).get("id") if isinstance(body, dict) else None


def list_under(bucket, prefix, found):
    _, items = T.call("POST", f"/storage/v1/object/list/{bucket}", {"prefix": prefix, "limit": 1000, "offset": 0}, service=True)
    for it in items or []:
        name = f"{prefix}/{it['name']}"
        if it.get("id") is None:
            list_under(bucket, name, found)
        else:
            found.append(name)
    return found


def cleanup(users, teams):
    """Removes the test teams, users and their storage objects. Errors are reported by the final check, not hidden."""
    for uid in users:
        for bucket in ("trainer-clips", "generated-videos", "module-cache"):
            names = list_under(bucket, uid, [])
            if names:
                T.call("DELETE", f"/storage/v1/object/{bucket}", {"prefixes": names}, service=True)
    for tid in teams:
        T.call("DELETE", f"/rest/v1/teams?id=eq.{tid}", service=True)
    for uid in users:
        T.call("DELETE", f"/auth/v1/admin/users/{uid}", service=True)


def run():
    T.guard()
    if not PASS:
        sys.exit("Set THROWAWAY_WORKER_PASS first (the pass currently set on the throwaway function).")
    print(f"Gateway: {GATEWAY}   run id: {T.RUN}")

    # ---- Setup: two owners, two teams, one trainer each with consent and a clip, and two queued jobs.
    creator = T.make_user("gw-creator")
    member = T.make_user("gw-member")
    other = T.make_user("gw-other")
    users = [creator["id"], member["id"], other["id"]]
    _, t1 = T.call("POST", "/rest/v1/teams", {"name": f"gw-team-{T.RUN}"}, service=True, prefer="return=representation")
    _, t2 = T.call("POST", "/rest/v1/teams", {"name": f"gw-team-b-{T.RUN}"}, service=True, prefer="return=representation")
    team1, team2 = t1[0]["id"], t2[0]["id"]
    teams = [team1, team2]
    T.call("POST", "/rest/v1/team_members", {"team_id": team1, "user_id": creator["id"], "role": "creator"}, service=True)
    T.call("POST", "/rest/v1/team_members", {"team_id": team1, "user_id": member["id"], "role": "member"}, service=True)
    T.call("POST", "/rest/v1/team_members", {"team_id": team2, "user_id": other["id"], "role": "creator"}, service=True)

    def make_trainer(owner, team, label):
        _, rows = T.call("POST", "/rest/v1/custom_trainers", {
            "owner_user_id": owner["id"], "name": f"{label} {T.RUN}", "team_id": team, "voice_id": f"voice-{label}",
            "voice_status": "ready"}, service=True, prefer="return=representation")
        tid = rows[0]["id"]
        sentence = f"I, {label}, agree that ContentForge may create a synthetic copy of my face and voice to narrate courses I choose."
        T.call("POST", "/rest/v1/custom_trainer_consents", {"trainer_id": tid, "owner_user_id": owner["id"],
               "consent_sentence": sentence, "consent_audio_path": f"{owner['id']}/{tid}/consent.webm"}, service=True)
        T.call("POST", f"/storage/v1/object/trainer-clips/{owner['id']}/{tid}/clips/clip-{label}.mp4",
               b"\x00" * 2048, token=owner["token"])
        T.call("POST", "/functions/v1/trainer-clips-sync", {"trainer_id": tid}, token=owner["token"])
        return tid

    tr1 = make_trainer(creator, team1, "gw-one")
    tr2 = make_trainer(other, team2, "gw-two")
    job1 = queue_job(team1, tr1, creator["token"], "First test script for the gateway.")
    job2 = queue_job(team2, tr2, other["token"], "Second test script for the gateway.")
    print(f"  setup: queued {bool(job1)} and {bool(job2)}")

    # ---- A. Authentication. Every refusal is generic.
    print("\n[A] authentication")
    s, b = gw("claim", pass_=None)
    check("no worker pass is refused (401)", s == 401, f"HTTP {s}")
    s, b = gw("claim", pass_=PASS + "x")
    check("a wrong pass is refused (401)", s == 401, f"HTTP {s}")
    s, b = gw("claim", pass_=PASS[:-1])
    check("a truncated pass is refused (401)", s == 401, f"HTTP {s}")
    s, b = gw("claim", origin="https://testing.l-kurve.com")
    check("a request with an Origin header is refused (401)", s == 401, f"HTTP {s}")
    s, b = gw(method="GET", raw=b"")
    check("GET is refused (405)", s == 405, f"HTTP {s}")
    s, b = gw("claim", anon=None)
    check("no anon Bearer token is refused by the platform (401)", s == 401, f"HTTP {s}")
    s, b = gw("select_everything")
    check("an unknown operation is refused (404)", s == 404, f"HTTP {s}")
    s, b = gw(raw=b"not json")
    check("a body that is not JSON is refused (400)", s == 400, f"HTTP {s}")

    # ---- B. Claim: one job per claim, and the claim token is never stored in clear.
    print("\n[B] claim")
    s, c1 = gw("claim")
    check("first claim returns a job and a token (200)", s == 200 and c1 and c1.get("job_id") and c1.get("claim_token"), f"HTTP {s}")
    s, c2 = gw("claim")
    check("second claim returns the other queued job (200)", s == 200 and c2 and c2.get("job_id") and c2["job_id"] != c1.get("job_id"), f"HTTP {s}")
    check("the two claims are our two jobs", {c1.get("job_id"), c2.get("job_id")} == {job1, job2},
          f"got {bool(c1.get('job_id'))} and {bool(c2.get('job_id'))}")
    s, c3 = gw("claim")
    check("a third claim with nothing queued returns no job (200, job null)", s == 200 and c3 and c3.get("job") is None, f"HTTP {s}")
    claim = {c1["job_id"]: c1["claim_token"], c2["job_id"]: c2["claim_token"]}
    tok1, tok2 = claim[job1], claim[job2]
    _, rows = T.call("GET", f"/rest/v1/module_job_claims?job_id=eq.{job1}&select=token_hash", service=True)
    stored = rows[0]["token_hash"] if rows else ""
    check("the claim record holds a 64-character hash, not the token", len(stored) == 64 and stored != tok1, f"length {len(stored)}")
    check("the job is generating after the claim", job_row(job1).get("status") == "generating", str(job_row(job1).get("status")))

    # ---- C. Token checks: a job can only be used with its own token.
    print("\n[C] claim token")
    s, _ = gw("inputs", {"job_id": job1, "claim_token": tok2})
    check("job 1 with job 2's token is refused (403)", s == 403, f"HTTP {s}")
    s, _ = gw("inputs", {"job_id": job1, "claim_token": "A" * 43})
    check("job 1 with a made-up token is refused (403)", s == 403, f"HTTP {s}")
    s, _ = gw("inputs", {"job_id": job1})
    check("a request with no token is refused (400)", s == 400, f"HTTP {s}")
    s, _ = gw("progress", {"job_id": job1, "claim_token": tok2, "message": "x"})
    check("progress with another job's token is refused (403)", s == 403, f"HTTP {s}")

    # ---- D. Team members and browsers cannot read the claim record or call the claim function.
    print("\n[D] database access")
    s, rows = T.call("GET", "/rest/v1/module_job_claims?select=*", token=member["token"])
    check("a team member cannot read the claim record", s in (401, 403, 404) or rows == [], f"HTTP {s}, rows {len(rows) if isinstance(rows, list) else rows}")
    s, rows = T.call("GET", "/rest/v1/module_job_claims?select=*", token=creator["token"])
    check("a creator cannot read the claim record either", s in (401, 403, 404) or rows == [], f"HTTP {s}")
    s, _ = T.call("POST", "/rest/v1/rpc/claim_next_module_job", {"p_token_hash": "0" * 64}, token=member["token"])
    check("a team member cannot call the claim function (refused)", s in (401, 403, 404), f"HTTP {s}")
    s, _ = T.call("POST", "/rest/v1/rpc/claim_next_module_job", {"p_token_hash": "0" * 64})
    check("the anon key cannot call the claim function (refused)", s in (401, 403, 404), f"HTTP {s}")

    # ---- E. Inputs, scoping and path rules.
    print("\n[E] inputs and paths")
    s, inp = gw("inputs", {"job_id": job1, "claim_token": tok1})
    check("inputs returns the script and the voice (200)", s == 200 and inp and inp.get("script_text") and inp.get("trainer", {}).get("voice_id"), f"HTTP {s}")
    dumped = json.dumps(inp or {})
    check("inputs does not reveal owner, trainer or storage ids", creator["id"] not in dumped and tr1 not in dumped and "/" not in dumped, "")
    s, links = gw("links_download", {"job_id": job1, "claim_token": tok1})
    names = [c["name"] for c in (links or {}).get("clips", [])]
    urls = " ".join(c["url"] for c in (links or {}).get("clips", []) + (links or {}).get("cache", []))
    check("download links are for job 1's trainer only (200)", s == 200 and "clip-gw-one.mp4" in names and "clip-gw-two.mp4" not in names, f"HTTP {s}, names {names}")
    check("download links point only at the owner's own folder", other["id"] not in urls, "")
    s, _ = gw("links_download", {"job_id": job2, "claim_token": tok1})
    check("job 2 with job 1's token is refused (403)", s == 403, f"HTTP {s}")
    bad_names = ["../x.mp4", "a/b.mp4", "..\\x.mp4", "%2e%2e%2fx.mp4", "x\u0000.mp4", ".hidden.mp4", "a" * 121 + ".mp4", "", ".."]
    refused = 0
    for name in bad_names:
        s, _ = gw("links_upload", {"job_id": job1, "claim_token": tok1, "names": [name]})
        refused += (s == 400)
    check(f"upload names with path tricks are refused ({len(bad_names)} tried)", refused == len(bad_names), f"{refused} refused")
    s, _ = gw("links_upload", {"job_id": job1, "claim_token": tok1, "names": ["ok-piece.mp4"]})
    check("a plain file name is accepted (200)", s == 200, f"HTTP {s}")
    s, _ = gw("links_upload", {"job_id": job1, "claim_token": tok1, "names": ["a.mp4"] * 201})
    check("more than 200 names is refused (400)", s == 400, f"HTTP {s}")

    # ---- F. Status rules and the end-to-end path (no spend: the outputs are small dummy files).
    print("\n[F] status rules and completion")
    s, _ = gw("progress", {"job_id": job1, "claim_token": tok1, "message": "Still working"})
    check("progress on a generating job is accepted (200)", s == 200, f"HTTP {s}")
    s, up = gw("links_upload", {"job_id": job1, "claim_token": tok1, "names": ["ok-piece.mp4"]})
    if s == 200:
        check("the upload links include the three outputs", all(up["outputs"].get(k) for k in ("final", "proof", "report")), "")
        put_status = put_file(up["outputs"]["final"], b"\x00" * 4096, "video/mp4")
        put_status2 = put_file(up["outputs"]["proof"], b"\x00" * 4096, "video/mp4")
        put_status3 = put_file(up["outputs"]["report"], json.dumps({"costs": {"total_usd": 0.2}}).encode(), "application/json")
        check("the three outputs upload through the signed links", (put_status, put_status2, put_status3) == (200, 200, 200),
              f"{put_status}, {put_status2}, {put_status3}")
    s, _ = gw("complete", {"job_id": job1, "claim_token": tok1})
    check("complete with the outputs in place (200)", s == 200, f"HTTP {s}")
    row = job_row(job1)
    check("job 1 is ready_for_review with the cost and output path set",
          row.get("status") == "ready_for_review" and row.get("cost_usd") == 0.2 and row.get("output_path"), str(row.get("status")))
    s, _ = gw("complete", {"job_id": job1, "claim_token": tok1})
    check("complete a second time is refused (409)", s in (403, 409), f"HTTP {s}")
    s, _ = gw("progress", {"job_id": job1, "claim_token": tok1, "message": "late"})
    check("progress after completion is refused", s in (403, 409), f"HTTP {s}")
    _, claims_left = T.call("GET", f"/rest/v1/module_job_claims?job_id=eq.{job1}&select=job_id", service=True)
    check("the claim record is removed when the job completes", claims_left == [], "")

    s, _ = gw("complete", {"job_id": job2, "claim_token": tok2})
    check("completing a job with no outputs is refused and fails the job (409)", s == 409, f"HTTP {s}")
    check("the job without outputs is marked failed", job_row(job2).get("status") == "failed", str(job_row(job2).get("status")))

    s, _ = gw("fail", {"job_id": job2, "claim_token": tok2, "message": "x"})
    check("failing a job that already failed is refused (409 or 403)", s in (403, 409), f"HTTP {s}")

    # A fail message with a link and a token-like string must be cleaned before it is stored.
    _, extra = T.call("POST", "/rest/v1/module_jobs", {"team_id": team1, "owner_user_id": creator["id"], "trainer_id": tr1,
                      "script_text": "Fail test.", "status": "queued"}, service=True, prefer="return=representation")
    job3 = extra[0]["id"]
    s, c4 = gw("claim")
    tok_map = {c4.get("job_id"): c4.get("claim_token")} if s == 200 and c4 else {}
    if job3 in tok_map:
        s, _ = gw("fail", {"job_id": job3, "claim_token": tok_map[job3],
                           "message": "boom at https://x.supabase.co/object/sign/a?token=abcdefghijklmnopqrstuvwxyz0123456789"})
        stored = job_row(job3).get("error") or ""
        check("a failure message with a link and token is stored cleaned (200)", s == 200 and "http" not in stored.lower() and "token=" not in stored,
              f"HTTP {s}")
    else:
        check("a failure message with a link and token is stored cleaned (200)", False, "could not claim the test job")

    # ---- G. Stale jobs: a generating job with no progress for 45 minutes is failed inside the next claim.
    print("\n[G] stale-job timeout")
    now = datetime.datetime.now(datetime.timezone.utc)
    old = (now - datetime.timedelta(minutes=46)).isoformat()
    _, stale_rows = T.call("POST", "/rest/v1/module_jobs", {"team_id": team1, "owner_user_id": creator["id"], "trainer_id": tr1,
                           "script_text": "Stale test.", "status": "generating", "progress_at": old},
                           service=True, prefer="return=representation")
    stale = stale_rows[0]["id"]
    _, fresh_rows = T.call("POST", "/rest/v1/module_jobs", {"team_id": team1, "owner_user_id": creator["id"], "trainer_id": tr1,
                           "script_text": "Fresh test.", "status": "generating"}, service=True, prefer="return=representation")
    fresh = fresh_rows[0]["id"]
    T.call("PATCH", f"/rest/v1/module_jobs?id=eq.{fresh}", {"progress_at": now.isoformat()}, service=True)
    gw("claim")
    check("a generating job with no progress for 46 minutes is failed (worker stopped)",
          job_row(stale).get("status") == "failed" and job_row(stale).get("error") == "worker stopped", str(job_row(stale).get("error")))
    check("a generating job with recent progress is left alone", job_row(fresh).get("status") == "generating", str(job_row(fresh).get("status")))
    _, ev = T.call("GET", f"/rest/v1/module_job_events?job_id=eq.{stale}&select=status,message", service=True)
    check("the stale job has an event recording the failure", any(e.get("message") == "worker stopped" for e in (ev or [])), "")

    # ---- Clean up the test data we created.
    cleanup(users, teams)
    _, left = T.call("GET", "/rest/v1/teams?select=id", service=True)
    failed = [n for n, ok in results if not ok]
    print(f"\nResult: {len(results) - len(failed)} passed, {len(failed)} failed.")
    for n in failed:
        print("  failed:", n)
    print("Test data removed." if not left or all(t["id"] not in teams for t in left) else "Some test data may be left: check the throwaway project.")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(run())
