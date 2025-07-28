-- Fix the infinite recursion in restaurants RLS policies completely
-- Drop all existing policies on restaurants first
DROP POLICY IF EXISTS "Users can view restaurants they own or work at" ON restaurants;
DROP POLICY IF EXISTS "Restaurant owners can update their restaurants" ON restaurants;
DROP POLICY IF EXISTS "Users can create restaurants" ON restaurants;

-- Create simple, non-recursive policies for restaurants
CREATE POLICY "Owners can view their restaurants" 
ON restaurants 
FOR SELECT 
USING (owner_id = auth.uid());

CREATE POLICY "Owners can update their restaurants" 
ON restaurants 
FOR UPDATE 
USING (owner_id = auth.uid());

CREATE POLICY "Users can create restaurants" 
ON restaurants 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

-- Fix staff_members policies to avoid recursion
DROP POLICY IF EXISTS "Restaurant owners and managers can manage staff" ON staff_members;

CREATE POLICY "Restaurant owners can manage staff" 
ON staff_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = staff_members.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);