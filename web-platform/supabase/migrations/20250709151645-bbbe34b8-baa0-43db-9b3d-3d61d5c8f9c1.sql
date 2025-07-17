-- Insert subscription data for the current user
INSERT INTO user_subscriptions (user_id, subscription_plan, is_platform_owner, enabled_features)
VALUES (
  '34e082ce-1dd7-4a4c-858c-630c1479ee77',
  'omega',
  true,
  ARRAY['business_management', 'subscription_management', 'system_health', 'advanced_analytics', 'payment_settings', 'inventory_management', 'staff_management', 'customer_database', 'advanced_reports', 'api_access', 'location_management']
)
ON CONFLICT (user_id) 
DO UPDATE SET 
  subscription_plan = 'omega',
  is_platform_owner = true,
  enabled_features = ARRAY['business_management', 'subscription_management', 'system_health', 'advanced_analytics', 'payment_settings', 'inventory_management', 'staff_management', 'customer_database', 'advanced_reports', 'api_access', 'location_management'],
  updated_at = now();