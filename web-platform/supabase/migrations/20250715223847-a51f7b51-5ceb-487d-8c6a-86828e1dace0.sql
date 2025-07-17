-- Drop existing tables that don't match our interface
DROP TABLE IF EXISTS public.staff_schedules CASCADE;
DROP TABLE IF EXISTS public.loyalty_programs CASCADE;
DROP TABLE IF EXISTS public.loyalty_campaigns CASCADE;
DROP TABLE IF EXISTS public.customer_loyalty CASCADE;
DROP TABLE IF EXISTS public.schedule_templates CASCADE;

-- Create staff schedules table with correct structure
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

-- Create loyalty programs table with correct structure
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

-- Enable RLS and create policies
ALTER TABLE public.staff_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.loyalty_programs ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for staff schedules
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

-- Create indexes for better performance
CREATE INDEX idx_staff_schedules_date ON public.staff_schedules(shift_date);
CREATE INDEX idx_staff_schedules_staff_member ON public.staff_schedules(staff_member_id);
CREATE INDEX idx_loyalty_programs_restaurant ON public.loyalty_programs(restaurant_id);

-- Create triggers for updated_at timestamps
CREATE TRIGGER update_staff_schedules_updated_at
BEFORE UPDATE ON public.staff_schedules
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_loyalty_programs_updated_at
BEFORE UPDATE ON public.loyalty_programs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();