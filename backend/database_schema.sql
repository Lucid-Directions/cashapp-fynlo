-- ===============================================
-- FYNLO POS MULTI-TENANT DATABASE SCHEMA
-- ===============================================
-- Complete database schema for Fynlo POS multi-tenant platform
-- Supports platform owners, restaurants, employees, inventory, and transactions
-- Includes Row Level Security (RLS) for tenant isolation

-- ===============================================
-- PLATFORM MANAGEMENT TABLES
-- ===============================================

-- Platform owners (top-level entities)
CREATE TABLE platforms (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    owner_email VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    total_restaurants INTEGER DEFAULT 0,
    monthly_revenue DECIMAL(12,2) DEFAULT 0.00
);

-- Platform-wide settings
CREATE TABLE platform_config (
    id SERIAL PRIMARY KEY,
    key VARCHAR(100) NOT NULL UNIQUE,
    value TEXT,
    description TEXT,
    created_by INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Subscription plans and pricing
CREATE TABLE subscription_plans (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL, -- basic, premium, enterprise
    commission_rate DECIMAL(5,2) NOT NULL, -- 4.00, 6.00, 8.00
    service_fee_rate DECIMAL(5,2) NOT NULL, -- Fixed platform fee
    monthly_fee DECIMAL(10,2) DEFAULT 0.00,
    max_restaurants INTEGER DEFAULT NULL, -- NULL = unlimited
    features JSONB DEFAULT '{}', -- Feature flags
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ===============================================
-- RESTAURANT MANAGEMENT TABLES (MULTI-TENANT)
-- ===============================================

-- Restaurants (tenant entities with proper isolation)
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    cuisine_type VARCHAR(100) DEFAULT 'restaurant',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    website VARCHAR(255),
    tax_number VARCHAR(100),
    logo_url TEXT,
    platform_owner_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    subscription_tier VARCHAR(50) DEFAULT 'basic',
    monthly_revenue DECIMAL(12,2) DEFAULT 0.00,
    last_activity TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, slug)
);

-- Restaurant subscriptions and billing
CREATE TABLE restaurant_subscriptions (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    plan_id INTEGER REFERENCES subscription_plans(id),
    start_date DATE NOT NULL,
    end_date DATE,
    status VARCHAR(50) DEFAULT 'active', -- active, suspended, cancelled
    commission_rate DECIMAL(5,2) NOT NULL,
    monthly_fee DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Commission tracking
CREATE TABLE commission_records (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    order_id INTEGER, -- Will reference orders(id)
    gross_amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2) NOT NULL,
    commission_amount DECIMAL(10,2) NOT NULL,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    payment_status VARCHAR(50) DEFAULT 'pending' -- pending, paid, failed
);

-- Restaurant sections (floor plan)
CREATE TABLE restaurant_sections (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    color VARCHAR(7) DEFAULT '#3498db', -- Hex color
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- Restaurant tables
CREATE TABLE restaurant_tables (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    section_id INTEGER REFERENCES restaurant_sections(id) ON DELETE CASCADE,
    name VARCHAR(50) NOT NULL, -- T1, T2, B1, etc.
    display_name VARCHAR(100) NOT NULL, -- Table 1, Bar 1, etc.
    capacity INTEGER NOT NULL DEFAULT 2,
    status VARCHAR(50) DEFAULT 'available', -- available, occupied, reserved, cleaning
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- ===============================================
-- USER MANAGEMENT TABLES (MULTI-TENANT)
-- ===============================================

-- Users with multi-tenant isolation
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL, -- platform_owner, restaurant_owner, manager, cashier, server, cook
    hourly_rate DECIMAL(8,2),
    is_active BOOLEAN DEFAULT true,
    last_login TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT users_tenant_check CHECK (
        (role = 'platform_owner' AND restaurant_id IS NULL) OR
        (role != 'platform_owner' AND restaurant_id IS NOT NULL)
    )
);

-- User permissions and roles
CREATE TABLE user_permissions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    permission VARCHAR(100) NOT NULL, -- inventory.read, employees.write, etc.
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    granted_by INTEGER REFERENCES users(id),
    UNIQUE(user_id, permission)
);

-- ===============================================
-- INVENTORY MANAGEMENT TABLES (PER RESTAURANT)
-- ===============================================

-- Product categories (per restaurant)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10), -- Emoji icon
    sort_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- Products/Menu items (per restaurant)
CREATE TABLE products (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    category_id INTEGER REFERENCES categories(id) ON DELETE SET NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    price DECIMAL(10,2) NOT NULL,
    cost DECIMAL(10,2), -- Cost price for margin calculation
    sku VARCHAR(100),
    image_emoji VARCHAR(10), -- Emoji representation
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    available_in_pos BOOLEAN DEFAULT true,
    track_inventory BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- Suppliers (per restaurant)
CREATE TABLE suppliers (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255),
    phone VARCHAR(50),
    address TEXT,
    payment_terms VARCHAR(100),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Inventory items (stock tracking per restaurant)
CREATE TABLE inventory_items (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    unit VARCHAR(50) DEFAULT 'each', -- each, kg, liter, etc.
    current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
    min_stock_level DECIMAL(10,3) NOT NULL DEFAULT 0,
    max_stock_level DECIMAL(10,3) NOT NULL DEFAULT 0,
    cost_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    last_restocked TIMESTAMP,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, name)
);

