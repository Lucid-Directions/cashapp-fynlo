#!/bin/bash

# Fynlo POS Backend - Development Environment Setup Script
echo "🚀 Setting up Fynlo POS Backend Development Environment..."

# Check if we're on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    echo "❌ This script is designed for macOS. Please adapt for your OS."
    exit 1
fi

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

echo "📦 Installing PostgreSQL..."
if ! command -v psql &> /dev/null; then
    brew install postgresql@15
    brew services start postgresql@15
    echo "✅ PostgreSQL installed and started"
else
    echo "✅ PostgreSQL already installed"
    brew services restart postgresql@15
fi

echo "📦 Installing Redis..."
if ! command -v redis-server &> /dev/null; then
    brew install redis
    brew services start redis
    echo "✅ Redis installed and started"
else
    echo "✅ Redis already installed"
    brew services restart redis
fi

# Wait for PostgreSQL to be ready
echo "⏳ Waiting for PostgreSQL to be ready..."
sleep 3

# Create database and user
echo "🗄️ Setting up PostgreSQL database..."
psql postgres << EOF
-- Create user if not exists
DO \$\$
BEGIN
    IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'fynlo_user') THEN
        CREATE USER fynlo_user WITH PASSWORD 'fynlo_password';
    END IF;
END
\$\$;

-- Create database if not exists
SELECT 'CREATE DATABASE fynlo_pos' WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'fynlo_pos')\gexec

-- Grant privileges
GRANT ALL PRIVILEGES ON DATABASE fynlo_pos TO fynlo_user;
GRANT ALL ON SCHEMA public TO fynlo_user;
ALTER USER fynlo_user CREATEDB;
EOF

if [ $? -eq 0 ]; then
    echo "✅ Database 'fynlo_pos' and user 'fynlo_user' created successfully"
else
    echo "⚠️  Database setup encountered issues, but continuing..."
fi

# Test database connection
echo "🔍 Testing database connection..."
psql -h localhost -U fynlo_user -d fynlo_pos -c "SELECT version();" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Database connection successful"
else
    echo "❌ Database connection failed"
    echo "💡 You may need to set up PostgreSQL authentication manually"
fi

# Test Redis connection
echo "🔍 Testing Redis connection..."
redis-cli ping > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✅ Redis connection successful"
else
    echo "❌ Redis connection failed"
fi

# Check Python virtual environment
echo "🐍 Checking Python environment..."
if [ ! -d "venv" ]; then
    echo "📦 Creating Python virtual environment..."
    python3 -m venv venv
fi

echo "📦 Activating virtual environment and installing dependencies..."
source venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt

echo "✅ Development environment setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Activate virtual environment: source venv/bin/activate"
echo "2. Run database migrations: alembic upgrade head"
echo "3. Start the server: uvicorn app.main:app --reload"
echo "4. Open http://localhost:8000 in your browser"
echo ""
echo "🔧 Services status:"
echo "   PostgreSQL: $(brew services list | grep postgresql | awk '{print $2}')"
echo "   Redis: $(brew services list | grep redis | awk '{print $2}')"
echo ""
echo "🗄️ Database details:"
echo "   Host: localhost"
echo "   Port: 5432"
echo "   Database: fynlo_pos"
echo "   User: fynlo_user"
echo "   Password: fynlo_password"