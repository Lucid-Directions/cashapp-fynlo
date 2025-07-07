-- Create Demo Users for Fynlo POS
-- This script creates real user accounts in the database for authentication

-- First, let's check if the users table exists and its structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'users'
ORDER BY ordinal_position;

-- Create platform owner account
INSERT INTO users (
    id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    role,
    is_active,
    created_at,
    updated_at
) VALUES (
    gen_random_uuid(),
    'owner@fynlopos.com',
    'platformowner',
    -- Password: platformowner123 (using bcrypt hash)
    '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LewKyNiAYlT/mk6Bi',
    'Platform',
    'Owner',
    'platform_owner',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    role = EXCLUDED.role,
    is_active = EXCLUDED.is_active;

-- Update Carlos's password (he already exists)
UPDATE users 
SET 
    password_hash = '$2b$12$iXvmtpOjW8gJMtuYkqBRxOKlgBU/FqMnmFc8SXQJS58Yh4bIxHO2m', -- Password: password123
    username = 'carlos',
    updated_at = NOW()
WHERE email = 'carlos@casaestrella.co.uk';

-- Create additional demo accounts for quick testing
INSERT INTO users (
    id,
    email,
    username,
    password_hash,
    first_name,
    last_name,
    role,
    restaurant_id,
    is_active,
    created_at,
    updated_at
) VALUES 
(
    gen_random_uuid(),
    'john@fynlopos.com',
    'john',
    -- Password: password123
    '$2b$12$iXvmtpOjW8gJMtuYkqBRxOKlgBU/FqMnmFc8SXQJS58Yh4bIxHO2m',
    'John',
    'Smith',
    'restaurant_owner',
    'f7919b40-dd76-41de-9ae7-7f642ef4c7d9',
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'sarah@fynlopos.com',
    'sarah',
    -- Password: password123
    '$2b$12$iXvmtpOjW8gJMtuYkqBRxOKlgBU/FqMnmFc8SXQJS58Yh4bIxHO2m',
    'Sarah',
    'Johnson',
    'manager',
    'f7919b40-dd76-41de-9ae7-7f642ef4c7d9',
    true,
    NOW(),
    NOW()
),
(
    gen_random_uuid(),
    'demo@fynlopos.com',
    'demo',
    -- Password: demo
    '$2b$12$S9.gK8U5nKaGVdVGm6pFkOKGM0pKwMq/iCWI/5UiV.qrfUjvU6vE6',
    'Demo',
    'User',
    'manager',
    'f7919b40-dd76-41de-9ae7-7f642ef4c7d9',
    true,
    NOW(),
    NOW()
) ON CONFLICT (email) DO UPDATE SET
    password_hash = EXCLUDED.password_hash,
    username = EXCLUDED.username,
    restaurant_id = EXCLUDED.restaurant_id,
    is_active = EXCLUDED.is_active;

-- Verify the users were created
SELECT id, email, username, role, restaurant_id, is_active 
FROM users 
WHERE email IN (
    'owner@fynlopos.com',
    'carlos@casaestrella.co.uk',
    'john@fynlopos.com',
    'sarah@fynlopos.com',
    'demo@fynlopos.com'
);