-- Configure authentication settings for better security
-- Note: These settings should be configured in Supabase dashboard
-- This is just a reference for what needs to be updated

-- 1. Set OTP expiry to recommended 10 minutes (600 seconds)
-- This needs to be done in Supabase Dashboard > Authentication > Settings
-- Set "OTP expiry" to 600 seconds

-- 2. Enable leaked password protection
-- This needs to be done in Supabase Dashboard > Authentication > Settings
-- Enable "Leaked password protection"

-- 3. Add more restrictive RLS policies where needed
-- Already handled above

-- 4. Create missing user data for current session
INSERT INTO public.user_subscriptions (
  user_id, 
  subscription_plan, 
  enabled_features, 
  is_platform_owner
) 
SELECT 
  id,
  'omega',
  ARRAY[
    'staff_management', 
    'inventory_management', 
    'customer_database', 
    'analytics', 
    'advanced_analytics', 
    'api_access',
    'location_management',
    'business_management',
    'subscription_management',
    'system_health',
    'payment_settings',
    'advanced_reports'
  ],
  true
FROM auth.users 
WHERE id NOT IN (SELECT user_id FROM public.user_subscriptions);