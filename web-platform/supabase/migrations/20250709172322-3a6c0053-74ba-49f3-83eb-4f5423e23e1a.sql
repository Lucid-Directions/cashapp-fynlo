-- Upgrade current authenticated user to Omega tier for testing
UPDATE public.user_subscriptions 
SET 
  subscription_plan = 'omega',
  is_platform_owner = TRUE,
  enabled_features = ARRAY['analytics', 'inventory_management', 'staff_management', 'customer_database', 'location_management', 'api_access', 'advanced_reporting', 'business_management', 'subscription_management', 'system_health'],
  updated_at = NOW()
WHERE user_id = auth.uid();