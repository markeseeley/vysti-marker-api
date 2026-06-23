#!/usr/bin/env python3
"""Cleanup orphan files in the Supabase Storage `marked/` bucket.

Cross-references every object under `marked/{user_id}/` against the
current `mark_events.file_name` rows for that user. Anything in storage
that no longer has a metadata row is an orphan — usually a leftover from
a teacher's end-of-semester bulk delete or from earlier silent-prune
bugs. Orphans serve no purpose: the app can't reach them because the
metadata they hang off of is gone.

Two-phase, dry-run by default. Run once to preview, once with --delete
to actually remove.

Usage:
    python cleanup_orphan_marked_files.py                       # preview only
    python cleanup_orphan_marked_files.py --email you@x.com     # preview for a specific user
    python cleanup_orphan_marked_files.py --email you@x.com --delete  # delete after preview

Reads SUPABASE_URL and SUPABASE_SERVICE_KEY from .env. Never writes
without an explicit --delete flag.
"""

import argparse
import os
import sys
import time
from pathlib import Path

import httpx

# Manually parse .env (no python-dotenv dep).
def _load_dotenv():
    env_path = Path(__file__).resolve().parent / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL", "").rstrip("/")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY", "")
BUCKET = "marked"

if not SUPABASE_URL or not SUPABASE_SERVICE_KEY:
    print("ERROR: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env")
    sys.exit(1)


_HEADERS = {
    "apikey": SUPABASE_SERVICE_KEY,
    "Authorization": f"Bearer {SUPABASE_SERVICE_KEY}",
}


def lookup_user_id(email: str) -> str:
    """Resolve email → auth.users.id via the auth admin endpoint."""
    url = f"{SUPABASE_URL}/auth/v1/admin/users"
    with httpx.Client(timeout=30) as c:
        # The admin endpoint paginates; we just want this one user.
        resp = c.get(url, headers=_HEADERS, params={"page": 1, "per_page": 1000})
        resp.raise_for_status()
        users = resp.json().get("users", [])
    for u in users:
        if (u.get("email") or "").lower() == email.lower():
            return u.get("id") or ""
    raise SystemExit(f"No user found for email {email!r}")


def list_storage_files(user_id: str) -> list[dict]:
    """List every object under marked/{user_id}/. Returns [{name, size, ...}]."""
    url = f"{SUPABASE_URL}/storage/v1/object/list/{BUCKET}"
    out = []
    offset = 0
    page_size = 100
    with httpx.Client(timeout=30) as c:
        while True:
            resp = c.post(
                url,
                headers={**_HEADERS, "Content-Type": "application/json"},
                json={
                    "prefix": f"{user_id}/",
                    "limit": page_size,
                    "offset": offset,
                    "sortBy": {"column": "name", "order": "asc"},
                },
            )
            resp.raise_for_status()
            chunk = resp.json() or []
            if not chunk:
                break
            for item in chunk:
                # Skip directories (size 0, id null sometimes)
                if item.get("id") is None and not item.get("metadata"):
                    continue
                out.append({
                    "name": item.get("name", ""),
                    "size": (item.get("metadata") or {}).get("size", 0),
                    "created_at": item.get("created_at", ""),
                })
            if len(chunk) < page_size:
                break
            offset += page_size
    return out


def fetch_mark_event_filenames(user_id: str) -> set[str]:
    """Return the set of file_name values currently in mark_events for this user."""
    url = f"{SUPABASE_URL}/rest/v1/mark_events"
    out = set()
    offset = 0
    page_size = 1000
    with httpx.Client(timeout=30) as c:
        while True:
            resp = c.get(
                url,
                headers={
                    **_HEADERS,
                    "Range": f"{offset}-{offset + page_size - 1}",
                    "Range-Unit": "items",
                },
                params={
                    "user_id": f"eq.{user_id}",
                    "select": "file_name",
                },
            )
            if resp.status_code not in (200, 206):
                raise SystemExit(f"mark_events fetch failed: {resp.status_code} {resp.text[:200]}")
            chunk = resp.json() or []
            for row in chunk:
                fn = row.get("file_name") or ""
                if fn:
                    out.add(fn)
            if len(chunk) < page_size:
                break
            offset += page_size
    return out


