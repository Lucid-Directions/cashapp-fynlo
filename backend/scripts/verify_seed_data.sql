-- Verify Seed Data Script
-- Run this to check if the database has been properly seeded

-- Summary Statistics
SELECT 'Database Seed Data Summary' as report;
SELECT '=========================' as separator;

-- Platform and Restaurant
SELECT 'Platforms' as entity, COUNT(*) as count FROM platforms
UNION ALL
SELECT 'Restaurants', COUNT(*) FROM restaurants
UNION ALL
SELECT 'Users', COUNT(*) FROM users
UNION ALL
SELECT 'Employees', COUNT(*) FROM employee_profiles
UNION ALL
SELECT 'Categories', COUNT(*) FROM categories
UNION ALL
SELECT 'Products', COUNT(*) FROM products
UNION ALL
SELECT 'Customers', COUNT(*) FROM customers
UNION ALL
SELECT 'Orders', COUNT(*) FROM orders
UNION ALL
SELECT 'Payments', COUNT(*) FROM payments
UNION ALL
SELECT 'Inventory Items', COUNT(*) FROM inventory_items
UNION ALL
SELECT 'Suppliers', COUNT(*) FROM suppliers
UNION ALL
SELECT 'Schedules', COUNT(*) FROM schedules
UNION ALL
SELECT 'Daily Reports', COUNT(*) FROM daily_reports;

-- Restaurant Details
SELECT '\nRestaurant Information' as section;
SELECT '---------------------' as separator;
SELECT name, email, phone, timezone FROM restaurants LIMIT 1;

-- User Roles
SELECT '\nUser Accounts by Role' as section;
SELECT '--------------------' as separator;
SELECT role, COUNT(*) as count 
FROM users 
GROUP BY role 
ORDER BY role;

-- Recent Orders
SELECT '\nRecent Orders (Last 7 Days)' as section;
SELECT '---------------------------' as separator;
SELECT 
    DATE(created_at) as order_date,
    COUNT(*) as order_count,
    ROUND(SUM(total_amount)::numeric, 2) as daily_revenue
FROM orders
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY order_date DESC;

-- Payment Methods Distribution
SELECT '\nPayment Methods (Last 30 Days)' as section;
SELECT '------------------------------' as separator;
SELECT 
    payment_method,
    COUNT(*) as transaction_count,
    ROUND(SUM(amount)::numeric, 2) as total_amount
FROM payments
WHERE created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY payment_method
ORDER BY transaction_count DESC;

-- Top Products
SELECT '\nTop 5 Products by Order Frequency' as section;
SELECT '---------------------------------' as separator;
SELECT 
    p.name as product_name,
    COUNT(DISTINCT o.id) as times_ordered,
    ROUND(p.price::numeric, 2) as unit_price
FROM products p
JOIN orders o ON o.items::text LIKE '%' || p.name || '%'
GROUP BY p.id, p.name, p.price
ORDER BY times_ordered DESC
LIMIT 5;

-- Employee Schedule Coverage
SELECT '\nEmployee Schedule Coverage (Next 7 Days)' as section;
SELECT '---------------------------------------' as separator;
SELECT 
    date,
    COUNT(DISTINCT employee_id) as scheduled_employees
FROM schedules
WHERE date >= CURRENT_DATE
  AND date < CURRENT_DATE + INTERVAL '7 days'
GROUP BY date
ORDER BY date;