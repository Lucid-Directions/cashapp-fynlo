#!/bin/bash
#
# Database Restore Script for Fynlo POS
# Usage: ./restore_database.sh <backup_tag>
#

set -e

# Configuration
BACKUP_TAG=$1
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
ENVIRONMENT=${ENVIRONMENT:-production}

# Validate arguments
if [ -z "$BACKUP_TAG" ]; then
    echo "❌ Usage: ./restore_database.sh <backup_tag>"
    echo "Example: ./restore_database.sh 20250118_143022"
    echo ""
    echo "Available backups:"
    ls -la "$BACKUP_DIR"/fynlo_${ENVIRONMENT}_*.sql.gz 2>/dev/null | awk '{print $9}' | sed 's/.*fynlo_'${ENVIRONMENT}'_//' | sed 's/.sql.gz//' || echo "No backups found"
    exit 1
fi

# Database connection details
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-fynlo_pos}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD}

# Backup file
BACKUP_FILE="$BACKUP_DIR/fynlo_${ENVIRONMENT}_${BACKUP_TAG}.sql.gz"

# Check if backup exists
if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup file not found: $BACKUP_FILE"
    exit 1
fi

echo "⚠️  WARNING: This will restore the database from backup"
echo "Environment: $ENVIRONMENT"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"
echo ""
read -p "Are you sure you want to continue? (yes/no) " -n 3 -r
echo
if [[ ! $REPLY =~ ^yes$ ]]; then
    echo "Restore cancelled"
    exit 1
fi

# Create a current backup before restore
echo "📸 Creating safety backup before restore..."
SAFETY_TIMESTAMP=$(date +%Y%m%d_%H%M%S)
./scripts/backup_database.sh "before_restore_${SAFETY_TIMESTAMP}"

# Decompress backup
echo "📦 Decompressing backup..."
TEMP_SQL="/tmp/restore_${BACKUP_TAG}.sql"
gunzip -c "$BACKUP_FILE" > "$TEMP_SQL"

# Perform restore
echo "🔄 Restoring database..."
if [ -f /.dockerenv ]; then
    # Inside Docker container
    PGPASSWORD="$DB_PASSWORD" psql \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        < "$TEMP_SQL"
else
    # On host - use Docker exec
    docker-compose -f docker-compose.prod.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" < "$TEMP_SQL"
fi

# Clean up temp file
rm -f "$TEMP_SQL"

# Verify restore
echo "🔍 Verifying restore..."
if [ -f /.dockerenv ]; then
    TABLE_COUNT=$(PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
else
    TABLE_COUNT=$(docker-compose -f docker-compose.prod.yml exec -T postgres \
        psql -U "$DB_USER" -d "$DB_NAME" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
fi

echo "Tables in database: $TABLE_COUNT"

if [ "$TABLE_COUNT" -lt 10 ]; then
    echo "⚠️  Warning: Database appears to have fewer tables than expected"
    echo "Expected at least 10 tables, found $TABLE_COUNT"
fi

# Run any post-restore migrations
echo "🔄 Running post-restore migrations..."
if [ -f /.dockerenv ]; then
    cd /app && alembic upgrade head
else
    docker-compose -f docker-compose.prod.yml exec -T backend alembic upgrade head
fi

echo "✅ Database restore completed successfully!"
echo "Restored from: $BACKUP_FILE"
echo "Backup date: $BACKUP_TAG"
echo ""
echo "⚠️  Important: Clear application cache to ensure consistency"
echo "Run: docker-compose -f docker-compose.prod.yml exec backend python -c \"from app.core.redis_client import redis_client; import asyncio; asyncio.run(redis_client.flushdb())\""