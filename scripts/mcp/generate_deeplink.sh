#!/usr/bin/env bash
set -euo pipefail

NAME=${1:-}
if [[ -z "$NAME" ]]; then
  echo "Usage: $0 <server-name>" >&2
  exit 1
fi

if [[ ! -f .cursor/mcp.template.json && ! -f .cursor/mcp.json ]]; then
  echo "No .cursor/mcp.json or template found. Create one first." >&2
  exit 1
fi

CFG_FILE=.cursor/mcp.json
[[ -f "$CFG_FILE" ]] || CFG_FILE=.cursor/mcp.template.json

# Construct a minimal per-server config by extracting that server block
TMP_JSON=$(mktemp)
node -e '
const fs = require("fs");
const name = process.argv[2];
const file = process.argv[3];
const raw = JSON.parse(fs.readFileSync(file, "utf8"));
const server = raw.servers?.[name];
if (!server) { process.exit(2); }
const cfg = { servers: { [name]: server } };
process.stdout.write(JSON.stringify(cfg));
' "$NAME" "$CFG_FILE" > "$TMP_JSON" || { echo "Server not found: $NAME" >&2; exit 2; }

# Base64 encode (no line wrap)
if command -v base64 >/dev/null; then
  if base64 --help 2>&1 | grep -q "-b"; then
    B64=$(base64 -b 0 "$TMP_JSON")
  else
    B64=$(base64 -w 0 "$TMP_JSON")
  fi
else
  echo "base64 not found" >&2; exit 1
fi

URL="cursor://anysphere.cursor-deeplink/mcp/install?name=${NAME}&config=${B64}"
echo "$URL"
