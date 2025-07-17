-- Create user_restaurants association table for proper security
CREATE TABLE public.user_restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'staff',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, restaurant_id)
);

-- Enable RLS
ALTER TABLE public.user_restaurants ENABLE ROW LEVEL SECURITY;

-- Create policies for user_restaurants
CREATE POLICY "Users can view their own restaurant associations" 
ON public.user_restaurants 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Restaurant owners can manage staff associations" 
ON public.user_restaurants 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = user_restaurants.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_user_restaurants_updated_at
BEFORE UPDATE ON public.user_restaurants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create security definer function to get user's restaurant ID
CREATE OR REPLACE FUNCTION public.get_user_restaurant_id(_user_id UUID)
RETURNS UUID
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = ''
AS $$
  SELECT restaurant_id
  FROM public.user_restaurants
  WHERE user_id = _user_id
  AND is_active = true
  LIMIT 1
$$;

-- Create function to check if user has access to restaurant
CREATE OR REPLACE FUNCTION public.user_has_restaurant_access(_user_id UUID, _restaurant_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE SECURITY DEFINER
SET search_path = ''
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