#!/usr/bin/env python3
"""
Fynlo POS Database Seed Migration Script

This script migrates dynamic test data from MockDataService to real database records.
It preserves the Mexican restaurant menu (REAL CLIENT DATA) while creating testable
employees, schedules, and inventory for feature validation.

Usage:
    python database_seed_migration.py --environment staging
    python database_seed_migration.py --environment production --confirm-real-data
"""

import asyncio
import sys
import argparse
from datetime import datetime, timedelta
from typing import Dict, List, Any
import asyncpg
import json
import os
from pathlib import Path

# Add parent directory to path for imports
sys.path.append(str(Path(__file__).parent))

from app.core.config import settings
from app.models.database import get_database_url

class FynloSeedMigration:
    def __init__(self, database_url: str):
        self.database_url = database_url
        self.conn = None
    
    async def connect(self):
        """Connect to PostgreSQL database"""
        try:
            self.conn = await asyncpg.connect(self.database_url)
            print(f"✅ Connected to database: {self.database_url.split('@')[1]}")
        except Exception as e:
            print(f"❌ Database connection failed: {e}")
            sys.exit(1)
    
    async def close(self):
        """Close database connection"""
        if self.conn:
            await self.conn.close()
    
    async def create_test_platform(self) -> int:
        """Create test platform owner and configuration"""
        print("\n📊 Creating test platform...")
        
        # Create platform owner user
        platform_user_id = await self.conn.fetchval("""
            INSERT INTO users (email, name, role, is_active, created_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (email) DO UPDATE SET
                name = EXCLUDED.name,
                role = EXCLUDED.role,
                updated_at = NOW()
            RETURNING id
        """, 
        'platform@fynlo.com', 
        'Fynlo Platform Admin', 
        'platform_owner', 
        True,
        datetime.utcnow()
        )
        
        # Create platform configuration
        await self.conn.execute("""
            INSERT INTO platform_config (key, value, description, created_by)
            VALUES 
                ($1, $2, $3, $4),
                ($5, $6, $7, $4),
                ($8, $9, $10, $4),
                ($11, $12, $13, $4)
            ON CONFLICT (key) DO UPDATE SET
                value = EXCLUDED.value,
                updated_at = NOW()
        """,
        'service_charge_rate', '10.0', 'Platform-wide service charge percentage', platform_user_id,
        'qr_payment_fee_percentage', '1.2', 'QR payment processing fee', platform_user_id,
        'card_payment_fee_percentage', '2.9', 'Card payment processing fee', platform_user_id,
        'platform_fee_percentage', '0.5', 'Platform commission fee', platform_user_id
        )
        
        print(f"✅ Platform owner created (ID: {platform_user_id})")
        return platform_user_id
    
    async def create_test_restaurant(self, platform_owner_id: int) -> int:
        """Create test Mexican restaurant"""
        print("\n🌮 Creating test Mexican restaurant...")
        
        # Create restaurant
        restaurant_id = await self.conn.fetchval("""
            INSERT INTO restaurants (
                name, slug, description, cuisine_type, 
                address, phone, email, website,
                platform_owner_id, is_active, created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (slug) DO UPDATE SET
                name = EXCLUDED.name,
                description = EXCLUDED.description,
                updated_at = NOW()
            RETURNING id
        """,
        'Fynlo Mexican Restaurant',
        'fynlo-mexican',
        'Authentic Mexican cuisine with traditional tacos, burritos, and specialties',
        'Mexican',
        '123 High Street, London, SW1A 1AA',
        '+44 20 7123 4567',
        'hello@fynlomexican.co.uk',
        'https://fynlomexican.co.uk',
        platform_owner_id,
        True,
        datetime.utcnow()
        )
        
        print(f"✅ Restaurant created (ID: {restaurant_id})")
        return restaurant_id
    
    async def create_test_employees(self, restaurant_id: int) -> Dict[str, int]:
        """Create test employees for feature validation"""
        print("\n👥 Creating test employees...")
        
        # Test employees from MockDataService staff_performance data
        employees = [
            {
                'email': 'sarah.johnson@fynlo.com',
                'name': 'Sarah Johnson', 
                'role': 'cashier',
                'hourly_rate': 12.50,
                'phone': '+44 7700 900001'
            },
            {
                'email': 'mike.chen@fynlo.com',
                'name': 'Mike Chen',
                'role': 'cook', 
                'hourly_rate': 15.00,
                'phone': '+44 7700 900002'
            },
            {
                'email': 'emma.davis@fynlo.com',
                'name': 'Emma Davis',
                'role': 'server',
                'hourly_rate': 11.50,
                'phone': '+44 7700 900003'
            },
            {
                'email': 'tom.wilson@fynlo.com',
                'name': 'Tom Wilson',
                'role': 'manager',
                'hourly_rate': 18.00,
                'phone': '+44 7700 900004'
            },
            {
                'email': 'anna.garcia@fynlo.com',
                'name': 'Anna Garcia',
                'role': 'cook',
                'hourly_rate': 14.50,
                'phone': '+44 7700 900005'
            },
            {
                'email': 'demo@fynlo.com',
                'name': 'Demo User',
                'role': 'cashier',
                'hourly_rate': 12.00,
                'phone': '+44 7700 900000'
            }
        ]
        
        employee_ids = {}
        
        for emp in employees:
            employee_id = await self.conn.fetchval("""
                INSERT INTO users (
                    email, name, role, restaurant_id, 
                    phone, hourly_rate, is_active, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
                ON CONFLICT (email) DO UPDATE SET
                    name = EXCLUDED.name,
                    role = EXCLUDED.role,
                    restaurant_id = EXCLUDED.restaurant_id,
                    phone = EXCLUDED.phone,
                    hourly_rate = EXCLUDED.hourly_rate,
                    updated_at = NOW()
                RETURNING id
            """,
            emp['email'], emp['name'], emp['role'], restaurant_id,
            emp['phone'], emp['hourly_rate'], True, datetime.utcnow()
            )
            
            employee_ids[emp['name']] = employee_id
        
        print(f"✅ Created {len(employees)} test employees")
        return employee_ids
    
    async def create_mexican_menu(self, restaurant_id: int) -> Dict[str, List[int]]:
        """Create REAL Mexican restaurant menu from MockDataService"""
        print("\n🍴 Creating Mexican restaurant menu (REAL CLIENT DATA)...")
        
        # Categories from MockDataService
        categories = [
            {'name': 'Snacks', 'icon': '🧀', 'sort_order': 1},
            {'name': 'Tacos', 'icon': '🌮', 'sort_order': 2},
            {'name': 'Special Tacos', 'icon': '⭐', 'sort_order': 3},
            {'name': 'Burritos', 'icon': '🌯', 'sort_order': 4},
            {'name': 'Sides', 'icon': '🍟', 'sort_order': 5},
            {'name': 'Drinks', 'icon': '🍺', 'sort_order': 6},
        ]
        
        category_ids = {}
        for cat in categories:
            cat_id = await self.conn.fetchval("""
                INSERT INTO categories (name, icon, sort_order, restaurant_id, is_active)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (restaurant_id, name) DO UPDATE SET
                    icon = EXCLUDED.icon,
                    sort_order = EXCLUDED.sort_order,
                    updated_at = NOW()
                RETURNING id
            """, cat['name'], cat['icon'], cat['sort_order'], restaurant_id, True)
            category_ids[cat['name']] = cat_id
        
        # Menu items from MockDataService (REAL DATA - DO NOT MODIFY)
        menu_items = [
            # SNACKS
            {'name': 'Nachos', 'price': 5.00, 'category': 'Snacks', 'image': '🧀', 'description': 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'},
            {'name': 'Quesadillas', 'price': 5.50, 'category': 'Snacks', 'image': '🫓', 'description': 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'},
            {'name': 'Chorizo Quesadilla', 'price': 5.50, 'category': 'Snacks', 'image': '🌶️', 'description': 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander'},
            {'name': 'Chicken Quesadilla', 'price': 5.50, 'category': 'Snacks', 'image': '🐔', 'description': 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander'},
            {'name': 'Tostada', 'price': 6.50, 'category': 'Snacks', 'image': '🥙', 'description': 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta'},
            
            # TACOS
            {'name': 'Carnitas', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'},
            {'name': 'Cochinita', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Marinated pulled pork served with pickle red onion'},
            {'name': 'Barbacoa de Res', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Juicy pulled beef topped with onion, guacamole & coriander'},
            {'name': 'Chorizo', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole'},
            {'name': 'Rellena', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion'},
            {'name': 'Chicken Fajita', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander'},
            {'name': 'Haggis', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion'},
            {'name': 'Pescado', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa'},
            {'name': 'Dorados', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta'},
            {'name': 'Dorados Papa', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta'},
            {'name': 'Nopal', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta'},
            {'name': 'Frijol', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Black beans with fried plantain served with tomato salsa, feta & coriander'},
            {'name': 'Verde', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta'},
            {'name': 'Fajita', 'price': 3.50, 'category': 'Tacos', 'image': '🌮', 'description': 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander'},
            
            # SPECIAL TACOS
            {'name': 'Carne Asada', 'price': 4.50, 'category': 'Special Tacos', 'image': '⭐', 'description': 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander'},
            {'name': 'Camaron', 'price': 4.50, 'category': 'Special Tacos', 'image': '🦐', 'description': 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole'},
            {'name': 'Pulpos', 'price': 4.50, 'category': 'Special Tacos', 'image': '🐙', 'description': 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander'},
            
            # BURRITOS
            {'name': 'Regular Burrito', 'price': 8.00, 'category': 'Burritos', 'image': '🌯', 'description': 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.'},
            {'name': 'Special Burrito', 'price': 10.00, 'category': 'Burritos', 'image': '🌯', 'description': 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.'},
            {'name': 'Add Mozzarella', 'price': 1.00, 'category': 'Burritos', 'image': '🧀', 'description': 'Add extra cheese to any burrito'},
            
            # SIDES & SALSAS
            {'name': 'Skinny Fries', 'price': 3.50, 'category': 'Sides', 'image': '🍟', 'description': 'Thin cut fries'},
            {'name': 'Pico de Gallo', 'price': 0.00, 'category': 'Sides', 'image': '🍅', 'description': 'Diced tomato, onion and chilli - FREE!'},
            {'name': 'Green Chili', 'price': 0.00, 'category': 'Sides', 'image': '🌶️', 'description': 'Homemade green chili salsa - HOT! - FREE!'},
            {'name': 'Pineapple Habanero', 'price': 0.00, 'category': 'Sides', 'image': '🍍', 'description': 'Pineapple sauce with habanero chili - HOT! - FREE!'},
            {'name': 'Scotch Bonnet', 'price': 0.00, 'category': 'Sides', 'image': '🔥', 'description': 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT! - FREE!'},
            
            # DRINKS
            {'name': 'Pink Paloma', 'price': 3.75, 'category': 'Drinks', 'image': '🍹', 'description': 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine'},
            {'name': 'Coco-Nought', 'price': 3.75, 'category': 'Drinks', 'image': '🥥', 'description': 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!'},
            {'name': 'Corona', 'price': 3.80, 'category': 'Drinks', 'image': '🍺', 'description': 'Mexican beer'},
            {'name': 'Modelo', 'price': 4.00, 'category': 'Drinks', 'image': '🍺', 'description': 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml'},
            {'name': 'Pacifico', 'price': 4.00, 'category': 'Drinks', 'image': '🍺', 'description': 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml'},
            {'name': 'Dos Equis', 'price': 4.00, 'category': 'Drinks', 'image': '🍺', 'description': '"Two X\'s". German brewing heritage with the spirit of Mexican traditions. 355ml'},
        ]
        
        item_ids = {}
        for item in menu_items:
            item_id = await self.conn.fetchval("""
                INSERT INTO products (
                    name, description, price, category_id, restaurant_id,
                    image_emoji, is_available, is_active, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (restaurant_id, name) DO UPDATE SET
                    description = EXCLUDED.description,
                    price = EXCLUDED.price,
                    category_id = EXCLUDED.category_id,
                    image_emoji = EXCLUDED.image_emoji,
                    updated_at = NOW()
                RETURNING id
            """,
            item['name'], item['description'], item['price'], 
            category_ids[item['category']], restaurant_id,
            item['image'], True, True, datetime.utcnow()
            )
            
            if item['category'] not in item_ids:
                item_ids[item['category']] = []
            item_ids[item['category']].append(item_id)
        
        print(f"✅ Created {len(menu_items)} menu items across {len(categories)} categories")
        return item_ids
    
    async def create_restaurant_floor_plan(self, restaurant_id: int):
        """Create restaurant floor plan from MockDataService"""
        print("\n🏢 Creating restaurant floor plan...")
        
        # Sections from MockDataService
        sections = [
            {'name': 'Main Floor', 'color': '#3498db'},
            {'name': 'Patio', 'color': '#27ae60'},
            {'name': 'Bar', 'color': '#e74c3c'},
        ]
        
        section_ids = {}
        for section in sections:
            section_id = await self.conn.fetchval("""
                INSERT INTO restaurant_sections (name, color, restaurant_id)
                VALUES ($1, $2, $3)
                ON CONFLICT (restaurant_id, name) DO UPDATE SET
                    color = EXCLUDED.color,
                    updated_at = NOW()
                RETURNING id
            """, section['name'], section['color'], restaurant_id)
            section_ids[section['name']] = section_id
        
        # Tables from MockDataService
        tables = [
            # Main Floor
            {'name': 'T1', 'display_name': 'Table 1', 'capacity': 4, 'section': 'Main Floor'},
            {'name': 'T2', 'display_name': 'Table 2', 'capacity': 2, 'section': 'Main Floor'},
            {'name': 'T3', 'display_name': 'Table 3', 'capacity': 6, 'section': 'Main Floor'},
            {'name': 'T4', 'display_name': 'Table 4', 'capacity': 4, 'section': 'Main Floor'},
            {'name': 'T5', 'display_name': 'Table 5', 'capacity': 4, 'section': 'Main Floor'},
            
            # Patio
            {'name': 'P1', 'display_name': 'Patio 1', 'capacity': 4, 'section': 'Patio'},
            {'name': 'P2', 'display_name': 'Patio 2', 'capacity': 4, 'section': 'Patio'},
            {'name': 'P3', 'display_name': 'Patio 3', 'capacity': 2, 'section': 'Patio'},
            
            # Bar
            {'name': 'B1', 'display_name': 'Bar 1', 'capacity': 1, 'section': 'Bar'},
            {'name': 'B2', 'display_name': 'Bar 2', 'capacity': 1, 'section': 'Bar'},
            {'name': 'B3', 'display_name': 'Bar 3', 'capacity': 1, 'section': 'Bar'},
            {'name': 'B4', 'display_name': 'Bar 4', 'capacity': 1, 'section': 'Bar'},
        ]
        
        for table in tables:
            await self.conn.execute("""
                INSERT INTO restaurant_tables (
                    name, display_name, capacity, section_id, restaurant_id, status
                )
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (restaurant_id, name) DO UPDATE SET
                    display_name = EXCLUDED.display_name,
                    capacity = EXCLUDED.capacity,
                    updated_at = NOW()
            """, 
            table['name'], table['display_name'], table['capacity'],
            section_ids[table['section']], restaurant_id, 'available'
            )
        
        print(f"✅ Created {len(tables)} tables across {len(sections)} sections")
    
    async def create_sample_schedules(self, employee_ids: Dict[str, int], restaurant_id: int):
        """Create sample schedules for testing rota system"""
        print("\n📅 Creating sample schedules...")
        
        # Create schedules for the next 7 days
        start_date = datetime.now().date()
        
        # Schedule patterns for different roles
        schedule_patterns = {
            'Sarah Johnson': [  # Cashier
                {'day': 0, 'start': '09:00', 'end': '17:00'},  # Monday
                {'day': 1, 'start': '09:00', 'end': '17:00'},  # Tuesday
                {'day': 2, 'start': '09:00', 'end': '17:00'},  # Wednesday
                {'day': 4, 'start': '09:00', 'end': '17:00'},  # Friday
                {'day': 5, 'start': '10:00', 'end': '18:00'},  # Saturday
            ],
            'Mike Chen': [  # Cook
                {'day': 0, 'start': '11:00', 'end': '22:00'},  # Monday
                {'day': 1, 'start': '11:00', 'end': '22:00'},  # Tuesday
                {'day': 2, 'start': '11:00', 'end': '22:00'},  # Wednesday
                {'day': 3, 'start': '11:00', 'end': '22:00'},  # Thursday
                {'day': 4, 'start': '11:00', 'end': '22:00'},  # Friday
            ],
            'Emma Davis': [  # Server
                {'day': 1, 'start': '17:00', 'end': '23:00'},  # Tuesday
                {'day': 2, 'start': '17:00', 'end': '23:00'},  # Wednesday
                {'day': 4, 'start': '17:00', 'end': '23:00'},  # Friday
                {'day': 5, 'start': '12:00', 'end': '23:00'},  # Saturday
                {'day': 6, 'start': '12:00', 'end': '22:00'},  # Sunday
            ],
            'Tom Wilson': [  # Manager
                {'day': 0, 'start': '08:00', 'end': '18:00'},  # Monday
                {'day': 1, 'start': '08:00', 'end': '18:00'},  # Tuesday
                {'day': 2, 'start': '08:00', 'end': '18:00'},  # Wednesday
                {'day': 3, 'start': '08:00', 'end': '18:00'},  # Thursday
                {'day': 4, 'start': '08:00', 'end': '18:00'},  # Friday
            ],
            'Anna Garcia': [  # Cook
                {'day': 3, 'start': '11:00', 'end': '22:00'},  # Thursday
                {'day': 5, 'start': '11:00', 'end': '23:00'},  # Saturday
                {'day': 6, 'start': '11:00', 'end': '22:00'},  # Sunday
            ],
        }
        
        for name, employee_id in employee_ids.items():
            if name not in schedule_patterns:
                continue
                
            for pattern in schedule_patterns[name]:
                shift_date = start_date + timedelta(days=pattern['day'])
                
                await self.conn.execute("""
                    INSERT INTO employee_schedules (
                        employee_id, restaurant_id, shift_date,
                        start_time, end_time, position, status
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7)
                    ON CONFLICT (employee_id, shift_date) DO UPDATE SET
                        start_time = EXCLUDED.start_time,
                        end_time = EXCLUDED.end_time,
                        updated_at = NOW()
                """,
                employee_id, restaurant_id, shift_date,
                pattern['start'], pattern['end'], 'floor', 'confirmed'
                )
        
        print(f"✅ Created sample schedules for {len(schedule_patterns)} employees")
    
    async def create_test_inventory(self, menu_item_ids: Dict[str, List[int]], restaurant_id: int):
        """Create test inventory items linked to menu items"""
        print("\n📦 Creating test inventory...")
        
        # Sample inventory items
        inventory_items = [
            # Proteins
            {'name': 'Pork Shoulder', 'unit': 'kg', 'current_stock': 15.5, 'min_stock': 5.0, 'max_stock': 25.0, 'cost_per_unit': 8.50},
            {'name': 'Beef Brisket', 'unit': 'kg', 'current_stock': 12.0, 'min_stock': 3.0, 'max_stock': 20.0, 'cost_per_unit': 12.00},
            {'name': 'Chicken Breast', 'unit': 'kg', 'current_stock': 18.0, 'min_stock': 5.0, 'max_stock': 30.0, 'cost_per_unit': 6.50},
            {'name': 'Chorizo', 'unit': 'kg', 'current_stock': 8.0, 'min_stock': 2.0, 'max_stock': 15.0, 'cost_per_unit': 9.50},
            {'name': 'Prawns', 'unit': 'kg', 'current_stock': 3.5, 'min_stock': 1.0, 'max_stock': 8.0, 'cost_per_unit': 18.00},
            {'name': 'Octopus', 'unit': 'kg', 'current_stock': 2.0, 'min_stock': 0.5, 'max_stock': 5.0, 'cost_per_unit': 22.00},
            
            # Vegetables
            {'name': 'White Onions', 'unit': 'kg', 'current_stock': 25.0, 'min_stock': 8.0, 'max_stock': 40.0, 'cost_per_unit': 1.20},
            {'name': 'Red Onions', 'unit': 'kg', 'current_stock': 15.0, 'min_stock': 5.0, 'max_stock': 25.0, 'cost_per_unit': 1.50},
            {'name': 'Bell Peppers', 'unit': 'kg', 'current_stock': 12.0, 'min_stock': 4.0, 'max_stock': 20.0, 'cost_per_unit': 3.00},
            {'name': 'Tomatoes', 'unit': 'kg', 'current_stock': 20.0, 'min_stock': 6.0, 'max_stock': 35.0, 'cost_per_unit': 2.50},
            {'name': 'Avocados', 'unit': 'piece', 'current_stock': 50.0, 'min_stock': 15.0, 'max_stock': 80.0, 'cost_per_unit': 0.75},
            {'name': 'Coriander', 'unit': 'bunch', 'current_stock': 25.0, 'min_stock': 8.0, 'max_stock': 40.0, 'cost_per_unit': 0.50},
            {'name': 'Limes', 'unit': 'kg', 'current_stock': 8.0, 'min_stock': 2.0, 'max_stock': 15.0, 'cost_per_unit': 4.00},
            
            # Pantry
            {'name': 'Black Beans', 'unit': 'kg', 'current_stock': 45.0, 'min_stock': 15.0, 'max_stock': 60.0, 'cost_per_unit': 2.20},
            {'name': 'Corn Tortillas', 'unit': 'pack', 'current_stock': 80.0, 'min_stock': 20.0, 'max_stock': 120.0, 'cost_per_unit': 1.80},
            {'name': 'Flour Tortillas', 'unit': 'pack', 'current_stock': 60.0, 'min_stock': 15.0, 'max_stock': 100.0, 'cost_per_unit': 2.20},
            {'name': 'Mozzarella Cheese', 'unit': 'kg', 'current_stock': 12.0, 'min_stock': 4.0, 'max_stock': 20.0, 'cost_per_unit': 7.50},
            {'name': 'Feta Cheese', 'unit': 'kg', 'current_stock': 8.0, 'min_stock': 2.0, 'max_stock': 15.0, 'cost_per_unit': 8.20},
            
            # Beverages
            {'name': 'Corona Beer', 'unit': 'bottle', 'current_stock': 120.0, 'min_stock': 30.0, 'max_stock': 200.0, 'cost_per_unit': 1.50},
            {'name': 'Modelo Beer', 'unit': 'bottle', 'current_stock': 96.0, 'min_stock': 24.0, 'max_stock': 150.0, 'cost_per_unit': 1.65},
            {'name': 'Pacifico Beer', 'unit': 'bottle', 'current_stock': 72.0, 'min_stock': 18.0, 'max_stock': 120.0, 'cost_per_unit': 1.70},
            {'name': 'Dos Equis Beer', 'unit': 'bottle', 'current_stock': 84.0, 'min_stock': 20.0, 'max_stock': 140.0, 'cost_per_unit': 1.75},
        ]
        
        for item in inventory_items:
            await self.conn.execute("""
                INSERT INTO inventory_items (
                    name, unit, current_stock, min_stock_level, max_stock_level,
                    cost_per_unit, restaurant_id, is_active, created_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                ON CONFLICT (restaurant_id, name) DO UPDATE SET
                    current_stock = EXCLUDED.current_stock,
                    cost_per_unit = EXCLUDED.cost_per_unit,
                    updated_at = NOW()
            """,
            item['name'], item['unit'], item['current_stock'], 
            item['min_stock'], item['max_stock'], item['cost_per_unit'],
            restaurant_id, True, datetime.utcnow()
            )
        
        print(f"✅ Created {len(inventory_items)} inventory items")
    
    async def create_sample_orders(self, employee_ids: Dict[str, int], menu_item_ids: Dict[str, List[int]], restaurant_id: int):
        """Create sample orders for testing reporting"""
        print("\n🧾 Creating sample orders for testing...")
        
        # Create orders from the last 7 days
        import random
        
        for day_offset in range(7):
            order_date = datetime.now() - timedelta(days=day_offset)
            
            # 3-8 orders per day
            for order_num in range(random.randint(3, 8)):
                order_time = order_date.replace(
                    hour=random.randint(11, 21),
                    minute=random.randint(0, 59)
                )
                
                # Random employee
                employee_name = random.choice(list(employee_ids.keys()))
                employee_id = employee_ids[employee_name]
                
                # Create order
                order_id = await self.conn.fetchval("""
                    INSERT INTO orders (
                        order_number, restaurant_id, employee_id, table_name,
                        order_date, status, payment_method, subtotal, tax_amount, 
                        service_charge, total_amount, created_at
                    )
                    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                    RETURNING id
                """,
                f"ORD-{int(order_time.timestamp())}", restaurant_id, employee_id,
                f"Table {random.randint(1, 12)}", order_time, 'completed',
                random.choice(['card', 'cash', 'qr_code']),
                0.0, 0.0, 0.0, 0.0, order_time  # Will calculate totals after adding items
                )
                
                # Add 1-4 items to order
                order_total = 0.0
                for _ in range(random.randint(1, 4)):
                    # Random category and item
                    category = random.choice(list(menu_item_ids.keys()))
                    item_id = random.choice(menu_item_ids[category])
                    quantity = random.randint(1, 3)
                    
                    # Get item price
                    price = await self.conn.fetchval("SELECT price FROM products WHERE id = $1", item_id)
                    item_total = price * quantity
                    order_total += item_total
                    
                    await self.conn.execute("""
                        INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
                        VALUES ($1, $2, $3, $4, $5)
                    """, order_id, item_id, quantity, price, item_total)
                
                # Update order totals
                tax_amount = order_total * 0.20  # 20% VAT
                service_charge = order_total * 0.125  # 12.5% service
                total_amount = order_total + tax_amount + service_charge
                
                await self.conn.execute("""
                    UPDATE orders SET 
                        subtotal = $1, tax_amount = $2, service_charge = $3, total_amount = $4
                    WHERE id = $5
                """, order_total, tax_amount, service_charge, total_amount, order_id)
        
        print("✅ Created sample orders for the last 7 days")
    
    async def run_migration(self):
        """Run the complete migration"""
        print("🚀 Starting Fynlo POS Database Seed Migration...")
        print("=" * 50)
        
        try:
            await self.connect()
            
            # Step 1: Create test platform
            platform_owner_id = await self.create_test_platform()
            
            # Step 2: Create test restaurant
            restaurant_id = await self.create_test_restaurant(platform_owner_id)
            
            # Step 3: Create test employees
            employee_ids = await self.create_test_employees(restaurant_id)
            
            # Step 4: Create Mexican menu (REAL CLIENT DATA)
            menu_item_ids = await self.create_mexican_menu(restaurant_id)
            
            # Step 5: Create restaurant floor plan
            await self.create_restaurant_floor_plan(restaurant_id)
            
            # Step 6: Create sample schedules
            await self.create_sample_schedules(employee_ids, restaurant_id)
            
            # Step 7: Create test inventory
            await self.create_test_inventory(menu_item_ids, restaurant_id)
            
            # Step 8: Create sample orders
            await self.create_sample_orders(employee_ids, menu_item_ids, restaurant_id)
            
            print("\n" + "=" * 50)
            print("✅ MIGRATION COMPLETED SUCCESSFULLY!")
            print(f"🏢 Platform Owner: platform@fynlo.com")
            print(f"🌮 Restaurant: Fynlo Mexican Restaurant (ID: {restaurant_id})")
            print(f"👥 Employees: {len(employee_ids)} test employees created")
            print(f"🍴 Menu: {sum(len(items) for items in menu_item_ids.values())} items across {len(menu_item_ids)} categories")
            print(f"📦 Inventory: Test inventory items created")
            print(f"📅 Schedules: Sample schedules for testing")
            print(f"🧾 Orders: Sample orders for reporting")
            print("\n🎯 Next Steps:")
            print("1. Update frontend to use real database APIs")
            print("2. Remove static mock data displays")
            print("3. Enable SumUp payment integration")
            print("4. Test all features with real data")
            
        except Exception as e:
            print(f"\n❌ Migration failed: {e}")
            raise
        finally:
            await self.close()

def main():
    parser = argparse.ArgumentParser(description='Fynlo POS Database Seed Migration')
    parser.add_argument('--environment', choices=['staging', 'production'], default='staging',
                       help='Target environment')
    parser.add_argument('--confirm-real-data', action='store_true',
                       help='Confirm you understand this migrates real client data')
    parser.add_argument('--database-url', 
                       help='Database URL (overrides config)')
    
    args = parser.parse_args()
    
    if args.environment == 'production' and not args.confirm_real_data:
        print("❌ Production migration requires --confirm-real-data flag")
        print("   This migration includes REAL client data (Mexican restaurant menu)")
        sys.exit(1)
    
    # Get database URL
    database_url = args.database_url or get_database_url()
    
    if not database_url:
        print("❌ No database URL configured. Check your .env file or use --database-url")
        sys.exit(1)
    
    print(f"🎯 Target Environment: {args.environment}")
    print(f"🗄️  Database: {database_url.split('@')[1] if '@' in database_url else database_url}")
    
    if args.environment == 'production':
        print("\n⚠️  WARNING: This will migrate REAL CLIENT DATA to production!")
        print("   Mexican restaurant menu and pricing will be preserved.")
        response = input("Continue? (yes/no): ")
        if response.lower() != 'yes':
            print("Migration cancelled.")
            sys.exit(0)
    
    # Run migration
    migration = FynloSeedMigration(database_url)
    asyncio.run(migration.run_migration())

if __name__ == "__main__":
    main()