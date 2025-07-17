-- Update the user role from customer to admin for platform owner
UPDATE user_roles 
SET role = 'admin' 
WHERE user_id = '459da6bc-3472-4de6-8f0c-793373f1a7b0' AND role = 'customer';