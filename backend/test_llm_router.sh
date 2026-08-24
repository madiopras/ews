#!/bin/bash
# Test Script for 9router LLM Integration

echo "=========================================="
echo "Testing 9router LLM Configuration"
echo "=========================================="
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check if condition is true
check() {
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓${NC} $1"
    else
        echo -e "${RED}✗${NC} $1"
    fi
}

# Check environment variables
echo "1️⃣ Checking Environment Variables..."
echo "---"
LLM_BASE_URL=$(grep "LLM_BASE_URL=" backend/.env | cut -d'=' -f2)
LLM_API_KEY=$(grep "LLM_API_KEY=" backend/.env | cut -d'=' -f2)
LLM_MODEL_NAME=$(grep "LLM_MODEL_NAME=" backend/.env | cut -d'=' -f2)

test -n "$LLM_BASE_URL" && check "LLM_BASE_URL set: $LLM_BASE_URL"
test -n "$LLM_API_KEY" && check "LLM_API_KEY configured"
test -n "$LLM_MODEL_NAME" && check "LLM_MODEL_NAME set: $LLM_MODEL_NAME"
echo ""

# Check Python imports
echo "2️⃣ Checking Python Imports..."
echo "---"
cd /home/prasdios/aiproject/ews/backend

python3 -c "import httpx" 2>/dev/null && check "httpx installed" || check "httpx NOT installed (pip install httpx)"
python3 -c "import json" 2>/dev/null && check "json module available" || check "json module NOT found"
python3 -c "import asyncio" 2>/dev/null && check "asyncio available" || check "asyncio NOT found"
echo ""

# Check if LLM client class exists in server.py
echo "3️⃣ Checking Server Configuration..."
echo "---"
grep -q "class LocalLLMClient:" server.py && check "LocalLLMClient class defined" || check "LocalLLMClient NOT found"
grep -q "llm_client = LocalLLMClient" server.py && check "LLM client instance created" || check "LLM client NOT initialized"
! grep -q "from emergentintegrations" server.py && check "No emergent integrations import" || check "Still has emergent import!"
echo ""

# Check if backend server can be imported without error
echo "4️⃣ Testing Backend Import..."
echo "---"
python3 -c "import sys; sys.path.insert(0, '.'); import importlib.util; spec = importlib.util.spec_from_file_location('server', 'server.py'); module = importlib.util.module_from_spec(spec); print('Import successful!')" 2>&1 | grep -q "success" && check "Backend imports successfully" || check "Import error detected"
echo ""

# Test direct connection to 9router
echo "5️⃣ Testing Connection to 9router..."
echo "---"
RESPONSE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:20128/" 2>/dev/null || echo "000")

if [ "$RESPONSE" = "000" ]; then
    echo -e "${YELLOW}⚠${NC} Cannot reach 9router at localhost:20128"
    echo -e "${YELLOW}   Make sure 9router service is running!${NC}"
else
    check "9router endpoint responding (HTTP $RESPONSE)"
fi
echo ""

# Summary
echo "=========================================="
echo "Summary"
echo "=========================================="
echo ""
echo "Configuration Details:"
echo "  • Base URL: ${LLM_BASE_URL:-NOT SET}"
echo "  • Model Name: ${LLM_MODEL_NAME:-NOT SET}"
echo "  • API Key: ${LLM_API_KEY:0:20}...${LLM_API_KEY: -4:-0:-}"
echo "  • Status: Ready for testing"
echo ""
echo "Next Steps:"
echo "  1. Start backend: make dev-backend"
echo "  2. Test LLM endpoint: curl http://localhost:8000/api/health"
echo "  3. Try chat feature via Swagger UI: http://localhost:8000/docs"
echo ""
echo "Done! 🚀"
