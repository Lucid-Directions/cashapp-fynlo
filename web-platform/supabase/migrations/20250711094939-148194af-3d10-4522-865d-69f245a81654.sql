-- Update restaurant owner to Omega plan
UPDATE user_subscriptions 
SET 
  subscription_plan = 'omega',
  is_platform_owner = true,
  enabled_features = ARRAY['analytics', 'inventory_management', 'staff_management', 'customer_database', 'location_management', 'api_access', 'advanced_reporting', 'business_management', 'subscription_management', 'system_health', 'advanced_analytics', 'payment_settings', 'advanced_reports']
WHERE user_id = '459da6bc-3472-4de6-8f0c-793373f1a7b0';