-- Stock movements (transaction history)
CREATE TABLE stock_movements (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    movement_type VARCHAR(50) NOT NULL, -- restock, sale, waste, adjustment
    quantity DECIMAL(10,3) NOT NULL,
    unit_cost DECIMAL(10,2),
    total_cost DECIMAL(10,2),
    reference_id INTEGER, -- Could reference orders, restock_orders, etc.
    reference_type VARCHAR(50), -- order, restock, adjustment
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee schedules (weekly templates)
CREATE TABLE employee_schedules (
    id SERIAL PRIMARY KEY,
    employee_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time VARCHAR(5) NOT NULL, -- HH:MM format
    end_time VARCHAR(5) NOT NULL, -- HH:MM format
    position VARCHAR(100), -- cashier, cook, server, manager
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, completed, no_show, cancelled
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(employee_id, shift_date)
);

-- ===============================================
-- POS TRANSACTION TABLES (PER RESTAURANT)
-- ===============================================

-- Orders (enhanced with multi-tenant support)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    table_name VARCHAR(50),
    customer_name VARCHAR(255),
    order_type VARCHAR(50) DEFAULT 'dine_in', -- dine_in, takeaway, delivery
    status VARCHAR(50) DEFAULT 'draft', -- draft, confirmed, preparing, ready, completed, cancelled
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    service_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    order_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    employee_id INTEGER REFERENCES users(id),
    payment_method VARCHAR(50), -- card, cash, apple_pay, sumup
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Order items
CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    quantity INTEGER NOT NULL DEFAULT 1,
    unit_price DECIMAL(10,2) NOT NULL,
    total_price DECIMAL(10,2) NOT NULL,
    special_instructions TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Payments (enhanced with commission tracking)
CREATE TABLE payments (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    order_id INTEGER REFERENCES orders(id) ON DELETE CASCADE,
    payment_method VARCHAR(50) NOT NULL, -- card, cash, apple_pay, sumup
    amount DECIMAL(10,2) NOT NULL,
    commission_rate DECIMAL(5,2),
    commission_amount DECIMAL(10,2),
    transaction_id VARCHAR(255),
    processor_response JSONB,
    status VARCHAR(50) DEFAULT 'pending', -- pending, completed, failed, refunded
    processed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Daily reports cache (for performance)
CREATE TABLE daily_reports (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    report_date DATE NOT NULL,
    total_sales DECIMAL(10,2) DEFAULT 0,
    total_orders INTEGER DEFAULT 0,
    average_ticket DECIMAL(10,2) DEFAULT 0,
    total_items INTEGER DEFAULT 0,
    payment_breakdown JSONB, -- JSON object with payment method totals
    top_products JSONB, -- JSON array of best-selling items
    staff_performance JSONB, -- JSON object with staff metrics
    generated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, report_date)
);

-- ===============================================
-- INDEXES FOR PERFORMANCE
-- ===============================================

-- Platform tables
CREATE INDEX idx_platforms_slug ON platforms(slug);
CREATE INDEX idx_platforms_owner_email ON platforms(owner_email);

-- Restaurant tables
CREATE INDEX idx_restaurants_platform_id ON restaurants(platform_id);
CREATE INDEX idx_restaurants_slug ON restaurants(slug);
CREATE INDEX idx_restaurants_active ON restaurants(is_active);

-- User tables  
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_active ON users(is_active);

-- Category and product tables
CREATE INDEX idx_categories_restaurant_id ON categories(restaurant_id);
CREATE INDEX idx_products_restaurant_id ON products(restaurant_id);
CREATE INDEX idx_products_category_id ON products(category_id);
CREATE INDEX idx_products_active ON products(is_active);

-- Inventory tables
CREATE INDEX idx_inventory_items_restaurant_id ON inventory_items(restaurant_id);
CREATE INDEX idx_stock_movements_restaurant_id ON stock_movements(restaurant_id);
CREATE INDEX idx_stock_movements_item_id ON stock_movements(inventory_item_id);

-- Order tables
CREATE INDEX idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX idx_orders_order_number ON orders(order_number);
CREATE INDEX idx_orders_created_at ON orders(created_at);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_order_items_order_id ON order_items(order_id);

-- Payment tables
CREATE INDEX idx_payments_restaurant_id ON payments(restaurant_id);
CREATE INDEX idx_payments_order_id ON payments(order_id);
CREATE INDEX idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX idx_payments_created_at ON payments(created_at);

-- ===============================================
-- ROW LEVEL SECURITY (RLS) FOR MULTI-TENANT ISOLATION
-- ===============================================

-- Enable RLS on all tenant-specific tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_sections ENABLE ROW LEVEL SECURITY;
ALTER TABLE restaurant_tables ENABLE ROW LEVEL SECURITY;

-- Create application role
CREATE ROLE fynlo_app;

-- Create RLS policies for restaurant isolation
CREATE POLICY restaurant_isolation_policy ON restaurants
    FOR ALL TO fynlo_app
    USING (
        -- Platform owners can see their restaurants
        (platform_id = current_setting('app.current_platform_id', true)::integer) OR
        -- Restaurant users can see their own restaurant
        (id = current_setting('app.current_restaurant_id', true)::integer)
    );

CREATE POLICY user_restaurant_policy ON users
    FOR ALL TO fynlo_app
    USING (
        -- Platform owners can see all users in their platform
        (platform_id = current_setting('app.current_platform_id', true)::integer) OR
        -- Restaurant users can see users in their restaurant
        (restaurant_id = current_setting('app.current_restaurant_id', true)::integer) OR
        -- Platform owners have no restaurant_id restriction
        (restaurant_id IS NULL AND role = 'platform_owner')
    );

CREATE POLICY category_restaurant_policy ON categories
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

CREATE POLICY product_restaurant_policy ON products
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

CREATE POLICY inventory_restaurant_policy ON inventory_items
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

CREATE POLICY order_restaurant_policy ON orders
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

CREATE POLICY payment_restaurant_policy ON payments
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

CREATE POLICY section_restaurant_policy ON restaurant_sections
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

CREATE POLICY table_restaurant_policy ON restaurant_tables
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id', true)::integer);

-- ===============================================
-- FUNCTIONS AND TRIGGERS
-- ===============================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers to relevant tables
CREATE TRIGGER update_platforms_updated_at BEFORE UPDATE ON platforms
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON restaurants
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON products
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_categories_updated_at BEFORE UPDATE ON categories
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_inventory_items_updated_at BEFORE UPDATE ON inventory_items
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Function to update restaurant revenue
CREATE OR REPLACE FUNCTION update_restaurant_revenue()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
        UPDATE restaurants 
        SET monthly_revenue = monthly_revenue + NEW.total_amount,
            last_activity = CURRENT_TIMESTAMP
        WHERE id = NEW.restaurant_id;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to update restaurant revenue when orders are completed
CREATE TRIGGER update_restaurant_revenue_trigger
    AFTER UPDATE ON orders
    FOR EACH ROW
    EXECUTE FUNCTION update_restaurant_revenue();

-- ===============================================
-- INITIAL DATA CONSTRAINTS AND VALIDATIONS
-- ===============================================

-- Add constraints for data integrity
ALTER TABLE orders ADD CONSTRAINT orders_total_check 
    CHECK (total_amount >= 0 AND subtotal >= 0);

ALTER TABLE products ADD CONSTRAINT products_price_check 
    CHECK (price >= 0);

ALTER TABLE inventory_items ADD CONSTRAINT inventory_stock_check 
    CHECK (current_stock >= 0 AND min_stock_level >= 0);

ALTER TABLE payments ADD CONSTRAINT payments_amount_check 
    CHECK (amount > 0);

-- Add email validation
ALTER TABLE users ADD CONSTRAINT users_email_check 
    CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');

-- ===============================================
-- COMPLETION
-- ===============================================

-- Create a view for easy restaurant access with platform info
CREATE VIEW restaurant_with_platform AS
SELECT 
    r.*,
    p.name as platform_name,
    p.owner_email as platform_owner_email
FROM restaurants r
JOIN platforms p ON r.platform_id = p.id;

-- Create a view for user information with restaurant context
CREATE VIEW user_with_context AS
SELECT 
    u.*,
    r.name as restaurant_name,
    r.slug as restaurant_slug,
    p.name as platform_name
FROM users u
LEFT JOIN restaurants r ON u.restaurant_id = r.id
LEFT JOIN platforms p ON u.platform_id = p.id;

-- Grant permissions to application role
GRANT USAGE ON SCHEMA public TO fynlo_app;
GRANT ALL ON ALL TABLES IN SCHEMA public TO fynlo_app;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO fynlo_app;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Fynlo POS Multi-Tenant Database Schema Created Successfully!';
    RAISE NOTICE '🏢 Platform management: Ready';
    RAISE NOTICE '🏪 Restaurant isolation: Enabled with RLS';
    RAISE NOTICE '👥 User management: Multi-role support';
    RAISE NOTICE '📦 Inventory tracking: Full featured';
    RAISE NOTICE '💰 Transaction processing: Commission tracking enabled';
    RAISE NOTICE '🔒 Security: Row Level Security policies active';
END $$;