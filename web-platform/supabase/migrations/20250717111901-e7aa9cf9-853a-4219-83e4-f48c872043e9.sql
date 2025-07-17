-- Update RLS policies for loyalty programs to allow restaurant staff access
DROP POLICY IF EXISTS "Restaurant staff can manage loyalty programs" ON loyalty_programs;

CREATE POLICY "Restaurant staff can manage loyalty programs"
ON loyalty_programs
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM restaurants r
    LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = loyalty_programs.restaurant_id
    AND (
      r.owner_id = auth.uid() OR 
      (sm.user_id = auth.uid() AND sm.is_active = true)
    )
  )
);

-- Create staff invitations table for email workflow
CREATE TABLE IF NOT EXISTS public.staff_invitations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff',
  invited_by UUID NOT NULL,
  invitation_token UUID DEFAULT gen_random_uuid(),
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT (now() + interval '7 days'),
  accepted_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(restaurant_id, email)
);

-- Enable RLS on staff invitations
ALTER TABLE public.staff_invitations ENABLE ROW LEVEL SECURITY;

-- RLS policies for staff invitations
CREATE POLICY "Restaurant owners can manage invitations"
ON public.staff_invitations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM restaurants r 
    WHERE r.id = staff_invitations.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- Create a trigger for updated_at
CREATE TRIGGER update_staff_invitations_updated_at
  BEFORE UPDATE ON public.staff_invitations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add granular permissions to staff_members table
ALTER TABLE public.staff_members 
ADD COLUMN IF NOT EXISTS can_manage_loyalty BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_view_analytics BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_staff BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_menu BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS can_manage_orders BOOLEAN DEFAULT true;