#!/bin/bash
#
# DigitalOcean App Platform Database Migration Script
# 
# This script runs the database migration on DigitalOcean App Platform
# It can be executed via the console or as a one-time job
#
# Usage:
#   ./scripts/digitalocean_migration.sh
#

set -e  # Exit on error

echo "=================================================="
echo "     Fynlo Database Migration - DigitalOcean      "
echo "=================================================="
echo ""

# Check if we're in the backend directory
if [ ! -f "app/main.py" ]; then
    echo "❌ Error: This script must be run from the backend directory"
    echo "   Current directory: $(pwd)"
    exit 1
fi

# Check for required environment variables
if [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: DATABASE_URL environment variable not set"
    echo "   This should be automatically set in DigitalOcean App Platform"
    exit 1
fi

# Note: On DigitalOcean App Platform, dependencies are pre-installed
# and the filesystem may be read-only, so we skip virtual environment setup

# Check if we can import required modules
echo "🔍 Checking Python environment..."
if ! python3 -c "import sqlalchemy, dotenv" 2>/dev/null; then
    echo "⚠️  Warning: Required Python modules not found"
    echo "   Attempting to install dependencies..."
    
    # Try to install dependencies (may fail on read-only systems)
    if ! pip install sqlalchemy python-dotenv 2>/dev/null; then
        echo "❌ Error: Cannot install dependencies"
        echo "   This environment may have a read-only filesystem"
        echo "   Please ensure dependencies are pre-installed in the build phase"
        exit 1
    fi
fi

echo "✅ Python environment ready"

# Run the migration
echo "🔄 Running database migration..."
echo ""

python3 scripts/migrate_database_columns.py --force

echo ""
echo "✅ Migration completed!"
echo ""
echo "Next steps:"
echo "1. The backend service will automatically restart"
echo "2. Check the runtime logs for any errors"
echo "3. Test authentication to verify the fix"
echo ""