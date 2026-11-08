#!/usr/bin/env bash
# D1データベース(shiftcast)が無ければ作成し、wrangler.jsonc の database_id を実IDに置換する（CI用・冪等）。
set -euo pipefail
NAME=shiftcast
find_id() {
  npx wrangler d1 list --json | node -e '
    const l = JSON.parse(require("fs").readFileSync(0, "utf8"));
    const d = l.find((x) => x.name === process.argv[1]);
    process.stdout.write(d ? d.uuid : "");' "$NAME"
}
ID=$(find_id)
if [ -z "$ID" ]; then
  npx wrangler d1 create "$NAME" >/dev/null
  ID=$(find_id)
fi
[ -n "$ID" ] || { echo "D1 database id not found" >&2; exit 1; }
sed -i "s/00000000-0000-0000-0000-000000000000/$ID/" wrangler.jsonc
echo "D1 $NAME = $ID"
