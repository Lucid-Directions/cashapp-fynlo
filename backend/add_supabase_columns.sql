-- Add Supabase authentication columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS supabase_id VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50) DEFAULT 'local';

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_supabase_id ON users(supabase_id);

-- Add subscription columns to restaurants table
ALTER TABLE restaurants 
ADD COLUMN IF NOT EXISTS subscription_plan VARCHAR(50) DEFAULT 'alpha',
ADD COLUMN IF NOT EXISTS subscription_status VARCHAR(50) DEFAULT 'trial',
ADD COLUMN IF NOT EXISTS subscription_started_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS subscription_ended_at TIMESTAMP;

-- Update existing users to have auth_provider set
UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL;