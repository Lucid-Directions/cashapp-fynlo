#!/usr/bin/env python3
"""
Seed Mexican Restaurant Menu Data
Seeds the Casa Estrella Mexican restaurant menu data into the production database
"""

import sys
import os
import asyncio
from sqlalchemy.orm import Session
from sqlalchemy import and_

# Add the project root to Python path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, Restaurant, Category, Product, User
from app.core.config import settings
import uuid
from decimal import Decimal

# Mexican Restaurant Menu Data (from DatabaseService.getMexicanMenuFallback)
MEXICAN_CATEGORIES = [
    {'name': 'Snacks', 'color': '#FF6B6B', 'icon': '🧀', 'sort_order': 1},
    {'name': 'Tacos', 'color': '#4ECDC4', 'icon': '🌮', 'sort_order': 2},
    {'name': 'Special Tacos', 'color': '#45B7D1', 'icon': '⭐', 'sort_order': 3},
    {'name': 'Burritos', 'color': '#96CEB4', 'icon': '🌯', 'sort_order': 4},
    {'name': 'Sides', 'color': '#FECA57', 'icon': '🍟', 'sort_order': 5},
    {'name': 'Drinks', 'color': '#FF9FF3', 'icon': '🥤', 'sort_order': 6},
]

MEXICAN_MENU_ITEMS = [
    # SNACKS
    {'name': 'Nachos', 'price': 5.00, 'category': 'Snacks', 'emoji': '🧀', 'available': True, 'description': 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'},
    {'name': 'Quesadillas', 'price': 5.50, 'category': 'Snacks', 'emoji': '🫓', 'available': True, 'description': 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'},
    {'name': 'Chorizo Quesadilla', 'price': 5.50, 'category': 'Snacks', 'emoji': '🌶️', 'available': True, 'description': 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander'},
    {'name': 'Chicken Quesadilla', 'price': 5.50, 'category': 'Snacks', 'emoji': '🐔', 'available': True, 'description': 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander'},
    {'name': 'Tostada', 'price': 6.50, 'category': 'Snacks', 'emoji': '🥙', 'available': True, 'description': 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta'},
    
    # TACOS
    {'name': 'Carnitas', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'},
    {'name': 'Cochinita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Marinated pulled pork served with pickle red onion'},
    {'name': 'Barbacoa de Res', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Juicy pulled beef topped with onion, guacamole & coriander'},
    {'name': 'Chorizo', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole'},
    {'name': 'Rellena', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Chicken Fajita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander'},
    {'name': 'Haggis', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion'},
    {'name': 'Pescado', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa'},
    {'name': 'Dorados', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta'},
    {'name': 'Dorados Papa', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta'},
    {'name': 'Nopal', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta'},
    {'name': 'Frijol', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Black beans with fried plantain served with tomato salsa, feta & coriander'},
    {'name': 'Verde', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta'},
    {'name': 'Fajita', 'price': 3.50, 'category': 'Tacos', 'emoji': '🌮', 'available': True, 'description': 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander'},
    
    # SPECIAL TACOS
    {'name': 'Carne Asada', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '⭐', 'available': True, 'description': 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander'},
    {'name': 'Camaron', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '🦐', 'available': True, 'description': 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole'},
    {'name': 'Pulpos', 'price': 4.50, 'category': 'Special Tacos', 'emoji': '🐙', 'available': True, 'description': 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander'},
    
    # BURRITOS
    {'name': 'Pulled Beef Burrito', 'price': 7.50, 'category': 'Burritos', 'emoji': '🌯', 'available': True, 'description': 'Flour tortilla filled with pulled beef, rice, black beans, peppers, onion, tomato salsa, guacamole & coriander'},
    {'name': 'Chicken Burrito', 'price': 7.50, 'category': 'Burritos', 'emoji': '🌯', 'available': True, 'description': 'Flour tortilla filled with chicken, rice, black beans, peppers, onion, tomato salsa, guacamole & coriander'},
    {'name': 'Chorizo Burrito', 'price': 7.50, 'category': 'Burritos', 'emoji': '🌯', 'available': True, 'description': 'Flour tortilla filled with chorizo, rice, black beans, peppers, onion, tomato salsa, guacamole & coriander'},
    {'name': 'Vegetarian Burrito', 'price': 7.50, 'category': 'Burritos', 'emoji': '🌯', 'available': True, 'description': 'Flour tortilla filled with mushrooms, rice, black beans, peppers, onion, tomato salsa, guacamole & coriander'},
    
    # SIDES
    {'name': 'Rice & Beans', 'price': 3.00, 'category': 'Sides', 'emoji': '🍚', 'available': True, 'description': 'Mexican rice with black beans'},
    {'name': 'Guacamole & Chips', 'price': 4.00, 'category': 'Sides', 'emoji': '🥑', 'available': True, 'description': 'Fresh guacamole with tortilla chips'},
    {'name': 'Elote', 'price': 3.50, 'category': 'Sides', 'emoji': '🌽', 'available': True, 'description': 'Mexican street corn with mayo, chili powder & cheese'},
    
    # DRINKS
    {'name': 'Agua Fresca', 'price': 2.50, 'category': 'Drinks', 'emoji': '🥤', 'available': True, 'description': 'Traditional Mexican flavored water'},
    {'name': 'Mexican Coke', 'price': 2.00, 'category': 'Drinks', 'emoji': '🥤', 'available': True, 'description': 'Coca-Cola made with cane sugar'},
    {'name': 'Horchata', 'price': 3.00, 'category': 'Drinks', 'emoji': '🥛', 'available': True, 'description': 'Traditional rice and cinnamon drink'},
]

def find_restaurant_by_email(db: Session, email: str) -> Restaurant:
    """Find restaurant by owner email"""
    user = db.query(User).filter(User.email == email).first()
    if not user:
        raise Exception(f"No user found with email: {email}")
    
    # Simple query to avoid schema mismatch issues
    from sqlalchemy import text
    result = db.execute(
        text("SELECT id, name FROM restaurants WHERE id = :restaurant_id"),
        {"restaurant_id": str(user.restaurant_id)}
    ).fetchone()
    
    if not result:
        raise Exception(f"No restaurant found for user: {email}")
    
    # Create a simple object with the needed fields
    class SimpleRestaurant:
        def __init__(self, id, name):
            self.id = id
            self.name = name
    
    return SimpleRestaurant(result[0], result[1])

def seed_categories(db: Session, restaurant_id: str) -> dict:
    """Seed menu categories and return mapping"""
    category_mapping = {}
    
    print(f"🏷️  Creating categories for restaurant {restaurant_id}...")
    
    for cat_data in MEXICAN_CATEGORIES:
        # Check if category already exists
        existing = db.query(Category).filter(
            and_(Category.restaurant_id == restaurant_id, Category.name == cat_data['name'])
        ).first()
        
        if existing:
            print(f"   ✅ Category '{cat_data['name']}' already exists")
            category_mapping[cat_data['name']] = existing.id
            continue
        
        # Create new category
        category = Category(
            restaurant_id=restaurant_id,
            name=cat_data['name'],
            description=f"{cat_data['name']} items",
            color=cat_data['color'],
            icon=cat_data['icon'],
            sort_order=cat_data['sort_order'],
            is_active=True
        )
        
        db.add(category)
        db.flush()  # Get the ID
        
        category_mapping[cat_data['name']] = category.id
        print(f"   ✅ Created category: {cat_data['name']}")
    
    return category_mapping

def seed_products(db: Session, restaurant_id: str, category_mapping: dict):
    """Seed menu products"""
    
    print(f"🍽️  Creating menu items for restaurant {restaurant_id}...")
    
    for item_data in MEXICAN_MENU_ITEMS:
        category_id = category_mapping.get(item_data['category'])
        if not category_id:
            print(f"   ⚠️  Warning: Category '{item_data['category']}' not found for item '{item_data['name']}'")
            continue
        
        # Check if product already exists
        existing = db.query(Product).filter(
            and_(Product.restaurant_id == restaurant_id, Product.name == item_data['name'])
        ).first()
        
        if existing:
            print(f"   ✅ Product '{item_data['name']}' already exists")
            continue
        
        # Create new product
        product = Product(
            restaurant_id=restaurant_id,
            category_id=category_id,
            name=item_data['name'],
            description=item_data['description'],
            price=Decimal(str(item_data['price'])),
            cost=Decimal('0.00'),  # Default cost
            image_url=None,
            barcode=None,
            sku=None,
            prep_time=5,  # Default 5 minutes
            dietary_info=[],
            modifiers=[],
            is_active=item_data['available'],
            stock_tracking=False,
            stock_quantity=None
        )
        
        db.add(product)
        print(f"   ✅ Created product: {item_data['name']} (£{item_data['price']})")

def main():
    """Main seeding function"""
    print("🚀 Starting Mexican Restaurant Menu Seeding...")
    print(f"📍 Database: {settings.DATABASE_URL[:50]}...")
    
    db = SessionLocal()
    
    try:
        # Find Casa Estrella restaurant by owner email
        restaurant = find_restaurant_by_email(db, "carlos@casaestrella.co.uk")
        restaurant_id = str(restaurant.id)
        
        print(f"🏪 Found restaurant: {restaurant.name} (ID: {restaurant_id})")
        
        # Seed categories
        category_mapping = seed_categories(db, restaurant_id)
        
        # Seed products
        seed_products(db, restaurant_id, category_mapping)
        
        # Commit all changes
        db.commit()
        
        # Summary
        total_categories = len(MEXICAN_CATEGORIES)
        total_products = len(MEXICAN_MENU_ITEMS)
        
        print(f"")
        print(f"✅ SUCCESS: Mexican restaurant menu seeded!")
        print(f"   📋 Categories: {total_categories}")
        print(f"   🍽️  Products: {total_products}")
        print(f"   🏪 Restaurant: {restaurant.name}")
        print(f"   🔗 Menu API endpoints now available:")
        print(f"      GET /api/v1/menu/categories")
        print(f"      GET /api/v1/menu/items")
        
    except Exception as e:
        print(f"❌ Error seeding menu: {e}")
        db.rollback()
        sys.exit(1)
        
    finally:
        db.close()

if __name__ == "__main__":
    main()