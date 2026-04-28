#!/bin/bash
# SessionStart hook: install dependencies and run the test suite so every
# Claude Code session starts with a known-green baseline.
set -euo pipefail

# Only run in remote (Claude Code on the web) environments. Local sessions
# already have node_modules and don't need to wait on a fresh install.
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi

cd "${CLAUDE_PROJECT_DIR:-$(pwd)}"

echo "[session-start] Installing dependencies..."
npm install --no-audit --no-fund

echo "[session-start] Running test suite..."
npm test
