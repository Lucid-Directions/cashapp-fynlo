-- Seed customers and orders for existing restaurant

DO $$
DECLARE
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
    -- Get existing restaurant
    SELECT id INTO restaurant_uuid FROM restaurants WHERE email = 'info@casaestrella.co.uk' LIMIT 1;
    
    IF restaurant_uuid IS NULL THEN
        SELECT id INTO restaurant_uuid FROM restaurants LIMIT 1;
    END IF;
    
    RAISE NOTICE 'Using restaurant: %', restaurant_uuid;
    
    -- Get owner user
    SELECT id INTO owner_user_uuid FROM users WHERE email = 'carlos@casaestrella.co.uk';
    
    -- Get existing employee IDs
    SELECT array_agg(id) INTO employee_user_uuids 
    FROM users 
    WHERE role = 'employee' 
    AND email LIKE '%@casaestrella.co.uk';
    
    -- Create customers
    FOR i IN 1..10 LOOP
        INSERT INTO customers (id, restaurant_id, email, phone, first_name, last_name, loyalty_points, total_spent, visit_count, created_at, updated_at)
        VALUES (
            gen_random_uuid(),
            restaurant_uuid,
            'customer' || i || '@example.com',
            '+44 7700 900' || LPAD(i::TEXT, 3, '0'),
            CASE i % 5
                WHEN 0 THEN 'John'
                WHEN 1 THEN 'Emma'
                WHEN 2 THEN 'Oliver'
                WHEN 3 THEN 'Sophia'
                WHEN 4 THEN 'James'
            END,
            CASE i % 4
                WHEN 0 THEN 'Smith'
                WHEN 1 THEN 'Johnson'
                WHEN 2 THEN 'Williams'
                WHEN 3 THEN 'Brown'
            END,
            FLOOR(random() * 500),
            FLOOR(random() * 2000),
            FLOOR(random() * 50),
            NOW() - INTERVAL '1 year' * random(),
            NOW()
        );
    END LOOP;
    
    -- Get customer IDs
    SELECT array_agg(id) INTO customer_uuids FROM customers WHERE restaurant_id = restaurant_uuid;
    
    RAISE NOTICE 'Created % customers', array_length(customer_uuids, 1);
    
    -- Get existing categories or create them
    SELECT array_agg(id) INTO category_uuids FROM categories WHERE restaurant_id = restaurant_uuid;
    
    IF category_uuids IS NULL OR array_length(category_uuids, 1) IS NULL THEN
        -- Create categories if they don't exist
        WITH inserted_categories AS (
            INSERT INTO categories (id, restaurant_id, name, description, color, sort_order, is_active, created_at)
            VALUES 
                (gen_random_uuid(), restaurant_uuid, 'Starters', 'Appetizers and small plates', '#E53E3E', 1, true, NOW()),
                (gen_random_uuid(), restaurant_uuid, 'Mains', 'Main course dishes', '#38A169', 2, true, NOW()),
                (gen_random_uuid(), restaurant_uuid, 'Desserts', 'Sweet treats', '#D69E2E', 3, true, NOW()),
                (gen_random_uuid(), restaurant_uuid, 'Drinks', 'Beverages', '#0BC5EA', 4, true, NOW())
            RETURNING id
        )
        SELECT array_agg(id) INTO category_uuids FROM inserted_categories;
    END IF;
    
    -- Get existing products or create them
    SELECT array_agg(id) INTO product_uuids FROM products WHERE restaurant_id = restaurant_uuid;
    
    IF product_uuids IS NULL OR array_length(product_uuids, 1) IS NULL THEN
        -- Create products
        WITH inserted_products AS (
            INSERT INTO products (id, restaurant_id, category_id, name, description, price, cost, is_active, created_at, updated_at)
            VALUES 
                -- Starters
                (gen_random_uuid(), restaurant_uuid, category_uuids[1], 'Nachos', 'Tortilla chips with cheese and jalapenos', 8.50, 3.40, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[1], 'Guacamole', 'Fresh avocado dip with chips', 7.50, 3.00, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[1], 'Chicken Wings', 'Spicy buffalo wings', 9.50, 3.80, true, NOW(), NOW()),
                -- Mains
                (gen_random_uuid(), restaurant_uuid, category_uuids[2], 'Beef Tacos', 'Three soft tacos with seasoned beef', 12.50, 5.00, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[2], 'Chicken Burrito', 'Large burrito with rice and beans', 10.50, 4.20, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[2], 'Veggie Quesadilla', 'Grilled tortilla with vegetables and cheese', 9.50, 3.80, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[2], 'Fish Tacos', 'Three tacos with grilled fish', 13.50, 5.40, true, NOW(), NOW()),
                -- Desserts
                (gen_random_uuid(), restaurant_uuid, category_uuids[3], 'Churros', 'Fried dough with cinnamon sugar', 6.50, 2.60, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[3], 'Flan', 'Traditional caramel custard', 5.50, 2.20, true, NOW(), NOW()),
                -- Drinks
                (gen_random_uuid(), restaurant_uuid, category_uuids[4], 'Margarita', 'Classic lime margarita', 8.50, 3.40, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[4], 'Corona', 'Mexican beer', 4.50, 1.80, true, NOW(), NOW()),
                (gen_random_uuid(), restaurant_uuid, category_uuids[4], 'Soft Drink', 'Coke, Sprite, or Fanta', 3.50, 1.40, true, NOW(), NOW())
            RETURNING id
        )
        SELECT array_agg(id) INTO product_uuids FROM inserted_products;
    END IF;
    
    RAISE NOTICE 'Products available: %', array_length(product_uuids, 1);
    
    -- Create orders for the last 90 days
    FOR i IN 0..89 LOOP
        order_date := CURRENT_DATE - INTERVAL '1 day' * i;
        
        -- Variable number of orders per day (more on weekends)
        IF EXTRACT(DOW FROM order_date) IN (0, 6) THEN
            orders_per_day := 15 + FLOOR(random() * 20);
        ELSE
            orders_per_day := 10 + FLOOR(random() * 15);
        END IF;
        
        FOR j IN 1..orders_per_day LOOP
            order_uuid := gen_random_uuid();
            
            -- Random payment method
            payment_method := CASE FLOOR(random() * 4)
                WHEN 0 THEN 'cash'
                WHEN 1 THEN 'card'
                WHEN 2 THEN 'qr_code'
                ELSE 'card'
            END;
            
            -- Create order with 1-5 items
            WITH order_items AS (
                SELECT 
                    jsonb_build_object(
                        'id', p.id,
                        'name', p.name,
                        'price', p.price,
                        'quantity', 1 + FLOOR(random() * 3)::INTEGER
                    ) as item,
                    p.price * (1 + FLOOR(random() * 3)::INTEGER) as item_total
                FROM products p
                WHERE p.restaurant_id = restaurant_uuid
                ORDER BY random()
                LIMIT 1 + FLOOR(random() * 4)::INTEGER
            ),
            order_summary AS (
                SELECT 
                    jsonb_agg(item) as items,
                    SUM(item_total) as subtotal
                FROM order_items
            )
            INSERT INTO orders (
                id, restaurant_id, customer_id, order_number, table_number,
                order_type, status, items, subtotal, tax_amount, service_charge,
                discount_amount, total_amount, payment_status, created_by,
                created_at, updated_at
            )
            SELECT 
                order_uuid,
                restaurant_uuid,
                customer_uuids[1 + FLOOR(random() * (array_length(customer_uuids, 1) - 1))::INTEGER],
                'ORD-' || to_char(order_date, 'YYMMDD') || '-' || LPAD(j::TEXT, 4, '0'),
                CASE WHEN random() < 0.7 THEN (1 + FLOOR(random() * 20))::TEXT ELSE NULL END,
                CASE WHEN random() < 0.6 THEN 'dine_in' ELSE 'takeaway' END,
                'completed',
                items,
                subtotal,
                subtotal * 0.2, -- 20% VAT
                subtotal * 0.125, -- 12.5% service charge
                CASE WHEN random() < 0.1 THEN subtotal * 0.1 ELSE 0 END, -- 10% chance of discount
                subtotal * 1.325 - (CASE WHEN random() < 0.1 THEN subtotal * 0.1 ELSE 0 END),
                'completed',
                COALESCE(employee_user_uuids[1 + FLOOR(random() * (array_length(employee_user_uuids, 1) - 1))::INTEGER], owner_user_uuid),
                order_date + (INTERVAL '10 hours' + INTERVAL '1 minute' * FLOOR(random() * 720)),
                order_date + (INTERVAL '10 hours' + INTERVAL '1 minute' * FLOOR(random() * 720))
            FROM order_summary;
            
            -- Create payment record
            SELECT total_amount INTO order_total FROM orders WHERE id = order_uuid;
            
            fee_rate := CASE payment_method
                WHEN 'qr_code' THEN 0.012
                WHEN 'card' THEN 0.029
                ELSE 0
            END;
            
            INSERT INTO payments (
                id, order_id, payment_method, amount, fee_amount, net_amount,
                status, processed_at, created_at
            )
            VALUES (
                gen_random_uuid(),
                order_uuid,
                payment_method,
                order_total,
                order_total * fee_rate,
                order_total - (order_total * fee_rate),
                'completed',
                order_date + (INTERVAL '10 hours' + INTERVAL '1 minute' * FLOOR(random() * 720)),
                order_date + (INTERVAL '10 hours' + INTERVAL '1 minute' * FLOOR(random() * 720))
            );
        END LOOP;
    END LOOP;
    
    RAISE NOTICE 'Order creation completed';
    
    -- Update customer visit counts and total spent
    UPDATE customers c
    SET 
        visit_count = subquery.order_count,
        total_spent = subquery.total_spent
    FROM (
        SELECT 
            customer_id,
            COUNT(*) as order_count,
            SUM(total_amount) as total_spent
        FROM orders
        WHERE restaurant_id = restaurant_uuid
        GROUP BY customer_id
    ) subquery
    WHERE c.id = subquery.customer_id;
    
    RAISE NOTICE 'Customer stats updated';
    
    -- Show summary
    RAISE NOTICE '=== Seeding Complete ===';
    RAISE NOTICE 'Restaurant: %', restaurant_uuid;
    RAISE NOTICE 'Total Customers: %', (SELECT COUNT(*) FROM customers WHERE restaurant_id = restaurant_uuid);
    RAISE NOTICE 'Total Orders: %', (SELECT COUNT(*) FROM orders WHERE restaurant_id = restaurant_uuid);
    RAISE NOTICE 'Total Revenue: £%', (SELECT ROUND(SUM(total_amount)::numeric, 2) FROM orders WHERE restaurant_id = restaurant_uuid);
    
END $$;