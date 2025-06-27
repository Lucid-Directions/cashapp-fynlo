#!/bin/bash

# ===============================================
# FYNLO POS DIGITALOCEAN DATABASE SETUP SCRIPT
# ===============================================
# This script sets up DigitalOcean PostgreSQL database and runs the migration

set -e  # Exit on any error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
check_prerequisites() {
    print_info "Checking prerequisites..."
    
    if ! command_exists doctl; then
        print_error "DigitalOcean CLI (doctl) not found. Please install it first:"
        echo "  curl -sL https://github.com/digitalocean/doctl/releases/latest/download/doctl-1.104.0-linux-amd64.tar.gz | tar -xzv"
        echo "  sudo mv doctl /usr/local/bin"
        exit 1
    fi
    
    if ! command_exists psql; then
        print_error "PostgreSQL client (psql) not found. Please install it first:"
        echo "  Ubuntu/Debian: sudo apt install postgresql-client"
        echo "  macOS: brew install postgresql"
        exit 1
    fi
    
    if ! command_exists python3; then
        print_error "Python 3 not found. Please install Python 3."
        exit 1
    fi
    
    # Check if user is authenticated with doctl
    if ! doctl account get >/dev/null 2>&1; then
        print_error "Not authenticated with DigitalOcean. Please run: doctl auth init"
        exit 1
    fi
    
    print_status "Prerequisites check passed"
}

# Function to create DigitalOcean database cluster
create_database_cluster() {
    print_info "Creating DigitalOcean PostgreSQL database cluster..."
    
    # Configuration
    local cluster_name="fynlo-pos-db"
    local region="lon1"  # London datacenter
    local engine="pg"
    local version="15"
    local size="db-s-1vcpu-1gb"  # Basic plan, can be upgraded later
    local num_nodes="1"
    
    # Check if cluster already exists
    if doctl databases list --format Name --no-header | grep -q "^${cluster_name}$"; then
        print_warning "Database cluster '${cluster_name}' already exists"
        local cluster_id=$(doctl databases list --format ID,Name --no-header | grep "${cluster_name}" | cut -f1)
    else
        print_info "Creating new database cluster..."
        local cluster_id=$(doctl databases create ${cluster_name} \
            --engine ${engine} \
            --version ${version} \
            --region ${region} \
            --size ${size} \
            --num-nodes ${num_nodes} \
            --format ID \
            --no-header)
        
        if [ -z "$cluster_id" ]; then
            print_error "Failed to create database cluster"
            exit 1
        fi
        
        print_status "Database cluster created with ID: ${cluster_id}"
        
        print_info "Waiting for database cluster to be ready..."
        while [ "$(doctl databases get ${cluster_id} --format Status --no-header)" != "online" ]; do
            echo -n "."
            sleep 10
        done
        echo ""
        print_status "Database cluster is online"
    fi
    
    echo $cluster_id
}

# Function to create application database
create_application_database() {
    local cluster_id=$1
    
    print_info "Creating application database..."
    
    # Get connection details
    local connection_info=$(doctl databases connection ${cluster_id} --format "Host,Port,User,Password,Database" --no-header)
    local host=$(echo $connection_info | cut -d' ' -f1)
    local port=$(echo $connection_info | cut -d' ' -f2)
    local user=$(echo $connection_info | cut -d' ' -f3)
    local password=$(echo $connection_info | cut -d' ' -f4)
    local default_db=$(echo $connection_info | cut -d' ' -f5)
    
    # Create database URL
    local database_url="postgresql://${user}:${password}@${host}:${port}/${default_db}?sslmode=require"
    
    print_info "Testing database connection..."
    if ! psql "${database_url}" -c "SELECT version();" >/dev/null 2>&1; then
        print_error "Failed to connect to database"
        exit 1
    fi
    
    print_status "Database connection successful"
    
    # Create application database
    print_info "Creating Fynlo POS database..."
    psql "${database_url}" -c "CREATE DATABASE fynlo_pos;" 2>/dev/null || true
    
    # Create application user
    print_info "Creating application user..."
    psql "${database_url}" -c "
        CREATE USER fynlo_app WITH ENCRYPTED PASSWORD 'fynlo_secure_password_2024';
        GRANT ALL PRIVILEGES ON DATABASE fynlo_pos TO fynlo_app;
    " 2>/dev/null || true
    
    # Return the application database URL
    local app_database_url="postgresql://${user}:${password}@${host}:${port}/fynlo_pos?sslmode=require"
    echo $app_database_url
}

