-- Revert the user role back to customer for restaurant manager
UPDATE user_roles 
SET role = 'customer' 
WHERE user_id = '459da6bc-3472-4de6-8f0c-793373f1a7b0' AND role = 'admin';