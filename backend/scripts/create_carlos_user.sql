-- Create Carlos user (restaurant owner)
INSERT INTO users (
    email, 
    username,
    password_hash,
    first_name, 
    last_name, 
    role,
    restaurant_id,
    is_active
) VALUES (
    'carlos@casaestrella.co.uk',
    'carlos',
    '$2b$12$dummy', -- Will be updated by Python script
    'Carlos',
    'Martinez',
    'restaurant_owner',
    'a1b2c3d4-5e6f-7a8b-9c0d-1e2f3a4b5c6d', -- Casa Estrella restaurant ID
    true
);