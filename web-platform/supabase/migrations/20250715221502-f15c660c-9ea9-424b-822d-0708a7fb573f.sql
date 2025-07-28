-- Create staff schedules table
CREATE TABLE public.staff_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_member_id UUID NOT NULL REFERENCES public.staff_members(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  shift_date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  role_assigned TEXT,
  notes TEXT,
  status TEXT DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'confirmed', 'cancelled', 'completed')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create loyalty programs table
CREATE TABLE public.loyalty_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  program_type TEXT NOT NULL CHECK (program_type IN ('points', 'visits', 'amount_spent', 'tier')),
  is_active BOOLEAN DEFAULT true,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create loyalty campaigns table
CREATE TABLE public.loyalty_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL CHECK (campaign_type IN ('birthday', 'welcome', 'milestone', 'seasonal', 'referral', 'double_points', 'bonus_visits')),
  reward_type TEXT NOT NULL CHECK (reward_type IN ('discount_percentage', 'discount_fixed', 'free_item', 'points_bonus', 'tier_upgrade')),
  reward_value DECIMAL(10,2),
  conditions JSONB DEFAULT '{}',
  start_date DATE,
  end_date DATE,
  is_active BOOLEAN DEFAULT true,
  usage_limit INTEGER,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create customer loyalty data table
CREATE TABLE public.customer_loyalty (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id UUID NOT NULL REFERENCES public.restaurant_customers(id) ON DELETE CASCADE,
  program_id UUID NOT NULL REFERENCES public.loyalty_programs(id) ON DELETE CASCADE,
  points_balance INTEGER DEFAULT 0,
  visits_count INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  tier_level TEXT DEFAULT 'bronze',
  last_activity_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(customer_id, program_id)
);

-- Create schedule templates table for recurring schedules
CREATE TABLE public.schedule_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  template_data JSONB NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_loyalty ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_templates ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staff schedules
CREATE POLICY "Staff can view their own schedules"
ON public.staff_schedules
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.staff_members sm
    WHERE sm.id = staff_schedules.staff_member_id
    AND sm.user_id = auth.uid()
  )
);

CREATE POLICY "Restaurant staff can manage schedules"
ON public.staff_schedules
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = staff_schedules.restaurant_id
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

-- Create RLS policies for loyalty programs
CREATE POLICY "Restaurant staff can manage loyalty programs"
ON public.loyalty_programs
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = loyalty_programs.restaurant_id
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

-- Create RLS policies for loyalty campaigns
CREATE POLICY "Restaurant staff can manage loyalty campaigns"
ON public.loyalty_campaigns
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.loyalty_programs lp
    JOIN public.restaurants r ON r.id = lp.restaurant_id
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE lp.id = loyalty_campaigns.program_id
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

-- Create RLS policies for customer loyalty
CREATE POLICY "Restaurant staff can manage customer loyalty"
ON public.customer_loyalty
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.loyalty_programs lp
    JOIN public.restaurants r ON r.id = lp.restaurant_id
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE lp.id = customer_loyalty.program_id
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

-- Create RLS policies for schedule templates
CREATE POLICY "Restaurant staff can manage schedule templates"
ON public.schedule_templates
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = schedule_templates.restaurant_id
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

-- Create indexes for better performance
CREATE INDEX idx_staff_schedules_date ON public.staff_schedules(shift_date);
CREATE INDEX idx_staff_schedules_staff_member ON public.staff_schedules(staff_member_id);
CREATE INDEX idx_loyalty_programs_restaurant ON public.loyalty_programs(restaurant_id);
CREATE INDEX idx_loyalty_campaigns_program ON public.loyalty_campaigns(program_id);
CREATE INDEX idx_customer_loyalty_customer ON public.customer_loyalty(customer_id);
CREATE INDEX idx_customer_loyalty_program ON public.customer_loyalty(program_id);

-- Create triggers for updated_at timestamps
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

CREATE TRIGGER update_schedule_templates_updated_at
BEFORE UPDATE ON public.schedule_templates
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();