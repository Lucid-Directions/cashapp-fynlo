-- Create subscription records for all existing users
INSERT INTO user_subscriptions (user_id, subscription_plan, is_platform_owner, enabled_features)
VALUES 
  -- Restaurant manager with beta access
  ('82601d0b-47b8-4e13-8e2f-d696b7ccd36a', 'beta', false, ARRAY['inventory_management', 'staff_management', 'customer_database', 'advanced_reports']),
  ('eae7fc4e-9dac-4b65-a757-e8a6da5facdb', 'beta', false, ARRAY['inventory_management', 'staff_management', 'customer_database', 'advanced_reports']),
  ('c394da32-1f14-4a91-b524-2333b1b525ca', 'beta', false, ARRAY['inventory_management', 'staff_management', 'customer_database', 'advanced_reports']),
  ('459da6bc-3472-4de6-8f0c-793373f1a7b0', 'beta', false, ARRAY['inventory_management', 'staff_management', 'customer_database', 'advanced_reports'])
ON CONFLICT (user_id) 
DO UPDATE SET 
  subscription_plan = EXCLUDED.subscription_plan,
  is_platform_owner = EXCLUDED.is_platform_owner,
  enabled_features = EXCLUDED.enabled_features,
  updated_at = now();