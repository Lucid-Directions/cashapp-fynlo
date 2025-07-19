#!/bin/bash
#
# Database Backup Script for Fynlo POS
# Usage: ./backup_database.sh [timestamp]
#

set -e

# Configuration
TIMESTAMP=${1:-$(date +%Y%m%d_%H%M%S)}
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="$PROJECT_ROOT/backups"
ENVIRONMENT=${ENVIRONMENT:-production}

# Ensure backup directory exists
mkdir -p "$BACKUP_DIR"

# Database connection details from environment
DB_HOST=${POSTGRES_HOST:-postgres}
DB_PORT=${POSTGRES_PORT:-5432}
DB_NAME=${POSTGRES_DB:-fynlo_pos}
DB_USER=${POSTGRES_USER:-postgres}
DB_PASSWORD=${POSTGRES_PASSWORD}

# Backup filename
BACKUP_FILE="$BACKUP_DIR/fynlo_${ENVIRONMENT}_${TIMESTAMP}.sql"

echo "🔄 Starting database backup..."
echo "Environment: $ENVIRONMENT"
echo "Database: $DB_NAME"
echo "Backup file: $BACKUP_FILE"

# Perform backup based on whether we're in Docker or not
if [ -f /.dockerenv ]; then
    # We're inside a Docker container
    PGPASSWORD="$DB_PASSWORD" pg_dump \
        -h "$DB_HOST" \
        -p "$DB_PORT" \
        -U "$DB_USER" \
        -d "$DB_NAME" \
        --no-owner \
        --no-privileges \
        --if-exists \
        --clean \
        --verbose \
        > "$BACKUP_FILE"
else
    # We're on the host - use Docker exec
    docker-compose -f docker-compose.prod.yml exec -T postgres \
        pg_dump -U "$DB_USER" -d "$DB_NAME" \
        --no-owner \
        --no-privileges \
        --if-exists \
        --clean \
        > "$BACKUP_FILE"
fi

# Compress the backup
gzip -f "$BACKUP_FILE"
BACKUP_FILE="${BACKUP_FILE}.gz"

# Check backup size
BACKUP_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "✅ Backup completed successfully"
echo "File: $BACKUP_FILE"
echo "Size: $BACKUP_SIZE"

# Cleanup old backups (keep last 30 days)
echo "🧹 Cleaning up old backups..."
find "$BACKUP_DIR" -name "fynlo_${ENVIRONMENT}_*.sql.gz" -mtime +30 -delete

# List recent backups
echo "📁 Recent backups:"
ls -lht "$BACKUP_DIR"/fynlo_${ENVIRONMENT}_*.sql.gz 2>/dev/null | head -5 || echo "No backups found"

# Create backup metadata
cat > "$BACKUP_DIR/fynlo_${ENVIRONMENT}_${TIMESTAMP}.json" <<EOF
{
    "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
    "environment": "$ENVIRONMENT",
    "database": "$DB_NAME",
    "size": "$BACKUP_SIZE",
    "compressed": true,
    "host": "$(hostname)",
    "created_by": "$(whoami)"
}
EOF

echo "✅ Backup process complete!"