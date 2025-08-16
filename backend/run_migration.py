#\!/usr/bin/env python3
"""
Script to run database migrations manually
"""
import os
import sys
from pathlib import Path

# Add backend directory to path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

from alembic import command
from alembic.config import Config

def run_migration():
    """Run the latest migration"""
    try:
        # Get the alembic.ini path
        alembic_ini_path = backend_dir / "alembic.ini"
        
        if not alembic_ini_path.exists():
            print(f"Error: alembic.ini not found at {alembic_ini_path}")
            return False
        
        print(f"🔄 Running database migration...")
        print(f"Config path: {alembic_ini_path}")
        
        # Create Alembic configuration
        alembic_cfg = Config(str(alembic_ini_path))
        
        # Run migration to latest version
        command.upgrade(alembic_cfg, "head")
        
        print("✅ Migration completed successfully\!")
        return True
        
    except Exception as e:
        print(f"❌ Error running migration: {e}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    success = run_migration()
    sys.exit(0 if success else 1)
EOF < /dev/null