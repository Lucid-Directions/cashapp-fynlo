#!/bin/bash
#
# Wait for all services to be healthy
# Usage: ./wait_for_healthy.sh [timeout_seconds]
#

set -e

# Configuration
TIMEOUT=${1:-120}  # Default 2 minutes
INTERVAL=5         # Check every 5 seconds
ELAPSED=0

# Color codes
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "⏳ Waiting for services to be healthy (timeout: ${TIMEOUT}s)..."

# Function to check service health
check_health() {
    local service=$1
    local container_name="cashapp-fynlo_${service}_1"
    
    # Check if container is running
    if ! docker ps --format "table {{.Names}}" | grep -q "$container_name"; then
        return 1
    fi
    
    # Check container health status
    local health_status=$(docker inspect --format='{{.State.Health.Status}}' "$container_name" 2>/dev/null || echo "none")
    
    if [ "$health_status" = "healthy" ]; then
        return 0
    else
        return 1
    fi
}

# Function to check endpoint health
check_endpoint() {
    local url=$1
    local response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null || echo "000")
    
    if [ "$response" = "200" ]; then
        return 0
    else
        return 1
    fi
}

# Services to check
SERVICES=("postgres" "redis" "backend")
ENDPOINTS=(
    "http://localhost:8000/api/v1/health"
    "http://localhost:8000/api/v1/health/detailed"
)

# Wait loop
while [ $ELAPSED -lt $TIMEOUT ]; do
    ALL_HEALTHY=true
    
    # Check Docker services
    for service in "${SERVICES[@]}"; do
        if check_health "$service"; then
            echo -e "${GREEN}✓${NC} $service is healthy"
        else
            echo -e "${YELLOW}⏳${NC} $service is not healthy yet"
            ALL_HEALTHY=false
        fi
    done
    
    # Check HTTP endpoints (only if backend is healthy)
    if check_health "backend"; then
        for endpoint in "${ENDPOINTS[@]}"; do
            if check_endpoint "$endpoint"; then
                echo -e "${GREEN}✓${NC} $endpoint is responding"
            else
                echo -e "${YELLOW}⏳${NC} $endpoint is not responding yet"
                ALL_HEALTHY=false
            fi
        done
    fi
    
    # If all services are healthy, we're done
    if [ "$ALL_HEALTHY" = true ]; then
        echo -e "\n${GREEN}✅ All services are healthy!${NC}"
        
        # Show service status
        echo -e "\n📊 Service Status:"
        docker-compose -f docker-compose.prod.yml ps
        
        exit 0
    fi
    
    # Wait before next check
    echo -e "\n⏳ Waiting ${INTERVAL}s before next check... (${ELAPSED}s/${TIMEOUT}s elapsed)\n"
    sleep $INTERVAL
    ELAPSED=$((ELAPSED + INTERVAL))
done

# Timeout reached
echo -e "\n${RED}❌ Timeout reached! Services are not healthy after ${TIMEOUT}s${NC}"

# Show logs for debugging
echo -e "\n📋 Service Status:"
docker-compose -f docker-compose.prod.yml ps

echo -e "\n📋 Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

exit 1