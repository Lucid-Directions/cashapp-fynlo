#!/usr/bin/env python3
"""
Run the Chucho menu seed SQL script on DigitalOcean database
"""
import os
import sys
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
import logging

# Load environment variables
load_dotenv()

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def run_seed_script():
    """Execute the Chucho menu seed SQL script"""
    database_url = os.getenv("DATABASE_URL")
    
    if not database_url:
        print("❌ ERROR: DATABASE_URL environment variable is not set!")
        return False
    
    print("🌮 Seeding Chucho Mexican Restaurant Menu...")
    print("=" * 60)
    
    try:
        # Create engine
        engine = create_engine(database_url, echo=False)
        
        # Read the SQL script
        script_path = os.path.join(os.path.dirname(__file__), "seed_chucho_menu_complete.sql")
        with open(script_path, 'r') as f:
            sql_script = f.read()
        
        # Execute the script
        with engine.connect() as conn:
            # Execute the entire script as one transaction
            result = conn.execute(text(sql_script))
            conn.commit()
            
            print("✅ Successfully executed menu seed script!")
            
            # Verify the data was inserted
            print("\n📊 Verifying menu data...")
            
            # Check restaurant
            result = conn.execute(text("""
                SELECT name, subscription_plan, subscription_status 
                FROM restaurants 
                WHERE name ILIKE '%Chucho%'
                LIMIT 1
            """))
            restaurant = result.fetchone()
            if restaurant:
                print(f"✅ Restaurant: {restaurant[0]}")
                print(f"   Plan: {restaurant[1]}")
                print(f"   Status: {restaurant[2]}")
            
            # Count categories
            result = conn.execute(text("""
                SELECT COUNT(*) FROM categories 
                WHERE restaurant_id IN (
                    SELECT id FROM restaurants WHERE name ILIKE '%Chucho%'
                )
            """))
            category_count = result.scalar()
            print(f"\n✅ Categories: {category_count}")
            
            # Count products
            result = conn.execute(text("""
                SELECT COUNT(*) FROM products 
                WHERE restaurant_id IN (
                    SELECT id FROM restaurants WHERE name ILIKE '%Chucho%'
                )
            """))
            product_count = result.scalar()
            print(f"✅ Menu Items: {product_count}")
            
            # Show sample items
            result = conn.execute(text("""
                SELECT p.name, p.price, c.name as category
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.restaurant_id IN (
                    SELECT id FROM restaurants WHERE name ILIKE '%Chucho%'
                )
                ORDER BY c.sort_order, p.name
                LIMIT 10
            """))
            
            print("\n📋 Sample Menu Items:")
            for item in result:
                print(f"   - {item[0]} (£{item[1]:.2f}) - {item[2]}")
            
        print("\n✅ Chucho menu successfully seeded!")
        print("🎉 The menu should now appear in the mobile app")
        return True
        
    except Exception as e:
        print(f"\n❌ Error seeding menu: {str(e)}")
        import traceback
        traceback.print_exc()
        return False

if __name__ == "__main__":
    print("🚀 Chucho Menu Seeder for DigitalOcean")
    print("=" * 60)
    
    success = run_seed_script()
    
    if success:
        print("\n✅ All done! The Chucho menu is now in the database.")
        sys.exit(0)
    else:
        print("\n❌ Seeding failed. Please check the error messages above.")
        sys.exit(1)