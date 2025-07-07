-- Direct SQL seeding for Orders, Customers, and Payments
-- Creates 90 days of realistic transaction data for reports

-- First, let's check if we have the required tables and get restaurant/employee IDs
DO $$
DECLARE
    restaurant_uuid UUID;
    employee_ids UUID[];
    product_data JSON[];
    order_date DATE;
    orders_per_day INTEGER;
    order_hour INTEGER;
    order_total DECIMAL;
    payment_method TEXT;
    fee_rate DECIMAL;
    i INTEGER;
    j INTEGER;
    order_uuid UUID;
    payment_uuid UUID;
    customer_uuid UUID;
BEGIN
    -- Get the first restaurant (assuming we have one)
    SELECT id INTO restaurant_uuid FROM restaurants LIMIT 1;
    
    IF restaurant_uuid IS NULL THEN
        RAISE EXCEPTION 'No restaurant found. Please run basic seeding first.';
    END IF;
    
    RAISE NOTICE 'Using restaurant ID: %', restaurant_uuid;
    
    -- Create customers first
    INSERT INTO customers (id, restaurant_id, name, email, phone, total_visits, total_spent, created_at, updated_at)
    VALUES 
        (gen_random_uuid(), restaurant_uuid, 'James Thompson', 'james.t@email.com', '+44 7911 123456', 0, 0, NOW() - INTERVAL '180 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Sarah Wilson', 'sarah.wilson@email.com', '+44 7911 234567', 0, 0, NOW() - INTERVAL '150 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Michael Brown', 'm.brown@email.com', '+44 7911 345678', 0, 0, NOW() - INTERVAL '120 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Emma Davis', 'emma.davis@email.com', '+44 7911 456789', 0, 0, NOW() - INTERVAL '90 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'David Miller', 'd.miller@email.com', '+44 7911 567890', 0, 0, NOW() - INTERVAL '75 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Lisa Johnson', 'lisa.j@email.com', '+44 7911 678901', 0, 0, NOW() - INTERVAL '60 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Chris Evans', 'c.evans@email.com', '+44 7911 789012', 0, 0, NOW() - INTERVAL '45 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Amanda Taylor', 'amanda.taylor@email.com', '+44 7911 890123', 0, 0, NOW() - INTERVAL '30 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Robert Garcia', 'robert.g@email.com', '+44 7911 901234', 0, 0, NOW() - INTERVAL '25 days', NOW()),
        (gen_random_uuid(), restaurant_uuid, 'Jennifer Lee', 'jennifer.lee@email.com', '+44 7911 012345', 0, 0, NOW() - INTERVAL '20 days', NOW())
    ON CONFLICT (email, restaurant_id) DO NOTHING;
    
    RAISE NOTICE 'Created customers';
    
    -- Create 90 days of order history
    FOR i IN 1..90 LOOP
        order_date := CURRENT_DATE - i;
        
        -- Different volumes based on day of week
        CASE EXTRACT(DOW FROM order_date)
            WHEN 0, 6, 5 THEN orders_per_day := 60 + (random() * 35)::INTEGER; -- Weekend
            WHEN 1 THEN orders_per_day := 20 + (random() * 20)::INTEGER; -- Monday
            ELSE orders_per_day := 35 + (random() * 25)::INTEGER; -- Weekdays
        END CASE;
        
        -- Create orders for this day
        FOR j IN 1..orders_per_day LOOP
            order_uuid := gen_random_uuid();
            
            -- Random order time (lunch and dinner rush)
            IF j <= orders_per_day * 0.4 THEN
                order_hour := 12 + (random() * 3)::INTEGER; -- Lunch
            ELSE
                order_hour := 18 + (random() * 4)::INTEGER; -- Dinner
            END IF;
            
            -- Random order total between £15-£85
            order_total := 15.00 + (random() * 70)::DECIMAL;
            
            -- Insert order
            INSERT INTO orders (
                id, 
                restaurant_id, 
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
                'CE' || TO_CHAR(order_date, 'YYMMDD') || LPAD(j::TEXT, 3, '0'),
                CASE WHEN random() < 0.7 THEN 'dine_in' ELSE 'takeaway' END,
                CASE WHEN random() < 0.6 THEN (1 + random() * 24)::INTEGER::TEXT ELSE NULL END,
                'completed',
                'completed',
                order_total,
                order_total * 0.20, -- 20% VAT
                order_total * 0.125, -- 12.5% service charge
                order_total * 1.325, -- Total with tax and service
                jsonb_build_array(
                    jsonb_build_object(
                        'product_name', CASE (random() * 5)::INTEGER
                            WHEN 0 THEN 'Chicken Burrito'
                            WHEN 1 THEN 'Beef Tacos'
                            WHEN 2 THEN 'Fish Quesadilla'
                            WHEN 3 THEN 'Veggie Enchiladas'
                            ELSE 'Mixed Fajitas'
                        END,
                        'quantity', 1 + (random() * 2)::INTEGER,
                        'unit_price', (order_total / (1 + random()))::DECIMAL,
                        'total_price', order_total
                    )
                ),
                order_date + (order_hour || ' hours')::INTERVAL + (random() * 59 || ' minutes')::INTERVAL,
                order_date + (order_hour || ' hours')::INTERVAL + (random() * 59 || ' minutes')::INTERVAL
            );
            
            -- Create payment for this order
            payment_uuid := gen_random_uuid();
            
            -- Random payment method
            payment_method := CASE (random() * 4)::INTEGER
                WHEN 0 THEN 'card'
                WHEN 1 THEN 'cash'
                WHEN 2 THEN 'qr_code'
                ELSE 'mobile_payment'
            END;
            
            -- Calculate fees based on payment method
            fee_rate := CASE payment_method
                WHEN 'cash' THEN 0.00
                WHEN 'qr_code' THEN 0.012 -- 1.2%
                ELSE 0.029 -- 2.9% for cards
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
                order_date + (order_hour || ' hours')::INTERVAL + (random() * 59 || ' minutes')::INTERVAL,
                order_date + (order_hour || ' hours')::INTERVAL + (random() * 59 || ' minutes')::INTERVAL
            );
        END LOOP;
        
        -- Progress indicator every 10 days
        IF i % 10 = 0 THEN
            RAISE NOTICE 'Created orders for % days (% remaining)', i, 90-i;
        END IF;
    END LOOP;
    
    RAISE NOTICE 'Seeding completed! Created orders and payments for 90 days';
    
END $$;