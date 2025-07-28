#!/bin/bash

# Fynlo POS Backend - Quick Start with Docker
echo "🚀 Fynlo POS Backend - Quick Start"
echo "=================================="

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo "❌ Docker is not installed. Please install Docker Desktop first."
    echo "   Download from: https://www.docker.com/products/docker-desktop"
    exit 1
fi

# Check if Docker Compose is available
if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
    echo "❌ Docker Compose is not available. Please install Docker Compose."
    exit 1
fi

echo "✅ Docker is available"

# Determine which docker compose command to use
if docker compose version &> /dev/null; then
    DOCKER_COMPOSE="docker compose"
else
    DOCKER_COMPOSE="docker-compose"
fi

# Stop any existing containers
echo "🛑 Stopping any existing containers..."
$DOCKER_COMPOSE down

# Pull latest images
echo "📦 Pulling latest Docker images..."
$DOCKER_COMPOSE pull

# Build the backend image
echo "🔨 Building Fynlo POS backend..."
$DOCKER_COMPOSE build

# Start all services
echo "🚀 Starting all services..."
$DOCKER_COMPOSE up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Check service health
echo "🔍 Checking service health..."

# Check PostgreSQL
if $DOCKER_COMPOSE exec postgres pg_isready -U fynlo_user -d fynlo_pos &> /dev/null; then
    echo "✅ PostgreSQL is ready"
else
    echo "❌ PostgreSQL is not ready"
fi

# Check Redis
if $DOCKER_COMPOSE exec redis redis-cli ping &> /dev/null; then
    echo "✅ Redis is ready"
else
    echo "❌ Redis is not ready"
fi

# Run database migrations
echo "🗄️ Running database migrations..."
$DOCKER_COMPOSE exec backend alembic revision --autogenerate -m "Initial migration"
$DOCKER_COMPOSE exec backend alembic upgrade head

# Seed database with production-like data
echo "🌱 Seeding database with production-like data..."
$DOCKER_COMPOSE exec backend python scripts/seed_database.py --force
if [ $? -eq 0 ]; then
    echo "✅ Database seeded successfully"
else
    echo "⚠️  Database seeding failed (non-critical)"
fi

# Test backend API
echo "🌐 Testing backend API..."
sleep 5

if curl -f http://localhost:8000/health &> /dev/null; then
    echo "✅ Backend API is responding"
else
    echo "❌ Backend API is not responding"
    echo "📋 Checking logs..."
    $DOCKER_COMPOSE logs backend
fi

echo ""
echo "🎉 Fynlo POS Backend is running!"
echo ""
echo "📋 Service URLs:"
echo "   API Documentation: http://localhost:8000/docs"
echo "   Health Check: http://localhost:8000/health"
echo "   PostgreSQL: localhost:5432 (fynlo_user/fynlo_password)"
echo "   Redis: localhost:6379"
echo ""
echo "🔧 Useful commands:"
echo "   View logs: $DOCKER_COMPOSE logs -f"
echo "   Stop services: $DOCKER_COMPOSE down"
echo "   Restart: $DOCKER_COMPOSE restart"
echo "   Database shell: $DOCKER_COMPOSE exec postgres psql -U fynlo_user -d fynlo_pos"
echo "   Backend shell: $DOCKER_COMPOSE exec backend bash"
echo ""
echo "🎯 Next steps:"
echo "   1. Open http://localhost:8000/docs to explore the API"
echo "   2. Test the endpoints using the interactive documentation"
echo "   3. Start frontend integration with the backend"