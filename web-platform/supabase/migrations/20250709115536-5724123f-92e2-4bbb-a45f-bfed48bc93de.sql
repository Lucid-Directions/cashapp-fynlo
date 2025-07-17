-- Create restaurants table
CREATE TABLE public.restaurants (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  slug TEXT UNIQUE NOT NULL,
  description TEXT,
  address TEXT,
  phone TEXT,
  email TEXT,
  timezone TEXT DEFAULT 'UTC',
  currency TEXT DEFAULT 'GBP',
  logo_url TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create restaurant_settings table
CREATE TABLE public.restaurant_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  tax_rate DECIMAL(5,4) DEFAULT 0.20,
  service_charge DECIMAL(5,4) DEFAULT 0.00,
  opening_hours JSONB DEFAULT '{}',
  business_days JSONB DEFAULT '[]',
  auto_accept_orders BOOLEAN DEFAULT false,
  payment_methods JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id)
);

-- Create menu_categories table
CREATE TABLE public.menu_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_items table
CREATE TABLE public.menu_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price DECIMAL(10,2) NOT NULL,
  cost DECIMAL(10,2) DEFAULT 0,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  is_featured BOOLEAN DEFAULT false,
  allergens TEXT[],
  tags TEXT[],
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_modifiers table
CREATE TABLE public.menu_modifiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('single', 'multiple')),
  is_required BOOLEAN DEFAULT false,
  max_selections INTEGER,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create modifier_options table
CREATE TABLE public.modifier_options (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  modifier_id UUID NOT NULL REFERENCES public.menu_modifiers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price_adjustment DECIMAL(10,2) DEFAULT 0,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create menu_item_modifiers junction table
CREATE TABLE public.menu_item_modifiers (
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  modifier_id UUID NOT NULL REFERENCES public.menu_modifiers(id) ON DELETE CASCADE,
  PRIMARY KEY (menu_item_id, modifier_id)
);

-- Create tables table for restaurant floor plan
CREATE TABLE public.restaurant_tables (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_number TEXT NOT NULL,
  section TEXT,
  capacity INTEGER NOT NULL DEFAULT 2,
  position_x INTEGER DEFAULT 0,
  position_y INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  qr_code_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, table_number)
);

-- Create orders table
CREATE TABLE public.orders (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  table_id UUID REFERENCES public.restaurant_tables(id) ON DELETE SET NULL,
  order_number TEXT NOT NULL,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'preparing', 'ready', 'delivered', 'cancelled')),
  order_type TEXT NOT NULL DEFAULT 'dine_in' CHECK (order_type IN ('dine_in', 'takeaway', 'delivery')),
  subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
  tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  service_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
  total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
  notes TEXT,
  special_instructions TEXT,
  estimated_ready_time TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create order_items table
CREATE TABLE public.order_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  menu_item_id UUID NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
  quantity INTEGER NOT NULL DEFAULT 1,
  unit_price DECIMAL(10,2) NOT NULL,
  total_price DECIMAL(10,2) NOT NULL,
  modifiers JSONB DEFAULT '[]',
  special_instructions TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'preparing', 'ready', 'served')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create payments table
CREATE TABLE public.payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  order_id UUID NOT NULL REFERENCES public.orders(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card', 'apple_pay', 'google_pay', 'sumup', 'square', 'stripe')),
  payment_status TEXT NOT NULL DEFAULT 'pending' CHECK (payment_status IN ('pending', 'processing', 'completed', 'failed', 'refunded')),
  transaction_id TEXT,
  provider_reference TEXT,
  metadata JSONB DEFAULT '{}',
  processed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create staff_members table for restaurant user management
CREATE TABLE public.staff_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  restaurant_id UUID NOT NULL REFERENCES public.restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'staff' CHECK (role IN ('owner', 'manager', 'staff', 'chef')),
  permissions JSONB DEFAULT '[]',
  hourly_rate DECIMAL(10,2),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(restaurant_id, user_id)
);

