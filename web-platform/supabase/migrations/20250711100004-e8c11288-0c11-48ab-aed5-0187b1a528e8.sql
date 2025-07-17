-- Create example tables for advanced features that require subscription gating

-- Analytics data (requires 'analytics' or 'advanced_analytics' feature)
CREATE TABLE IF NOT EXISTS public.restaurant_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  total_revenue DECIMAL(10,2),
  order_count INTEGER,
  avg_order_value DECIMAL(10,2),
  peak_hours JSONB,
  popular_items JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Customer data (requires 'customer_database' feature)
CREATE TABLE IF NOT EXISTS public.restaurant_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  email TEXT,
  phone TEXT,
  name TEXT,
  preferences JSONB,
  order_history JSONB,
  loyalty_points INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inventory data (requires 'inventory_management' feature)
CREATE TABLE IF NOT EXISTS public.inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID REFERENCES restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sku TEXT,
  current_stock INTEGER DEFAULT 0,
  min_threshold INTEGER DEFAULT 0,
  unit_cost DECIMAL(10,2),
  supplier_info JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS on all new tables
ALTER TABLE public.restaurant_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_customers ENABLE ROLS_LEVEL SECURITY;
ALTER TABLE public.inventory_items ENABLE ROW LEVEL SECURITY;