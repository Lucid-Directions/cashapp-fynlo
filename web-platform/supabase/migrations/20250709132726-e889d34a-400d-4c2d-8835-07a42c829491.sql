-- Update demo restaurant to be owned by the test user
UPDATE public.restaurants 
SET owner_id = '459da6bc-3472-4de6-8f0c-793373f1a7b0'
WHERE slug = 'demo-restaurant';

-- Create some sample orders for testing
INSERT INTO public.orders (restaurant_id, order_number, customer_name, customer_email, customer_phone, order_type, status, subtotal, tax_amount, service_charge, total_amount, table_id)
SELECT 
  r.id,
  'ORD-' || LPAD((ROW_NUMBER() OVER ())::text, 4, '0'),
  customer_data.name,
  customer_data.email,
  customer_data.phone,
  customer_data.order_type,
  customer_data.status,
  customer_data.subtotal,
  customer_data.subtotal * 0.20, -- 20% tax
  customer_data.subtotal * 0.10, -- 10% service charge
  customer_data.subtotal * 1.30, -- Total with tax and service
  tables.id
FROM public.restaurants r
CROSS JOIN (VALUES 
  ('John Smith', 'john@example.com', '+44 7700 900001', 'dine_in', 'pending', 25.50),
  ('Sarah Johnson', 'sarah@example.com', '+44 7700 900002', 'takeaway', 'preparing', 18.99),
  ('Mike Wilson', 'mike@example.com', '+44 7700 900003', 'dine_in', 'ready', 32.75),
  ('Emma Brown', 'emma@example.com', '+44 7700 900004', 'delivery', 'completed', 22.99),
  ('David Lee', 'david@example.com', '+44 7700 900005', 'dine_in', 'preparing', 41.50)
) AS customer_data(name, email, phone, order_type, status, subtotal)
LEFT JOIN public.restaurant_tables tables ON tables.restaurant_id = r.id AND tables.table_number = 'T1'
WHERE r.slug = 'demo-restaurant';

-- Create order items for these orders
INSERT INTO public.order_items (order_id, menu_item_id, quantity, unit_price, total_price, status)
SELECT 
  o.id,
  mi.id,
  1,
  mi.price,
  mi.price * 1,
  'pending'
FROM public.orders o
JOIN public.restaurants r ON r.id = o.restaurant_id
JOIN public.menu_items mi ON mi.restaurant_id = r.id
WHERE r.slug = 'demo-restaurant'
AND mi.name IN ('Margherita Pizza', 'Caesar Salad', 'Fish & Chips')
LIMIT 8;

-- Create some sample payments
INSERT INTO public.payments (restaurant_id, order_id, amount, payment_method, payment_status, processed_at)
SELECT 
  r.id,
  o.id,
  o.total_amount,
  CASE 
    WHEN o.status = 'completed' THEN 'card'
    WHEN o.status = 'ready' THEN 'cash'
    ELSE 'pending'
  END,
  CASE 
    WHEN o.status IN ('completed', 'ready') THEN 'paid'
    ELSE 'pending'
  END,
  CASE 
    WHEN o.status IN ('completed', 'ready') THEN NOW() - INTERVAL '1 hour'
    ELSE NULL
  END
FROM public.orders o
JOIN public.restaurants r ON r.id = o.restaurant_id
WHERE r.slug = 'demo-restaurant';