#!/usr/bin/env python3
"""
Setup default subscription plans for Fynlo POS

This script creates the default subscription plans that will be available
to restaurants when they sign up for the platform.

Run this script after running the database migration:
python backend/scripts/setup_subscription_plans.py
"""

import asyncio
import sys
import os
from datetime import datetime

# Add the backend directory to the Python path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.database import get_db_session
from app.models.subscription import SubscriptionPlan
from sqlalchemy.orm import Session


# Default subscription plans for Fynlo POS
SUBSCRIPTION_PLANS = [
    {
        'name': 'basic',
        'display_name': 'Basic Plan',
        'price_monthly': 29.99,
        'price_yearly': 299.99,  # 2 months free (16.7% discount)
        'max_orders_per_month': 500,
        'max_staff_accounts': 5,
        'max_menu_items': 50,
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'customer_support': 'email',
            'payment_processing': True,
            'order_history': True,
            'inventory_management': False,
            'advanced_analytics': False,
            'multi_location': False,
            'api_access': False,
            'custom_branding': False,
            'priority_support': False
        }
    },
    {
        'name': 'professional',
        'display_name': 'Professional Plan',
        'price_monthly': 59.99,
        'price_yearly': 599.99,  # 2 months free (16.7% discount)
        'max_orders_per_month': 2000,
        'max_staff_accounts': 15,
        'max_menu_items': 200,
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'advanced_analytics': True,
            'inventory_management': True,
            'customer_support': 'priority',
            'payment_processing': True,
            'order_history': True,
            'staff_management': True,
            'custom_branding': True,
            'multi_location': False,
            'api_access': False,
            'priority_support': True,
            'export_data': True
        }
    },
    {
        'name': 'enterprise',
        'display_name': 'Enterprise Plan',
        'price_monthly': 129.99,
        'price_yearly': 1299.99,  # 2 months free (16.7% discount)
        'max_orders_per_month': None,  # Unlimited
        'max_staff_accounts': None,    # Unlimited
        'max_menu_items': None,        # Unlimited
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'advanced_analytics': True,
            'inventory_management': True,
            'multi_location': True,
            'api_access': True,
            'custom_integrations': True,
            'dedicated_support': True,
            'customer_support': 'phone',
            'priority_support': True,
            'white_label': True,
            'custom_branding': True,
            'staff_management': True,
            'export_data': True,
            'backup_restore': True
        }
    },
    {
        'name': 'trial',
        'display_name': 'Free Trial',
        'price_monthly': 0.00,
        'price_yearly': 0.00,
        'max_orders_per_month': 100,
        'max_staff_accounts': 2,
        'max_menu_items': 20,
        'features': {
            'pos_system': True,
            'basic_reports': True,
            'customer_support': 'email',
            'payment_processing': True,
            'order_history': True,
            'inventory_management': False,
            'advanced_analytics': False,
            'multi_location': False,
            'api_access': False,
            'custom_branding': False,
            'priority_support': False,
            'trial_limitations': True
        }
    }
]


async def create_subscription_plans():
    """Create the default subscription plans in the database"""
    
    # Get database session
    async with get_db_session() as db:
        try:
            for plan_data in SUBSCRIPTION_PLANS:
                # Check if plan already exists
                existing_plan = db.query(SubscriptionPlan).filter(
                    SubscriptionPlan.name == plan_data['name']
                ).first()
                
                if existing_plan:
                    print(f"✅ Plan '{plan_data['name']}' already exists, skipping...")
                    continue
                
                # Create new plan
                plan = SubscriptionPlan(
                    name=plan_data['name'],
                    display_name=plan_data['display_name'],
                    price_monthly=plan_data['price_monthly'],
                    price_yearly=plan_data['price_yearly'],
                    max_orders_per_month=plan_data['max_orders_per_month'],
                    max_staff_accounts=plan_data['max_staff_accounts'],
                    max_menu_items=plan_data['max_menu_items'],
                    features=plan_data['features'],
                    is_active=True,
                    created_at=datetime.utcnow(),
                    updated_at=datetime.utcnow()
                )
                
                db.add(plan)
                print(f"✅ Created subscription plan: {plan_data['display_name']}")
            
            # Commit all changes
            db.commit()
            print(f"\n🎉 Successfully created {len(SUBSCRIPTION_PLANS)} subscription plans!")
            
            # Display summary
            print("\n📋 Subscription Plans Summary:")
            for plan_data in SUBSCRIPTION_PLANS:
                print(f"  • {plan_data['display_name']}: £{plan_data['price_monthly']}/month")
            
        except Exception as e:
            print(f"❌ Error creating subscription plans: {e}")
            db.rollback()
            raise


def main():
    """Main function to run the setup script"""
    print("🚀 Setting up default subscription plans for Fynlo POS...")
    print("=" * 60)
    
    try:
        asyncio.run(create_subscription_plans())
        print("\n✅ Subscription plans setup completed successfully!")
        print("\nNext steps:")
        print("1. Run the application to test subscription functionality")
        print("2. Configure Stripe integration for payment processing")
        print("3. Test subscription flows in the mobile app")
        
    except Exception as e:
        print(f"\n❌ Failed to setup subscription plans: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()