def delete_storage_files(paths: list[str]) -> tuple[int, list[str]]:
    """Bulk-delete storage objects by full path. Returns (deleted_count, errors)."""
    url = f"{SUPABASE_URL}/storage/v1/object/{BUCKET}"
    deleted = 0
    errors: list[str] = []
    # Supabase Storage's bulk delete takes a JSON body with a list of paths.
    # Chunk at 100 per request to keep payloads reasonable.
    CHUNK = 100
    with httpx.Client(timeout=60) as c:
        for i in range(0, len(paths), CHUNK):
            batch = paths[i : i + CHUNK]
            try:
                resp = c.request(
                    "DELETE",
                    url,
                    headers={**_HEADERS, "Content-Type": "application/json"},
                    json={"prefixes": batch},
                )
                if resp.status_code in (200, 204):
                    deleted += len(batch)
                    print(f"  deleted batch {i + 1}-{i + len(batch)}", flush=True)
                else:
                    errors.append(f"batch {i}: HTTP {resp.status_code} {resp.text[:200]}")
            except Exception as exc:
                errors.append(f"batch {i}: {exc!r}")
            # Gentle pacing
            time.sleep(0.1)
    return deleted, errors


def main():
    ap = argparse.ArgumentParser(description="Clean up orphan marked/ Supabase Storage files.")
    ap.add_argument("--email", default="markeseeley@gmail.com", help="User email (defaults to project owner)")
    ap.add_argument("--delete", action="store_true", help="Actually delete the orphans. Without this flag, only previews.")
    args = ap.parse_args()

    print(f"Resolving user_id for {args.email}…")
    user_id = lookup_user_id(args.email)
    print(f"  user_id = {user_id}")

    print(f"\nListing files in marked/{user_id}/ …")
    files = list_storage_files(user_id)
    print(f"  total storage files: {len(files)}")
    total_size = sum(f["size"] for f in files)
    print(f"  total size:          {total_size / 1_048_576:.1f} MB")

    print(f"\nFetching mark_events file_names for this user…")
    live_filenames = fetch_mark_event_filenames(user_id)
    print(f"  live mark_events rows: {len(live_filenames)}")

    # An orphan is a storage file whose `name` (without the user_id prefix)
    # is NOT in the live mark_events.file_name set.
    orphans = []
    for f in files:
        # Storage `name` is the basename within the prefix (e.g. "essay.docx")
        # — Supabase Storage list returns just the filename, not the full path.
        if f["name"] not in live_filenames:
            orphans.append(f)

    orphan_size = sum(f["size"] for f in orphans)
    print(f"\nOrphan files:        {len(orphans)}")
    print(f"Orphan size:         {orphan_size / 1_048_576:.1f} MB")

    if not orphans:
        print("\nNothing to clean up. Done.")
        return

    print(f"\nSample (up to 20):")
    for f in orphans[:20]:
        print(f"  {f['size']:>10} B   {f['name']}")
    if len(orphans) > 20:
        print(f"  …and {len(orphans) - 20} more")

    if not args.delete:
        print("\n(Preview only — pass --delete to actually remove these files.)")
        return

    # Build full paths for deletion (Storage API wants the prefix-included path).
    full_paths = [f"{user_id}/{f['name']}" for f in orphans]
    confirm = input(f"\nType DELETE to remove {len(full_paths)} orphan files: ")
    if confirm.strip() != "DELETE":
        print("Aborted.")
        return

    print(f"\nDeleting {len(full_paths)} files…")
    deleted, errors = delete_storage_files(full_paths)
    print(f"\nDeleted: {deleted}/{len(full_paths)}")
    if errors:
        print("\nErrors:")
        for e in errors:
            print(f"  {e}")


if __name__ == "__main__":
    main()
