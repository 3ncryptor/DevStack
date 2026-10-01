#!/usr/bin/env bash
# Builds the codebase knowledge graph (graphify-out/, git-ignored) and wires the graphify skill
# into the AI coding tools the team uses. Safe to re-run. Usage: npm run graph
set -euo pipefail

cd "$(dirname "$0")/.."

# Install graphifyy if not already available
if ! command -v graphify &>/dev/null; then
  if ! command -v uv &>/dev/null; then
    echo "[graphify] uv is required: https://docs.astral.sh/uv/ (or: pipx install graphifyy)" >&2
    exit 1
  fi
  echo "[graphify] installing graphifyy via uv..."
  uv tool install graphifyy
fi

# Run code-only graph extraction (no LLM key required)
echo "[graphify] building code graph..."
graphify update .

echo "[graphify] done — output in graphify-out/"
echo "  graph.html       → open in browser for visual exploration"
echo "  graph.json       → machine-readable graph"
echo "  GRAPH_REPORT.md  → community summary"

# Wire the graphify skill into every AI coding tool the team actually uses,
# not just Claude Code, so whoever opens this repo — regardless of tool —
# can query the codebase graph. Each install is idempotent (writes/updates
# a marked section in that tool's own config, safe to re-run).
echo ""
echo "[graphify] installing the graphify skill for Claude Code, Codex, Cursor, Antigravity..."
for platform in claude codex cursor antigravity; do
  echo "  -> ${platform}"
  graphify "${platform}" install
done

# If an LLM key is present, offer to enrich docs/images too
if [[ -n "${ANTHROPIC_API_KEY:-}" ]]; then
  echo ""
  echo "[graphify] ANTHROPIC_API_KEY detected — run the following to include docs/images:"
  echo "  graphify . --backend claude"
elif [[ -n "${OPENAI_API_KEY:-}" ]]; then
  echo ""
  echo "[graphify] OPENAI_API_KEY detected — run the following to include docs/images:"
  echo "  graphify . --backend openai"
elif [[ -n "${GEMINI_API_KEY:-}" || -n "${GOOGLE_API_KEY:-}" ]]; then
  echo ""
  echo "[graphify] Gemini key detected — run the following to include docs/images:"
  echo "  graphify . --backend gemini"
fi