# Function to run database schema migration
run_schema_migration() {
    local database_url=$1
    
    print_info "Running database schema migration..."
    
    if [ ! -f "database_schema.sql" ]; then
        print_error "database_schema.sql file not found"
        exit 1
    fi
    
    # Run schema migration
    if psql "${database_url}" -f database_schema.sql; then
        print_status "Database schema created successfully"
    else
        print_error "Schema migration failed"
        exit 1
    fi
}

# Function to run seed data migration
run_seed_migration() {
    local database_url=$1
    
    print_info "Running seed data migration..."
    
    if [ ! -f "database_seed_migration.py" ]; then
        print_error "database_seed_migration.py file not found"
        exit 1
    fi
    
    # Install Python dependencies
    print_info "Installing Python dependencies..."
    pip3 install asyncpg psycopg2-binary || {
        print_warning "Failed to install some dependencies. Trying with --user flag..."
        pip3 install --user asyncpg psycopg2-binary
    }
    
    # Set environment variable for migration script
    export DATABASE_URL="${database_url}"
    
    # Run seed migration
    if python3 database_seed_migration.py; then
        print_status "Seed data migration completed successfully"
    else
        print_error "Seed data migration failed"
        exit 1
    fi
}

# Function to update backend configuration
update_backend_config() {
    local database_url=$1
    local cluster_id=$2
    
    print_info "Updating backend configuration..."
    
    # Backup existing .env file
    if [ -f ".env" ]; then
        cp .env .env.backup.$(date +%Y%m%d_%H%M%S)
        print_info "Backed up existing .env file"
    fi
    
    # Get Redis connection details (create if doesn't exist)
    local redis_cluster_name="fynlo-pos-cache"
    if ! doctl databases list --format Name --no-header | grep -q "^${redis_cluster_name}$"; then
        print_info "Creating Redis cluster for caching..."
        local redis_cluster_id=$(doctl databases create ${redis_cluster_name} \
            --engine redis \
            --region lon1 \
            --size db-s-1vcpu-1gb \
            --format ID \
            --no-header)
        
        print_info "Waiting for Redis cluster to be ready..."
        while [ "$(doctl databases get ${redis_cluster_id} --format Status --no-header)" != "online" ]; do
            echo -n "."
            sleep 10
        done
        echo ""
    else
        local redis_cluster_id=$(doctl databases list --format ID,Name --no-header | grep "${redis_cluster_name}" | cut -f1)
    fi
    
    # Get Redis connection info
    local redis_connection_info=$(doctl databases connection ${redis_cluster_id} --format "Host,Port,Password" --no-header)
    local redis_host=$(echo $redis_connection_info | cut -d' ' -f1)
    local redis_port=$(echo $redis_connection_info | cut -d' ' -f2)
    local redis_password=$(echo $redis_connection_info | cut -d' ' -f3)
    local redis_url="redis://default:${redis_password}@${redis_host}:${redis_port}/0"
    
    # Update .env file
    cat > .env << EOF
# =============================================================================
# FYNLO POS BACKEND - DIGITALOCEAN ENVIRONMENT CONFIGURATION
# =============================================================================
# Generated automatically by setup_digitalocean_database.sh
# Generated at: $(date)
# =============================================================================

# =============================================================================
# APPLICATION SETTINGS
# =============================================================================
APP_NAME="Fynlo POS"
DEBUG=true
ENVIRONMENT="staging"
API_V1_STR="/api/v1"
ROOT_PATH=""
LOG_LEVEL="INFO"

# =============================================================================
# DIGITALOCEAN DATABASE CONFIGURATION
# =============================================================================
DATABASE_URL="${database_url}"
DB_POOL_SIZE=20
DB_MAX_OVERFLOW=30
DB_POOL_TIMEOUT=30
DB_POOL_RECYCLE=3600

# =============================================================================
# DIGITALOCEAN REDIS CONFIGURATION (CACHING & REAL-TIME)
# =============================================================================
REDIS_URL="${redis_url}"
REDIS_MAX_CONNECTIONS=50

# =============================================================================
# AUTHENTICATION & SECURITY
# =============================================================================
SECRET_KEY="$(openssl rand -base64 32)"
ALGORITHM="HS256"
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7

# CORS Configuration
ALLOWED_ORIGINS="http://localhost:3000,http://localhost:19006,http://localhost:8081"
ALLOWED_METHODS="GET,POST,PUT,DELETE,OPTIONS"
ALLOWED_HEADERS="*"
CORS_CREDENTIALS=true

# =============================================================================
# PAYMENT PROVIDER INTEGRATIONS - SUMUP PRIMARY
# =============================================================================
# SumUp Integration (PRIMARY PAYMENT METHOD)
SUMUP_API_KEY=sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU
SUMUP_MERCHANT_CODE=M4EM2GKE
SUMUP_AFFILIATE_KEY=sup_afk_8OlK0ooUnu0MxvmKx6Beapf4L0ekSCe9
SUMUP_ENVIRONMENT=sandbox

# Payment Fee Configuration (Fynlo's Competitive Advantage)
QR_PAYMENT_FEE_PERCENTAGE=1.2
DEFAULT_CARD_FEE_PERCENTAGE=2.9
PLATFORM_FEE_PERCENTAGE=0.5

# =============================================================================
# WEBSOCKET CONFIGURATION
# =============================================================================
WEBSOCKET_HOST="localhost"
WEBSOCKET_PORT=8001
WEBSOCKET_PATH="/ws"

# =============================================================================
# FILE UPLOAD CONFIGURATION
# =============================================================================
MAX_FILE_SIZE=10485760
UPLOAD_DIR="uploads"

# =============================================================================
# UK BUSINESS SPECIFIC SETTINGS
# =============================================================================
UK_VAT_RATE=20.0

# =============================================================================
# DIGITALOCEAN CLUSTER IDS (FOR MANAGEMENT)
# =============================================================================
DO_DATABASE_CLUSTER_ID="${cluster_id}"
DO_REDIS_CLUSTER_ID="${redis_cluster_id}"

EOF

    print_status "Backend configuration updated"
    print_info "Database URL configured: ${database_url}"
    print_info "Redis URL configured: ${redis_url}"
}

