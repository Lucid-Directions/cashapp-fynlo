-- Create table for restaurant bank details (encrypted/secure storage)
CREATE TABLE public.restaurant_bank_details (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  account_holder_name TEXT,
  bank_name TEXT,
  account_number TEXT, -- Should be encrypted in production
  sort_code TEXT,
  swift_code TEXT,
  iban TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Enable Row Level Security
ALTER TABLE public.restaurant_bank_details ENABLE ROW LEVEL SECURITY;

-- Create policy for restaurant owners to manage their bank details
CREATE POLICY "Restaurant owners can manage bank details" 
ON public.restaurant_bank_details 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r 
    WHERE r.id = restaurant_bank_details.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_restaurant_bank_details_updated_at
BEFORE UPDATE ON public.restaurant_bank_details
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add additional platform settings to platform_settings table
INSERT INTO public.platform_settings (setting_key, setting_value) VALUES 
('api_keys', '{
  "sumupPlatformApiKey": "",
  "sumupRestaurantApiKey": ""
}'),
('payment_methods', '{
  "card": true,
  "cash": true,
  "digital_wallet": false,
  "bank_transfer": false
}'),
('system_settings', '{
  "auto_backup": true,
  "email_notifications": true,
  "sms_notifications": false,
  "maintenance_mode": false
}')
ON CONFLICT (setting_key) DO NOTHING;