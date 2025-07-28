-- Create staff schedules table
CREATE TABLE public.staff_schedules (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  staff_member_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6), -- 0 = Sunday, 6 = Saturday
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  break_start TIME,
  break_end TIME,
  is_recurring BOOLEAN DEFAULT true,
  specific_date DATE, -- For one-off schedules
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  CONSTRAINT valid_time_range CHECK (start_time < end_time),
  CONSTRAINT valid_break_time CHECK (
    (break_start IS NULL AND break_end IS NULL) OR 
    (break_start IS NOT NULL AND break_end IS NOT NULL AND break_start < break_end AND break_start >= start_time AND break_end <= end_time)
  )
);

-- Create loyalty programs table
CREATE TABLE public.loyalty_programs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  program_type TEXT NOT NULL CHECK (program_type IN ('points', 'visits', 'spending', 'tiered')),
  is_active BOOLEAN DEFAULT true,
  start_date DATE,
  end_date DATE,
  
  -- Points-based settings
  points_per_dollar NUMERIC(5,2) DEFAULT 1.00,
  dollar_value_per_point NUMERIC(5,4) DEFAULT 0.01,
  
  -- Visit-based settings
  visits_required INTEGER,
  reward_after_visits INTEGER,
  
  -- Spending-based settings
  spending_threshold NUMERIC(10,2),
  spending_reward_type TEXT CHECK (spending_reward_type IN ('percentage', 'fixed_amount', 'free_item')),
  spending_reward_value NUMERIC(10,2),
  
  -- Tiered settings
  tier_thresholds JSONB DEFAULT '[]'::jsonb,
  tier_benefits JSONB DEFAULT '[]'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create loyalty campaigns table
CREATE TABLE public.loyalty_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL,
  loyalty_program_id UUID,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('double_points', 'bonus_visit', 'happy_hour', 'birthday', 'referral', 'social_media', 'first_visit', 'seasonal')),
  
  -- Campaign settings
  multiplier NUMERIC(5,2) DEFAULT 1.0, -- For double/triple points
  bonus_points INTEGER DEFAULT 0,
  bonus_visits INTEGER DEFAULT 0,
  discount_percentage NUMERIC(5,2),
  discount_amount NUMERIC(10,2),
  free_item_menu_item_id UUID,
  
  -- Timing
  start_date DATE NOT NULL,
  end_date DATE,
  days_of_week INTEGER[] DEFAULT '{0,1,2,3,4,5,6}', -- 0-6 for Sun-Sat
  start_time TIME,
  end_time TIME,
  
  -- Conditions
  min_purchase_amount NUMERIC(10,2),
  max_uses_per_customer INTEGER,
  max_total_uses INTEGER,
  current_uses INTEGER DEFAULT 0,
  
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create customer loyalty tracking table
CREATE TABLE public.customer_loyalty (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  customer_id UUID NOT NULL,
  restaurant_id UUID NOT NULL,
  loyalty_program_id UUID NOT NULL,
  
  -- Points tracking
  total_points_earned INTEGER DEFAULT 0,
  total_points_redeemed INTEGER DEFAULT 0,
  current_points INTEGER DEFAULT 0,
  
  -- Visits tracking
  total_visits INTEGER DEFAULT 0,
  current_visit_streak INTEGER DEFAULT 0,
  
  -- Spending tracking
  total_spending NUMERIC(12,2) DEFAULT 0.00,
  current_tier_spending NUMERIC(12,2) DEFAULT 0.00,
  
  -- Tier information
  current_tier TEXT DEFAULT 'bronze',
  tier_progress NUMERIC(5,2) DEFAULT 0.00,
  
  last_visit_date DATE,
  enrollment_date DATE DEFAULT CURRENT_DATE,
  is_active BOOLEAN DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(customer_id, restaurant_id, loyalty_program_id)
);

-- Enable Row Level Security
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;

