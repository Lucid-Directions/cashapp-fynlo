-- Fix RLS policies that cause infinite recursion

-- Drop the problematic policy that references restaurants in a recursive way
DROP POLICY IF EXISTS "Users can view restaurants they have access to" ON restaurants;

-- Create a simpler, non-recursive policy for restaurants
CREATE POLICY "Users can view restaurants they own or work at" 
ON restaurants 
FOR SELECT 
USING (
  owner_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM user_restaurants ur 
    WHERE ur.restaurant_id = restaurants.id 
    AND ur.user_id = auth.uid() 
    AND ur.is_active = true
  )
);

-- Also update the staff_members policy to be more direct
DROP POLICY IF EXISTS "Restaurant owners can manage staff" ON staff_members;

CREATE POLICY "Restaurant owners and managers can manage staff" 
ON staff_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = staff_members.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- Fix the update policy for restaurants to be simpler
DROP POLICY IF EXISTS "Restaurant owners can update their restaurants" ON restaurants;

CREATE POLICY "Restaurant owners can update their restaurants" 
ON restaurants 
FOR UPDATE 
USING (owner_id = auth.uid());