#!/usr/bin/env python3
"""
Setup Test User Script
Creates a test restaurant owner with specified subscription plan

Usage:
    python setup_test_user.py <email> [plan]
    
Arguments:
    email    User's email address
    plan     Subscription plan (alpha/beta/omega) - default: omega

Examples:
    python setup_test_user.py user@example.com
    python setup_test_user.py user@example.com beta
"""
import os
import sys
import uuid
import argparse
from datetime import datetime, timedelta
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

# Add the backend directory to the path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Load environment variables
load_dotenv()

def setup_test_user(email, plan='omega'):
    """Setup test user as restaurant owner with specified plan"""
    
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        print("❌ DATABASE_URL not found in environment variables")
        return False
    
    try:
        # Create database connection
        engine = create_engine(database_url)
        
        with engine.connect() as conn:
            print("🔍 Checking for existing user...")
            
            # Check if user already exists
            result = conn.execute(text("""
                SELECT id, email, restaurant_id, role, supabase_id 
                FROM users 
                WHERE email = :email
            """), {"email": email})
            
            user = result.fetchone()
            
            if user:
                print(f"✅ User found: {user[0]}")
                user_id = user[0]
                restaurant_id = user[2]
                
                # Update role if needed
                if user[3] != 'restaurant_owner':
                    print("📝 Updating user role to restaurant_owner...")
                    conn.execute(text("""
                        UPDATE users 
                        SET role = 'restaurant_owner' 
                        WHERE id = :user_id
                    """), {"user_id": user_id})
                    conn.commit()
            else:
                print("❌ User not found in database")
                print("⚠️  User needs to sign in first via the app to be created automatically")
                print(f"📱 Please sign in with {email} through the mobile app")
                return False
            
            # Check if user has a restaurant
            if not restaurant_id:
                print("\n🏢 Creating restaurant for user...")
                
                # Generate new restaurant ID
                restaurant_id = str(uuid.uuid4())
                
                # Create restaurant with Omega subscription
                conn.execute(text("""
                    INSERT INTO restaurants (
                        id, name, email, phone, address,
                        subscription_plan, subscription_status,
                        subscription_started_at, subscription_expires_at,
                        is_active, created_at, updated_at,
                        timezone, business_hours, settings,
                        tax_configuration, payment_methods
                    ) VALUES (
                        :id, :name, :email, :phone, :address,
                        :plan, :status,
                        :started_at, :expires_at,
                        :is_active, :created_at, :updated_at,
                        :timezone, :business_hours::jsonb, :settings::jsonb,
                        :tax_configuration::jsonb, :payment_methods::jsonb
                    )
                """), {
                    "id": restaurant_id,
                    "name": f"Test Restaurant - {plan.title()} Tier",
                    "email": email,
                    "phone": "+44 20 1234 5678",
                    "address": '{"street": "123 Test Street", "city": "London", "postcode": "SW1A 1AA", "country": "UK"}',
                    "plan": plan,
                    "status": "active",
                    "started_at": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(days=365),  # 1 year subscription
                    "is_active": True,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow(),
                    "timezone": "Europe/London",
                    "business_hours": '{"monday": {"open": "09:00", "close": "22:00"}, "tuesday": {"open": "09:00", "close": "22:00"}, "wednesday": {"open": "09:00", "close": "22:00"}, "thursday": {"open": "09:00", "close": "22:00"}, "friday": {"open": "09:00", "close": "23:00"}, "saturday": {"open": "10:00", "close": "23:00"}, "sunday": {"open": "10:00", "close": "21:00"}}',
                    "settings": '{"currency": "GBP", "language": "en", "theme": "light"}',
                    "tax_configuration": '{"vatEnabled": true, "vatRate": 20, "serviceTaxEnabled": true, "serviceTaxRate": 12.5}',
                    "payment_methods": '{"qrCode": {"enabled": true, "feePercentage": 1.2}, "cash": {"enabled": true, "requiresAuth": false}, "card": {"enabled": true, "feePercentage": 2.9}, "applePay": {"enabled": true, "feePercentage": 2.9}, "giftCard": {"enabled": true, "requiresAuth": true}}'
                })
                
                # Link user to restaurant
                conn.execute(text("""
                    UPDATE users 
                    SET restaurant_id = :restaurant_id 
                    WHERE id = :user_id
                """), {"restaurant_id": restaurant_id, "user_id": user_id})
                
                conn.commit()
                print(f"✅ Created restaurant with ID: {restaurant_id}")
                
            else:
                print(f"\n🏢 User already has restaurant: {restaurant_id}")
                
                # Update restaurant to Omega plan
                print("📝 Updating restaurant to Omega subscription plan...")
                conn.execute(text("""
                    UPDATE restaurants 
                    SET 
                        subscription_plan = 'omega',
                        subscription_status = 'active',
                        subscription_started_at = :started_at,
                        subscription_expires_at = :expires_at,
                        updated_at = :updated_at
                    WHERE id = :restaurant_id
                """), {
                    "restaurant_id": restaurant_id,
                    "started_at": datetime.utcnow(),
                    "expires_at": datetime.utcnow() + timedelta(days=365),
                    "updated_at": datetime.utcnow()
                })
                conn.commit()
            
            # Verify the setup
            print("\n🔍 Verifying setup...")
            
            result = conn.execute(text("""
                SELECT 
                    u.email, u.role,
                    r.name, r.subscription_plan, r.subscription_status,
                    r.id as restaurant_id
                FROM users u
                JOIN restaurants r ON u.restaurant_id = r.id
                WHERE u.email = :email
            """), {"email": email})
            
            final_data = result.fetchone()
            
            if final_data:
                print("\n✅ Setup Complete!")
                print(f"📧 Email: {final_data[0]}")
                print(f"👤 Role: {final_data[1]}")
                print(f"🏢 Restaurant: {final_data[2]}")
                print(f"📦 Subscription Plan: {final_data[3]}")
                print(f"✓ Subscription Status: {final_data[4]}")
                print(f"🔑 Restaurant ID: {final_data[5]}")
                
                print("\n🎯 Next Steps:")
                print("1. The user can now log in with full Omega tier access")
                print("2. WebSocket connections should work properly")
                print("3. All premium features will be available")
                
                # Show available features for Omega plan
                # Show plan features
                if plan == 'omega':
                    print("\n🌟 Omega Plan Features:")
                    print("- ✅ Unlimited transactions at 1% fee")
                    print("- ✅ Unlimited everything")
                    print("- ✅ Everything in Beta PLUS:")
                    print("- ✅ Unlimited staff accounts")
                    print("- ✅ Unlimited locations")
                    print("- ✅ White-label options")
                    print("- ✅ Advanced analytics & forecasting")
                    print("- ✅ Custom integrations")
                elif plan == 'beta':
                    print("\n🎆 Beta Plan Features:")
                    print("- ✅ Up to 1000 transactions/month at 1.5% fee")
                    print("- ✅ Up to 10 staff accounts")
                    print("- ✅ Advanced reporting")
                    print("- ✅ Multi-location support")
                    print("- ✅ Priority support")
                else:  # alpha
                    print("\n🆓 Alpha Plan Features:")
                    print("- ✅ Up to 100 transactions/month at 2% fee")
                    print("- ✅ Up to 3 staff accounts")
                    print("- ✅ Basic reporting")
                    print("- ✅ Single location")
                
                return True
            else:
                print("❌ Setup verification failed")
                return False
                
    except Exception as e:
        print(f"\n❌ Error setting up test user: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    # Parse command line arguments
    parser = argparse.ArgumentParser(description='Setup test user with subscription')
    parser.add_argument('email', help='User email address')
    parser.add_argument('plan', nargs='?', default='omega', 
                        choices=['alpha', 'beta', 'omega'],
                        help='Subscription plan (default: omega)')
    args = parser.parse_args()
    
    print("="*60)
    print("🔧 Fynlo Test User Setup")
    print("="*60)
    print(f"Setting up {args.email} as restaurant owner")
    print(f"with {args.plan.title()} subscription plan...")
    print()
    
    success = setup_test_user(args.email, args.plan)
    
    if not success:
        sys.exit(1)
    else:
        sys.exit(0)