#!/bin/bash

# Fynlo POS Backend - Development Server Startup Script

echo "🚀 Starting Fynlo POS Backend Development Server..."

# Check if virtual environment exists
if [ ! -d "venv" ]; then
    echo "❌ Virtual environment not found. Run setup_dev_environment.sh first."
    exit 1
fi

# Activate virtual environment
echo "📦 Activating virtual environment..."
source venv/bin/activate

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "❌ .env file not found."
    echo "⚠️  Please create a .env file with your configuration before continuing."
    exit 1
fi

# Check if PostgreSQL is running
echo "🔍 Checking PostgreSQL connection..."
if ! pg_isready -h localhost -p 5432; then
    echo "❌ PostgreSQL is not running. Starting PostgreSQL..."
    brew services start postgresql@15
    sleep 3
fi

# Check if Redis is running
echo "🔍 Checking Redis connection..."
if ! redis-cli ping > /dev/null 2>&1; then
    echo "❌ Redis is not running. Starting Redis..."
    brew services start redis
    sleep 2
fi

# Test database connection
echo "🗄️ Testing database connection..."
python -c "
from app.core.config import settings
import psycopg2
try:
    conn = psycopg2.connect(settings.DATABASE_URL)
    conn.close()
    print('✅ Database connection successful')
except Exception as e:
    print(f'❌ Database connection failed: {e}')
    exit(1)
"

# Run migrations
echo "🔄 Applying database migrations..."
alembic upgrade head

if [ $? -ne 0 ]; then
    echo "❌ Migration failed. Creating initial migration..."
    alembic revision --autogenerate -m "Initial migration"
    alembic upgrade head
fi

echo "✅ Backend setup complete!"
echo ""
echo "🌐 Starting development server..."
echo "   API: http://localhost:8000"
echo "   Docs: http://localhost:8000/docs"
echo "   Health: http://localhost:8000/health"
echo ""
echo "Press Ctrl+C to stop the server"
echo ""

# Start the FastAPI server
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000