-- Create table for platform configuration settings
CREATE TABLE public.platform_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.platform_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for platform owners to manage settings
CREATE POLICY "Platform owners can manage settings" 
ON public.platform_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.user_subscriptions us 
    WHERE us.user_id = auth.uid() 
    AND us.is_platform_owner = true
  )
);

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_platform_settings_updated_at
BEFORE UPDATE ON public.platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default platform configuration
INSERT INTO public.platform_settings (setting_key, setting_value) VALUES 
('payment_config', '{
  "sumup_app_id": "",
  "sumup_app_secret": "",
  "platform_commission_rate": 0.01,
  "subscription_plans": [
    {
      "id": "alpha",
      "name": "Alpha (FREE)",
      "price": 0,
      "features": ["Basic POS", "Order Management", "Basic Reports"],
      "sumup_product_id": ""
    },
    {
      "id": "beta", 
      "name": "Beta",
      "price": 49,
      "features": ["Everything in Alpha", "Inventory Management", "Staff Management", "Advanced Analytics"],
      "sumup_product_id": ""
    },
    {
      "id": "omega",
      "name": "Omega", 
      "price": 119,
      "features": ["Everything in Beta", "Multi-location", "API Access", "Custom Integrations", "Priority Support"],
      "sumup_product_id": ""
    }
  ]
}');