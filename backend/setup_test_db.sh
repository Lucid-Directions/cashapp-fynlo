#!/bin/bash
# Setup PostgreSQL test database for real end-to-end testing

echo "Setting up PostgreSQL test database..."

# Database configuration
DB_NAME="fynlo_pos_test"
DB_USER="fynlo_test"
DB_PASSWORD="fynlo_test_password"

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Create user if it doesn't exist
echo "Creating test user..."
psql -U postgres -c "CREATE USER $DB_USER WITH PASSWORD '$DB_PASSWORD' CREATEDB;" 2>/dev/null || echo "User already exists"

# Drop and recreate database
echo "Creating test database..."
psql -U postgres -c "DROP DATABASE IF EXISTS $DB_NAME;"
psql -U postgres -c "CREATE DATABASE $DB_NAME OWNER $DB_USER;"

# Grant privileges
psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE $DB_NAME TO $DB_USER;"

echo "Test database setup complete!"
echo "Connection string: postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME"
echo ""
echo "To run tests with real database:"
echo "  cd backend"
echo "  APP_ENV=test pytest"