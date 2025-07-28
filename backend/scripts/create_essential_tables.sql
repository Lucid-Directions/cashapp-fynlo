-- Create essential tables for authentication to work

-- Create platforms table first
CREATE TABLE IF NOT EXISTS platforms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    owner_email VARCHAR(255) UNIQUE NOT NULL,
    subscription_tier VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create restaurants table
CREATE TABLE IF NOT EXISTS restaurants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_id UUID REFERENCES platforms(id),
    name VARCHAR(255) NOT NULL,
    address JSONB,
    phone VARCHAR(50),
    email VARCHAR(255),
    timezone VARCHAR(50) DEFAULT 'Europe/London',
    business_hours JSONB,
    settings JSONB,
    tax_configuration JSONB,
    payment_methods JSONB,
    floor_plan_layout JSONB,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create users table
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    username VARCHAR(100) UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    restaurant_id UUID,
    platform_id UUID,
    permissions JSONB DEFAULT '{}',
    pin_code VARCHAR(6),
    is_active BOOLEAN DEFAULT TRUE,
    last_login TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert platform data
INSERT INTO platforms (id, name, owner_email, subscription_tier) 
VALUES (
    'b5c4a3d2-1e0f-4c8b-9d7a-6e5f4a3b2c1d',
    'Fynlo POS Platform',
    'admin@fynlo.com',
    'enterprise'
) ON CONFLICT (owner_email) DO NOTHING;

-- Insert restaurant data
INSERT INTO restaurants (id, platform_id, name, email, phone, address) 
VALUES (
    'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
    'b5c4a3d2-1e0f-4c8b-9d7a-6e5f4a3b2c1d',
    'Casa Estrella',
    'info@casaestrella.co.uk',
    '+44 20 7123 4567',
    '{"street": "123 Camden High Street", "city": "London", "postcode": "NW1 7JR", "country": "UK"}'::jsonb
) ON CONFLICT DO NOTHING;

-- Now run the demo users script to add users