-- Create policies for staff schedules
CREATE POLICY "Staff can view schedules for their restaurant" 
ON public.staff_schedules 
FOR SELECT 
USING (EXISTS (
  SELECT 1 FROM restaurants r
  LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
  WHERE r.id = staff_schedules.restaurant_id 
  AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
));

CREATE POLICY "Staff can manage schedules for their restaurant" 
ON public.staff_schedules 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM restaurants r
  LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
  WHERE r.id = staff_schedules.restaurant_id 
  AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
));

-- Create policies for loyalty programs
CREATE POLICY "Staff can manage loyalty programs" 
ON public.loyalty_programs 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM restaurants r
  LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
  WHERE r.id = loyalty_programs.restaurant_id 
  AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
));

-- Create policies for loyalty campaigns
CREATE POLICY "Staff can manage loyalty campaigns" 
ON public.loyalty_campaigns 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM restaurants r
  LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
  WHERE r.id = loyalty_campaigns.restaurant_id 
  AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
));

-- Create policies for customer loyalty
CREATE POLICY "Staff can view customer loyalty data" 
ON public.customer_loyalty 
FOR ALL 
USING (EXISTS (
  SELECT 1 FROM restaurants r
  LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
  WHERE r.id = customer_loyalty.restaurant_id 
  AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
));

-- Create foreign key relationships
ALTER TABLE public.staff_schedules 
  ADD CONSTRAINT staff_schedules_staff_member_id_fkey 
  FOREIGN KEY (staff_member_id) REFERENCES public.staff_members(id) ON DELETE CASCADE;

ALTER TABLE public.staff_schedules 
  ADD CONSTRAINT staff_schedules_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.loyalty_programs 
  ADD CONSTRAINT loyalty_programs_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.loyalty_campaigns 
  ADD CONSTRAINT loyalty_campaigns_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.loyalty_campaigns 
  ADD CONSTRAINT loyalty_campaigns_loyalty_program_id_fkey 
  FOREIGN KEY (loyalty_program_id) REFERENCES public.loyalty_programs(id) ON DELETE CASCADE;

ALTER TABLE public.loyalty_campaigns 
  ADD CONSTRAINT loyalty_campaigns_free_item_menu_item_id_fkey 
  FOREIGN KEY (free_item_menu_item_id) REFERENCES public.menu_items(id) ON DELETE SET NULL;

ALTER TABLE public.customer_loyalty 
  ADD CONSTRAINT customer_loyalty_customer_id_fkey 
  FOREIGN KEY (customer_id) REFERENCES public.restaurant_customers(id) ON DELETE CASCADE;

ALTER TABLE public.customer_loyalty 
  ADD CONSTRAINT customer_loyalty_restaurant_id_fkey 
  FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id) ON DELETE CASCADE;

ALTER TABLE public.customer_loyalty 
  ADD CONSTRAINT customer_loyalty_loyalty_program_id_fkey 
  FOREIGN KEY (loyalty_program_id) REFERENCES public.loyalty_programs(id) ON DELETE CASCADE;

-- Create indexes for better performance
CREATE INDEX idx_staff_schedules_restaurant_staff ON public.staff_schedules(restaurant_id, staff_member_id);
CREATE INDEX idx_staff_schedules_day_time ON public.staff_schedules(day_of_week, start_time);
CREATE INDEX idx_loyalty_programs_restaurant ON public.loyalty_programs(restaurant_id);
CREATE INDEX idx_loyalty_campaigns_restaurant_program ON public.loyalty_campaigns(restaurant_id, loyalty_program_id);
CREATE INDEX idx_customer_loyalty_restaurant_customer ON public.customer_loyalty(restaurant_id, customer_id);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_staff_schedules_updated_at
  BEFORE UPDATE ON public.staff_schedules
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_programs_updated_at
  BEFORE UPDATE ON public.loyalty_programs
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_campaigns_updated_at
  BEFORE UPDATE ON public.loyalty_campaigns
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_customer_loyalty_updated_at
  BEFORE UPDATE ON public.customer_loyalty
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();