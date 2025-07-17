-- Create subscription-based RLS policies for advanced features

-- Analytics policies (requires 'analytics' or 'advanced_analytics' feature)
CREATE POLICY "Analytics access requires subscription" 
ON public.restaurant_analytics 
FOR ALL 
USING (
  public.user_owns_restaurant(auth.uid(), restaurant_id) 
  AND (
    public.user_has_feature(auth.uid(), 'analytics') 
    OR public.user_has_feature(auth.uid(), 'advanced_analytics')
  )
);

-- Customer database policies (requires 'customer_database' feature)
CREATE POLICY "Customer data requires subscription" 
ON public.restaurant_customers 
FOR ALL 
USING (
  public.user_owns_restaurant(auth.uid(), restaurant_id) 
  AND public.user_has_feature(auth.uid(), 'customer_database')
);

-- Inventory policies (requires 'inventory_management' feature)
CREATE POLICY "Inventory requires subscription" 
ON public.inventory_items 
FOR ALL 
USING (
  public.user_owns_restaurant(auth.uid(), restaurant_id) 
  AND public.user_has_feature(auth.uid(), 'inventory_management')
);

-- Update existing staff_members policy to include subscription check
-- First drop the existing conflicting policy
DROP POLICY IF EXISTS "Restaurant owners can manage staff" ON public.staff_members;

-- Create new policy with subscription gating
CREATE POLICY "Staff management requires subscription" 
ON public.staff_members 
FOR ALL 
USING (
  (
    public.user_owns_restaurant(auth.uid(), restaurant_id) 
    AND public.user_has_feature(auth.uid(), 'staff_management')
  )
  OR user_id = auth.uid() -- Users can always view their own record
);