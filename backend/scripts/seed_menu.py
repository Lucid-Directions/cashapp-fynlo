#!/usr/bin/env python3
"""
Seed Menu Script
Seeds menu data (categories and products) for a restaurant
"""TODO: Add docstring."""

import os
import sys
from pathlib import Path

# Add parent directory to path
sys.path.append(str(Path(__file__).parent.parent))

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from decimal import Decimal
import uuid
from app.core.config import settings

# Create engine and session
engine = create_engine(settings.DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Chucho Restaurant Menu Data
CHUCHO_CATEGORIES = [
    {'name': 'Snacks', 'color': '#FF6B6B', 'icon': '🍲', 'sort_order': 1},
    {'name': 'Tacos', 'color': '#4ECDC4', 'icon': '🌮', 'sort_order': 2},
    {'name': 'Special Tacos', 'color': '#45B7D1', 'icon': '⭐', 'sort_order': 3},
    {'name': 'Burritos', 'color': '#96CEB4', 'icon': '🌯', 'sort_order': 4},
    {'name': 'Sides', 'color': '#FECA57', 'icon': '🍟', 'sort_order': 5},
    {'name': 'Drinks', 'color': '#FF9FF3', 'icon': '🍹', 'sort_order': 6},
]

CHUCHO_MENU_ITEMS = [
    # NOTE: The 'emoji' field in each item is provided for future use when the products table
    # is updated to include an emoji column. Currently, the products table does not have an
    # emoji column, so this data is defined but not inserted into the database.
    
    # SNACKS
    {'name': 'Nachos', 'price': 5.00, 'category': 'Snacks', 'emoji': '🍲', 'description': 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'},
    {'name': 'Quesadillas', 'price': 5.50, 'category': 'Snacks', 'emoji': '🧀', 'description': 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'},
    {'name': 'Chorizo Quesadilla', 'price': 5.50, 'category': 'Snacks', 'emoji': '🧀', 'description': 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander'},
    {'name': 'Chicken Quesadilla', 'price': 5.50, 'category': 'Snacks', 'emoji': '🧀', 'description': 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander'},
    {'name': 'Tostada', 'price': 6.50, 'category': 'Snacks', 'emoji': '🍲', 'description': 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta'},
    
    # TACOS (All £3.50 each or 3 for £9)
    {'name': 'Carnitas', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'},
    {'name': 'Cochinita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Marinated pulled pork served with pickle red onion'},
    {'name': 'Barbacoa de Res', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Juicy pulled beef topped with onion, guacamole & coriander'},
    {'name': 'Chorizo', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole'},
    {'name': 'Rellena', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Chicken Fajita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander'},
    {'name': 'Haggis', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Pescado', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa'},
    {'name': 'Dorados', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta'},
    {'name': 'Dorados Papa', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta'},
    {'name': 'Nopal', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta'},
    {'name': 'Papa', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Potato with beans, peppers & onion. Topped with salsa, feta & coriander'},
    {'name': 'Setas', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'description': 'Oyster mushrooms with beans, peppers & onion. Topped with salsa, feta & coriander'},
    
    # SPECIAL TACOS
    {'name': 'Especial Carnitas', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '⭐', 'description': 'Premium slow cooked pork with special toppings'},
    {'name': 'Especial Barbacoa', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '⭐', 'description': 'Premium pulled beef with gourmet toppings'},
    {'name': 'Especial Pollo', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '⭐', 'description': 'Premium grilled chicken with special sauce'},
    
    # BURRITOS
    {'name': 'Burrito Carnitas', 'price': 9.00, 'category': 'Burritos', 'emoji': '🌯', 'description': 'Large flour tortilla with slow cooked pork, rice, beans, salsa'},
    {'name': 'Burrito Pollo', 'price': 8.50, 'category': 'Burritos', 'emoji': '🌯', 'description': 'Large flour tortilla with grilled chicken, rice, beans, salsa'},
    {'name': 'Burrito Vegetariano', 'price': 7.50, 'category': 'Burritos', 'emoji': '🌯', 'description': 'Large flour tortilla with grilled vegetables, rice, beans, salsa'},
    {'name': 'Burrito Barbacoa', 'price': 9.50, 'category': 'Burritos', 'emoji': '🌯', 'description': 'Large flour tortilla with pulled beef, rice, beans, salsa'},
    
    # SIDES
    {'name': 'Chips & Salsa', 'price': 3.00, 'category': 'Sides', 'emoji': '🍟', 'description': 'Fresh tortilla chips with homemade salsa'},
    {'name': 'Guacamole', 'price': 4.00, 'category': 'Sides', 'emoji': '🥑', 'description': 'Fresh guacamole with chips'},
    {'name': 'Rice & Beans', 'price': 3.50, 'category': 'Sides', 'emoji': '🍚', 'description': 'Mexican rice with black beans'},
    {'name': 'Elote', 'price': 4.50, 'category': 'Sides', 'emoji': '🌽', 'description': 'Mexican street corn with mayo, cheese, and chilli'},
    
    # DRINKS
    {'name': 'Coca Cola', 'price': 2.50, 'category': 'Drinks', 'emoji': '🥤', 'description': 'Classic Coca Cola'},
    {'name': 'Sprite', 'price': 2.50, 'category': 'Drinks', 'emoji': '🥤', 'description': 'Refreshing Sprite'},
    {'name': 'Fanta Orange', 'price': 2.50, 'category': 'Drinks', 'emoji': '🥤', 'description': 'Orange Fanta'},
    {'name': 'Water', 'price': 1.50, 'category': 'Drinks', 'emoji': '💧', 'description': 'Bottled water'},
    {'name': 'Sparkling Water', 'price': 2.00, 'category': 'Drinks', 'emoji': '💧', 'description': 'Sparkling water'},
    {'name': 'Horchata', 'price': 3.50, 'category': 'Drinks', 'emoji': '🥛', 'description': 'Traditional Mexican rice drink'},
    {'name': 'Agua de Jamaica', 'price': 3.50, 'category': 'Drinks', 'emoji': '🍹', 'description': 'Hibiscus flower water'},
    {'name': 'Mexican Beer', 'price': 4.00, 'category': 'Drinks', 'emoji': '🍺', 'description': 'Corona or Modelo'},
]


def seed_menu(restaurant_name: str = "Chucho Restaurant"):
    """Seed menu data for a restaurant"""
    db = SessionLocal()
    
    try:
        # Find restaurant
        result = db.execute(
            text("SELECT id FROM restaurants WHERE name = :name LIMIT 1"),
            {"name": restaurant_name}
        )
        restaurant = result.fetchone()
        
        if not restaurant:
            print(f"❌ {restaurant_name} not found. Please create the restaurant first.")
            return
        
        restaurant_id = restaurant[0]
        print(f"✅ Found {restaurant_name}: {restaurant_id}")
        
        # Create categories
        category_map = {}
        for cat_data in CHUCHO_CATEGORIES:
            # Check if category exists
            result = db.execute(
                text("SELECT id FROM categories WHERE name = :name AND restaurant_id = :restaurant_id"),
                {'name': cat_data['name'], 'restaurant_id': restaurant_id}
            )
            existing_cat = result.fetchone()
            
            if existing_cat:
                category_map[cat_data['name']] = existing_cat[0]
                print(f"✓ Category '{cat_data['name']}' already exists")
            else:
                # Create new category
                cat_id = str(uuid.uuid4())
                db.execute(
                    text("""
                        INSERT INTO categories (id, name, color, icon, sort_order, is_active, restaurant_id, created_at)
                        VALUES (:id, :name, :color, :icon, :sort_order, true, :restaurant_id, NOW())
                    """),
                    {
                        'id': cat_id,
                        'name': cat_data['name'],
                        'color': cat_data['color'],
                        'icon': cat_data['icon'],
                        'sort_order': cat_data['sort_order'],
                        'restaurant_id': restaurant_id
                    }
                )
                category_map[cat_data['name']] = cat_id
                print(f"✅ Created category: {cat_data['name']}")
        
        # Create products
        created_count = 0
        skipped_count = 0
        
        for item in CHUCHO_MENU_ITEMS:
            # Check if product exists
            result = db.execute(
                text("SELECT id FROM products WHERE name = :name AND restaurant_id = :restaurant_id"),
                {'name': item['name'], 'restaurant_id': restaurant_id}
            )
            existing_product = result.fetchone()
            
            if existing_product:
                print(f"✓ Product '{item['name']}' already exists")
                skipped_count += 1
            else:
                # Create new product
                product_id = str(uuid.uuid4())
                category_id = category_map.get(item['category'])
                
                if not category_id:
                    print(f"⚠️  Category '{item['category']}' not found for product '{item['name']}'")
                    skipped_count += 1  # Count skipped products due to missing category
                    continue
                
                db.execute(
                    text("""
                        INSERT INTO products (
                            id, name, description, price, category_id, restaurant_id, 
                            is_active, created_at, updated_at
                        )
                        VALUES (
                            :id, :name, :description, :price, :category_id, :restaurant_id,
                            true, NOW(), NOW()
                        )
                    """),
                    {
                        'id': product_id,
                        'name': item['name'],
                        'description': item['description'],
                        'price': Decimal(str(item['price'])),
                        'category_id': category_id,
                        'restaurant_id': restaurant_id
                    }
                )
                print(f"✅ Created product: {item['name']} (£{item['price']})")
                created_count += 1
        
        # Commit the transaction
        db.commit()
        
        print(f"\n🎉 Successfully seeded menu for {restaurant_name}!")
        print(f"   Created: {created_count} products")
        print(f"   Skipped: {skipped_count} products (existing or missing category)")
        print(f"   Total processed: {len(CHUCHO_MENU_ITEMS)}")
        
    except Exception as e:
        db.rollback()
        print(f"\n❌ Error seeding menu: {str(e)}")
        raise
    finally:
        db.close()


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Seed menu data for a restaurant")
    parser.add_argument("--restaurant", default="Chucho Restaurant", help="Restaurant name")
    
    args = parser.parse_args()
    
    seed_menu(args.restaurant)