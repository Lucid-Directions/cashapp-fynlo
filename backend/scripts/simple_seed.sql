-- Simple SQL seeding script for Fynlo POS
-- Creates restaurant, employees, products, customers, and 90 days of order history

-- First create the platform
INSERT INTO platforms (id, name, owner_email, subscription_tier, created_at, updated_at)
VALUES (gen_random_uuid(), 'Fynlo POS Platform', 'admin@fynlo.com', 'enterprise', NOW(), NOW())
ON CONFLICT (owner_email) DO NOTHING;

-- Get or create restaurant
DO $$
DECLARE
    platform_uuid UUID;
    restaurant_uuid UUID;
    owner_user_uuid UUID;
    employee_user_uuids UUID[];
    category_uuids UUID[];
    product_uuids UUID[];
    customer_uuids UUID[];
    i INTEGER;
    j INTEGER;
    order_date DATE;
    orders_per_day INTEGER;
    order_uuid UUID;
    payment_uuid UUID;
    order_total DECIMAL;
    payment_method TEXT;
    fee_rate DECIMAL;
BEGIN
    -- Get platform ID
    SELECT id INTO platform_uuid FROM platforms LIMIT 1;
    
    -- Create restaurant
    INSERT INTO restaurants (id, platform_id, name, address, phone, email, timezone, business_hours, settings, tax_configuration, payment_methods, is_active, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        platform_uuid,
        'Casa Estrella Mexican Cuisine',
        '{"street": "123 Camden High Street", "city": "London", "postcode": "NW1 7JR", "country": "UK"}'::jsonb,
        '+44 20 7123 4567',
        'info@casaestrella.co.uk',
        'Europe/London',
        '{"monday": {"open": "11:00", "close": "23:00"}, "tuesday": {"open": "11:00", "close": "23:00"}, "wednesday": {"open": "11:00", "close": "23:00"}, "thursday": {"open": "11:00", "close": "23:00"}, "friday": {"open": "11:00", "close": "24:00"}, "saturday": {"open": "11:00", "close": "24:00"}, "sunday": {"open": "12:00", "close": "22:00"}}'::jsonb,
        '{"currency": "GBP", "language": "en", "receipt_footer": "¡Gracias por visitarnos!"}'::jsonb,
        '{"vat_rate": 20.0, "service_charge_rate": 10.0, "tax_inclusive": false}'::jsonb,
        '{"cash": true, "card": true, "qr_code": true, "mobile_payment": true}'::jsonb,
        true,
        NOW(),
        NOW()
    )
    RETURNING id INTO restaurant_uuid;
    
    RAISE NOTICE 'Created restaurant: %', restaurant_uuid;
    
    -- Create owner user
    INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
    VALUES (
        gen_random_uuid(),
        'carlos@casaestrella.co.uk',
        '$2b$12$example.hash.for.password123',
        'Carlos',
        'Hernández',
        'restaurant_owner',
        true,
        NOW(),
        NOW()
    )
    RETURNING id INTO owner_user_uuid;
    
    -- Create employee users and profiles
    FOR i IN 1..8 LOOP
        DECLARE
            emp_user_uuid UUID;
            emp_name TEXT[];
            emp_role TEXT;
        BEGIN
            emp_user_uuid := gen_random_uuid();
            
            CASE i
                WHEN 1 THEN emp_name := ARRAY['María', 'González']; emp_role := 'manager';
                WHEN 2 THEN emp_name := ARRAY['Luis', 'Morales']; emp_role := 'head_chef';
                WHEN 3 THEN emp_name := ARRAY['Sofia', 'Ramírez']; emp_role := 'server';
                WHEN 4 THEN emp_name := ARRAY['Diego', 'Castillo']; emp_role := 'server';
                WHEN 5 THEN emp_name := ARRAY['Isabella', 'Torres']; emp_role := 'server';
                WHEN 6 THEN emp_name := ARRAY['Miguel', 'Vargas']; emp_role := 'cashier';
                WHEN 7 THEN emp_name := ARRAY['Carmen', 'Jiménez']; emp_role := 'bartender';
                WHEN 8 THEN emp_name := ARRAY['José', 'Mendoza']; emp_role := 'line_cook';
            END CASE;
            
            -- Create user
            INSERT INTO users (id, email, password_hash, first_name, last_name, role, is_active, created_at, updated_at)
            VALUES (
                emp_user_uuid,
                LOWER(emp_name[1]) || '.' || LOWER(emp_name[2]) || '@casaestrella.co.uk',
                '$2b$12$example.hash.for.password123',
                emp_name[1],
                emp_name[2],
                'employee',
                true,
                NOW(),
                NOW()
            );
            
            -- Create employee profile
            INSERT INTO employee_profiles (id, user_id, restaurant_id, employee_id, phone, hire_date, hourly_rate, is_active, created_at, updated_at)
            VALUES (
                gen_random_uuid(),
                emp_user_uuid,
                restaurant_uuid,
                'EMP' || LPAD(i::TEXT, 3, '0'),
                '+44 791' || (1000000 + i * 111111)::TEXT,
                NOW() - INTERVAL '30 days' * random(),
                12.50 + (random() * 8),
                true,
                NOW(),
                NOW()
            );
            
            employee_user_uuids := array_append(employee_user_uuids, emp_user_uuid);
        END;
    END LOOP;
    
    RAISE NOTICE 'Created % employees', array_length(employee_user_uuids, 1);
    
    -- Create categories
    WITH inserted_categories AS (
        INSERT INTO categories (id, restaurant_id, name, description, color, sort_order, is_active, created_at)
        VALUES 
            (gen_random_uuid(), restaurant_uuid, 'Tacos', 'Authentic tacos with fresh tortillas', '#E53E3E', 1, true, NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Burritos', 'Hearty burritos with various fillings', '#38A169', 2, true, NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Quesadillas', 'Grilled tortillas with cheese and fillings', '#D69E2E', 3, true, NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Enchiladas', 'Rolled tortillas with sauce', '#9F7AEA', 4, true, NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Bebidas', 'Traditional drinks and beverages', '#0BC5EA', 5, true, NOW())
        RETURNING id
    )
    SELECT array_agg(id) INTO category_uuids FROM inserted_categories;
    
    -- Create products
    WITH inserted_products AS (
        INSERT INTO products (id, restaurant_id, category_id, name, description, price, cost, is_active, created_at, updated_at)
        SELECT 
            gen_random_uuid(),
            restaurant_uuid,
            category_uuids[1 + (random() * (array_length(category_uuids, 1) - 1))::INTEGER],
            product_data.name,
            product_data.description,
            product_data.price,
            product_data.price * 0.4, -- 40% cost ratio
            true,
            NOW(),
            NOW()
        FROM (VALUES
            ('Chicken Tinga Tacos', 'Slow-cooked chicken with chipotle sauce', 8.50),
            ('Beef Barbacoa Tacos', 'Tender beef barbacoa with onions and cilantro', 9.50),
            ('Fish Tacos', 'Grilled fish with cabbage slaw and lime crema', 10.50),
            ('Chicken Burrito', 'Large flour tortilla with chicken, rice, beans', 12.50),
            ('Beef Burrito', 'Seasoned ground beef with cheese and vegetables', 13.50),
            ('Veggie Burrito', 'Black beans, rice, peppers, and avocado', 11.50),
            ('Cheese Quesadilla', 'Melted cheese in crispy tortilla', 8.00),
            ('Chicken Quesadilla', 'Grilled chicken and cheese quesadilla', 10.50),
            ('Beef Enchiladas', 'Three enchiladas with red sauce and cheese', 14.50),
            ('Chicken Enchiladas', 'Three chicken enchiladas with green sauce', 13.50),
            ('Guacamole & Chips', 'Fresh guacamole with tortilla chips', 6.50),
            ('Nachos Supreme', 'Loaded nachos with meat, cheese, jalapeños', 11.50),
            ('Horchata', 'Traditional rice and cinnamon drink', 4.50),
            ('Agua Fresca', 'Fresh fruit water (Jamaica or Tamarindo)', 3.50),
            ('Mexican Coca-Cola', 'Glass bottle Coca-Cola with cane sugar', 3.00)
        ) AS product_data(name, description, price)
        RETURNING id
    )
    SELECT array_agg(id) INTO product_uuids FROM inserted_products;
    
    RAISE NOTICE 'Created % products', array_length(product_uuids, 1);
    
    -- Create customers
    WITH inserted_customers AS (
        INSERT INTO customers (id, restaurant_id, first_name, last_name, email, phone, visit_count, total_spent, created_at, updated_at)
        VALUES 
            (gen_random_uuid(), restaurant_uuid, 'James', 'Thompson', 'james.t@email.com', '+44 7911 123456', 0, 0, NOW() - INTERVAL '180 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Sarah', 'Wilson', 'sarah.wilson@email.com', '+44 7911 234567', 0, 0, NOW() - INTERVAL '150 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Michael', 'Brown', 'm.brown@email.com', '+44 7911 345678', 0, 0, NOW() - INTERVAL '120 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Emma', 'Davis', 'emma.davis@email.com', '+44 7911 456789', 0, 0, NOW() - INTERVAL '90 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'David', 'Miller', 'd.miller@email.com', '+44 7911 567890', 0, 0, NOW() - INTERVAL '75 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Lisa', 'Johnson', 'lisa.j@email.com', '+44 7911 678901', 0, 0, NOW() - INTERVAL '60 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Chris', 'Evans', 'c.evans@email.com', '+44 7911 789012', 0, 0, NOW() - INTERVAL '45 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Amanda', 'Taylor', 'amanda.taylor@email.com', '+44 7911 890123', 0, 0, NOW() - INTERVAL '30 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Robert', 'Garcia', 'robert.g@email.com', '+44 7911 901234', 0, 0, NOW() - INTERVAL '25 days', NOW()),
            (gen_random_uuid(), restaurant_uuid, 'Jennifer', 'Lee', 'jennifer.lee@email.com', '+44 7911 012345', 0, 0, NOW() - INTERVAL '20 days', NOW())
        RETURNING id
    )
    SELECT array_agg(id) INTO customer_uuids FROM inserted_customers;
    
    RAISE NOTICE 'Created % customers', array_length(customer_uuids, 1);
    
    -- Create 90 days of order history
    FOR i IN 1..90 LOOP
        order_date := CURRENT_DATE - i;
        
        -- Different volumes based on day of week (0=Sunday, 6=Saturday)
        CASE EXTRACT(DOW FROM order_date)
            WHEN 0, 6, 5 THEN orders_per_day := 50 + (random() * 40)::INTEGER; -- Weekend
            WHEN 1 THEN orders_per_day := 20 + (random() * 20)::INTEGER; -- Monday
            ELSE orders_per_day := 30 + (random() * 30)::INTEGER; -- Weekdays
        END CASE;
        
        -- Create orders for this day
        FOR j IN 1..orders_per_day LOOP
            order_uuid := gen_random_uuid();
            
            -- Random order total between £15-£80
            order_total := 15.00 + (random() * 65)::DECIMAL;
            
            -- Insert order
            INSERT INTO orders (
                id, 
                restaurant_id, 
                customer_id,
                created_by,
                order_number, 
                order_type,
                table_number,
                status, 
                payment_status,
                subtotal, 
                tax_amount, 
                service_charge, 
                total_amount,
                items,
                created_at, 
                updated_at
            ) VALUES (
                order_uuid,
                restaurant_uuid,
                CASE WHEN random() < 0.7 THEN customer_uuids[1 + (random() * (array_length(customer_uuids, 1) - 1))::INTEGER] ELSE NULL END,
                employee_user_uuids[1 + (random() * (array_length(employee_user_uuids, 1) - 1))::INTEGER],
                'CE' || TO_CHAR(order_date, 'YYMMDD') || LPAD(j::TEXT, 3, '0'),
                CASE WHEN random() < 0.65 THEN 'dine_in' WHEN random() < 0.9 THEN 'takeaway' ELSE 'delivery' END,
                CASE WHEN random() < 0.6 THEN (1 + random() * 24)::INTEGER::TEXT ELSE NULL END,
                'completed',
                'completed',
                order_total,
                order_total * 0.20, -- 20% VAT
                order_total * 0.125, -- 12.5% service charge
                order_total * 1.325, -- Total with tax and service
                jsonb_build_array(
                    jsonb_build_object(
                        'product_id', product_uuids[1 + (random() * (array_length(product_uuids, 1) - 1))::INTEGER],
                        'product_name', CASE (random() * 6)::INTEGER
                            WHEN 0 THEN 'Chicken Tinga Tacos'
                            WHEN 1 THEN 'Beef Barbacoa Tacos'
                            WHEN 2 THEN 'Chicken Burrito'
                            WHEN 3 THEN 'Cheese Quesadilla'
                            WHEN 4 THEN 'Beef Enchiladas'
                            ELSE 'Guacamole & Chips'
                        END,
                        'quantity', 1 + (random() * 2)::INTEGER,
                        'unit_price', (order_total * (0.6 + random() * 0.4))::DECIMAL,
                        'total_price', order_total,
                        'modifiers', '[]'::jsonb,
                        'special_instructions', CASE (random() * 5)::INTEGER
                            WHEN 0 THEN 'No onions'
                            WHEN 1 THEN 'Extra spicy'
                            WHEN 2 THEN 'On the side'
                            ELSE ''
                        END
                    )
                ),
                order_date + (
                    CASE 
                        WHEN j <= orders_per_day * 0.4 THEN (12 + random() * 3)::INTEGER -- Lunch
                        ELSE (18 + random() * 4)::INTEGER -- Dinner
                    END || ' hours'
                )::INTERVAL + (random() * 59 || ' minutes')::INTERVAL,
                order_date + (
                    CASE 
                        WHEN j <= orders_per_day * 0.4 THEN (12 + random() * 3)::INTEGER -- Lunch
                        ELSE (18 + random() * 4)::INTEGER -- Dinner
                    END || ' hours'
                )::INTERVAL + (random() * 59 || ' minutes')::INTERVAL
            );
            
            -- Create payment for this order
            payment_uuid := gen_random_uuid();
            
            -- Random payment method
            CASE 
                WHEN (random() * 10)::INTEGER BETWEEN 0 AND 5 THEN payment_method := 'card'; -- 60%
                WHEN (random() * 10)::INTEGER BETWEEN 6 AND 7 THEN payment_method := 'cash'; -- 20%
                WHEN (random() * 10)::INTEGER = 8 THEN payment_method := 'qr_code'; -- 10%
                ELSE payment_method := 'mobile_payment'; -- 10%
            END CASE;
            
            -- Calculate fees based on payment method
            fee_rate := CASE payment_method
                WHEN 'cash' THEN 0.00
                WHEN 'qr_code' THEN 0.012 -- 1.2%
                ELSE 0.029 -- 2.9% for cards/mobile
            END;
            
            INSERT INTO payments (
                id,
                order_id,
                payment_method,
                amount,
                fee_amount,
                net_amount,
                status,
                processed_at,
                created_at
            ) VALUES (
                payment_uuid,
                order_uuid,
                payment_method,
                order_total * 1.325,
                (order_total * 1.325) * fee_rate,
                (order_total * 1.325) * (1 - fee_rate),
                'completed',
                order_date + (
                    CASE 
                        WHEN j <= orders_per_day * 0.4 THEN (12 + random() * 3)::INTEGER
                        ELSE (18 + random() * 4)::INTEGER
                    END || ' hours'
                )::INTERVAL + (random() * 59 || ' minutes')::INTERVAL,
                order_date + (
                    CASE 
                        WHEN j <= orders_per_day * 0.4 THEN (12 + random() * 3)::INTEGER
                        ELSE (18 + random() * 4)::INTEGER
                    END || ' hours'
                )::INTERVAL + (random() * 59 || ' minutes')::INTERVAL
            );
        END LOOP;
        
        -- Progress indicator every 10 days
        IF i % 15 = 0 THEN
            RAISE NOTICE 'Created orders for % days (% remaining)', i, 90-i;
        END IF;
    END LOOP;
    
    -- Update customer visit counts and total spent
    UPDATE customers SET 
        visit_count = (SELECT COUNT(*) FROM orders WHERE orders.customer_id = customers.id),
        total_spent = (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE orders.customer_id = customers.id)
    WHERE restaurant_id = restaurant_uuid;
    
    RAISE NOTICE 'Seeding completed! Created full restaurant with 90 days of transaction history';
    RAISE NOTICE 'Restaurant ID: %', restaurant_uuid;
    
END $$;