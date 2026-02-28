#!/bin/bash

# Nobonir E-Commerce - Quick Installation Script
# This script sets up the project from scratch

set -e

echo "======================================="
echo "Nobonir E-Commerce - Installation"
echo "======================================="

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check prerequisites
echo -e "\n${BLUE}Checking prerequisites...${NC}"
command -v python3 >/dev/null 2>&1 || { echo "Python 3 is required but not installed. Aborting."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "npm is required but not installed. Aborting."; exit 1; }
echo -e "${GREEN}✓ Python 3 and npm found${NC}"

# Backend setup
echo -e "\n${BLUE}Setting up backend...${NC}"
cd backend

echo "Installing Python dependencies..."
pip3 install Django==6.0 djangorestframework==3.15.2 djangorestframework-simplejwt==5.5.1 drf-spectacular==0.28.0 django-cors-headers==4.6.0 django-filter==25.1 psycopg[binary]==3.2.9 sentence-transformers==5.1.0 scikit-learn==1.6.1 numpy==2.2.3 python-dotenv==1.0.1 stripe==11.5.0

echo "Running migrations..."
python3 manage.py migrate

echo -e "${YELLOW}Creating superuser (admin account)...${NC}"
echo "Please enter admin credentials:"
python3 manage.py createsuperuser

echo "Seeding sample products..."
python3 manage.py seed_products

echo -e "${GREEN}✓ Backend setup complete${NC}"
cd ..

# Frontend setup
echo -e "\n${BLUE}Setting up frontend...${NC}"
cd frontend

echo "Installing npm dependencies..."
npm install

echo -e "${GREEN}✓ Frontend setup complete${NC}"
cd ..

# Create .env files if they don't exist
if [ ! -f "backend/.env" ]; then
    echo -e "\n${YELLOW}Creating backend/.env file...${NC}"
    cat > backend/.env << EOF
DJANGO_SECRET_KEY=$(python3 -c 'from django.core.management.utils import get_random_secret_key; print(get_random_secret_key())')
DEBUG=True
ALLOWED_HOSTS=localhost,127.0.0.1
CORS_ALLOWED_ORIGINS=http://localhost:5173,http://127.0.0.1:5173
FRONTEND_BASE_URL=http://localhost:5173
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
AI_FREE_LLM_ENABLED=1
AI_FREE_LLM_PROVIDER=pollinations
AI_FREE_LLM_TIMEOUT_SECONDS=8
AI_FREE_LLM_POLLINATIONS_URL=https://text.pollinations.ai
EOF
    echo -e "${GREEN}✓ Created backend/.env${NC}"
fi

if [ ! -f "frontend/.env" ]; then
    echo -e "${YELLOW}Creating frontend/.env file...${NC}"
    cat > frontend/.env << EOF
VITE_API_URL=http://127.0.0.1:8000/api
EOF
    echo -e "${GREEN}✓ Created frontend/.env${NC}"
fi

# Summary
echo -e "\n======================================="
echo -e "${GREEN}Installation Complete!${NC}"
echo "======================================="
echo ""
echo "To start the application, run:"
echo "  ./start.sh"
echo ""
echo "Or manually:"
echo "  Terminal 1: cd backend && python3 manage.py runserver"
echo "  Terminal 2: cd frontend && npm run dev"
echo ""
echo "Access points:"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://127.0.0.1:8000"
echo "  API Docs:  http://127.0.0.1:8000/api/docs/swagger/"
echo ""
echo "Use the superuser credentials you just created to login as admin."
echo ""
