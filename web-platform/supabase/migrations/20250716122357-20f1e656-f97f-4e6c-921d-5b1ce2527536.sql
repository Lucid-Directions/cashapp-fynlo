-- Create a demo restaurant for testing
-- Get the first user ID and create a restaurant
WITH first_user AS (
  SELECT id FROM auth.users LIMIT 1
)
INSERT INTO public.restaurants (
  name, 
  slug, 
  description, 
  address, 
  phone, 
  email, 
  owner_id, 
  currency, 
  timezone, 
  is_active
) 
SELECT 
  'Demo Restaurant',
  'demo-restaurant',
  'A demo restaurant for testing the platform features',
  '123 Demo Street, London, UK',
  '+44 20 1234 5678',
  'demo@restaurant.com',
  fu.id,
  'GBP',
  'Europe/London',
  true
FROM first_user fu
WHERE NOT EXISTS (
  SELECT 1 FROM public.restaurants WHERE slug = 'demo-restaurant'
);