-- Enable Row Level Security
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.modifier_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_item_modifiers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurant_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.staff_members ENABLE ROW LEVEL SECURITY;

-- Create policies for restaurants
CREATE POLICY "Users can view restaurants they have access to" 
ON public.restaurants 
FOR SELECT 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.staff_members 
    WHERE restaurant_id = restaurants.id AND user_id = auth.uid() AND is_active = true
  )
);

CREATE POLICY "Users can create restaurants" 
ON public.restaurants 
FOR INSERT 
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Restaurant owners can update their restaurants" 
ON public.restaurants 
FOR UPDATE 
USING (
  owner_id = auth.uid() OR 
  EXISTS (
    SELECT 1 FROM public.staff_members 
    WHERE restaurant_id = restaurants.id AND user_id = auth.uid() AND role IN ('owner', 'manager') AND is_active = true
  )
);

-- Create similar policies for other tables (staff can access their restaurant's data)
CREATE POLICY "Staff can view restaurant settings" 
ON public.restaurant_settings 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = restaurant_settings.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage menu categories" 
ON public.menu_categories 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = menu_categories.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage menu items" 
ON public.menu_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = menu_items.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage modifiers" 
ON public.menu_modifiers 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = menu_modifiers.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can view modifier options" 
ON public.modifier_options 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.menu_modifiers mm
    INNER JOIN public.restaurants r ON r.id = mm.restaurant_id
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE mm.id = modifier_options.modifier_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage tables" 
ON public.restaurant_tables 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = restaurant_tables.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage orders" 
ON public.orders 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = orders.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage order items" 
ON public.order_items 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.orders o
    INNER JOIN public.restaurants r ON r.id = o.restaurant_id
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE o.id = order_items.order_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Staff can manage payments" 
ON public.payments 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    LEFT JOIN public.staff_members sm ON sm.restaurant_id = r.id
    WHERE r.id = payments.restaurant_id 
    AND (r.owner_id = auth.uid() OR (sm.user_id = auth.uid() AND sm.is_active = true))
  )
);

CREATE POLICY "Restaurant owners can manage staff" 
ON public.staff_members 
FOR ALL 
USING (
  EXISTS (
    SELECT 1 FROM public.restaurants r
    WHERE r.id = staff_members.restaurant_id 
    AND r.owner_id = auth.uid()
  )
);

CREATE POLICY "Staff can view themselves" 
ON public.staff_members 
FOR SELECT 
USING (user_id = auth.uid());

-- Create triggers for automatic timestamp updates
CREATE TRIGGER update_restaurants_updated_at
BEFORE UPDATE ON public.restaurants
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_settings_updated_at
BEFORE UPDATE ON public.restaurant_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_categories_updated_at
BEFORE UPDATE ON public.menu_categories
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_items_updated_at
BEFORE UPDATE ON public.menu_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_menu_modifiers_updated_at
BEFORE UPDATE ON public.menu_modifiers
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_restaurant_tables_updated_at
BEFORE UPDATE ON public.restaurant_tables
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_order_items_updated_at
BEFORE UPDATE ON public.order_items
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_payments_updated_at
BEFORE UPDATE ON public.payments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_staff_members_updated_at
BEFORE UPDATE ON public.staff_members
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create indexes for better performance
CREATE INDEX idx_restaurants_owner_id ON public.restaurants(owner_id);
CREATE INDEX idx_menu_items_restaurant_id ON public.menu_items(restaurant_id);
CREATE INDEX idx_menu_items_category_id ON public.menu_items(category_id);
CREATE INDEX idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_orders_created_at ON public.orders(created_at);
CREATE INDEX idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX idx_payments_restaurant_id ON public.payments(restaurant_id);
CREATE INDEX idx_payments_order_id ON public.payments(order_id);
CREATE INDEX idx_staff_members_restaurant_id ON public.staff_members(restaurant_id);
CREATE INDEX idx_staff_members_user_id ON public.staff_members(user_id);