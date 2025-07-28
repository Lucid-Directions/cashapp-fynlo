-- Fix the RLS enabling and create subscription-based policies

-- Enable RLS correctly on all tables
ALTER TABLE public.restaurant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;

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

-- Also add subscription checks to staff management
-- Only users with 'staff_management' feature can access advanced staff features
CREATE POLICY "Advanced staff features require subscription" 
ON public.staff_members 
FOR ALL 
USING (
  (
    public.user_owns_restaurant(auth.uid(), restaurant_id) 
    AND public.user_has_feature(auth.uid(), 'staff_management')
  )
  OR user_id = auth.uid() -- Users can always view their own record
);