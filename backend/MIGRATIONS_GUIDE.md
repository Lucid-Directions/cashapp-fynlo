# Database Migrations Guide - Fynlo POS

## How Migrations Work

This project uses **Alembic** for database migrations. Alembic is SQLAlchemy's database migration tool that handles schema changes in a version-controlled manner.

## Key Files and Locations

- **Migration files**: `/backend/alembic/versions/`
- **Configuration**: `/backend/alembic.ini`
- **Environment setup**: `/backend/alembic/env.py`
- **Auto-run on startup**: `/backend/app/core/run_migrations.py`
- **Manual run script**: `/backend/run_migration.py`

## Migration Workflow

### 1. Automatic Migrations (Production)
Migrations run automatically when the app starts via `run_migrations.py`. This ensures the database schema is always up-to-date in production.

### 2. Creating a New Migration

#### Option A: Manual Migration File
Create a new file in `/backend/alembic/versions/` with this pattern:

```python
"""Description of the change

Revision ID: unique_identifier_YYYYMMDD
Revises: previous_migration_id
Create Date: YYYY-MM-DD HH:MM:SS

"""
from alembic import op
import sqlalchemy as sa

# revision identifiers
revision = 'unique_identifier_YYYYMMDD'
down_revision = 'previous_migration_id'  # Get from latest migration
branch_labels = None
depends_on = None

def upgrade():
    # Add your schema changes here
    op.add_column('table_name', 
        sa.Column('column_name', sa.String(255), nullable=True))

def downgrade():
    # Reverse the changes
    op.drop_column('table_name', 'column_name')
```

#### Option B: Auto-generate Migration (if local dev environment)
```bash
cd backend
alembic revision --autogenerate -m "Description of change"
```

### 3. Running Migrations Manually

```bash
# Using the provided script
cd backend
python3 run_migration.py

# Or using Alembic directly
cd backend
alembic upgrade head
```

### 4. Checking Migration Status

```bash
cd backend
alembic current  # Show current database version
alembic history  # Show migration history
```

## Recent Migration Example

A migration was just created to add `customer_email` to the orders table:
- File: `/backend/alembic/versions/add_customer_email_to_orders_20250811.py`
- Purpose: Adds customer_email column to store email addresses for guest checkout

## Best Practices

1. **Always test migrations locally first** before deploying to production
2. **Include both upgrade() and downgrade()** functions for rollback capability
3. **Use try-except blocks** when column might already exist (for idempotency)
4. **Name migrations descriptively** with date suffix for easy identification
5. **Check the previous migration ID** from the latest file in versions/

## Production Deployment

When deploying to DigitalOcean:
1. The migration runs automatically on app startup
2. Check logs to confirm successful migration
3. The `run_migrations()` function logs but doesn't crash the app if migration fails

## Troubleshooting

If a migration fails:
1. Check the logs for specific error messages
2. Verify database connectivity
3. Ensure the migration chain is unbroken (check down_revision)
4. Manual intervention may be needed for complex schema conflicts
EOF < /dev/null