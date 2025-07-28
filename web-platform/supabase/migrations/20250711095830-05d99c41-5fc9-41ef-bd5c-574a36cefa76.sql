-- Create helper functions for subscription-based access control

-- Function to check if user has a specific feature enabled
CREATE OR REPLACE FUNCTION public.user_has_feature(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT 
    CASE 
      WHEN us.is_platform_owner = true THEN true
      WHEN _feature_key = ANY(us.enabled_features) THEN true
      ELSE false
    END
  FROM public.user_subscriptions us
  WHERE us.user_id = _user_id
  LIMIT 1;
$$;

-- Function to check subscription level
CREATE OR REPLACE FUNCTION public.user_has_subscription_level(_user_id uuid, _required_level text)
RETURNS boolean  
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  WITH level_hierarchy AS (
    SELECT 'alpha'::text as level, 1 as rank
    UNION ALL SELECT 'beta'::text, 2
    UNION ALL SELECT 'omega'::text, 3
  )
  SELECT 
    CASE 
      WHEN us.is_platform_owner = true THEN true
      WHEN user_level.rank >= required_level.rank THEN true
      ELSE false
    END
  FROM public.user_subscriptions us
  LEFT JOIN level_hierarchy user_level ON user_level.level = us.subscription_plan
  LEFT JOIN level_hierarchy required_level ON required_level.level = _required_level
  WHERE us.user_id = _user_id
  LIMIT 1;
$$;

-- Function to check if user owns restaurant (for restaurant-specific features)
CREATE OR REPLACE FUNCTION public.user_owns_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = _restaurant_id AND owner_id = _user_id
  );
$$;