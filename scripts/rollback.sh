#!/bin/bash
#
# Fynlo POS Rollback Script
# Usage: ./rollback.sh <environment> <backup_tag>
#

set -e

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

# Configuration
ENVIRONMENT=$1
BACKUP_TAG=$2
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

# Functions
log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Validate arguments
if [ -z "$ENVIRONMENT" ] || [ -z "$BACKUP_TAG" ]; then
    log_error "Usage: ./rollback.sh <environment> <backup_tag>"
    log_info "Example: ./rollback.sh production 20250118_143022"
    exit 1
fi

log_warning "🔄 Rolling back $ENVIRONMENT to backup $BACKUP_TAG"
log_warning "This will restore the database and restart services."
read -p "Are you sure you want to continue? (yes/no) " -n 3 -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    log_info "Rollback cancelled"
    exit 1
fi

# Change to project root
cd "$PROJECT_ROOT"

# Load environment
ENV_FILE=".env.$ENVIRONMENT"
if [ -f "$ENV_FILE" ]; then
    export $(cat "$ENV_FILE" | grep -v '^#' | grep -v '^$' | xargs)
else
    log_error "Environment file $ENV_FILE not found"
    exit 1
fi

# Check if backup exists
BACKUP_FILE="backups/fynlo_${ENVIRONMENT}_${BACKUP_TAG}.sql"
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    log_info "Available backups:"
    ls -la backups/fynlo_${ENVIRONMENT}_*.sql 2>/dev/null || echo "No backups found"
    exit 1
fi

# Stop current deployment
log_info "Stopping current deployment..."
docker-compose -f docker-compose.prod.yml stop backend nginx

# Restore database backup
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "💾 Restoring database backup..."
    ./scripts/restore_database.sh "$BACKUP_TAG" || {
        log_error "Database restore failed"
        exit 1
    }
fi

# Restart services
log_info "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to be healthy
log_info "⏳ Waiting for services to be healthy..."
./scripts/wait_for_healthy.sh || {
    log_error "Services failed to start properly"
    docker-compose -f docker-compose.prod.yml logs --tail=100
    exit 1
}

# Verify rollback
log_info "🔍 Verifying rollback..."
sleep 5

# Health check
HEALTH_CHECK=$(curl -s http://localhost:8000/api/v1/health)
if [ $? -eq 0 ]; then
    log_success "✅ Services are responding"
    echo "$HEALTH_CHECK" | python -m json.tool
else
    log_error "Services are not responding"
    docker-compose -f docker-compose.prod.yml logs --tail=50 backend
    exit 1
fi

# Clear cache after rollback
log_info "Clearing cache..."
docker-compose -f docker-compose.prod.yml exec -T backend python -c "
from app.core.redis_client import redis_client
import asyncio
async def clear():
    await redis_client.flushdb()
asyncio.run(clear())
" || log_warning "Failed to clear cache"

# Record rollback
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cat > "deployments/rollback_${ENVIRONMENT}_${TIMESTAMP}.json" <<EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "backup_restored": "$BACKUP_TAG",
    "rolled_back_by": "$(whoami)",
    "host": "$(hostname)"
}
EOF

log_success "✅ Rollback completed successfully"
log_info "Environment: $ENVIRONMENT"
log_info "Restored backup: $BACKUP_TAG"

# Send notification
if [ -f "./scripts/notify_deployment.sh" ]; then
    ./scripts/notify_deployment.sh "$ENVIRONMENT" "rollback" "$BACKUP_TAG" || {
        log_warning "Failed to send rollback notification"
    }
fi

log_warning "⚠️  Please verify that all services are working correctly"
log_info "Monitor logs: docker-compose -f docker-compose.prod.yml logs -f backend"