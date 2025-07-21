#!/usr/bin/env python3
"""
Update Supabase User Metadata for Subscription Plan
Updates user metadata to set subscription plan and features
"""
import os
import sys
from dotenv import load_dotenv
from supabase import create_client, Client

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def update_user_subscription(email: str, plan: str = "omega"):
    """Update user's subscription plan in Supabase metadata"""
    
    # Get Supabase credentials
    supabase_url = os.getenv("SUPABASE_URL")
    supabase_service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    
    if not supabase_url or not supabase_service_key:
        print("❌ Missing Supabase credentials in environment variables")
        print("Required: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY")
        return False
    
    try:
        # Create Supabase admin client
        supabase: Client = create_client(supabase_url, supabase_service_key)
        
        print(f"🔍 Looking up user: {email}")
        
        # Get user by email
        result = supabase.auth.admin.list_users()
        
        user_found = None
        # Handle both possible response formats
        users_list = result.users if hasattr(result, 'users') else result
        
        for user in users_list:
            if user.email == email:
                user_found = user
                break
        
        if not user_found:
            print(f"❌ User not found: {email}")
            print("Please ensure the user has signed up first")
            return False
        
        print(f"✅ User found: {user_found.id}")
        print(f"📧 Email: {user_found.email}")
        
        # Current metadata
        current_metadata = user_found.user_metadata or {}
        print(f"\n📋 Current metadata:")
        for key, value in current_metadata.items():
            print(f"  - {key}: {value}")
        
        # Update metadata with subscription plan
        updated_metadata = current_metadata.copy()
        updated_metadata.update({
            "subscription_plan": plan,
            "subscription_status": "active",
            "subscription_tier": plan,  # Duplicate for compatibility
            "features": get_plan_features(plan)
        })
        
        print(f"\n📝 Updating metadata with {plan} subscription...")
        
        # Update user metadata
        update_result = supabase.auth.admin.update_user_by_id(
            user_found.id,
            {
                "user_metadata": updated_metadata
            }
        )
        
        if update_result:
            print("✅ User metadata updated successfully!")
            
            # Verify the update
            verify_result = supabase.auth.admin.get_user_by_id(user_found.id)
            if verify_result:
                print(f"\n📋 Updated metadata:")
                for key, value in verify_result.user.user_metadata.items():
                    print(f"  - {key}: {value}")
            
            print(f"\n🌟 {plan.upper()} Plan Features Enabled:")
            for feature in get_plan_features(plan):
                print(f"  - ✅ {feature}")
            
            print("\n🎯 Next Steps:")
            print("1. User can now log in to the mobile app")
            print("2. Authentication will sync the subscription plan")
            print("3. All Omega features will be available")
            
            return True
        else:
            print("❌ Failed to update user metadata")
            return False
            
    except Exception as e:
        print(f"\n❌ Error updating user: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

def get_plan_features(plan: str) -> list:
    """Get features enabled for a subscription plan"""
    
    features = {
        "alpha": [
            "Basic POS functions",
            "Up to 500 transactions/month",
            "Digital receipts",
            "QR code ordering",
            "Single location",
            "Single user account",
            "Email support"
        ],
        "beta": [
            "Everything in Alpha PLUS",
            "Unlimited transactions",
            "Full kitchen display system",
            "Station-based order routing",
            "Up to 5 staff accounts",
            "Staff scheduling & time tracking",
            "Inventory management with alerts"
        ],
        "omega": [
            "Everything in Beta PLUS",
            "Unlimited staff accounts",
            "Unlimited locations",
            "White-label options",
            "Advanced analytics & forecasting",
            "Custom integrations",
            "Priority support",
            "API access",
            "Multi-restaurant management",
            "Enterprise features"
        ]
    }
    
    return features.get(plan.lower(), features["alpha"])

if __name__ == "__main__":
    print("="*60)
    print("🔧 Supabase User Subscription Update")
    print("="*60)
    
    # Parse command line arguments
    if len(sys.argv) < 2:
        print("Usage: python update_user_subscription.py <email> [plan]")
        print("  email: User's email address")
        print("  plan: Subscription plan (alpha/beta/omega) - default: omega")
        print("\nExample: python update_user_subscription.py user@example.com omega")
        sys.exit(1)
    
    email = sys.argv[1]
    plan = sys.argv[2] if len(sys.argv) > 2 else "omega"
    
    print(f"Updating {email} to {plan.upper()} subscription plan...")
    print()
    
    success = update_user_subscription(email, plan)
    
    if not success:
        sys.exit(1)
    else:
        sys.exit(0)