#!/usr/bin/env python3
"""
Setup Chucho Restaurant with correct name and menu
<<<<<<< HEAD

=======
"""
>>>>>>> parent of af057592 (fix: docstring syntax and formatting issues across backend)

import os
from sqlalchemy import create_engine, text
from dotenv import load_dotenv
from decimal import Decimal
import json

# Load environment variables
load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")

# Chucho Restaurant Menu Data - AUTHENTIC MEXICAN TACOS
CHUCHO_MENU = {
    "restaurant_name": "Chucho Restaurant",
    "categories": [
        {
            "name": "Snacks",
            "sort_order": 1,
            "items": [
                {"name": "Nachos", "price": 5.00, "description": "Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander"},
                {"name": "Quesadillas", "price": 5.50, "description": "Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander"},
                {"name": "Chorizo Quesadilla", "price": 5.50, "description": "Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander"},
                {"name": "Chicken Quesadilla", "price": 5.50, "description": "Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander"},
                {"name": "Tostada", "price": 6.50, "description": "Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta"}
            ]
        },
        {
            "name": "Tacos",
            "sort_order": 2,
            "items": [
                {"name": "Carnitas", "price": 3.50, "description": "Slow cooked pork, served with onion, salsa, guacamole & coriander"},
                {"name": "Cochinita", "price": 3.50, "description": "Marinated pulled pork served with pickle red onion"},
                {"name": "Barbacoa de Res", "price": 3.50, "description": "Juicy pulled beef topped with onion, guacamole & coriander"},
                {"name": "Chorizo", "price": 3.50, "description": "Grilled chorizo with black beans, onions, salsa, coriander & guacamole"},
                {"name": "Rellena", "price": 3.50, "description": "Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion"},
                {"name": "Chicken Fajita", "price": 3.50, "description": "Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander"},
                {"name": "Haggis", "price": 3.50, "description": "Haggis with beans, onion & chilli. Topped with coriander and pickled red onion"},
                {"name": "Pescado", "price": 3.50, "description": "Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa"},
                {"name": "Dorados", "price": 3.50, "description": "Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta"},
                {"name": "Dorados Papa", "price": 3.50, "description": "Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta"},
                {"name": "Nopal", "price": 3.50, "description": "Cactus, black beans & onion, topped with tomato salsa and crumbled feta"},
                {"name": "Papa", "price": 3.50, "description": "Potato with beans, peppers & onion. Topped with salsa, feta & coriander"},
                {"name": "Setas", "price": 3.50, "description": "Oyster mushrooms with beans, peppers & onion. Topped with salsa, feta & coriander"}
            ]
        },
        {
            "name": "Special Tacos",
            "sort_order": 3,
            "items": [
                {"name": "Especial Carnitas", "price": 4.50, "description": "Premium slow cooked pork with special toppings"},
                {"name": "Especial Barbacoa", "price": 4.50, "description": "Premium pulled beef with gourmet toppings"},
                {"name": "Especial Pollo", "price": 4.50, "description": "Premium grilled chicken with special sauce"}
            ]
        },
        {
            "name": "Burritos",
            "sort_order": 4,
            "items": [
                {"name": "Burrito Carnitas", "price": 9.00, "description": "Large flour tortilla with slow cooked pork, rice, beans, salsa"},
                {"name": "Burrito Pollo", "price": 8.50, "description": "Large flour tortilla with grilled chicken, rice, beans, salsa"},
                {"name": "Burrito Vegetariano", "price": 7.50, "description": "Large flour tortilla with grilled vegetables, rice, beans, salsa"},
                {"name": "Burrito Barbacoa", "price": 9.50, "description": "Large flour tortilla with pulled beef, rice, beans, salsa"}
            ]
        },
        {
            "name": "Sides",
            "sort_order": 5,
            "items": [
                {"name": "Chips & Salsa", "price": 3.00, "description": "Fresh tortilla chips with homemade salsa"},
                {"name": "Guacamole", "price": 4.00, "description": "Fresh guacamole with chips"},
                {"name": "Rice & Beans", "price": 3.50, "description": "Mexican rice with black beans"},
                {"name": "Elote", "price": 4.50, "description": "Mexican street corn with mayo, cheese, and chilli"}
            ]
        },
        {
            "name": "Drinks",
            "sort_order": 6,
            "items": [
                {"name": "Coca Cola", "price": 2.50, "description": "Classic Coca Cola"},
                {"name": "Sprite", "price": 2.50, "description": "Refreshing Sprite"},
                {"name": "Fanta Orange", "price": 2.50, "description": "Orange Fanta"},
                {"name": "Water", "price": 1.50, "description": "Bottled water"},
                {"name": "Sparkling Water", "price": 2.00, "description": "Sparkling water"},
                {"name": "Horchata", "price": 3.50, "description": "Traditional Mexican rice drink"},
                {"name": "Agua de Jamaica", "price": 3.50, "description": "Hibiscus flower water"},
                {"name": "Mexican Beer", "price": 4.00, "description": "Corona or Modelo"}
            ]
        }
    ]
}

