#!/bin/bash

# Nobonir E-Commerce - Development Server Startup Script

set -e

echo "==================================="
echo "Starting Nobonir E-Commerce"
echo "==================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

cleanup() {
    if [ -n "${BACKEND_PID:-}" ] && kill -0 "$BACKEND_PID" 2>/dev/null; then
        kill "$BACKEND_PID" 2>/dev/null || true
    fi
    if [ -n "${FRONTEND_PID:-}" ] && kill -0 "$FRONTEND_PID" 2>/dev/null; then
        kill "$FRONTEND_PID" 2>/dev/null || true
    fi
}

trap "cleanup; echo -e '\n${GREEN}Servers stopped${NC}'; exit" INT TERM

# Check if we're in the project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "Error: This script must be run from the project root directory"
    exit 1
fi

# Activate Python virtual environment
if [ ! -f ".venv/bin/activate" ]; then
    echo -e "${RED}Error: Virtual environment not found at .venv/bin/activate${NC}"
    echo "Create it first: python3 -m venv .venv && source .venv/bin/activate && pip install -r backend/requirements.txt"
    exit 1
fi

source .venv/bin/activate

# Free LLM (no paid API) defaults
export AI_FREE_LLM_ENABLED="${AI_FREE_LLM_ENABLED:-1}"
export AI_FREE_LLM_PROVIDER="${AI_FREE_LLM_PROVIDER:-pollinations}"
export AI_FREE_LLM_PROVIDERS="${AI_FREE_LLM_PROVIDERS:-pollinations,huggingface}"
export AI_FREE_LLM_TIMEOUT_SECONDS="${AI_FREE_LLM_TIMEOUT_SECONDS:-8}"
export AI_FREE_LLM_POLLINATIONS_URL="${AI_FREE_LLM_POLLINATIONS_URL:-https://text.pollinations.ai}"
export AI_FREE_LLM_HUGGINGFACE_URL="${AI_FREE_LLM_HUGGINGFACE_URL:-https://api-inference.huggingface.co/models/google/flan-t5-large}"
export AI_FREE_LLM_HUGGINGFACE_TOKEN="${AI_FREE_LLM_HUGGINGFACE_TOKEN:-}"

# Start backend
echo -e "\n${BLUE}Starting Django backend...${NC}"
cd backend
echo -e "${BLUE}Applying database migrations...${NC}"
python3 manage.py migrate --noinput
python3 manage.py runserver 8000 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
cd ..

# Wait a moment for backend to initialize
sleep 2

if ! kill -0 "$BACKEND_PID" 2>/dev/null; then
    echo -e "${RED}✗ Django backend failed to start. Fix the error above and retry.${NC}"
    cleanup
    exit 1
fi

# Start frontend
echo -e "\n${BLUE}Starting React frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

# Wait a moment for frontend to initialize
sleep 2

if ! kill -0 "$FRONTEND_PID" 2>/dev/null; then
    echo -e "${RED}✗ React frontend failed to start. Fix the error above and retry.${NC}"
    cleanup
    exit 1
fi

echo -e "\n==================================="
echo -e "${GREEN}Both servers are running!${NC}"
echo "==================================="
echo ""
echo "Backend:  http://127.0.0.1:8000"
echo "API Docs: http://127.0.0.1:8000/api/docs/swagger/"
echo "Frontend: http://localhost:5173"
echo ""
echo "Press Ctrl+C to stop both servers"
echo ""

# Keep script running
wait
