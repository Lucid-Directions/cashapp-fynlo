-- Create a dummy restaurant for testing
INSERT INTO public.restaurants (
  name,
  slug,
  owner_id,
  description,
  address,
  phone,
  email,
  is_active
) VALUES (
  'Demo Restaurant',
  'demo-restaurant',
  '00000000-0000-0000-0000-000000000000', -- Placeholder, will be updated
  'A demo restaurant for testing the POS system',
  '123 Test Street, London, UK',
  '+44 20 1234 5678',
  'demo@restaurant.com',
  true
);

-- Create default restaurant settings
INSERT INTO public.restaurant_settings (
  restaurant_id,
  tax_rate,
  service_charge,
  auto_accept_orders,
  opening_hours,
  business_days,
  payment_methods
) 
SELECT 
  id,
  0.20,
  0.10,
  false,
  '{"monday": {"open": "09:00", "close": "22:00"}, "tuesday": {"open": "09:00", "close": "22:00"}, "wednesday": {"open": "09:00", "close": "22:00"}, "thursday": {"open": "09:00", "close": "22:00"}, "friday": {"open": "09:00", "close": "22:00"}, "saturday": {"open": "10:00", "close": "23:00"}, "sunday": {"open": "10:00", "close": "21:00"}}'::jsonb,
  '["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"]'::jsonb,
  '["cash", "card", "contactless"]'::jsonb
FROM public.restaurants 
WHERE slug = 'demo-restaurant';

-- Create some sample menu categories
INSERT INTO public.menu_categories (restaurant_id, name, description, sort_order)
SELECT 
  r.id,
  category_name,
  category_desc,
  sort_order
FROM public.restaurants r,
(VALUES 
  ('Starters', 'Appetizers and small plates', 1),
  ('Mains', 'Main course dishes', 2),
  ('Desserts', 'Sweet treats and desserts', 3),
  ('Beverages', 'Drinks and refreshments', 4)
) AS categories(category_name, category_desc, sort_order)
WHERE r.slug = 'demo-restaurant';

-- Create some sample menu items
INSERT INTO public.menu_items (restaurant_id, category_id, name, description, price, cost, is_available, is_featured)
SELECT 
  r.id,
  mc.id,
  item_name,
  item_desc,
  item_price,
  item_cost,
  true,
  is_featured
FROM public.restaurants r
JOIN public.menu_categories mc ON mc.restaurant_id = r.id
CROSS JOIN (VALUES 
  ('Starters', 'Garlic Bread', 'Freshly baked bread with garlic butter', 5.99, 2.50, false),
  ('Starters', 'Caesar Salad', 'Crisp romaine lettuce with parmesan and croutons', 8.99, 3.75, true),
  ('Mains', 'Margherita Pizza', 'Classic pizza with tomato, mozzarella and basil', 12.99, 4.50, true),
  ('Mains', 'Fish & Chips', 'Beer battered cod with chunky chips', 15.99, 6.25, false),
  ('Desserts', 'Chocolate Brownie', 'Rich chocolate brownie with vanilla ice cream', 6.99, 2.75, false),
  ('Beverages', 'Coca Cola', 'Refreshing soft drink', 2.99, 0.85, false)
) AS items(category_name, item_name, item_desc, item_price, item_cost, is_featured)
WHERE r.slug = 'demo-restaurant' 
AND mc.name = items.category_name;

-- Create some sample tables
INSERT INTO public.restaurant_tables (restaurant_id, table_number, capacity, section, is_active)
SELECT 
  r.id,
  table_num,
  capacity,
  section,
  true
FROM public.restaurants r,
(VALUES 
  ('T1', 2, 'Main Floor'),
  ('T2', 4, 'Main Floor'),
  ('T3', 6, 'Main Floor'),
  ('T4', 2, 'Terrace'),
  ('T5', 4, 'Terrace'),
  ('T6', 8, 'Private Room')
) AS tables(table_num, capacity, section)
WHERE r.slug = 'demo-restaurant';