def setup_chucho_restaurant():
    """Update restaurant name and seed menu"""
    print("🍽️ Setting up Chucho Restaurant")
    print("=" * 50)
    
    engine = create_engine(DATABASE_URL)
    
    with engine.connect() as conn:
        trans = conn.begin()
        try:
            # Find the restaurant
            result = conn.execute(text("""
                SELECT id, name FROM restaurants 
                WHERE name LIKE '%Casa Estrella%' OR name LIKE '%Chucho%'
                LIMIT 1
            """))
            
            restaurant = result.fetchone()
            
            if not restaurant:
                print("❌ No restaurant found. Please run fix_arnaud_user.py first")
                return False
            
            restaurant_id = restaurant[0]
            current_name = restaurant[1]
            
            # Update restaurant name if needed
            if current_name != "Chucho Restaurant":
                print(f"📝 Updating restaurant name from '{current_name}' to 'Chucho Restaurant'")
                conn.execute(text("""
                    UPDATE restaurants 
                    SET name = 'Chucho Restaurant',
                        updated_at = NOW()
                    WHERE id = :restaurant_id
                """), {"restaurant_id": restaurant_id})
            
            # Clear existing menu items
            print("🧹 Clearing existing menu...")
            conn.execute(text("""
                DELETE FROM products WHERE restaurant_id = :restaurant_id
            """), {"restaurant_id": restaurant_id})
            
            conn.execute(text("""
                DELETE FROM categories WHERE restaurant_id = :restaurant_id
            """), {"restaurant_id": restaurant_id})
            
            # Seed new menu
            print("🍴 Seeding Chucho menu...")
            
            for category_data in CHUCHO_MENU["categories"]:
                # Create category
                result = conn.execute(text("""
                    INSERT INTO categories (
                        id, restaurant_id, name, sort_order,
                        is_active, created_at
                    ) VALUES (
                        gen_random_uuid(), :restaurant_id, :name, :sort_order,
                        true, NOW()
                    ) RETURNING id
                """), {
                    "restaurant_id": restaurant_id,
                    "name": category_data["name"],
                    "sort_order": category_data["sort_order"]
                })
                
                category_id = result.fetchone()[0]
                print(f"  ✅ Created category: {category_data['name']}")
                
                # Add items to category
                for idx, item in enumerate(category_data["items"]):
                    conn.execute(text("""
                        INSERT INTO products (
                            id, restaurant_id, category_id,
                            name, description, price,
                            is_active, cost,
                            created_at, updated_at
                        ) VALUES (
                            gen_random_uuid(), :restaurant_id, :category_id,
                            :name, :description, :price,
                            true, 0,
                            NOW(), NOW()
                        )
                    """), {
                        "restaurant_id": restaurant_id,
                        "category_id": category_id,
                        "name": item["name"],
                        "description": item.get("description", ""),
                        "price": Decimal(str(item["price"]))
                    })
                
                print(f"    Added {len(category_data['items'])} items")
            
            trans.commit()
            
            # Verify the setup
            print("\n🔍 Verifying setup...")
            
            # Check restaurant
            result = conn.execute(text("""
                SELECT name FROM restaurants WHERE id = :restaurant_id
            """), {"restaurant_id": restaurant_id})
            
            restaurant = result.fetchone()
            print(f"✅ Restaurant: {restaurant[0]}")
            
            # Count menu items
            result = conn.execute(text("""
                SELECT COUNT(*) FROM products WHERE restaurant_id = :restaurant_id
            """), {"restaurant_id": restaurant_id})
            
            item_count = result.scalar()
            print(f"✅ Menu items: {item_count}")
            
            # Count categories
            result = conn.execute(text("""
                SELECT COUNT(*) FROM categories WHERE restaurant_id = :restaurant_id
            """), {"restaurant_id": restaurant_id})
            
            category_count = result.scalar()
            print(f"✅ Categories: {category_count}")
            
            # Show some sample items
            print("\n📋 Sample menu items:")
            result = conn.execute(text("""
                SELECT p.name, p.price, c.name as category
                FROM products p
                JOIN categories c ON p.category_id = c.id
                WHERE p.restaurant_id = :restaurant_id
                AND c.name = 'Tacos'
                LIMIT 3
            """), {"restaurant_id": restaurant_id})
            
            for item in result:
                print(f"  - {item[0]}: £{item[1]} ({item[2]})")
            
            return True
            
        except Exception as e:
            trans.rollback()
            print(f"❌ Error: {str(e)}")
            return False

if __name__ == "__main__":
    if setup_chucho_restaurant():
        print("\n✅ Chucho Restaurant setup complete!")
        print("\n🌮 The app should now show:")
        print("- Restaurant name: Chucho Restaurant")
        print("- Authentic Mexican taco menu")
        print("- 37 items including tacos, burritos, and Mexican drinks")
        print("- All regular tacos priced at £3.50 each")
    else:
        print("\n❌ Setup failed. Check the error above.")