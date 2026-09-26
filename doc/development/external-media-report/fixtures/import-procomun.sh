#!/bin/sh
# Import evil.elpx into Procomún as a NEW resource, through its own legacy-import CLI.
#
# The importer consumes PAIRS of <name>.json + <name>.elpx, and it validates the ODE
# metadata, so the JSON is derived from a real fixture rather than invented — an invented
# one is rejected as "blocked" and proves nothing.
#
# Re-importing the SAME package into a database that already holds it is skipped as "ya
# importado". Tear the environment down properly first — `make down && make clean`, which
# drops `local-data` (the PGlite store) — and `make up` re-seeds from scratch.
#
# Usage: ./import-procomun.sh /path/to/evil.elpx [/path/to/procomun]
set -e

PACKAGE="${1:?usage: import-procomun.sh <package.elpx> [procomun-repo]}"
REPO="${2:-$HOME/Downloads/git/procomun}"
WORK="${TMPDIR:-/tmp}/procomun-import-$$"

[ -f "$PACKAGE" ] || { echo "no such package: $PACKAGE" >&2; exit 1; }
[ -d "$REPO" ] || { echo "no such repo: $REPO" >&2; exit 1; }

# PGlite is a SINGLE-WRITER embedded engine. Importing while the dev server holds the data
# directory appears to succeed and then is not what the server serves — the row is there on
# disk and invisible to the running process. Stop it first; that is not optional.
if lsof -nP -iTCP:3000 -sTCP:LISTEN >/dev/null 2>&1 || lsof -nP -iTCP:5173 -sTCP:LISTEN >/dev/null 2>&1; then
	echo "Procomún is running. Stop it first (its database is single-writer):" >&2
	echo "  pkill -f '@procomun'" >&2
	exit 1
fi

mkdir -p "$WORK"
python3 - "$REPO" "$WORK" <<'PY'
import json, pathlib, sys
repo, work = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
src = repo / "apps/cli/src/test-fixtures/legacy-procomun/1615293421477.json"
d = json.loads(src.read_text())
d["id"] = d["idODE"] = "evil-elpx-probe"
d["titleStr"] = "evil.elpx (adversarial probe)"
(work / "evil.json").write_text(json.dumps(d, ensure_ascii=False, indent=2))
PY
cp "$PACKAGE" "$WORK/evil.elpx"

cd "$REPO"
bun run apps/cli/src/index.ts import:legacy-procomun --source-dir "$WORK" --report-dir "$WORK/report"

# The public route resolves by SLUG, not by id, and the SPA reads it from `?slug=`.
bun -e '
const { PGlite } = await import("@electric-sql/pglite");
const db = new PGlite("./local-data");
const r = await db.query("select slug, editorial_status from resources where external_id = $1", ["evil-elpx-probe"]);
console.log("slug:", r.rows[0]?.slug, "status:", r.rows[0]?.editorial_status);
await db.close();'

rm -rf "$WORK"
echo "Restart with: bun run --filter '@procomun/*' dev"
echo "Then put http://localhost:5173/recurso?slug=<slug> in pages.spec.ts and shots.spec.ts."
