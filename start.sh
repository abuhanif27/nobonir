#!/bin/bash

# Nobonir E-Commerce - Development Server Startup Script

set -e

echo "==================================="
echo "Starting Nobonir E-Commerce"
echo "==================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Check if we're in the project root
if [ ! -d "backend" ] || [ ! -d "frontend" ]; then
    echo "Error: This script must be run from the project root directory"
    exit 1
fi

# Start backend
echo -e "\n${BLUE}Starting Django backend...${NC}"
cd backend
python3 manage.py runserver 8000 &
BACKEND_PID=$!
echo -e "${GREEN}✓ Backend started (PID: $BACKEND_PID)${NC}"
cd ..

# Wait a moment for backend to initialize
sleep 2

# Start frontend
echo -e "\n${BLUE}Starting React frontend...${NC}"
cd frontend
npm run dev &
FRONTEND_PID=$!
echo -e "${GREEN}✓ Frontend started (PID: $FRONTEND_PID)${NC}"
cd ..

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

# Wait for Ctrl+C
trap "kill $BACKEND_PID $FRONTEND_PID; echo -e '\n${GREEN}Servers stopped${NC}'; exit" INT

# Keep script running
wait
