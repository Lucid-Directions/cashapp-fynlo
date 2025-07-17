-- Create QR campaigns table for loyalty campaigns
CREATE TABLE public.qr_campaigns (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  campaign_type TEXT NOT NULL DEFAULT 'points_reward',
  qr_data JSONB NOT NULL DEFAULT '{}',
  reward_settings JSONB NOT NULL DEFAULT '{}',
  usage_limits JSONB DEFAULT '{"max_uses_per_customer": null, "total_max_uses": null, "daily_limit": null}',
  is_active BOOLEAN DEFAULT true,
  starts_at TIMESTAMP WITH TIME ZONE,
  expires_at TIMESTAMP WITH TIME ZONE,
  restaurant_id UUID NOT NULL,
  program_id UUID NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.qr_campaigns ENABLE ROW LEVEL SECURITY;

-- Create policies for QR campaigns
CREATE POLICY "Restaurant staff can manage QR campaigns" 
ON public.qr_campaigns 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM restaurants r
    LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = qr_campaigns.restaurant_id 
    AND (
      r.owner_id = auth.uid() 
      OR (sm.user_id = auth.uid() AND sm.is_active = true)
    )
  )
);

-- Create QR campaign usage tracking table
CREATE TABLE public.qr_campaign_usage (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  campaign_id UUID NOT NULL,
  customer_data_id UUID NOT NULL,
  claimed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  points_awarded INTEGER DEFAULT 0,
  reward_claimed JSONB,
  metadata JSONB DEFAULT '{}'
);

-- Enable RLS on usage tracking
ALTER TABLE public.qr_campaign_usage ENABLE ROW LEVEL SECURITY;

-- Create policy for usage tracking
CREATE POLICY "Restaurant staff can view campaign usage" 
ON public.qr_campaign_usage 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM qr_campaigns qc
    JOIN restaurants r ON r.id = qc.restaurant_id
    LEFT JOIN staff_members sm ON sm.restaurant_id = r.id
    WHERE qc.id = qr_campaign_usage.campaign_id 
    AND (
      r.owner_id = auth.uid() 
      OR (sm.user_id = auth.uid() AND sm.is_active = true)
    )
  )
);

-- Add foreign key constraints
ALTER TABLE public.qr_campaigns 
ADD CONSTRAINT qr_campaigns_restaurant_id_fkey 
FOREIGN KEY (restaurant_id) REFERENCES public.restaurants(id);

ALTER TABLE public.qr_campaigns 
ADD CONSTRAINT qr_campaigns_program_id_fkey 
FOREIGN KEY (program_id) REFERENCES public.loyalty_programs(id);

ALTER TABLE public.qr_campaign_usage 
ADD CONSTRAINT qr_campaign_usage_campaign_id_fkey 
FOREIGN KEY (campaign_id) REFERENCES public.qr_campaigns(id);

ALTER TABLE public.qr_campaign_usage 
ADD CONSTRAINT qr_campaign_usage_customer_data_id_fkey 
FOREIGN KEY (customer_data_id) REFERENCES public.loyalty_customer_data(id);

-- Create updated_at trigger for QR campaigns
CREATE TRIGGER update_qr_campaigns_updated_at
BEFORE UPDATE ON public.qr_campaigns
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();