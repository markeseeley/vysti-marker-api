#!/usr/bin/env bash
set -euo pipefail

A="$HOME/Desktop/vysti-marker-api"
B="$HOME/Desktop/vysti-marker-api-clean"
DEST="$HOME/Desktop/vysti-marker-api-unified"

echo "A = $A"
echo "B = $B"
echo "DEST = $DEST"

if [[ ! -d "$A" ]]; then echo "Missing: $A"; exit 1; fi
if [[ ! -d "$B" ]]; then echo "Missing: $B"; exit 1; fi
if [[ -e "$DEST" ]]; then echo "DEST already exists: $DEST (move it aside first)"; exit 1; fi

# Ignore patterns (keep the audit/copy fast and sane)
EXCLUDES=(
  "--exclude=.git"
  "--exclude=node_modules"
  "--exclude=dist"
  "--exclude=.vite"
  "--exclude=.DS_Store"
  "--exclude=coverage"
  "--exclude=*.log"
)

mkdir -p "$DEST"

echo "== Copying CLEAN (B) into unified DEST =="
rsync -a "${EXCLUDES[@]}" "$B"/ "$DEST"/

# Copy .git ONLY from B if it exists (we assume B is the active dev repo)
if [[ -d "$B/.git" ]]; then
  echo "== Copying .git from CLEAN into DEST =="
  rsync -a "$B/.git" "$DEST/.git"
fi

echo "== Auditing A vs B (hash-based) =="
mkdir -p "$DEST/docs" "$DEST/conflicts/original" "$DEST/conflicts/clean" "$DEST/conflicts/diffs"

python3 - <<'PY'
import os, hashlib, pathlib, difflib, sys

A = os.path.expanduser("~/Desktop/vysti-marker-api")
B = os.path.expanduser("~/Desktop/vysti-marker-api-clean")
DEST = os.path.expanduser("~/Desktop/vysti-marker-api-unified")

IGNORE_DIRS = {"node_modules","dist",".git",".vite","coverage","__pycache__"}
IGNORE_FILES = {".DS_Store"}
IGNORE_EXTS = {".log"}

TEXT_EXTS = {
  ".js",".jsx",".ts",".tsx",".html",".css",".json",".md",".txt",".yml",".yaml",".sh",".mjs",".cjs",".py"
}

def iter_files(root):
  for dirpath, dirnames, filenames in os.walk(root):
    # prune ignored dirs
    dirnames[:] = [d for d in dirnames if d not in IGNORE_DIRS]
    for fn in filenames:
      if fn in IGNORE_FILES: 
        continue
      p = os.path.join(dirpath, fn)
      rel = os.path.relpath(p, root)
      ext = pathlib.Path(fn).suffix.lower()
      if ext in IGNORE_EXTS:
        continue
      yield rel, p

def sha1(path):
  h = hashlib.sha1()
  with open(path, "rb") as f:
    while True:
      b = f.read(1024*1024)
      if not b: break
      h.update(b)
  return h.hexdigest()

def build_map(root):
  m = {}
  for rel, p in iter_files(root):
    try:
      m[rel] = (sha1(p), p)
    except Exception as e:
      m[rel] = ("<unreadable>", p)
  return m

am = build_map(A)
bm = build_map(B)

a_set = set(am.keys())
b_set = set(bm.keys())

only_a = sorted(a_set - b_set)
only_b = sorted(b_set - a_set)
both = sorted(a_set & b_set)

diff = []
for rel in both:
  if am[rel][0] != bm[rel][0]:
    diff.append(rel)

report_path = os.path.join(DEST, "docs", "merge-audit.md")
with open(report_path, "w", encoding="utf-8") as r:
  r.write("# Desktop repo audit: vysti-marker-api vs vysti-marker-api-clean\n\n")
  r.write(f"- Only in original (A): **{len(only_a)}**\n")
  r.write(f"- Only in clean (B): **{len(only_b)}**\n")
  r.write(f"- In both but different: **{len(diff)}**\n\n")

  def write_list(title, items, limit=300):
    r.write(f"## {title} ({len(items)})\n\n")
    if not items:
      r.write("_None._\n\n")
      return
    shown = items[:limit]
    for x in shown:
      r.write(f"- `{x}`\n")
    if len(items) > limit:
      r.write(f"\n…truncated (showing {limit} of {len(items)})\n\n")
    else:
      r.write("\n")

  write_list("Only in original (A)", only_a)
  write_list("Only in clean (B)", only_b)
  write_list("Different content (A vs B)", diff)

# Save conflict copies + diffs for text-like files
conf_clean = os.path.join(DEST, "conflicts", "clean")
conf_orig  = os.path.join(DEST, "conflicts", "original")
conf_diffs = os.path.join(DEST, "conflicts", "diffs")

for rel in diff:
  a_path = am[rel][1]
  b_path = bm[rel][1]
  rel_dir = os.path.dirname(rel)

  os.makedirs(os.path.join(conf_clean, rel_dir), exist_ok=True)
  os.makedirs(os.path.join(conf_orig, rel_dir), exist_ok=True)
  os.makedirs(os.path.join(conf_diffs, rel_dir), exist_ok=True)

  # copy both versions into conflicts/
  try:
    with open(b_path, "rb") as f: b_bytes = f.read()
    with open(os.path.join(conf_clean, rel), "wb") as f: f.write(b_bytes)
  except: 
    pass

  try:
    with open(a_path, "rb") as f: a_bytes = f.read()
    with open(os.path.join(conf_orig, rel), "wb") as f: f.write(a_bytes)
  except:
    pass

  # create a unified diff for text-ish files
  ext = pathlib.Path(rel).suffix.lower()
  if ext in TEXT_EXTS:
    try:
      a_txt = open(a_path, "r", encoding="utf-8", errors="replace").read().splitlines(True)
      b_txt = open(b_path, "r", encoding="utf-8", errors="replace").read().splitlines(True)
      d = difflib.unified_diff(a_txt, b_txt, fromfile=f"A/{rel}", tofile=f"B/{rel}")
      diff_path = os.path.join(conf_diffs, rel + ".diff")
      with open(diff_path, "w", encoding="utf-8") as f:
        f.writelines(d)
    except:
      pass

print("Wrote audit report:", report_path)
print("Wrote conflicts under:", os.path.join(DEST, "conflicts"))
PY

echo "== Copying files that exist ONLY in original (A) into unified DEST (no overwrites) =="
rsync -a --ignore-existing "${EXCLUDES[@]}" "$A"/ "$DEST"/

echo ""
echo "DONE."
echo "Unified folder: $DEST"
echo "Audit report:    $DEST/docs/merge-audit.md"
echo "Conflicts:       $DEST/conflicts/"
echo ""
echo "Next: open $DEST as the ONLY workspace folder in Cursor."
