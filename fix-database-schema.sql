-- Add missing columns to users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS current_restaurant_id UUID REFERENCES restaurants(id),
ADD COLUMN IF NOT EXISTS last_restaurant_switch TIMESTAMP WITH TIME ZONE;