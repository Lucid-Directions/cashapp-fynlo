-- Create analytics tables for loyalty programs
CREATE TABLE IF NOT EXISTS public.loyalty_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  
  -- Customer metrics
  total_members INTEGER DEFAULT 0,
  new_members INTEGER DEFAULT 0,
  active_members INTEGER DEFAULT 0,
  churned_members INTEGER DEFAULT 0,
  
  -- Transaction metrics  
  total_transactions INTEGER DEFAULT 0,
  total_revenue DECIMAL(10,2) DEFAULT 0,
  points_earned INTEGER DEFAULT 0,
  points_redeemed INTEGER DEFAULT 0,
  rewards_claimed INTEGER DEFAULT 0,
  
  -- Engagement metrics
  avg_transaction_value DECIMAL(10,2) DEFAULT 0,
  repeat_purchase_rate DECIMAL(5,2) DEFAULT 0,
  referrals_generated INTEGER DEFAULT 0,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create A/B testing tables
CREATE TABLE IF NOT EXISTS public.loyalty_ab_tests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  
  -- Test configuration
  test_type TEXT NOT NULL DEFAULT 'program_variant', -- 'program_variant', 'reward_structure', 'communication'
  status TEXT NOT NULL DEFAULT 'draft', -- 'draft', 'active', 'paused', 'completed'
  
  -- Test parameters
  control_settings JSONB NOT NULL DEFAULT '{}',
  variant_settings JSONB NOT NULL DEFAULT '{}',
  traffic_split INTEGER NOT NULL DEFAULT 50, -- percentage for variant
  
  -- Test dates
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  
  -- Success metrics
  primary_metric TEXT NOT NULL DEFAULT 'revenue',
  secondary_metrics TEXT[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create A/B test assignments table
CREATE TABLE IF NOT EXISTS public.loyalty_ab_assignments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  test_id UUID NOT NULL REFERENCES loyalty_ab_tests(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL, -- customer identifier (email hash or ID)
  variant TEXT NOT NULL DEFAULT 'control', -- 'control' or 'variant'
  
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(test_id, customer_id)
);

-- Create customer loyalty tracking table
CREATE TABLE IF NOT EXISTS public.loyalty_customer_data (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Customer identifiers
  customer_email TEXT,
  customer_phone TEXT,
  customer_hash TEXT, -- hashed identifier for privacy
  
  -- Loyalty metrics
  current_points INTEGER DEFAULT 0,
  lifetime_points INTEGER DEFAULT 0,
  total_spent DECIMAL(10,2) DEFAULT 0,
  visit_count INTEGER DEFAULT 0,
  tier_level TEXT DEFAULT 'bronze',
  
  -- Engagement data
  last_activity TIMESTAMP WITH TIME ZONE,
  last_purchase TIMESTAMP WITH TIME ZONE,
  referrals_made INTEGER DEFAULT 0,
  reviews_left INTEGER DEFAULT 0,
  
  -- A/B test data
  ab_test_variants JSONB DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  
  UNIQUE(program_id, customer_email),
  UNIQUE(program_id, customer_hash)
);

-- Create loyalty transactions table for detailed tracking
CREATE TABLE IF NOT EXISTS public.loyalty_transactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  customer_data_id UUID NOT NULL REFERENCES loyalty_customer_data(id) ON DELETE CASCADE,
  
  -- Transaction details
  transaction_type TEXT NOT NULL, -- 'earn', 'redeem', 'expire', 'bonus'
  points_change INTEGER NOT NULL,
  points_balance INTEGER NOT NULL,
  
  -- Context
  order_amount DECIMAL(10,2),
  order_id TEXT,
  reason TEXT,
  rule_id TEXT, -- which rule triggered this
  
  -- A/B test context
  ab_test_id UUID REFERENCES loyalty_ab_tests(id),
  variant TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create integration webhooks table
CREATE TABLE IF NOT EXISTS public.loyalty_integrations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID NOT NULL REFERENCES loyalty_programs(id) ON DELETE CASCADE,
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  
  -- Integration config
  integration_type TEXT NOT NULL, -- 'pos', 'ecommerce', 'crm', 'marketing'
  provider TEXT NOT NULL, -- 'square', 'shopify', 'mailchimp', etc.
  
  -- Webhook/API configuration
  webhook_url TEXT,
  api_key TEXT,
  settings JSONB DEFAULT '{}',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  last_sync TIMESTAMP WITH TIME ZONE,
  sync_status TEXT DEFAULT 'pending', -- 'pending', 'success', 'error'
  error_log TEXT,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_analytics_program_date ON loyalty_analytics(program_id, date);
CREATE INDEX IF NOT EXISTS idx_loyalty_analytics_restaurant_date ON loyalty_analytics(restaurant_id, date);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_data_program ON loyalty_customer_data(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_customer_data_email ON loyalty_customer_data(customer_email);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_program ON loyalty_transactions(program_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_customer ON loyalty_transactions(customer_data_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_ab_assignments_test ON loyalty_ab_assignments(test_id);

-- Enable RLS
ALTER TABLE loyalty_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ab_tests ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_ab_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_customer_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE loyalty_integrations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Program owners can manage analytics" 
ON loyalty_analytics FOR ALL 
USING (EXISTS (
  SELECT 1 FROM loyalty_programs lp 
  JOIN restaurants r ON r.id = lp.restaurant_id 
  WHERE lp.id = program_id AND r.owner_id = auth.uid()
));

CREATE POLICY "Program owners can manage A/B tests" 
ON loyalty_ab_tests FOR ALL 
USING (EXISTS (
  SELECT 1 FROM loyalty_programs lp 
  JOIN restaurants r ON r.id = lp.restaurant_id 
  WHERE lp.id = program_id AND r.owner_id = auth.uid()
));

CREATE POLICY "Program owners can view A/B assignments" 
ON loyalty_ab_assignments FOR ALL 
USING (EXISTS (
  SELECT 1 FROM loyalty_ab_tests lat
  JOIN loyalty_programs lp ON lp.id = lat.program_id
  JOIN restaurants r ON r.id = lp.restaurant_id 
  WHERE lat.id = test_id AND r.owner_id = auth.uid()
));

CREATE POLICY "Program owners can manage customer data" 
ON loyalty_customer_data FOR ALL 
USING (EXISTS (
  SELECT 1 FROM loyalty_programs lp 
  JOIN restaurants r ON r.id = lp.restaurant_id 
  WHERE lp.id = program_id AND r.owner_id = auth.uid()
));

CREATE POLICY "Program owners can view transactions" 
ON loyalty_transactions FOR ALL 
USING (EXISTS (
  SELECT 1 FROM loyalty_programs lp 
  JOIN restaurants r ON r.id = lp.restaurant_id 
  WHERE lp.id = program_id AND r.owner_id = auth.uid()
));

CREATE POLICY "Program owners can manage integrations" 
ON loyalty_integrations FOR ALL 
USING (EXISTS (
  SELECT 1 FROM loyalty_programs lp 
  JOIN restaurants r ON r.id = lp.restaurant_id 
  WHERE lp.id = program_id AND r.owner_id = auth.uid()
));

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_loyalty_analytics_updated_at
BEFORE UPDATE ON loyalty_analytics
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_ab_tests_updated_at
BEFORE UPDATE ON loyalty_ab_tests
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_customer_data_updated_at
BEFORE UPDATE ON loyalty_customer_data
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_loyalty_integrations_updated_at
BEFORE UPDATE ON loyalty_integrations
FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();