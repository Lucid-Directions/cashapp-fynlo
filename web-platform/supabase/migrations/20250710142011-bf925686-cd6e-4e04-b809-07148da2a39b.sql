-- Update the existing restaurant to be "Chucho" Mexican restaurant  
UPDATE restaurants 
SET name = 'Chucho', 
    description = 'Authentic Mexican cuisine with modern flair',
    slug = 'chucho',
    address = '123 High Street, London, UK',
    phone = '+44 20 7123 4567',
    email = 'arnaud@luciddirections.co.uk'
WHERE id = 'affa341f-7f7f-4941-8fe4-58941e93ee91';

-- Update the restaurant owner's subscription to Omega
UPDATE user_subscriptions 
SET subscription_plan = 'omega',
    enabled_features = ARRAY[
      'inventory_management', 
      'staff_management', 
      'customer_database', 
      'advanced_reports',
      'business_management',
      'subscription_management',
      'system_health',
      'advanced_analytics',
      'payment_settings',
      'api_access',
      'location_management',
      'white_label',
      'custom_integrations',
      'unlimited_locations',
      'unlimited_staff',
      'dedicated_support',
      'custom_training'
    ]
WHERE user_id = '459da6bc-3472-4de6-8f0c-793373f1a7b0';