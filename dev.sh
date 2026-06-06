#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# dev.sh — one command to run the whole app locally.
#
#   ./dev.sh
#
# Starts the Flask backend (:8000) and the Vite frontend (:5173) together,
# loading backend/.env for configuration. Ctrl-C stops both cleanly.
#
# The "empty section / black carousel" bugs all came from the backend not
# running — this makes sure it always comes up alongside the frontend.
# ─────────────────────────────────────────────────────────────────────────
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/web-frontend"

# ── Resolve the backend Python (prefer the project venv) ──
if [ -x "$BACKEND/venv/bin/python" ]; then
  PY="$BACKEND/venv/bin/python"
elif [ -x "$BACKEND/.venv/bin/python" ]; then
  PY="$BACKEND/.venv/bin/python"
else
  PY="$(command -v python3 || command -v python)"
fi

# ── Load backend/.env (create it from the template on first run) ──
if [ ! -f "$BACKEND/.env" ]; then
  echo "→ backend/.env not found; creating it from .env.example"
  cp "$BACKEND/.env.example" "$BACKEND/.env"
fi
# Export every var defined in .env into this shell. This is what lets the
# backend boot even when python-dotenv isn't installed in the venv.
set -a
# shellcheck disable=SC1091
source "$BACKEND/.env"
set +a

# ── Clean shutdown: kill both children on exit ──
pids=()
cleanup() {
  echo ""
  echo "→ Shutting down…"
  for pid in "${pids[@]}"; do
    kill "$pid" 2>/dev/null || true
  done
  wait 2>/dev/null || true
}
trap cleanup INT TERM EXIT

# ── Backend ──
echo "→ Starting backend (Flask) on :${PORT:-8000}  [$PY]"
( cd "$BACKEND" && "$PY" app.py ) &
pids+=($!)

# ── Frontend ──
echo "→ Starting frontend (Vite) on :5173"
( cd "$FRONTEND" && npm run dev ) &
pids+=($!)

echo ""
echo "  Frontend → http://localhost:5173"
echo "  Backend  → http://localhost:${PORT:-8000}/api/trails"
echo "  (Ctrl-C to stop both)"
echo ""

# Wait for either process; if one dies, cleanup() tears down the other.
wait -n
