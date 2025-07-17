-- Update the existing restaurant to be "Chucho" Mexican restaurant
UPDATE restaurants 
SET name = 'Chucho', 
    description = 'Authentic Mexican cuisine with modern flair',
    slug = 'chucho',
    address = '123 High Street, London, UK',
    phone = '+44 20 7123 4567',
    email = 'arnaud@luciddirections.co.uk'
WHERE name = 'Demo Restaurant';

-- Update the restaurant owner to have Omega subscription
UPDATE user_subscriptions 
SET subscription_plan = 'omega',
    enabled_features = ARRAY[
      'inventory_management', 
      'staff_management', 
      'customer_database', 
      'advanced_reports',
      'business_management',
      'subscription_management',
      'system_health',
      'advanced_analytics',
      'payment_settings',
      'api_access',
      'location_management',
      'white_label',
      'custom_integrations',
      'unlimited_locations',
      'unlimited_staff',
      'dedicated_support',
      'custom_training'
    ]
WHERE user_id = (SELECT owner_id FROM restaurants WHERE name = 'Chucho');

-- Insert some sample menu items for Chucho
INSERT INTO menu_categories (name, description, restaurant_id, sort_order) VALUES
('Tacos', 'Authentic Mexican tacos with fresh ingredients', (SELECT id FROM restaurants WHERE name = 'Chucho'), 1),
('Burritos', 'Large flour tortillas filled with delicious ingredients', (SELECT id FROM restaurants WHERE name = 'Chucho'), 2),
('Sides', 'Perfect accompaniments to your meal', (SELECT id FROM restaurants WHERE name = 'Chucho'), 3)
ON CONFLICT DO NOTHING;

-- Insert sample menu items
INSERT INTO menu_items (name, description, price, restaurant_id, category_id, is_available, is_featured) VALUES
('Carnitas Taco', 'Slow-cooked pork with onions and cilantro', 4.50, 
 (SELECT id FROM restaurants WHERE name = 'Chucho'), 
 (SELECT id FROM menu_categories WHERE name = 'Tacos' AND restaurant_id = (SELECT id FROM restaurants WHERE name = 'Chucho')), 
 true, true),
('Chicken Burrito', 'Grilled chicken with rice, beans, and salsa', 9.95, 
 (SELECT id FROM restaurants WHERE name = 'Chucho'), 
 (SELECT id FROM menu_categories WHERE name = 'Burritos' AND restaurant_id = (SELECT id FROM restaurants WHERE name = 'Chucho')), 
 true, false),
('Guacamole & Chips', 'Fresh avocado dip with tortilla chips', 6.50, 
 (SELECT id FROM restaurants WHERE name = 'Chucho'), 
 (SELECT id FROM menu_categories WHERE name = 'Sides' AND restaurant_id = (SELECT id FROM restaurants WHERE name = 'Chucho')), 
 true, false)
ON CONFLICT DO NOTHING;

-- Insert sample orders for testing payment analytics
INSERT INTO orders (restaurant_id, order_number, status, subtotal, tax_amount, service_charge, total_amount, order_type, customer_name, customer_email) VALUES
((SELECT id FROM restaurants WHERE name = 'Chucho'), 'CHU001', 'completed', 24.95, 4.99, 2.50, 32.44, 'dine_in', 'John Smith', 'john.smith@example.com'),
((SELECT id FROM restaurants WHERE name = 'Chucho'), 'CHU002', 'completed', 15.50, 3.10, 1.55, 20.15, 'takeaway', 'Maria Garcia', 'maria.garcia@example.com'),
((SELECT id FROM restaurants WHERE name = 'Chucho'), 'CHU003', 'pending', 18.75, 3.75, 1.88, 24.38, 'dine_in', 'David Wilson', 'david.wilson@example.com')
ON CONFLICT DO NOTHING;

-- Insert corresponding payments
INSERT INTO payments (order_id, restaurant_id, amount, payment_method, payment_status, provider_reference, metadata) VALUES
((SELECT id FROM orders WHERE order_number = 'CHU001'), (SELECT id FROM restaurants WHERE name = 'Chucho'), 32.44, 'stripe', 'paid', 'pi_1234567890', '{"stripe_charge_id": "ch_1234567890", "card_last4": "4242"}'),
((SELECT id FROM orders WHERE order_number = 'CHU002'), (SELECT id FROM restaurants WHERE name = 'Chucho'), 20.15, 'sumup', 'paid', 'txn_abcdef123456', '{"sumup_transaction_id": "txn_abcdef123456", "card_type": "visa"}'),
((SELECT id FROM orders WHERE order_number = 'CHU003'), (SELECT id FROM restaurants WHERE name = 'Chucho'), 24.38, 'cash', 'pending', null, '{"payment_type": "cash"}')
ON CONFLICT DO NOTHING;