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
pip install -q pytest pytest-asyncio pytest-cov pytest-mock httpx factory-boy

# Set test environment variables
export ENVIRONMENT=test
export DATABASE_URL=sqlite:///:memory:
export JWT_SECRET=test_secret_key
export REDIS_URL=redis://localhost:6379/15

# Run different test suites
echo ""
echo "🔒 Running Security Tests..."
pytest tests/security/ -v --tb=short || echo "⚠️  Some security tests need fixing"

echo ""
echo "💰 Running Payment Tests..."
pytest tests/payment/ -v --tb=short || echo "⚠️  Some payment tests need fixing"

echo ""
echo "📦 Running Unit Tests..."
pytest tests/unit/ -v --tb=short || echo "⚠️  Some unit tests need fixing"

echo ""
echo "🔌 Running Integration Tests..."
pytest tests/integration/ -v --tb=short || echo "⚠️  Some integration tests need fixing"

echo ""
echo "💼 Running Business Logic Tests..."
pytest tests/business/ -v --tb=short || echo "⚠️  Some business tests need fixing"

echo ""
echo "🌐 Running WebSocket Tests..."
pytest tests/ -k "websocket" -v --tb=short || echo "⚠️  Some websocket tests need fixing"

echo ""
echo "🏢 Running Multi-tenant Tests..."
pytest tests/ -k "multitenant or tenant" -v --tb=short || echo "⚠️  Some multi-tenant tests need fixing"

echo ""
echo "📊 Running Full Test Suite with Coverage..."
pytest tests/ --cov=app --cov-report=term-missing --cov-report=html --cov-fail-under=80 -x || {
    echo ""
    echo "❌ Test suite failed or coverage below 80%"
    echo "Please fix failing tests and improve coverage"
    exit 1
}

echo ""
echo "✅ All tests passed with sufficient coverage!"
echo ""
echo "📈 Coverage Summary:"
coverage report -m --include="app/*" | head -20

echo ""
echo "🔍 Critical Module Coverage:"
echo "- Payment Processing: $(coverage report -m --include="app/services/payment*" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"
echo "- Authentication: $(coverage report -m --include="app/core/auth.py,app/api/v1/endpoints/auth.py" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"
echo "- Security: $(coverage report -m --include="app/core/security.py,app/core/validation.py" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"
echo "- Multi-tenant: $(coverage report -m --include="app/core/tenant*" 2>/dev/null | grep -E "TOTAL" | awk '{print $4}')"

echo ""
echo "📝 Full coverage report available at: htmlcov/index.html"
echo "Run 'open htmlcov/index.html' to view detailed coverage"