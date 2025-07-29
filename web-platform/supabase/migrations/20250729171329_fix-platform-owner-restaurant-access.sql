-- Add RLS policy for platform owners to access all restaurants
-- This fixes the critical security issue where platform owner components
-- were fetching all restaurants without proper RLS policies

-- Create a secure function to check if user is a platform owner
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.user_roles 
    WHERE user_id = auth.uid() 
    AND role = 'admin'
  );
$$;

-- Add policy for platform owners to view all restaurants
CREATE POLICY "Platform owners can view all restaurants" 
ON public.restaurants 
FOR SELECT 
USING (
  public.is_platform_owner()
);

-- Add policy for platform owners to manage all restaurants
CREATE POLICY "Platform owners can manage all restaurants" 
ON public.restaurants 
FOR ALL 
USING (
  public.is_platform_owner()
);

-- Add similar policies for related tables that platform owners need access to

-- Staff members table
CREATE POLICY "Platform owners can view all staff members" 
ON public.staff_members 
FOR SELECT 
USING (
  public.is_platform_owner()
);

CREATE POLICY "Platform owners can manage all staff members" 
ON public.staff_members 
FOR ALL 
USING (
  public.is_platform_owner()
);

-- Orders table (for statistics)
CREATE POLICY "Platform owners can view all orders" 
ON public.orders 
FOR SELECT 
USING (
  public.is_platform_owner()
);

-- Restaurant tables (for statistics)
CREATE POLICY "Platform owners can view all restaurant tables" 
ON public.restaurant_tables 
FOR SELECT 
USING (
  public.is_platform_owner()
);

-- User restaurants association table
CREATE POLICY "Platform owners can view all user restaurant associations" 
ON public.user_restaurants 
FOR SELECT 
USING (
  public.is_platform_owner()
);

CREATE POLICY "Platform owners can manage all user restaurant associations" 
ON public.user_restaurants 
FOR ALL 
USING (
  public.is_platform_owner()
);

-- Grant execute permission on the function to authenticated users
GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION public.is_platform_owner() IS 'Securely checks if the current user is a platform owner (admin role)';