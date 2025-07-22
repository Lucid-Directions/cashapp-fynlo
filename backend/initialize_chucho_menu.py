#!/usr/bin/env python3
"""
Initialize Chucho Restaurant Menu through the API
This script creates the menu exactly as a restaurant owner would through the app
"""

import asyncio
import aiohttp
import sys
import os
from datetime import datetime

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
    
    # TACOS
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
    
    # SPECIAL TACOS
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

async def get_auth_token():
    """Get auth token for restaurant owner"""
    # In production, this would be the actual restaurant owner's credentials
    # For now, we'll use environment variables or test credentials
    email = os.getenv('RESTAURANT_OWNER_EMAIL', 'arnaud@luciddirections.co.uk')
    password = os.getenv('RESTAURANT_OWNER_PASSWORD', 'your_password_here')
    
    print(f"🔐 Getting auth token for {email}...")
    
    # This would normally authenticate through the API
    # For now, return a placeholder
    return os.getenv('AUTH_TOKEN', 'test_token')

async def clear_existing_menu(session, base_url, headers):
    """Clear existing menu items and categories"""
    print("\n🧹 Clearing existing menu...")
    
    try:
        # Get existing categories
        async with session.get(f"{base_url}/api/v1/categories", headers=headers) as resp:
            if resp.status == 200:
                data = await resp.json()
                categories = data.get('data', [])
                
                # Delete each category (which should cascade delete products)
                for category in categories:
                    async with session.delete(
                        f"{base_url}/api/v1/categories/{category['id']}", 
                        headers=headers
                    ) as del_resp:
                        if del_resp.status in [200, 204]:
                            print(f"   ✅ Deleted category: {category['name']}")
                        else:
                            print(f"   ⚠️  Failed to delete category: {category['name']}")
    except Exception as e:
        print(f"   ⚠️  Error clearing menu: {e}")

async def create_categories(session, base_url, headers):
    """Create menu categories"""
    print("\n📂 Creating categories...")
    category_map = {}
    
    for cat_data in CHUCHO_CATEGORIES:
        payload = {
            "name": cat_data['name'],
            "description": f"{cat_data['name']} items",
            "color": cat_data['color'],
            "icon": cat_data['icon'],
            "sort_order": cat_data['sort_order'],
            "is_active": True
        }
        
        try:
            async with session.post(
                f"{base_url}/api/v1/categories",
                headers=headers,
                json=payload
            ) as resp:
                if resp.status in [200, 201]:
                    data = await resp.json()
                    category_id = data['data']['id']
                    category_map[cat_data['name']] = category_id
                    print(f"   ✅ Created category: {cat_data['name']}")
                else:
                    error_text = await resp.text()
                    print(f"   ❌ Failed to create category {cat_data['name']}: {error_text}")
        except Exception as e:
            print(f"   ❌ Error creating category {cat_data['name']}: {e}")
    
    return category_map

async def create_products(session, base_url, headers, category_map):
    """Create menu products"""
    print(f"\n🍽️  Creating {len(CHUCHO_MENU_ITEMS)} menu items...")
    success_count = 0
    
    for item_data in CHUCHO_MENU_ITEMS:
        category_id = category_map.get(item_data['category'])
        if not category_id:
            print(f"   ⚠️  Skipping {item_data['name']} - category not found")
            continue
        
        payload = {
            "category_id": category_id,
            "name": item_data['name'],
            "description": item_data['description'],
            "price": item_data['price'],
            "is_active": True,
            "dietary_info": [],  # Could add allergen info here
            "modifiers": []
        }
        
        try:
            async with session.post(
                f"{base_url}/api/v1/products",
                headers=headers,
                json=payload
            ) as resp:
                if resp.status in [200, 201]:
                    success_count += 1
                    if success_count % 5 == 0:  # Progress indicator
                        print(f"   ✅ Created {success_count} items...")
                else:
                    error_text = await resp.text()
                    print(f"   ❌ Failed to create {item_data['name']}: {error_text}")
        except Exception as e:
            print(f"   ❌ Error creating {item_data['name']}: {e}")
    
    print(f"   ✅ Successfully created {success_count} menu items")
    return success_count

async def main():
    """Main function to initialize menu"""
    # Configuration
    base_url = os.getenv('API_BASE_URL', 'https://api.fynlo.co.uk')
    
    print("🌮 Chucho Restaurant Menu Initialization")
    print("=" * 50)
    print(f"API URL: {base_url}")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 50)
    
    # Get auth token
    token = await get_auth_token()
    if not token:
        print("❌ Failed to get auth token")
        return False
    
    headers = {
        'Authorization': f'Bearer {token}',
        'Content-Type': 'application/json'
    }
    
    # Create HTTP session
    async with aiohttp.ClientSession() as session:
        try:
            # Clear existing menu
            await clear_existing_menu(session, base_url, headers)
            
            # Create categories
            category_map = await create_categories(session, base_url, headers)
            if not category_map:
                print("❌ Failed to create categories")
                return False
            
            # Create products
            product_count = await create_products(session, base_url, headers, category_map)
            
            print("\n" + "=" * 50)
            print("✅ MENU INITIALIZATION COMPLETE!")
            print(f"   📂 Categories created: {len(category_map)}")
            print(f"   🍽️  Menu items created: {product_count}")
            print("=" * 50)
            
            return True
            
        except Exception as e:
            print(f"\n❌ ERROR: {str(e)}")
            return False

if __name__ == "__main__":
    success = asyncio.run(main())
    sys.exit(0 if success else 1)