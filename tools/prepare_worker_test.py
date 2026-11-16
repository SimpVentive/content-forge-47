#!/usr/bin/env python
"""Prepare one worker test on the THROWAWAY project, and clean it up afterwards. Spends nothing.

It creates a creator, a team, a trainer with a consent record (a row in custom_trainer_consents with a recording),
the trainer's base clip (through the owner's own account), and one queued job. The worker is what spends money.
Start the worker separately, when you have approved the estimate this script prints.

Set in the PowerShell window only, never in a file:
    THROWAWAY_SUPABASE_URL, THROWAWAY_SUPABASE_ANON_KEY, THROWAWAY_SUPABASE_SERVICE_KEY, THROWAWAY_CONFIRM=yes
Optional:
    --clip PATH     base clip (default: trainers/harish/clips/harish-base-01.mp4, local and git-ignored)
    --cleanup       remove what the last prepare run created (team, owner, storage objects)

The ids are written to tools/.worker_test_state.json (git-ignored) so the cleanup can find them.
"""
import json, sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import test_module_jobs as T  # noqa: E402  (the shared request helper and the throwaway guard)

REPO = Path(__file__).resolve().parent.parent
STATE = Path(__file__).resolve().parent / ".worker_test_state.json"
DEFAULT_CLIP = REPO / "trainers" / "harish" / "clips" / "harish-base-01.mp4"
BUCKETS = ("trainer-clips", "generated-videos", "module-cache")
SCRIPT = ("Active listening is one of the most useful skills you can build at work. When someone is speaking, "
          "give them your full attention. Put down your phone, look at them, and avoid planning your reply while "
          "they talk. Then reflect back what you heard in your own words. Ask one clarifying question if something "
          "is unclear. This shows respect, and it prevents costly misunderstandings in meetings and projects. "
          "Practise it in every conversation this week.")


def prepare(clip_path):
    T.guard()
    voice_id = json.loads((REPO / "trainers" / "harish" / "voice.json").read_text(encoding="utf8"))["voice_id"]
    print(f"Script: {len(SCRIPT.split())} words, {len(SCRIPT)} characters")
    owner = T.make_user("worker-owner")
    _, team = T.call("POST", "/rest/v1/teams", {"name": f"worker-test-{T.RUN}"}, service=True, prefer="return=representation")
    team_id = team[0]["id"]
    T.call("POST", "/rest/v1/team_members", {"team_id": team_id, "user_id": owner["id"], "role": "creator"}, service=True)
    _, rows = T.call("POST", "/rest/v1/custom_trainers", {
        "owner_user_id": owner["id"], "name": "Harish (worker test)", "team_id": team_id, "voice_id": voice_id,
        "voice_status": "ready", "base_clip_count": 0}, service=True, prefer="return=representation")
    trainer = rows[0]["id"]
    sentence = (f"I, Harish (worker test), agree that ContentForge may create a synthetic copy of my face and voice "
                f"to narrate courses I choose. I can delete it at any time.")
    # The consent record: the row the app writes, with the recording of the sentence.
    status, _ = T.call("POST", "/rest/v1/custom_trainer_consents", {
        "trainer_id": trainer, "owner_user_id": owner["id"], "consent_sentence": sentence,
        "consent_audio_path": f"{owner['id']}/{trainer}/consent.webm"}, service=True)
    print("consent record HTTP", status)
    status, _ = T.call("POST", f"/storage/v1/object/trainer-clips/{owner['id']}/{trainer}/clips/harish-base-01.mp4",
                       Path(clip_path).read_bytes(), token=owner["token"])
    print("clip upload HTTP", status)
    status, body = T.call("POST", "/functions/v1/trainer-clips-sync", {"trainer_id": trainer}, token=owner["token"])
    print("clip count HTTP", status, body)
    status, body = T.call("POST", "/functions/v1/module-job-create",
                          {"team_id": team_id, "trainer_id": trainer, "script_text": SCRIPT}, token=owner["token"])
    print("create job HTTP", status)
    job = (body or {}).get("data", {}).get("id") if isinstance(body, dict) else None
    if not job:
        print("No job created:", body)
        return 1
    _, jr = T.call("GET", f"/rest/v1/module_jobs?id=eq.{job}&select=status,estimate_usd", service=True)
    print(f"job {job}: status {jr[0]['status']}, estimate ${jr[0]['estimate_usd']}")
    print("Estimate: LatentSync $0.20 for one piece (40 s minimum), plus ElevenLabs for about "
          f"{len(SCRIPT)} characters. Nothing is spent until the worker runs.")
    STATE.write_text(json.dumps({"owner": owner["id"], "team": team_id, "trainer": trainer, "job": job}), "utf8")
    print("state saved to", STATE)
    return 0


def walk(bucket, prefix):
    out = []
    _, items = T.call("POST", f"/storage/v1/object/list/{bucket}", {"prefix": prefix, "limit": 1000, "offset": 0}, service=True)
    for it in items or []:
        name = f"{prefix}/{it['name']}" if prefix else it["name"]
        if it.get("id") is None:
            out += walk(bucket, name)
        else:
            out.append(name)
    return out


def cleanup():
    T.guard()
    if not STATE.exists():
        sys.exit("Nothing to clean up (no state file).")
    state = json.loads(STATE.read_text("utf8"))
    removed = 0
    for bucket in BUCKETS:
        names = walk(bucket, state["owner"])
        for i in range(0, len(names), 100):
            T.call("DELETE", f"/storage/v1/object/{bucket}", {"prefixes": names[i:i + 100]}, service=True)
        removed += len(names)
    T.call("DELETE", f"/rest/v1/teams?id=eq.{state['team']}", service=True)
    T.call("DELETE", f"/auth/v1/admin/users/{state['owner']}", service=True)
    STATE.unlink()
    print(f"removed {removed} storage objects, the team and the owner")


if __name__ == "__main__":
    if "--cleanup" in sys.argv:
        cleanup()
    else:
        clip = DEFAULT_CLIP
        if "--clip" in sys.argv:
            clip = Path(sys.argv[sys.argv.index("--clip") + 1])
        sys.exit(prepare(clip))
