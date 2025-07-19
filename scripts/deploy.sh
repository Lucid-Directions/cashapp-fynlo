#!/bin/bash
#
# Fynlo POS Deployment Script
# Usage: ./deploy.sh <environment> [branch]
#

set -e

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=$1
DEPLOY_BRANCH=${2:-main}
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
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

# Validate environment
if [ -z "$ENVIRONMENT" ]; then
    log_error "Usage: ./deploy.sh <environment> [branch]"
    log_info "Environments: staging, production"
    exit 1
fi

if [[ "$ENVIRONMENT" != "staging" && "$ENVIRONMENT" != "production" ]]; then
    log_error "Invalid environment: $ENVIRONMENT"
    log_info "Valid environments: staging, production"
    exit 1
fi

log_info "🚀 Deploying to $ENVIRONMENT from branch $DEPLOY_BRANCH"

# Change to project root
cd "$PROJECT_ROOT"

# Load environment variables
ENV_FILE=".env.$ENVIRONMENT"
if [ -f "$ENV_FILE" ]; then
    log_info "Loading environment variables from $ENV_FILE"
    export $(cat "$ENV_FILE" | grep -v '^#' | grep -v '^$' | xargs)
else
    log_error "Environment file $ENV_FILE not found"
    exit 1
fi

# Pre-deployment checks
log_info "📋 Running pre-deployment checks..."

# Check required environment variables
REQUIRED_VARS="DATABASE_URL REDIS_URL SECRET_KEY POSTGRES_PASSWORD JWT_SECRET_KEY"
for var in $REQUIRED_VARS; do
    if [ -z "${!var}" ]; then
        log_error "Required variable $var is not set"
        exit 1
    fi
done

# Git checks
log_info "Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    log_warning "Working directory is not clean. Uncommitted changes:"
    git status --short
    read -p "Continue anyway? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        log_info "Deployment cancelled"
        exit 1
    fi
fi

# Pull latest changes
log_info "Pulling latest changes from $DEPLOY_BRANCH..."
git fetch origin
git checkout "$DEPLOY_BRANCH"
git pull origin "$DEPLOY_BRANCH"

# Run tests
log_info "🧪 Running tests..."
cd backend
python -m pytest tests/ -v --tb=short --maxfail=5 || {
    log_error "Tests failed. Aborting deployment."
    exit 1
}
cd ..

# Database backup (production only)
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "💾 Backing up database..."
    ./scripts/backup_database.sh "$TIMESTAMP" || {
        log_error "Database backup failed. Aborting deployment."
        exit 1
    }
fi

# Build Docker images
log_info "🐳 Building Docker images..."
docker-compose -f docker-compose.prod.yml build --no-cache || {
    log_error "Docker build failed"
    exit 1
}

# Stop current deployment
log_info "📦 Stopping current deployment..."
docker-compose -f docker-compose.prod.yml down

# Remove old containers and volumes (except data volumes)
log_info "Cleaning up old containers..."
docker container prune -f
docker image prune -f

# Start new deployment
log_info "🚀 Starting new deployment..."
docker-compose -f docker-compose.prod.yml up -d || {
    log_error "Failed to start services"
    # Attempt rollback
    log_error "Attempting to restart previous version..."
    docker-compose -f docker-compose.prod.yml up -d
    exit 1
}

# Wait for services to be healthy
log_info "⏳ Waiting for services to be healthy..."
./scripts/wait_for_healthy.sh || {
    log_error "Services failed health checks"
    # Show logs for debugging
    docker-compose -f docker-compose.prod.yml logs --tail=50
    exit 1
}

# Run database migrations
log_info "🔄 Running database migrations..."
docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head || {
    log_error "Database migrations failed"
    if [ "$ENVIRONMENT" = "production" ]; then
        log_error "Consider rolling back to backup: $TIMESTAMP"
    fi
    exit 1
}

# Warm cache
log_info "🔥 Warming cache..."
docker-compose -f docker-compose.prod.yml exec -T backend python scripts/warm_cache.py || {
    log_warning "Cache warming failed (non-critical)"
}

# Run health checks
log_info "🏥 Running health checks..."
sleep 5  # Give services a moment to stabilize

# Basic health check
HEALTH_CHECK=$(curl -s http://localhost:8000/api/v1/health || echo '{"error": "Failed to connect"}')
echo "$HEALTH_CHECK" | python -m json.tool || {
    log_error "Health check returned invalid JSON"
    exit 1
}

# Detailed health check
DETAILED_HEALTH=$(curl -s http://localhost:8000/api/v1/health/detailed || echo '{"error": "Failed to connect"}')
echo "$DETAILED_HEALTH" | python -m json.tool

# Check if all components are healthy
if echo "$DETAILED_HEALTH" | grep -q '"status": "unhealthy"'; then
    log_error "Some components are unhealthy"
    docker-compose -f docker-compose.prod.yml logs --tail=100
    exit 1
fi

# Create deployment record
log_info "📝 Recording deployment..."
cat > "deployments/deploy_${ENVIRONMENT}_${TIMESTAMP}.json" <<EOF
{
    "environment": "$ENVIRONMENT",
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "branch": "$DEPLOY_BRANCH",
    "commit": "$(git rev-parse HEAD)",
    "commit_message": "$(git log -1 --pretty=%B | tr '\n' ' ')",
    "deployed_by": "$(whoami)",
    "host": "$(hostname)"
}
EOF

# Final verification
log_info "🔍 Running final verification..."
./scripts/verify_deployment.sh "$ENVIRONMENT" || {
    log_warning "Deployment verification reported issues"
}

# Success!
log_success "✅ Deployment completed successfully!"
log_info "Environment: $ENVIRONMENT"
log_info "Timestamp: $TIMESTAMP"
log_info "Commit: $(git rev-parse --short HEAD)"

# Post-deployment tasks
if [ "$ENVIRONMENT" = "production" ]; then
    log_info "📊 Production deployment complete. Monitor the following:"
    log_info "  - Grafana: http://localhost:3000"
    log_info "  - Prometheus: http://localhost:9090"
    log_info "  - Application logs: docker-compose -f docker-compose.prod.yml logs -f backend"
fi

# Send notification (if configured)
if [ -f "./scripts/notify_deployment.sh" ]; then
    ./scripts/notify_deployment.sh "$ENVIRONMENT" "success" "$TIMESTAMP" || {
        log_warning "Failed to send deployment notification"
    }
fi

log_info "🎉 Deployment process complete!"