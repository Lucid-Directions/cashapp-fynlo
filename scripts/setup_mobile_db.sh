#!/bin/bash

# CashApp Mobile Database Setup Script
# Sets up PostgreSQL, Redis, and pgbouncer for iOS app integration

set -e

echo "🚀 Setting up CashApp Mobile Database Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please modify for your OS."
    exit 1
fi

# Check if required tools are installed
command -v brew >/dev/null 2>&1 || { print_error "Homebrew is required but not installed."; exit 1; }
command -v psql >/dev/null 2>&1 || { print_error "PostgreSQL is required but not installed."; exit 1; }
command -v redis-cli >/dev/null 2>&1 || { print_error "Redis is required but not installed."; exit 1; }

# Start PostgreSQL service
print_status "Starting PostgreSQL service..."
brew services start postgresql@14 || print_warning "PostgreSQL might already be running"

# Start Redis service
print_status "Starting Redis service..."
brew services start redis || print_warning "Redis might already be running"

# Wait for services to start
sleep 3

# Create cashapp_mobile database if it doesn't exist
print_status "Creating cashapp_mobile database..."
createdb cashapp_mobile 2>/dev/null || print_warning "Database cashapp_mobile might already exist"

# Create cashapp_user
print_status "Creating cashapp_user..."
psql -c "CREATE USER cashapp_user WITH PASSWORD 'cashapp_mobile_password';" 2>/dev/null || print_warning "User cashapp_user might already exist"
psql -c "GRANT ALL PRIVILEGES ON DATABASE cashapp_mobile TO cashapp_user;"
psql -c "ALTER USER cashapp_user CREATEDB;"

# Apply PostgreSQL configuration
print_status "Configuring PostgreSQL for mobile optimization..."
PG_CONFIG_DIR="/opt/homebrew/var/postgresql@14"
if [ -d "$PG_CONFIG_DIR" ]; then
    cp config/postgresql.conf "$PG_CONFIG_DIR/postgresql.conf"
    print_status "PostgreSQL configuration applied"
else
    print_warning "PostgreSQL config directory not found at $PG_CONFIG_DIR"
fi

# Setup pgbouncer
print_status "Setting up pgbouncer..."
cp config/pgbouncer.ini /opt/homebrew/etc/pgbouncer.ini

# Create userlist for pgbouncer
echo '"cashapp_user" "md5'$(echo -n "cashapp_mobile_passwordcashapp_user" | md5)'"' > /opt/homebrew/etc/userlist.txt
print_status "pgbouncer configuration applied"

# Setup Redis configuration
print_status "Setting up Redis..."
mkdir -p /opt/homebrew/var/db/redis
mkdir -p /opt/homebrew/var/log
cp config/redis.conf /opt/homebrew/etc/redis.conf
print_status "Redis configuration applied"

# Restart services with new configurations
print_status "Restarting services with new configurations..."
brew services restart postgresql@14
brew services restart redis

# Start pgbouncer
print_status "Starting pgbouncer..."
brew services start pgbouncer || print_warning "pgbouncer might already be running"

# Wait for services to restart
sleep 5

# Test connections
print_status "Testing database connections..."

# Test PostgreSQL direct connection
if psql -U cashapp_user -d cashapp_mobile -c "SELECT 1;" >/dev/null 2>&1; then
    print_status "PostgreSQL direct connection: OK"
else
    print_error "PostgreSQL direct connection: FAILED"
fi

# Test Redis connection
if redis-cli ping >/dev/null 2>&1; then
    print_status "Redis connection: OK"
else
    print_error "Redis connection: FAILED"
fi

# Test pgbouncer connection
if psql -h 127.0.0.1 -p 6432 -U cashapp_user -d cashapp_mobile -c "SELECT 1;" >/dev/null 2>&1; then
    print_status "pgbouncer connection: OK"
else
    print_warning "pgbouncer connection: Check configuration"
fi

echo ""
print_status "Mobile database setup completed!"
echo ""
echo "📊 Connection Details:"
echo "  PostgreSQL Direct: localhost:5432/cashapp_mobile"
echo "  pgbouncer Pool:    localhost:6432/cashapp_mobile"
echo "  Redis Cache:       localhost:6379"
echo "  Username:          cashapp_user"
echo "  Password:          cashapp_mobile_password"
echo ""
print_status "Ready for iOS app integration!" 