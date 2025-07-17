-- Fix critical RLS policy for profiles table
DROP POLICY IF EXISTS "Users can view all profiles" ON public.profiles;

-- Create restrictive policy - users can only view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Add missing UPDATE and DELETE policies for user_roles table
CREATE POLICY "Users can update their own roles" 
ON public.user_roles 
FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own roles" 
ON public.user_roles 
FOR DELETE 
USING (auth.uid() = user_id);