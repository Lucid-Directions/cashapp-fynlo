#!/usr/bin/env python3
"""
Direct Database Menu Initialization for Chucho Restaurant
This bypasses the API and directly populates the database
"""

import sys
import os
from sqlalchemy.orm import Session
from sqlalchemy import text
import uuid
from decimal import Decimal
from datetime import datetime

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal

# Chucho Menu Data
CHUCHO_CATEGORIES = [
    {'name': 'Snacks', 'color': '#FF6B6B', 'icon': '🍲', 'sort_order': 1},
    {'name': 'Tacos', 'color': '#4ECDC4', 'icon': '🌮', 'sort_order': 2},
    {'name': 'Special Tacos', 'color': '#45B7D1', 'icon': '⭐', 'sort_order': 3},
    {'name': 'Burritos', 'color': '#96CEB4', 'icon': '🌯', 'sort_order': 4},
    {'name': 'Sides', 'color': '#FECA57', 'icon': '🍟', 'sort_order': 5},
    {'name': 'Drinks', 'color': '#FF9FF3', 'icon': '🍹', 'sort_order': 6},
]

CHUCHO_MENU_ITEMS = [
    # SNACKS
    {'name': 'Nachos', 'price': 5.00, 'category': 'Snacks', 'description': 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'},
    {'name': 'Quesadillas', 'price': 5.50, 'category': 'Snacks', 'description': 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'},
    {'name': 'Chorizo Quesadilla', 'price': 5.50, 'category': 'Snacks', 'description': 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander'},
    {'name': 'Chicken Quesadilla', 'price': 5.50, 'category': 'Snacks', 'description': 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander'},
    {'name': 'Tostada', 'price': 6.50, 'category': 'Snacks', 'description': 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta'},
    
    # TACOS (All £3.50)
    {'name': 'Carnitas', 'price': 3.50, 'category': 'Tacos', 'description': 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'},
    {'name': 'Cochinita', 'price': 3.50, 'category': 'Tacos', 'description': 'Marinated pulled pork served with pickle red onion'},
    {'name': 'Barbacoa de Res', 'price': 3.50, 'category': 'Tacos', 'description': 'Juicy pulled beef topped with onion, guacamole & coriander'},
    {'name': 'Chorizo', 'price': 3.50, 'category': 'Tacos', 'description': 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole'},
    {'name': 'Rellena', 'price': 3.50, 'category': 'Tacos', 'description': 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Chicken Fajita', 'price': 3.50, 'category': 'Tacos', 'description': 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander'},
    {'name': 'Haggis', 'price': 3.50, 'category': 'Tacos', 'description': 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Pescado', 'price': 3.50, 'category': 'Tacos', 'description': 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa'},
    {'name': 'Dorados', 'price': 3.50, 'category': 'Tacos', 'description': 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta'},
    {'name': 'Dorados Papa', 'price': 3.50, 'category': 'Tacos', 'description': 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta'},
    {'name': 'Nopal', 'price': 3.50, 'category': 'Tacos', 'description': 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta'},
    {'name': 'Bean & Cheese', 'price': 3.50, 'category': 'Tacos', 'description': 'Refried beans with cheddar cheese, topped with pico de gallo and coriander'},
    
    # SPECIAL TACOS (All £4.50)
    {'name': 'Birria', 'price': 4.50, 'category': 'Special Tacos', 'description': 'Slow-cooked beef in rich consommé, served with melted cheese and dipping broth'},
    {'name': 'Trompo', 'price': 4.50, 'category': 'Special Tacos', 'description': 'Marinated pork with pineapple, served with onion, coriander and tomatillo salsa'},
    {'name': 'Lobster', 'price': 4.50, 'category': 'Special Tacos', 'description': 'Fresh lobster with garlic butter, topped with avocado and chipotle mayo'},
    {'name': 'Wagyu', 'price': 4.50, 'category': 'Special Tacos', 'description': 'Premium wagyu beef with caramelized onions and truffle aioli'},
    
    # BURRITOS
    {'name': 'Classic Burrito', 'price': 8.50, 'category': 'Burritos', 'description': 'Large flour tortilla with your choice of filling, rice, beans, cheese, salsa, and sour cream'},
    {'name': 'Veggie Burrito', 'price': 7.50, 'category': 'Burritos', 'description': 'Grilled vegetables, rice, black beans, cheese, guacamole, and pico de gallo'},
    {'name': 'Breakfast Burrito', 'price': 7.00, 'category': 'Burritos', 'description': 'Scrambled eggs, chorizo, potatoes, cheese, and salsa verde'},
    {'name': 'California Burrito', 'price': 9.50, 'category': 'Burritos', 'description': 'Carne asada, french fries, cheese, guacamole, and sour cream'},
    
    # SIDES
    {'name': 'Chips & Salsa', 'price': 3.00, 'category': 'Sides', 'description': 'Fresh tortilla chips with house-made salsa'},
    {'name': 'Chips & Guacamole', 'price': 4.50, 'category': 'Sides', 'description': 'Fresh tortilla chips with house-made guacamole'},
    {'name': 'Mexican Rice', 'price': 3.00, 'category': 'Sides', 'description': 'Traditional Mexican rice with tomatoes and spices'},
    {'name': 'Refried Beans', 'price': 3.00, 'category': 'Sides', 'description': 'Creamy refried pinto beans'},
    {'name': 'Street Corn', 'price': 4.00, 'category': 'Sides', 'description': 'Grilled corn with mayo, cotija cheese, and chili powder'},
    
    # DRINKS
    {'name': 'Jarritos', 'price': 3.00, 'category': 'Drinks', 'description': 'Mexican soda - various flavors'},
    {'name': 'Mexican Coke', 'price': 3.50, 'category': 'Drinks', 'description': 'Made with real cane sugar'},
    {'name': 'Horchata', 'price': 3.50, 'category': 'Drinks', 'description': 'Traditional rice and cinnamon drink'},
    {'name': 'Jamaica', 'price': 3.50, 'category': 'Drinks', 'description': 'Hibiscus flower iced tea'},
    {'name': 'Margarita', 'price': 7.50, 'category': 'Drinks', 'description': 'Classic or frozen - lime, strawberry, or mango'},
    {'name': 'Corona', 'price': 4.50, 'category': 'Drinks', 'description': 'Mexican beer served with lime'},
]

def init_chucho_menu():
    """Initialize Chucho menu in database"""
    db = SessionLocal()
    
    try:
        print("🌮 Direct Database Menu Initialization")
        print("=" * 50)
        
        # Find Chucho restaurant specifically
        result = db.execute(
            text("SELECT id, name FROM restaurants WHERE LOWER(name) LIKE '%chucho%' ORDER BY created_at ASC LIMIT 1")
        ).fetchone()
        
        if not result:
            # If Chucho doesn't exist, create it
            print("⚠️  Chucho restaurant not found. Creating it...")
            restaurant_id = str(uuid.uuid4())
            restaurant_name = "Chucho"
            
            db.execute(
                text("""
                    INSERT INTO restaurants (id, name, is_active, created_at, updated_at)
                    VALUES (:id, :name, true, :created_at, :updated_at)
                """),
                {
                    "id": restaurant_id,
                    "name": restaurant_name,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            )
            db.commit()
            print(f"✅ Created Chucho restaurant (ID: {restaurant_id})")
        else:
            restaurant_id = str(result[0])
            restaurant_name = result[1]
            print(f"✅ Found restaurant: {restaurant_name} (ID: {restaurant_id})")
        
        # Clear existing menu
        print("\n🧹 Clearing existing menu...")
        db.execute(text("DELETE FROM products WHERE restaurant_id = :rid"), {"rid": restaurant_id})
        db.execute(text("DELETE FROM categories WHERE restaurant_id = :rid"), {"rid": restaurant_id})
        db.commit()
        print("✅ Existing menu cleared")
        
        # Create categories
        print("\n📂 Creating categories...")
        category_map = {}
        
        for cat_data in CHUCHO_CATEGORIES:
            category_id = str(uuid.uuid4())
            
            db.execute(
                text("""
                    INSERT INTO categories (
                        id, restaurant_id, name, description, 
                        is_active, sort_order, created_at, updated_at
                    ) VALUES (
                        :id, :restaurant_id, :name, :description,
                        true, :sort_order, :created_at, :updated_at
                    )
                """),
                {
                    "id": category_id,
                    "restaurant_id": restaurant_id,
                    "name": cat_data['name'],
                    "description": f"{cat_data['name']} items at {restaurant_name}",
                    "sort_order": cat_data['sort_order'],
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            )
            
            category_map[cat_data['name']] = category_id
            print(f"   ✅ Created: {cat_data['name']}")
        
        db.commit()
        
        # Create products
        print(f"\n🍽️  Creating {len(CHUCHO_MENU_ITEMS)} menu items...")
        sku_counter = 1
        
        for item_data in CHUCHO_MENU_ITEMS:
            category_id = category_map.get(item_data['category'])
            if not category_id:
                print(f"   ⚠️  Skipping {item_data['name']} - category not found")
                continue
            
            product_id = str(uuid.uuid4())
            sku = f"CHU{sku_counter:03d}"
            
            db.execute(
                text("""
                    INSERT INTO products (
                        id, restaurant_id, category_id, name, description,
                        price, is_active, sku, created_at, updated_at
                    ) VALUES (
                        :id, :restaurant_id, :category_id, :name, :description,
                        :price, true, :sku, :created_at, :updated_at
                    )
                """),
                {
                    "id": product_id,
                    "restaurant_id": restaurant_id,
                    "category_id": category_id,
                    "name": item_data['name'],
                    "description": item_data['description'],
                    "price": Decimal(str(item_data['price'])),
                    "sku": sku,
                    "created_at": datetime.utcnow(),
                    "updated_at": datetime.utcnow()
                }
            )
            
            sku_counter += 1
        
        db.commit()
        
        # Verify the data
        category_count = db.execute(
            text("SELECT COUNT(*) FROM categories WHERE restaurant_id = :rid"),
            {"rid": restaurant_id}
        ).scalar()
        
        product_count = db.execute(
            text("SELECT COUNT(*) FROM products WHERE restaurant_id = :rid"),
            {"rid": restaurant_id}
        ).scalar()
        
        print("\n" + "=" * 50)
        print("✅ MENU INITIALIZATION COMPLETE!")
        print(f"   Restaurant: {restaurant_name}")
        print(f"   Categories: {category_count}")
        print(f"   Products: {product_count}")
        print("=" * 50)
        
        return True
        
    except Exception as e:
        print(f"\n❌ ERROR: {str(e)}")
        db.rollback()
        return False
        
    finally:
        db.close()

if __name__ == "__main__":
    success = init_chucho_menu()
    sys.exit(0 if success else 1)