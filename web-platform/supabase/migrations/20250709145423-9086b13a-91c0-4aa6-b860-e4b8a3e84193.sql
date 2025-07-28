-- Upgrade current user to Omega tier for demo purposes
-- This would normally be handled by Stripe webhooks, but for demo we'll do it directly

-- First, let's create a user_subscriptions table if it doesn't exist to track subscription plans
CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  subscription_plan TEXT NOT NULL DEFAULT 'alpha' CHECK (subscription_plan IN ('alpha', 'beta', 'omega')),
  is_platform_owner BOOLEAN DEFAULT FALSE,
  enabled_features TEXT[] DEFAULT ARRAY[]::TEXT[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Create policy for users to view their own subscription
CREATE POLICY "Users can view own subscription" ON public.user_subscriptions
FOR SELECT USING (auth.uid() = user_id);

-- Create policy for authenticated users to insert their subscription
CREATE POLICY "Users can insert own subscription" ON public.user_subscriptions
FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Create policy for users to update their own subscription
CREATE POLICY "Users can update own subscription" ON public.user_subscriptions
FOR UPDATE USING (auth.uid() = user_id);

-- Insert/Update current user to Omega tier (this will work for any authenticated user)
INSERT INTO public.user_subscriptions (
  user_id, 
  subscription_plan, 
  is_platform_owner,
  enabled_features
) 
SELECT 
  auth.uid(),
  'omega',
  TRUE,
  ARRAY['analytics', 'inventory_management', 'staff_management', 'customer_database', 'location_management', 'api_access', 'advanced_reporting']
WHERE auth.uid() IS NOT NULL
ON CONFLICT (user_id) 
DO UPDATE SET 
  subscription_plan = 'omega',
  is_platform_owner = TRUE,
  enabled_features = ARRAY['analytics', 'inventory_management', 'staff_management', 'customer_database', 'location_management', 'api_access', 'advanced_reporting'],
  updated_at = NOW();