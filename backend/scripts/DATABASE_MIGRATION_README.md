# Database Migration Guide - Missing Columns Fix

## Problem Description

The Fynlo POS authentication system is failing because the SQLAlchemy ORM is trying to query columns that don't exist in the production database:

- `floor_plan_layout` (JSONB)
- `subscription_plan` (VARCHAR)
- `subscription_status` (VARCHAR)
- `subscription_started_at` (TIMESTAMPTZ)
- `subscription_expires_at` (TIMESTAMPTZ)

This causes the error: `column restaurants.floor_plan_layout does not exist`

## Root Cause

1. The database schema is out of sync with the SQLAlchemy models
2. SQLAlchemy caches the model metadata at startup
3. Even after removing `floor_plan_layout` from the model (PR #305), the running application still queries for it
4. The subscription fields are needed for the app to function properly

## Solution

This migration tool adds the missing columns to match what the application expects.

## Usage

### 1. Check What's Missing (Safe - Read Only)

```bash
cd backend
python scripts/migrate_database_columns.py --check-only
```

This will show you which columns are missing without making any changes.

### 2. Apply Migration (Interactive)

```bash
cd backend
python scripts/migrate_database_columns.py
```

This will:
- Check for missing columns
- Show the SQL that will be executed
- Ask for confirmation before applying
- Verify the migration succeeded

### 3. Apply Migration (Automated)

```bash
cd backend
python scripts/migrate_database_columns.py --force
```

This skips the confirmation prompt - useful for CI/CD pipelines.

## What the Migration Does

The tool will add these columns if they're missing:

```sql
ALTER TABLE restaurants
ADD COLUMN IF NOT EXISTS floor_plan_layout JSONB,
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'alpha',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS subscription_expires_at TIMESTAMPTZ;
```

## Safety Features

1. **Non-destructive**: Only adds missing columns, never drops or modifies existing data
2. **Transactional**: All changes are wrapped in a transaction
3. **Verification**: Checks that columns were added successfully
4. **Idempotent**: Safe to run multiple times (uses IF NOT EXISTS)

## Post-Migration Steps

1. **Restart the Backend Application**
   ```bash
   # Kill the current process
   pkill -f "uvicorn app.main:app"
   
   # Restart
   uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
   ```

2. **Verify Authentication Works**
   ```bash
   # Test with a known user
   python check_supabase_user.py user@example.com
   ```

3. **Monitor Logs**
   - Check that "column does not exist" errors are gone
   - Verify users can authenticate successfully

## Alternative Solutions (Not Recommended)

1. **Force Application Restart**: Would temporarily fix the issue but doesn't solve the root problem
2. **Remove Columns from Model**: Already tried (PR #305) but SQLAlchemy caching prevents this from working
3. **Full Database Migration System**: Overkill for this specific issue

## Environment Variables Required

The script requires `DATABASE_URL` to be set. It will automatically load from `.env` file if present:

```bash
DATABASE_URL=postgresql://username:password@host:port/database
```

## Troubleshooting

### "Permission denied" error
Make the script executable:
```bash
chmod +x scripts/migrate_database_columns.py
chmod +x scripts/digitalocean_migration.sh
```

### "Database connection failed"
Check your DATABASE_URL is correct and the database is accessible.

### "Column still missing after migration"
The application may need a full restart to clear SQLAlchemy's cache.

### "Cannot create virtual environment" (DigitalOcean)
The DigitalOcean App Platform has a read-only filesystem. The updated script handles this by:
- Skipping virtual environment creation
- Using pre-installed dependencies
- Using `python3` explicitly to avoid Python 2.x issues

### "Module not found" errors
Ensure dependencies are installed during the build phase in your app spec:
```yaml
build_command: pip install -r requirements.txt
```

## Related Files

- `/backend/app/core/database.py` - Contains the Restaurant model
- `/backend/app/api/v1/endpoints/auth.py` - Authentication endpoint that queries these columns
- PR #305 - Previous attempt to fix by removing floor_plan_layout

## Security Note

This migration tool is safe for production use. It:
- Only adds columns (never removes data)
- Uses parameterized queries
- Validates all inputs
- Provides dry-run mode with `--check-only`