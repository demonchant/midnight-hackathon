#!/usr/bin/env bash
set -euo pipefail

if ! command -v node >/dev/null 2>&1; then
  echo "BLOCKED: Node.js 20 or newer is required." >&2
  exit 2
fi
node -e 'const [major] = process.versions.node.split(".").map(Number); if (major < 20) process.exit(1)' || {
  echo "BLOCKED: Node.js 20 or newer is required; found $(node --version)." >&2
  exit 2
}
if ! command -v "${COMPACT_BIN:-compact}" >/dev/null 2>&1; then
  echo "BLOCKED: Compact CLI '${COMPACT_BIN:-compact}' is not on PATH. Install the official toolchain in WSL." >&2
  exit 2
fi

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
export CPG_PROJECT_ROOT="${CPG_PROJECT_ROOT:-$PROJECT_DIR}"
export COMPACT_BIN="${COMPACT_BIN:-compact}"
printf 'Compact CLI found: %s\n' "$(command -v "$COMPACT_BIN")"
printf 'Project root: %s\n' "$CPG_PROJECT_ROOT"
printf 'Starting local UI at http://127.0.0.1:%s\n' "${CPG_PORT:-4178}"
exec node "$PROJECT_DIR/server.mjs"
