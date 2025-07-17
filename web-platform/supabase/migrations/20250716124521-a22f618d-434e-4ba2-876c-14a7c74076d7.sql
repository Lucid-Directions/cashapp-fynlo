-- Update current user's subscription to omega with all features
UPDATE public.user_subscriptions 
SET 
  subscription_plan = 'omega',
  enabled_features = ARRAY[
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
  is_platform_owner = true,
  updated_at = now()
WHERE user_id = '82601d0b-47b8-4e13-8e2f-d696b7ccd36a';