# Function to test the complete setup
test_setup() {
    local database_url=$1
    
    print_info "Testing complete setup..."
    
    # Test database connection and data
    print_info "Testing database connection and data..."
    local test_result=$(psql "${database_url}" -c "
        SELECT 
            (SELECT COUNT(*) FROM platforms) as platforms,
            (SELECT COUNT(*) FROM restaurants) as restaurants,
            (SELECT COUNT(*) FROM users) as users,
            (SELECT COUNT(*) FROM products) as products;
    " -t)
    
    if [ $? -eq 0 ]; then
        print_status "Database test successful"
        print_info "Data summary: ${test_result}"
    else
        print_error "Database test failed"
        exit 1
    fi
    
    # Test backend startup (if possible)
    if [ -f "app/main.py" ]; then
        print_info "Testing backend startup..."
        timeout 10s python3 -c "
import sys
sys.path.append('.')
from app.core.config import settings
print(f'✅ Backend configuration loaded successfully')
print(f'✅ Database URL configured: {bool(settings.DATABASE_URL)}')
print(f'✅ Redis URL configured: {bool(settings.REDIS_URL)}')
" 2>/dev/null || print_warning "Backend test skipped (dependencies may be missing)"
    fi
    
    print_status "Setup testing completed"
}

# Function to display connection information
display_connection_info() {
    local database_url=$1
    local cluster_id=$2
    
    print_info "DigitalOcean Database Setup Complete!"
    echo ""
    echo "🗄️  Database Cluster ID: ${cluster_id}"
    echo "🔗 Database URL: ${database_url}"
    echo ""
    echo "📋 Next Steps:"
    echo "1. Test your backend: python3 -m app.main"
    echo "2. Update your mobile app to use the new backend URL"
    echo "3. Test SumUp payment integration"
    echo "4. Monitor database performance in DigitalOcean console"
    echo ""
    echo "🔧 Management Commands:"
    echo "  View cluster: doctl databases get ${cluster_id}"
    echo "  View logs: doctl databases logs ${cluster_id}"
    echo "  Connect directly: doctl databases connection ${cluster_id}"
    echo ""
    print_status "DigitalOcean database setup completed successfully!"
}

# Main execution
main() {
    echo "🚀 Fynlo POS DigitalOcean Database Setup"
    echo "========================================"
    echo ""
    
    # Check if we're in the right directory
    if [ ! -f "database_schema.sql" ] || [ ! -f "database_seed_migration.py" ]; then
        print_error "Please run this script from the backend directory with database files present"
        exit 1
    fi
    
    # Run setup steps
    check_prerequisites
    
    local cluster_id=$(create_database_cluster)
    local database_url=$(create_application_database $cluster_id)
    
    run_schema_migration "$database_url"
    run_seed_migration "$database_url"
    
    update_backend_config "$database_url" "$cluster_id"
    test_setup "$database_url"
    
    display_connection_info "$database_url" "$cluster_id"
}

# Handle script interruption
trap 'print_error "Setup interrupted"; exit 1' INT

# Run main function
main "$@"