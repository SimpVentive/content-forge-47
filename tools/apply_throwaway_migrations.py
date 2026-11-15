#!/usr/bin/env python
"""Apply supabase/migrations/*.sql to the THROWAWAY Supabase project, in filename order.

Safety rules (all enforced in code):
  * Refuses to run unless the connection string points at the throwaway project ref.
  * Refuses if the connection string mentions the live project ref.
  * Prints the target ref before connecting. Never prints the connection string or password.
  * Runs each file in its own transaction. Stops at the first error and prints the full error.
  * Does not use `supabase link` or `supabase db push`.

Setup (PowerShell, this window only):
    python -m pip install "psycopg[binary]"
    $env:THROWAWAY_DB_URL = "<session pooler connection string, password filled in>"

Run:
    python tools/apply_throwaway_migrations.py --dry-run   (lists the files in order, connects to nothing)
    python tools/apply_throwaway_migrations.py             (applies them)
"""
import glob, os, re, sys, urllib.parse

EXPECTED_REF = "lzuvfygszngdhjpocmeg"   # ContentForge_Throwaway
LIVE_REF = "licezkkahseilnmswxbc"       # the live project. Never touch it.
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
MIGRATIONS = os.path.join(ROOT, "supabase", "migrations")
REF_PATTERN = re.compile(r"^[a-z0-9]{20}$")


def project_ref(url):
    """The ref comes from the host (db.<ref>.supabase.co) or from the pooler username (postgres.<ref>)."""
    parts = urllib.parse.urlsplit(url)
    host = parts.hostname or ""
    user = urllib.parse.unquote(parts.username or "")
    m = re.match(r"^db\.([a-z0-9]{20})\.supabase\.co$", host)
    if m:
        return m.group(1)
    if "." in user:
        candidate = user.split(".", 1)[1]
        if REF_PATTERN.match(candidate):
            return candidate
    return None


def migration_files():
    # Filename order, byte by byte. This matches how Supabase orders migrations.
    return sorted(glob.glob(os.path.join(MIGRATIONS, "*.sql")), key=lambda p: os.path.basename(p))


def option(name):
    """Value after --name (e.g. --start-at 2026063), or None."""
    if name in sys.argv:
        i = sys.argv.index(name)
        if i + 1 < len(sys.argv):
            return sys.argv[i + 1]
        sys.exit(f"{name} needs a value")
    return None


def main():
    dry_run = "--dry-run" in sys.argv
    start_at = option("--start-at")   # run from the first file whose name starts with this text
    before = option("--before")       # a throwaway-only SQL file to run first, in its own transaction
    files = migration_files()
    if start_at:
        matches = [i for i, p in enumerate(files) if os.path.basename(p).startswith(start_at)]
        if not matches:
            print(f"No migration file starts with {start_at!r}. Nothing was run.")
            return 2
        files = files[matches[0]:]
    print(f"Found {len(files)} migration files to run, in this order:")
    for i, path in enumerate(files, 1):
        print(f"  {i:2d}. {os.path.basename(path)}")
    if before:
        print(f"Before them: {os.path.basename(before)} (throwaway-only step)")
    if dry_run:
        print("\nDry run: nothing was connected to or changed.")
        return 0

    url = os.environ.get("THROWAWAY_DB_URL", "").strip()
    if not url:
        print("THROWAWAY_DB_URL is not set. Set it in this PowerShell window first (see the instructions).")
        return 2
    if LIVE_REF in url:
        print("REFUSED: the connection string contains the LIVE project ref. Nothing was run.")
        return 2
    ref = project_ref(url)
    if ref != EXPECTED_REF:
        print(f"REFUSED: the connection string is for project ref {ref!r}, not the throwaway ref {EXPECTED_REF}. "
              "Nothing was run. Copy the connection string again from the throwaway project.")
        return 2

    print(f"\nTarget project ref: {ref} (ContentForge_Throwaway). Connecting...", flush=True)
    try:
        import psycopg
    except ImportError:
        print('psycopg is not installed. Run: python -m pip install "psycopg[binary]"')
        return 2

    try:
        conn = psycopg.connect(url, sslmode="require", autocommit=False, connect_timeout=20)
    except Exception as err:  # redact the URL in case the driver echoes it
        print(f"Could not connect: {type(err).__name__}: {str(err).replace(url, '<url>')}")
        return 1

    steps = ([before] if before else []) + files
    with conn:
        for i, path in enumerate(steps, 1):
            name = os.path.basename(path)
            print(f"[{i:2d}/{len(steps)}] {name} ... ", end="", flush=True)
            with open(path, "r", encoding="utf8") as f:
                sql = f.read()
            try:
                with conn.transaction():
                    with conn.cursor() as cur:
                        cur.execute(sql)
            except Exception as err:
                print("FAILED")
                print("\n--- full error ---")
                print(f"File: {name}")
                print(f"Type: {type(err).__name__}")
                diag = getattr(err, "diag", None)
                if diag is not None:
                    for label, value in (("Message", diag.message_primary), ("Detail", diag.message_detail),
                                         ("Hint", diag.message_hint), ("Position", diag.statement_position),
                                         ("SQLSTATE", getattr(err, "sqlstate", None))):
                        if value:
                            print(f"{label}: {value}")
                print(f"Raw: {str(err).replace(url, '<url>')}")
                print("--- nothing after this file was run. The failed file was rolled back. ---")
                return 1
            print("ok", flush=True)

    print(f"\nAll {len(steps)} steps applied to the throwaway project ({EXPECTED_REF}).")
    return 0


if __name__ == "__main__":
    sys.exit(main())
