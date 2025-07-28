-- Insert missing user subscription for current user
INSERT INTO public.user_subscriptions (user_id, subscription_plan, enabled_features, is_platform_owner)
SELECT 
  auth.uid(),
  'omega'::text,
  ARRAY['staff_management', 'inventory_management', 'customer_database', 'analytics', 'advanced_analytics', 'api_access']::text[],
  true
WHERE NOT EXISTS (
  SELECT 1 FROM public.user_subscriptions WHERE user_id = auth.uid()
);