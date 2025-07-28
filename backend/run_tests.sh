#!/bin/bash

echo "🧪 Running Fynlo POS Test Suite"
echo "================================"

# Set Python path
export PYTHONPATH="${PYTHONPATH}:$(pwd)"

# Check if virtual environment is activated
if [[ "$VIRTUAL_ENV" == "" ]]; then
    echo "⚠️  Virtual environment not activated. Activating..."
    source venv/bin/activate 2>/dev/null || {
        echo "❌ Failed to activate virtual environment"
        echo "Please run: source venv/bin/activate"
        exit 1
    }
fi

# Install test dependencies if needed
echo "📦 Checking test dependencies..."
pip install -q pytest pytest-asyncio pytest-cov pytest-mock

# Run different test categories
echo ""
echo "🔒 Running Security Tests..."
pytest tests/test_websocket_security.py tests/test_multitenant_isolation.py -v --tb=short -m "not slow"

echo ""
echo "🌐 Running WebSocket Tests..."
pytest tests/ -k "websocket" -v --tb=short

echo ""
echo "🏢 Running Multi-tenant Tests..."
pytest tests/ -k "multitenant or tenant" -v --tb=short

echo ""
echo "🔐 Running Authentication Tests..."
pytest tests/ -k "auth" -v --tb=short

echo ""
echo "📊 Running Full Test Suite with Coverage..."
pytest tests/ --cov=app --cov-report=term-missing --cov-report=html

echo ""
echo "📈 Coverage Summary:"
coverage report -m --include="app/*" | grep -E "(TOTAL|websocket|auth|security)"

echo ""
echo "🔍 Critical Coverage Gaps:"
echo "- WebSocket implementation: $(coverage report -m --include="app/core/websocket.py,app/api/v1/endpoints/websocket.py" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"
echo "- Authentication: $(coverage report -m --include="app/core/auth.py" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"
echo "- Security: $(coverage report -m --include="app/core/security.py" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"

echo ""
echo "📝 Full coverage report available at: htmlcov/index.html"
echo "Run 'open htmlcov/index.html' to view detailed coverage"