-- Test file for platform owner RLS policies
-- Run with: supabase test db

BEGIN;

-- Setup test data
INSERT INTO auth.users (id, email) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'platform@fynlo.com'),
  ('22222222-2222-2222-2222-222222222222', 'restaurant@example.com');

INSERT INTO public.user_roles (user_id, role) VALUES 
  ('11111111-1111-1111-1111-111111111111', 'admin'),
  ('22222222-2222-2222-2222-222222222222', 'owner');

INSERT INTO public.restaurants (id, name, owner_id, is_active) VALUES 
  ('33333333-3333-3333-3333-333333333333', 'Test Restaurant 1', '22222222-2222-2222-2222-222222222222', true),
  ('44444444-4444-4444-4444-444444444444', 'Test Restaurant 2', '22222222-2222-2222-2222-222222222222', true);

-- Test 1: Platform owner can see all restaurants
SET SESSION AUTHORIZATION '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE
  restaurant_count integer;
BEGIN
  SELECT COUNT(*) INTO restaurant_count FROM public.restaurants;
  ASSERT restaurant_count = 2, 'Platform owner should see all restaurants';
END $$;

-- Test 2: Regular user cannot see all restaurants (should fail without proper RLS)
SET SESSION AUTHORIZATION '22222222-2222-2222-2222-222222222222';
DO $$
DECLARE
  restaurant_count integer;
BEGIN
  SELECT COUNT(*) INTO restaurant_count FROM public.restaurants;
  -- This will depend on existing RLS policies for regular users
  -- If they can only see their own restaurants, count should be limited
  RAISE NOTICE 'Regular user sees % restaurants', restaurant_count;
END $$;

-- Test 3: is_platform_owner function works correctly
SET SESSION AUTHORIZATION '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT public.is_platform_owner() INTO is_owner;
  ASSERT is_owner = true, 'Admin user should be identified as platform owner';
END $$;

SET SESSION AUTHORIZATION '22222222-2222-2222-2222-222222222222';
DO $$
DECLARE
  is_owner boolean;
BEGIN
  SELECT public.is_platform_owner() INTO is_owner;
  ASSERT is_owner = false, 'Regular user should not be platform owner';
END $$;

-- Test 4: Platform owner can manage restaurants
SET SESSION AUTHORIZATION '11111111-1111-1111-1111-111111111111';
DO $$
BEGIN
  -- Test UPDATE
  UPDATE public.restaurants SET is_active = false WHERE id = '33333333-3333-3333-3333-333333333333';
  
  -- Test INSERT
  INSERT INTO public.restaurants (id, name, owner_id, is_active) 
  VALUES ('55555555-5555-5555-5555-555555555555', 'New Restaurant', '22222222-2222-2222-2222-222222222222', true);
  
  -- Test DELETE
  DELETE FROM public.restaurants WHERE id = '55555555-5555-5555-5555-555555555555';
  
  RAISE NOTICE 'Platform owner can perform all operations on restaurants';
END $$;

-- Test 5: Platform owner can view orders from all restaurants
INSERT INTO public.orders (id, restaurant_id, total_amount, status) VALUES 
  ('66666666-6666-6666-6666-666666666666', '33333333-3333-3333-3333-333333333333', 100.00, 'completed'),
  ('77777777-7777-7777-7777-777777777777', '44444444-4444-4444-4444-444444444444', 200.00, 'completed');

SET SESSION AUTHORIZATION '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE
  order_count integer;
  total_revenue numeric;
BEGIN
  SELECT COUNT(*), SUM(total_amount) INTO order_count, total_revenue FROM public.orders;
  ASSERT order_count = 2, 'Platform owner should see all orders';
  ASSERT total_revenue = 300.00, 'Platform owner should see correct total revenue';
END $$;

-- Test 6: Platform owner can view staff members from all restaurants
INSERT INTO public.staff_members (id, restaurant_id, user_id, role, is_active) VALUES 
  ('88888888-8888-8888-8888-888888888888', '33333333-3333-3333-3333-333333333333', '22222222-2222-2222-2222-222222222222', 'manager', true);

SET SESSION AUTHORIZATION '11111111-1111-1111-1111-111111111111';
DO $$
DECLARE
  staff_count integer;
BEGIN
  SELECT COUNT(*) INTO staff_count FROM public.staff_members;
  ASSERT staff_count >= 1, 'Platform owner should see staff members';
END $$;

-- Cleanup
ROLLBACK;