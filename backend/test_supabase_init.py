#!/usr/bin/env python3
"""
Diagnostic script to test Supabase initialization
Run this to see why Supabase admin client is not initializing
"""

import os
import sys
from pathlib import Path

# Add the backend directory to Python path
backend_dir = Path(__file__).parent
sys.path.insert(0, str(backend_dir))

# Now import our modules
from app.core.config import settings
from supabase import create_client, Client

def test_environment_variables():
    """Test if environment variables are properly loaded"""
    print("🔍 Testing Environment Variables")
    print("="*50)
    
    # Check SUPABASE_URL
    if hasattr(settings, 'SUPABASE_URL') and settings.SUPABASE_URL:
        print(f"✅ SUPABASE_URL is set: {settings.SUPABASE_URL[:50]}...")
    else:
        print("❌ SUPABASE_URL is NOT set")
    
    # Check SUPABASE_SERVICE_ROLE_KEY
    if hasattr(settings, 'SUPABASE_SERVICE_ROLE_KEY') and settings.SUPABASE_SERVICE_ROLE_KEY:
        print(f"✅ SUPABASE_SERVICE_ROLE_KEY is set: {settings.SUPABASE_SERVICE_ROLE_KEY[:20]}...")
    else:
        print("❌ SUPABASE_SERVICE_ROLE_KEY is NOT set")
    
    # Check SUPABASE_ANON_KEY
    if hasattr(settings, 'SUPABASE_ANON_KEY') and settings.SUPABASE_ANON_KEY:
        print(f"✅ SUPABASE_ANON_KEY is set: {settings.SUPABASE_ANON_KEY[:20]}...")
    else:
        print("❌ SUPABASE_ANON_KEY is NOT set")
    
    # Check environment
    print(f"\n📊 Environment: {settings.ENVIRONMENT}")
    print(f"📊 Debug mode: {settings.DEBUG}")
    
    return (hasattr(settings, 'SUPABASE_URL') and settings.SUPABASE_URL and 
            hasattr(settings, 'SUPABASE_SERVICE_ROLE_KEY') and settings.SUPABASE_SERVICE_ROLE_KEY)

def test_supabase_client_creation():
    """Test creating Supabase client"""
    print("\n🔍 Testing Supabase Client Creation")
    print("="*50)
    
    try:
        # Try to create client with service role key
        print("Creating client with service role key...")
        client = create_client(
            settings.SUPABASE_URL,
            settings.SUPABASE_SERVICE_ROLE_KEY
        )
        print("✅ Supabase client created successfully")
        
        # Test if we can make a basic call
        print("\nTesting client functionality...")
        try:
            # This should work even if no users exist
            response = client.auth.admin.list_users()
            print(f"✅ Client is functional - found {len(response) if hasattr(response, '__len__') else 'some'} users")
        except Exception as e:
            print(f"⚠️  Client created but API call failed: {type(e).__name__}: {e}")
            
        return True
        
    except Exception as e:
        print(f"❌ Failed to create Supabase client: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
        return False

def test_supabase_initialization_module():
    """Test the actual initialization in supabase.py"""
    print("\n🔍 Testing supabase.py Module")
    print("="*50)
    
    try:
        from app.core.supabase import supabase_admin
        
        if supabase_admin is None:
            print("❌ supabase_admin is None - initialization failed")
            
            # Check logs to see why
            print("\nChecking initialization logs...")
            # Re-run the initialization to see the error
            try:
                from app.core.supabase import get_supabase_client
                client = get_supabase_client()
                print("✅ Manual initialization succeeded - something wrong with module init")
            except Exception as e:
                print(f"❌ Manual initialization also failed: {type(e).__name__}: {e}")
        else:
            print("✅ supabase_admin is initialized")
            print(f"   Type: {type(supabase_admin)}")
            
    except Exception as e:
        print(f"❌ Error importing supabase module: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()

def main():
    """Run all tests"""
    print("🚀 Supabase Initialization Diagnostic")
    print("="*50)
    
    # Test 1: Environment variables
    env_ok = test_environment_variables()
    if not env_ok:
        print("\n❌ Environment variables not properly configured")
        print("Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set")
        return
    
    # Test 2: Client creation
    client_ok = test_supabase_client_creation()
    
    # Test 3: Module initialization
    test_supabase_initialization_module()
    
    print("\n📊 Summary")
    print("="*50)
    print(f"Environment variables: {'✅ OK' if env_ok else '❌ Failed'}")
    print(f"Client creation: {'✅ OK' if client_ok else '❌ Failed'}")
    
    if env_ok and client_ok:
        print("\n💡 Supabase configuration appears correct.")
        print("The issue might be with the initialization timing or import order.")
    else:
        print("\n❌ Supabase configuration has issues that need to be fixed.")

if __name__ == "__main__":
    main()