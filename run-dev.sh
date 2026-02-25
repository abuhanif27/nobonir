#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
PYTHON_BIN="$ROOT_DIR/.venv/bin/python"

BACKEND_HOST="${BACKEND_HOST:-127.0.0.1}"
BACKEND_PORT="${BACKEND_PORT:-8000}"
FRONTEND_HOST="${FRONTEND_HOST:-127.0.0.1}"
FRONTEND_PORT="${FRONTEND_PORT:-5173}"

if [[ ! -x "$PYTHON_BIN" ]]; then
  echo "Error: Python virtualenv not found at $PYTHON_BIN"
  echo "Create it first, then install backend dependencies."
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required but not found in PATH."
  exit 1
fi

cleanup() {
  echo
  echo "Stopping frontend and backend..."
  if [[ -n "${FRONTEND_PID:-}" ]] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
    kill "$FRONTEND_PID" 2>/dev/null || true
  fi
  if [[ -n "${BACKEND_PID:-}" ]] && kill -0 "$BACKEND_PID" 2>/dev/null; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
  wait 2>/dev/null || true
}

trap cleanup INT TERM EXIT

echo "Starting Django backend on http://$BACKEND_HOST:$BACKEND_PORT ..."
(
  cd "$BACKEND_DIR"
  "$PYTHON_BIN" manage.py runserver "$BACKEND_HOST:$BACKEND_PORT"
) &
BACKEND_PID=$!

echo "Starting React frontend on http://$FRONTEND_HOST:$FRONTEND_PORT ..."
(
  cd "$FRONTEND_DIR"
  npm run dev -- --host "$FRONTEND_HOST" --port "$FRONTEND_PORT"
) &
FRONTEND_PID=$!

echo "Both services started. Press Ctrl+C to stop both."
wait -n "$BACKEND_PID" "$FRONTEND_PID"
