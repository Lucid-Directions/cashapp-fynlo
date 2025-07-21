#!/usr/bin/env python3
"""
Safe Database Migration Application Tool
Applies pending Alembic migrations with proper error handling
"""
import os
import sys
import subprocess
from dotenv import load_dotenv
from urllib.parse import urlparse

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def run_command(cmd, description):
    """Run a command and capture output"""
    print(f"\n📋 {description}...")
    try:
        result = subprocess.run(
            cmd, 
            shell=True, 
            capture_output=True, 
            text=True, 
            cwd=os.path.dirname(os.path.abspath(__file__))
        )
        
        if result.stdout:
            print(result.stdout)
        
        if result.returncode != 0:
            print(f"❌ Error: {description}")
            if result.stderr:
                print(f"Error details: {result.stderr}")
            return False
        
        print(f"✅ {description} - Success")
        return True
    except Exception as e:
        print(f"❌ Exception during {description}: {str(e)}")
        return False

def apply_migrations():
    """Apply pending database migrations"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        print("💡 Please ensure your .env file contains DATABASE_URL")
        return False
    
    # Mask password in URL for display
    parsed = urlparse(database_url)
    display_url = f"{parsed.scheme}://{parsed.username}:****@{parsed.hostname}:{parsed.port}/{parsed.path.lstrip('/')}"
    print(f"🔗 Using database: {display_url}")
    
    print("\n🚀 Starting migration process...")
    
    # Step 1: Check current migration version
    if not run_command(
        "python -m alembic current",
        "Checking current migration version"
    ):
        return False
    
    # Step 2: Show pending migrations
    print("\n📊 Checking for pending migrations...")
    result = subprocess.run(
        "python -m alembic heads",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    
    if result.returncode == 0:
        print("Available migration heads:")
        print(result.stdout)
    
    # Step 3: Apply migrations
    print("\n🔧 Applying pending migrations...")
    
    # First try to upgrade to head
    upgrade_result = subprocess.run(
        "python -m alembic upgrade head",
        shell=True,
        capture_output=True,
        text=True,
        cwd=os.path.dirname(os.path.abspath(__file__))
    )
    
    if upgrade_result.returncode != 0:
        print("⚠️  Standard upgrade failed, checking for merge issues...")
        
        # Check if it's a merge head issue
        if "Multiple head revisions" in upgrade_result.stderr or "FAILED: Multiple head revisions" in upgrade_result.stdout:
            print("🔀 Multiple migration heads detected, attempting merge...")
            
            # Get the heads
            heads_result = subprocess.run(
                "python -m alembic heads",
                shell=True,
                capture_output=True,
                text=True,
                cwd=os.path.dirname(os.path.abspath(__file__))
            )
            
            if heads_result.returncode == 0:
                heads = [line.strip() for line in heads_result.stdout.split('\n') if line.strip() and not line.startswith(' ')]
                print(f"Found heads: {heads}")
                
                if len(heads) >= 2:
                    # Try to merge the heads
                    merge_cmd = f"python -m alembic merge -m 'Merge heads {heads[0][:8]} and {heads[1][:8]}' {heads[0]} {heads[1]}"
                    if run_command(merge_cmd, "Creating merge migration"):
                        # Try upgrade again
                        if run_command("python -m alembic upgrade head", "Applying migrations after merge"):
                            print("✅ Migrations applied successfully after merge!")
                            return True
                        else:
                            print("❌ Failed to apply migrations after merge")
                            return False
                    else:
                        print("❌ Failed to create merge migration")
                        return False
        else:
            print("❌ Migration failed:")
            print(upgrade_result.stdout)
            print(upgrade_result.stderr)
            return False
    else:
        print("✅ All migrations applied successfully!")
        print(upgrade_result.stdout)
    
    # Step 4: Verify final state
    print("\n🔍 Verifying final migration state...")
    if run_command(
        "python -m alembic current",
        "Final migration version"
    ):
        # Run the database check script
        print("\n🔍 Running database schema verification...")
        if os.path.exists("check_database_state.py"):
            run_command("python check_database_state.py", "Database schema check")
        
        print("\n✅ Migration process completed successfully!")
        print("💡 Your database schema is now up to date")
        return True
    
    return False

if __name__ == "__main__":
    print("="*60)
    print("🗄️  Fynlo Database Migration Tool")
    print("="*60)
    
    success = apply_migrations()
    
    if not success:
        print("\n❌ Migration process failed!")
        print("💡 Troubleshooting tips:")
        print("   1. Ensure DATABASE_URL is correct in your .env file")
        print("   2. Check that the database is accessible")
        print("   3. Run 'python check_database_state.py' to see current schema")
        print("   4. If all else fails, use 'python fix_missing_columns.py' as emergency fix")
        sys.exit(1)
    else:
        print("\n✅ All done! Your database is ready to use.")
        sys.exit(0)