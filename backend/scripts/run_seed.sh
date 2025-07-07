#!/bin/bash

# Fynlo POS - Database Seeding Script
# This script seeds the database with test data for development and testing

echo "🌱 Fynlo POS Database Seeding"
echo "============================="

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "app/main.py" ]; then
    echo -e "${RED}❌ Error: Please run this script from the backend directory${NC}"
    exit 1
fi

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "📦 Activating virtual environment..."
    source venv/bin/activate
else
    echo -e "${YELLOW}⚠️  No virtual environment found. Using system Python.${NC}"
fi

# Check if PostgreSQL is running
echo "🔍 Checking database connection..."
python -c "from app.core.database import SessionLocal; db = SessionLocal(); db.execute('SELECT 1'); db.close()" 2>/dev/null
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Error: Cannot connect to database. Make sure PostgreSQL is running.${NC}"
    echo "   If using Docker: docker-compose up -d postgres"
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"

# Run the seed script
echo ""
echo "🌮 Seeding database with Mexican restaurant data..."
echo "   This will create:"
echo "   • Restaurant: Casa Estrella Mexican Cuisine"
echo "   • Employees: 8 staff members"
echo "   • Customers: 15 customer profiles"
echo "   • Orders: 90 days of transaction history"
echo ""

# Ask for confirmation
read -p "Continue with seeding? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Seeding cancelled."
    exit 0
fi

# Run the master seed script
echo ""
echo "🚀 Running master seed script..."
python scripts/seed_database.py

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}✨ Database seeding completed successfully!${NC}"
    echo ""
    echo "📊 You can now:"
    echo "   • View orders in the POS system"
    echo "   • Check analytics and reports"
    echo "   • Test with realistic data"
    echo ""
    echo "🌐 API Documentation: http://localhost:8000/docs"
else
    echo ""
    echo -e "${RED}❌ Seeding failed. Check the error messages above.${NC}"
    echo ""
    echo "Common issues:"
    echo "  • Database not running"
    echo "  • Missing dependencies (run: pip install -r requirements.txt)"
    echo "  • Database not migrated (run: alembic upgrade head)"
    exit 1
fi