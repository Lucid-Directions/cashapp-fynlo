-- Fix RLS policies for menu_item_modifiers table
CREATE POLICY "Staff can manage menu item modifiers" 
ON public.menu_item_modifiers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 
    FROM menu_items mi 
    JOIN restaurants r ON r.id = mi.restaurant_id 
    LEFT JOIN staff_members sm ON sm.restaurant_id = r.id 
    WHERE mi.id = menu_item_modifiers.menu_item_id 
    AND (
      r.owner_id = auth.uid() 
      OR (sm.user_id = auth.uid() AND sm.is_active = true)
    )
  )
);

-- Fix search_path for all functions
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT restaurant_id
  FROM public.user_restaurants
  WHERE user_id = _user_id
  AND is_active = true
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.restaurants r
    LEFT JOIN public.user_restaurants ur ON ur.restaurant_id = r.id
    WHERE r.id = _restaurant_id
    AND (
      r.owner_id = _user_id 
      OR (ur.user_id = _user_id AND ur.is_active = true)
    )
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_feature(_user_id uuid, _feature_key text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.user_has_subscription_level(_user_id uuid, _required_level text)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
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

CREATE OR REPLACE FUNCTION public.user_owns_restaurant(_user_id uuid, _restaurant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = 'public'
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.restaurants 
    WHERE id = _restaurant_id AND owner_id = _user_id
  );
$$;