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
[ "$ID" = "de6edbd7-daa6-477c-b981-5f6e26661650" ] || sed -i "s/de6edbd7-daa6-477c-b981-5f6e26661650/$ID/" wrangler.jsonc
echo "D1 $NAME = $ID"
