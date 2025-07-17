-- Create a demo restaurant for the current user
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
) VALUES (
  'Demo Restaurant',
  'demo-restaurant',
  'A demo restaurant for testing the platform features',
  '123 Demo Street, London, UK',
  '+44 20 1234 5678',
  'demo@restaurant.com',
  auth.uid(),
  'GBP',
  'Europe/London',
  true
) ON CONFLICT (slug) DO NOTHING;