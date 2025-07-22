-- Complete Chucho Mexican Restaurant Menu Seed Script
-- This script directly inserts the full menu into the database

-- First, get the restaurant ID for Chucho (or create it if it doesn't exist)
DO $$
DECLARE
    v_restaurant_id UUID;
    v_snacks_id UUID;
    v_tacos_id UUID;
    v_special_tacos_id UUID;
    v_burritos_id UUID;
    v_sides_id UUID;
    v_drinks_id UUID;
BEGIN
    -- Find or create Chucho restaurant
    SELECT id INTO v_restaurant_id 
    FROM restaurants 
    WHERE name ILIKE '%Chucho%' 
    LIMIT 1;
    
    IF v_restaurant_id IS NULL THEN
        -- Create Chucho restaurant if it doesn't exist
        INSERT INTO restaurants (
            id, name, address, phone, email, timezone,
            business_hours, settings, tax_configuration, payment_methods,
            subscription_plan, subscription_status, is_active,
            created_at, updated_at
        ) VALUES (
            gen_random_uuid(),
            'Chucho Mexican Restaurant',
            '{"street": "123 High Street", "city": "London", "postcode": "W1 1AA", "country": "UK"}'::jsonb,
            '+44 20 1234 5678',
            'info@chucho.co.uk',
            'Europe/London',
            '{"monday": {"open": "12:00", "close": "22:00"}, "tuesday": {"open": "12:00", "close": "22:00"}, "wednesday": {"open": "12:00", "close": "22:00"}, "thursday": {"open": "12:00", "close": "22:00"}, "friday": {"open": "12:00", "close": "23:00"}, "saturday": {"open": "12:00", "close": "23:00"}, "sunday": {"open": "12:00", "close": "21:00"}}'::jsonb,
            '{"currency": "GBP", "language": "en"}'::jsonb,
            '{"vat_rate": 20.0, "service_charge_rate": 10.0, "tax_inclusive": true}'::jsonb,
            '{"cash": true, "card": true, "qr_code": true}'::jsonb,
            'omega',
            'active',
            true,
            NOW(),
            NOW()
        ) RETURNING id INTO v_restaurant_id;
        
        RAISE NOTICE 'Created new Chucho restaurant with ID: %', v_restaurant_id;
    ELSE
        RAISE NOTICE 'Found existing Chucho restaurant with ID: %', v_restaurant_id;
    END IF;
    
    -- Clear existing menu items for this restaurant
    DELETE FROM products WHERE restaurant_id = v_restaurant_id;
    DELETE FROM categories WHERE restaurant_id = v_restaurant_id;
    
    -- Create categories
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
    VALUES 
        (gen_random_uuid(), v_restaurant_id, 'Snacks', 'Delicious Mexican snacks and starters', 1, true, NOW())
        RETURNING id INTO v_snacks_id;
        
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
    VALUES 
        (gen_random_uuid(), v_restaurant_id, 'Tacos', 'Traditional Mexican tacos - 3 for £9 or £3.50 each', 2, true, NOW())
        RETURNING id INTO v_tacos_id;
        
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
    VALUES 
        (gen_random_uuid(), v_restaurant_id, 'Special Tacos', 'Premium tacos with special ingredients', 3, true, NOW())
        RETURNING id INTO v_special_tacos_id;
        
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
    VALUES 
        (gen_random_uuid(), v_restaurant_id, 'Burritos', 'Large flour tortillas filled with your choice', 4, true, NOW())
        RETURNING id INTO v_burritos_id;
        
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
    VALUES 
        (gen_random_uuid(), v_restaurant_id, 'Sides & Salsas', 'Accompaniments and homemade salsas', 5, true, NOW())
        RETURNING id INTO v_sides_id;
        
    INSERT INTO categories (id, restaurant_id, name, description, sort_order, is_active, created_at)
    VALUES 
        (gen_random_uuid(), v_restaurant_id, 'Drinks', 'Refreshing beverages and Mexican beers', 6, true, NOW())
        RETURNING id INTO v_drinks_id;
    
    -- Insert SNACKS
    INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_active, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_restaurant_id, v_snacks_id, 'Nachos', 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander', 5.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_snacks_id, 'Quesadillas', 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander', 5.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_snacks_id, 'Chorizo Quesadilla', 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander', 5.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_snacks_id, 'Chicken Quesadilla', 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander', 5.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_snacks_id, 'Tostada', 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta', 6.50, true, NOW(), NOW());
    
    -- Insert TACOS (Regular)
    INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_active, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Carnitas', 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Cochinita', 'Marinated pulled pork served with pickle red onion', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Barbacoa de Res', 'Juicy pulled beef topped with onion, guacamole & coriander', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Chorizo', 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Rellena', 'Fried black pudding with beans, onion & chilli. Topped with coriander and pickled red onion', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Chicken Fajita', 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Haggis', 'Haggis with beans, onion & chilli. Topped with coriander and pickled red onion', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Pescado', 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Dorados', 'Crispy rolled tortillas filled with chicken, topped with salsa, lettuce and feta', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Dorados Papa', 'Crispy rolled tortillas filled with potato, topped with salsa, lettuce and feta', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Nopal', 'Cactus, black beans & onion, topped with tomato salsa and crumbled feta', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Frijol', 'Black beans with fried plantain served with tomato salsa, feta & coriander', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Verde', 'Courgette & sweetcorn fried with garlic, served with tomato salsa and crumbled feta', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_tacos_id, 'Fajita', 'Mushrooms, peppers & onion with black beans. Topped with salsa, feta & coriander', 3.50, true, NOW(), NOW());
    
    -- Insert SPECIAL TACOS
    INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_active, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_restaurant_id, v_special_tacos_id, 'Carne Asada', 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander', 4.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_special_tacos_id, 'Camaron', 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole', 4.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_special_tacos_id, 'Pulpos', 'Chargrilled octopus, cooked with peppers and red onion. Served on grilled potato with garlic & coriander', 4.50, true, NOW(), NOW());
    
    -- Insert BURRITOS
    INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_active, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_restaurant_id, v_burritos_id, 'Regular Burrito', 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.', 8.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_burritos_id, 'Special Burrito', 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.', 10.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_burritos_id, 'Add mozzarella', 'Add extra cheese to any burrito', 1.00, true, NOW(), NOW());
    
    -- Insert SIDES & SALSAS
    INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_active, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_restaurant_id, v_sides_id, 'Skinny Fries', 'Thin cut fries', 3.50, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_sides_id, 'Pico de gallo', 'Diced tomato, onion and chilli', 0.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_sides_id, 'Green Chili', 'Homemade green chili salsa - HOT!', 0.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_sides_id, 'Pineapple Habanero', 'Pineapple sauce with habanero chili - HOT!', 0.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_sides_id, 'Scotch Bonnet', 'Homemade spicy salsa made with scotch bonnet chilies - VERY HOT!', 0.00, true, NOW(), NOW());
    
    -- Insert DRINKS
    INSERT INTO products (id, restaurant_id, category_id, name, description, price, is_active, created_at, updated_at)
    VALUES
        (gen_random_uuid(), v_restaurant_id, v_drinks_id, 'Pink Paloma', 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine', 3.75, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_drinks_id, 'Coco-Nought', 'Coconut, pineapple juice and milk, blended into a creamy, sweet, alcohol-free treat!', 3.75, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_drinks_id, 'Corona', 'Mexican beer', 3.80, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_drinks_id, 'Modelo', 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml', 4.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_drinks_id, 'Pacifico', 'Pilsner style Lager from the Pacific Ocean city of Mazatlán. 355ml', 4.00, true, NOW(), NOW()),
        (gen_random_uuid(), v_restaurant_id, v_drinks_id, 'Dos Equis', '"Two X\'s". German brewing heritage with the spirit of Mexican traditions. 355ml', 4.00, true, NOW(), NOW());
    
    -- Output summary
    RAISE NOTICE 'Successfully seeded Chucho menu with:';
    RAISE NOTICE '- 5 Snacks';
    RAISE NOTICE '- 14 Regular Tacos';
    RAISE NOTICE '- 3 Special Tacos';
    RAISE NOTICE '- 3 Burrito options';
    RAISE NOTICE '- 5 Sides & Salsas';
    RAISE NOTICE '- 6 Drinks';
    RAISE NOTICE 'Total: 36 menu items';
    
END $$;