# DigitalOcean Database Migration - Complete Data Migration Guide

## 🎯 Objective
Migrate all application data from existing database systems to DigitalOcean Managed PostgreSQL and Valkey cache, ensuring zero data loss and minimal downtime.

## 📋 Context & Prerequisites

### Current State After Phase 3
- [x] DigitalOcean infrastructure fully provisioned
- [x] Managed PostgreSQL cluster running in VPC
- [x] Valkey cache cluster operational
- [x] App Platform deployed and connected to databases
- [x] Backend configured with new database connection strings

### What We're Migrating
- **Primary Database**: All application data (users, restaurants, orders, payments)
- **Session Data**: User sessions and temporary data to Valkey cache
- **File References**: Update database file paths to point to Spaces
- **Configuration Data**: Platform and restaurant settings

### Prerequisites
- [x] Phase 3 completed (DO infrastructure ready)
- [x] Current database backup available
- [x] Database schema documentation
- [x] Maintenance window planned (recommended: off-peak hours)

### Migration Strategy
- **Approach**: Blue-Green deployment with data sync
- **Downtime**: Minimal (estimated 15-30 minutes)
- **Rollback**: Full backup available for emergency restoration

## 🗃️ Database Architecture

### Current vs New Architecture
```
BEFORE (Multi-Provider):
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  External DB    │    │  Redis/Cache    │    │   AWS S3        │
│  (Various)      │    │  (Separate)     │    │  (Files)        │
└─────────────────┘    └─────────────────┘    └─────────────────┘

AFTER (DigitalOcean Unified):
┌─────────────────────────────────────────────────────────────┐
│                    DIGITALOCEAN VPC                        │
│  ┌─────────────────┐  ┌─────────────────┐  ┌──────────────┐ │
│  │   PostgreSQL    │  │     Valkey      │  │    Spaces    │ │
│  │   (Primary)     │  │    (Cache)      │  │   (Files)    │ │
│  │                 │  │                 │  │              │ │
│  │  - All Data     │  │  - Sessions     │  │  - Assets    │ │
│  │  - ACID         │  │  - Temp Data    │  │  - Uploads   │ │
│  │  - Backups      │  │  - Real-time    │  │  - CDN       │ │
│  └─────────────────┘  └─────────────────┘  └──────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

### Database Schema Structure
```sql
-- Core tables to migrate
- users (authentication, profiles)
- restaurants (business data)
- platforms (multi-tenant configuration)
- orders (transaction history)
- payments (payment records)
- settings (configuration data)
- files (asset references)
- sessions (user sessions → Valkey)
```

## 🏗️ Complete Multi-Tenant Database Schema

### Comprehensive Feature Integration
The database schema now includes all application features discovered in the codebase:
- **Multi-tenant Platform Architecture** with proper data isolation
- **Inventory Management System** with stock tracking, suppliers, and restocking
- **Employee Management System** with scheduling, performance tracking, and roles
- **Advanced POS Features** with orders, payments, and analytics

### Multi-Tenant Database Architecture
```
🏢 PLATFORM LEVEL (Top Tier)
├── platforms (platform owners)
├── platform_settings (global platform configuration)
└── subscription_plans (pricing tiers)

🏪 RESTAURANT LEVEL (Tenant Isolation)
├── restaurants (tenant businesses)
├── restaurant_settings (per-restaurant configuration)
├── users (restaurant staff with roles)
├── restaurant_subscriptions (platform billing)
└── commission_rates (platform revenue)

📦 INVENTORY LEVEL (Per Restaurant)
├── categories (menu organization)
├── products (menu items)
├── suppliers (vendor management)
├── inventory_items (stock tracking)
├── stock_movements (transaction history)
└── restock_orders (supplier orders)

👥 EMPLOYEE LEVEL (Per Restaurant)
├── employees (staff profiles)
├── employee_roles (permission management)
├── schedules (shift planning)
├── shifts (actual work periods)
├── time_tracking (attendance)
└── performance_metrics (analytics)

💰 TRANSACTION LEVEL (Per Restaurant)
├── orders (customer transactions)
├── order_items (line items)
├── payments (payment processing)
├── refunds (return processing)
└── daily_reports (analytics cache)
```

### Complete Database Schema Definition

#### **Platform Management Tables**
```sql
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
CREATE TABLE platform_settings (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    setting_key VARCHAR(100) NOT NULL,
    setting_value TEXT,
    setting_type VARCHAR(50) DEFAULT 'string', -- string, number, boolean, json
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(platform_id, setting_key)
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
```

#### **Restaurant Management Tables (Multi-Tenant)**
```sql
-- Restaurants (tenant entities with proper isolation)
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    business_type VARCHAR(100) DEFAULT 'restaurant',
    address TEXT,
    phone VARCHAR(50),
    email VARCHAR(255),
    tax_number VARCHAR(100),
    logo_url TEXT,
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
```

#### **User Management Tables (Multi-Tenant)**
```sql
-- Users with multi-tenant isolation
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    platform_id INTEGER REFERENCES platforms(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(50),
    role VARCHAR(50) NOT NULL, -- platform_owner, restaurant_owner, manager, cashier, server, cook
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
```

#### **Inventory Management Tables (Per Restaurant)**
```sql
-- Product categories (per restaurant)
CREATE TABLE categories (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    icon VARCHAR(10), -- Emoji icon
    display_order INTEGER DEFAULT 0,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
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
    image_url TEXT,
    is_active BOOLEAN DEFAULT true,
    available_in_pos BOOLEAN DEFAULT true,
    track_inventory BOOLEAN DEFAULT false,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, sku)
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
    product_id INTEGER REFERENCES products(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE SET NULL,
    current_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
    minimum_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
    maximum_stock DECIMAL(10,3) NOT NULL DEFAULT 0,
    reorder_point DECIMAL(10,3) NOT NULL DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL DEFAULT 0,
    unit_measure VARCHAR(50) DEFAULT 'each', -- each, kg, liter, etc.
    last_restocked TIMESTAMP,
    turnover_rate DECIMAL(8,4) DEFAULT 0, -- Times per month
    wastage_rate DECIMAL(5,2) DEFAULT 0, -- Percentage
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, product_id)
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

-- Restock orders
CREATE TABLE restock_orders (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    supplier_id INTEGER REFERENCES suppliers(id) ON DELETE CASCADE,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    order_date DATE NOT NULL,
    expected_delivery DATE,
    actual_delivery DATE,
    status VARCHAR(50) DEFAULT 'pending', -- pending, ordered, delivered, cancelled
    total_amount DECIMAL(10,2) DEFAULT 0,
    notes TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Restock order items
CREATE TABLE restock_order_items (
    id SERIAL PRIMARY KEY,
    restock_order_id INTEGER REFERENCES restock_orders(id) ON DELETE CASCADE,
    inventory_item_id INTEGER REFERENCES inventory_items(id) ON DELETE CASCADE,
    quantity_ordered DECIMAL(10,3) NOT NULL,
    quantity_received DECIMAL(10,3) DEFAULT 0,
    unit_cost DECIMAL(10,2) NOT NULL,
    total_cost DECIMAL(10,2) NOT NULL,
    notes TEXT
);
```

#### **Employee Management Tables (Per Restaurant)**
```sql
-- Employees (per restaurant)
CREATE TABLE employees (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    employee_number VARCHAR(50),
    hire_date DATE NOT NULL,
    termination_date DATE,
    job_title VARCHAR(100),
    department VARCHAR(100),
    hourly_rate DECIMAL(8,2),
    salary DECIMAL(10,2),
    employment_type VARCHAR(50) DEFAULT 'part_time', -- full_time, part_time, contract
    emergency_contact_name VARCHAR(255),
    emergency_contact_phone VARCHAR(50),
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, employee_number)
);

-- Employee schedules (weekly templates)
CREATE TABLE schedules (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    week_start DATE NOT NULL,
    week_end DATE NOT NULL,
    status VARCHAR(50) DEFAULT 'draft', -- draft, published, archived
    total_scheduled_hours DECIMAL(8,2) DEFAULT 0,
    total_labor_cost DECIMAL(10,2) DEFAULT 0,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Individual shifts
CREATE TABLE shifts (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    schedule_id INTEGER REFERENCES schedules(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    break_duration INTEGER DEFAULT 0, -- Minutes
    position VARCHAR(100), -- cashier, cook, server, manager
    status VARCHAR(50) DEFAULT 'scheduled', -- scheduled, confirmed, completed, no_show, cancelled
    hourly_rate DECIMAL(8,2),
    overtime_rate DECIMAL(8,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Time tracking (clock in/out)
CREATE TABLE time_tracking (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    shift_id INTEGER REFERENCES shifts(id) ON DELETE CASCADE,
    clock_in TIMESTAMP,
    clock_out TIMESTAMP,
    break_start TIMESTAMP,
    break_end TIMESTAMP,
    total_hours DECIMAL(8,2),
    overtime_hours DECIMAL(8,2) DEFAULT 0,
    total_pay DECIMAL(10,2),
    status VARCHAR(50) DEFAULT 'active', -- active, completed, approved
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Employee performance metrics
CREATE TABLE performance_metrics (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    employee_id INTEGER REFERENCES employees(id) ON DELETE CASCADE,
    metric_date DATE NOT NULL,
    metric_type VARCHAR(100) NOT NULL, -- sales, punctuality, customer_rating
    metric_value DECIMAL(10,2) NOT NULL,
    target_value DECIMAL(10,2),
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(restaurant_id, employee_id, metric_date, metric_type)
);
```

#### **POS Transaction Tables (Per Restaurant)**
```sql
-- Orders (enhanced with multi-tenant support)
CREATE TABLE orders (
    id SERIAL PRIMARY KEY,
    restaurant_id INTEGER REFERENCES restaurants(id) ON DELETE CASCADE,
    order_number VARCHAR(100) UNIQUE NOT NULL,
    table_number VARCHAR(50),
    customer_name VARCHAR(255),
    order_type VARCHAR(50) DEFAULT 'dine_in', -- dine_in, takeaway, delivery
    status VARCHAR(50) DEFAULT 'draft', -- draft, confirmed, preparing, ready, completed, cancelled
    subtotal DECIMAL(10,2) NOT NULL DEFAULT 0,
    tax_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    service_charge DECIMAL(10,2) NOT NULL DEFAULT 0,
    discount_amount DECIMAL(10,2) DEFAULT 0,
    total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
    items_count INTEGER DEFAULT 0,
    served_by INTEGER REFERENCES employees(id),
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
```

#### **Multi-Tenant Security Constraints**
```sql
-- Row Level Security (RLS) for multi-tenant isolation
-- This ensures restaurants can only see their own data

-- Enable RLS on all tenant-specific tables
ALTER TABLE restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Create RLS policies for restaurant isolation
CREATE POLICY restaurant_isolation_policy ON restaurants
    FOR ALL TO fynlo_app
    USING (id = current_setting('app.current_restaurant_id')::integer);

CREATE POLICY user_restaurant_policy ON users
    FOR ALL TO fynlo_app
    USING (restaurant_id = current_setting('app.current_restaurant_id')::integer OR restaurant_id IS NULL);

-- Platform owners can see all restaurants
CREATE POLICY platform_owner_access ON restaurants
    FOR ALL TO fynlo_app
    USING (platform_id = current_setting('app.current_platform_id')::integer);
```

## 🚀 Implementation Steps

### Step 1: Pre-Migration Preparation

#### 1.1 Backup Current Database
```bash
# Create comprehensive backup of current database
# Adjust connection details for your current database

# PostgreSQL backup
pg_dump -h current-db-host \
        -U current-db-user \
        -d current-db-name \
        --clean \
        --create \
        --verbose \
        --file=fynlo_backup_$(date +%Y%m%d_%H%M%S).sql

# Verify backup file
ls -lh fynlo_backup_*.sql
echo "✅ Backup created successfully"

# Test backup integrity
pg_restore --list fynlo_backup_*.sql | head -20
```

#### 1.2 Document Current Schema
```bash
# Export current schema structure
pg_dump -h current-db-host \
        -U current-db-user \
        -d current-db-name \
        --schema-only \
        --verbose \
        --file=fynlo_schema_$(date +%Y%m%d).sql

# Export data only (for comparison)
pg_dump -h current-db-host \
        -U current-db-user \
        -d current-db-name \
        --data-only \
        --verbose \
        --file=fynlo_data_$(date +%Y%m%d).sql

echo "✅ Schema and data documented"
```

#### 1.3 Prepare DigitalOcean Database
```bash
# Get DigitalOcean database connection details
source ~/.bashrc  # Load environment variables from Phase 3

# Test connection to DO database
psql "$FYNLO_DATABASE_URL" -c "SELECT version();"

# Create application database if not exists
psql "$FYNLO_DATABASE_URL" -c "CREATE DATABASE fynlo_production;"

# Create application user with appropriate permissions
psql "$FYNLO_DATABASE_URL" -c "
CREATE USER fynlo_app WITH ENCRYPTED PASSWORD 'secure_app_password';
GRANT ALL PRIVILEGES ON DATABASE fynlo_production TO fynlo_app;
GRANT CREATE ON SCHEMA public TO fynlo_app;
"

echo "✅ DigitalOcean database prepared"
```

### Step 2: Schema Migration

#### 2.1 Migrate Database Schema
```bash
# Connect to DigitalOcean database and create schema
psql "$FYNLO_DATABASE_URL/fynlo_production" -f fynlo_schema_$(date +%Y%m%d).sql

# Verify schema creation
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;
"

# Check for any schema creation errors
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SELECT schemaname, tablename, tableowner 
FROM pg_tables 
WHERE schemaname = 'public';
"

echo "✅ Schema migrated successfully"
```

#### 2.2 Update Schema for DigitalOcean Optimization
```sql
-- Create additional indexes for performance
-- Connect to database and run these optimizations

-- Users table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_restaurant_id ON users(restaurant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at ON users(created_at);

-- Restaurants table optimizations  
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurants_platform_id ON restaurants(platform_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_restaurants_active ON restaurants(is_active);

-- Orders table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_restaurant_id ON orders(restaurant_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_created_at ON orders(created_at);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_orders_status ON orders(status);

-- Payments table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_order_id ON payments(order_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_transaction_id ON payments(transaction_id);
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payments_created_at ON payments(created_at);

-- Settings table optimizations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_settings_entity_type ON settings(entity_type, entity_id);
```

Run the optimizations:
```bash
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
-- Paste the above SQL optimizations here
"

echo "✅ Database optimized for DigitalOcean"
```

### Step 3: Data Migration

#### 3.1 Migrate Core Application Data
```bash
# Migrate data in dependency order to avoid foreign key conflicts

# 1. Migrate platforms first (top-level entities)
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
COPY platforms FROM STDIN WITH (FORMAT csv, HEADER true);
" < platforms_export.csv

# 2. Migrate restaurants (depend on platforms)
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
COPY restaurants FROM STDIN WITH (FORMAT csv, HEADER true);
" < restaurants_export.csv

# 3. Migrate users (depend on restaurants)
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
COPY users FROM STDIN WITH (FORMAT csv, HEADER true);
" < users_export.csv

# 4. Migrate orders (depend on restaurants and users)
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
COPY orders FROM STDIN WITH (FORMAT csv, HEADER true);
" < orders_export.csv

# 5. Migrate payments (depend on orders)
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
COPY payments FROM STDIN WITH (FORMAT csv, HEADER true);
" < payments_export.csv

# 6. Migrate settings (depend on various entities)
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
COPY settings FROM STDIN WITH (FORMAT csv, HEADER true);
" < settings_export.csv

echo "✅ Core data migrated"
```

#### 3.2 Alternative: Full Data Restore (If Using Full Backup)
```bash
# If using full pg_dump backup, restore everything at once
psql "$FYNLO_DATABASE_URL/fynlo_production" -f fynlo_backup_$(date +%Y%m%d)*.sql

# Verify data integrity
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SELECT 
    schemaname,
    tablename,
    n_tup_ins as inserts,
    n_tup_upd as updates,
    n_tup_del as deletes
FROM pg_stat_user_tables 
ORDER BY tablename;
"

echo "✅ Full data restore completed"
```

#### 3.3 Mock Data to Database Seed Migration
```bash
echo "🌱 Converting mock data to database seed data..."

# Create seed data migration script from MockDataService
cat > migrate_mock_data.py << 'EOF'
#!/usr/bin/env python3
"""
Mock Data to Database Seed Migration Script
Converts all MockDataService.ts data to PostgreSQL seed data
"""

import psycopg2
import json
from datetime import datetime, timedelta
import random
import os

# Database connection
DATABASE_URL = os.getenv('FYNLO_DATABASE_URL') + '/fynlo_production'

def connect_db():
    return psycopg2.connect(DATABASE_URL)

def create_platform_data(conn):
    """Create platform and subscription plans"""
    with conn.cursor() as cur:
        # Create main platform
        cur.execute("""
            INSERT INTO platforms (name, slug, owner_email, is_active, total_restaurants, monthly_revenue)
            VALUES ('Fynlo Platform', 'fynlo', 'admin@fynlo.com', true, 1, 125400.00)
            RETURNING id;
        """)
        platform_id = cur.fetchone()[0]
        
        # Create subscription plans
        plans = [
            ('basic', 8.00, 12.50, 0.00, 10),
            ('premium', 6.00, 12.50, 49.99, 50), 
            ('enterprise', 4.00, 12.50, 199.99, None)
        ]
        
        for name, commission, service_fee, monthly_fee, max_restaurants in plans:
            cur.execute("""
                INSERT INTO subscription_plans 
                (platform_id, name, commission_rate, service_fee_rate, monthly_fee, max_restaurants, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, true)
            """, (platform_id, name, commission, service_fee, monthly_fee, max_restaurants))
        
        return platform_id

def create_restaurant_data(conn, platform_id):
    """Create demo Mexican restaurant from MockDataService"""
    with conn.cursor() as cur:
        # Create restaurant
        cur.execute("""
            INSERT INTO restaurants 
            (platform_id, name, slug, business_type, address, phone, email, is_active, subscription_tier, monthly_revenue)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true, 'basic', %s)
            RETURNING id;
        """, (
            platform_id,
            'Fynlo Mexican Restaurant',
            'fynlo-mexican',
            'mexican_restaurant',
            '123 High Street, London, UK',
            '+44 20 1234 5678',
            'demo@fynlo.com',
            15620.50  # Monthly revenue
        ))
        restaurant_id = cur.fetchone()[0]
        
        return restaurant_id

def create_categories_and_products(conn, restaurant_id):
    """Create categories and menu items from MockDataService"""
    with conn.cursor() as cur:
        # Categories from MockDataService
        categories_data = [
            ('Snacks', '🧀', 1),
            ('Tacos', '🌮', 2),
            ('Special Tacos', '⭐', 3),
            ('Burritos', '🌯', 4),
            ('Sides', '🍟', 5),
            ('Drinks', '🍺', 6),
        ]
        
        category_map = {}
        for name, icon, order in categories_data:
            cur.execute("""
                INSERT INTO categories (restaurant_id, name, icon, display_order, is_active)
                VALUES (%s, %s, %s, %s, true)
                RETURNING id;
            """, (restaurant_id, name, icon, order))
            category_map[name] = cur.fetchone()[0]
        
        # Products from MockDataService
        products_data = [
            # SNACKS
            ('Nachos', 'Snacks', 5.00, 2.50, 'Homemade corn tortilla chips with black beans, tomato salsa, pico de gallo, feta, guac & coriander'),
            ('Quesadillas', 'Snacks', 5.50, 2.75, 'Folded flour tortilla filled with mozzarella, topped with tomato salsa, feta & coriander'),
            ('Chorizo Quesadilla', 'Snacks', 5.50, 3.00, 'Folded flour tortilla filled with chorizo & mozzarella. Topped with tomato salsa, feta & coriander'),
            ('Chicken Quesadilla', 'Snacks', 5.50, 3.25, 'Folded flour tortilla filled with chicken, peppers, onion & mozzarella. Topped with salsa, feta & coriander'),
            ('Tostada', 'Snacks', 6.50, 3.50, 'Crispy tortillas with black beans filled with chicken or any topping, served with salsa, lettuce and feta'),
            
            # TACOS
            ('Carnitas', 'Tacos', 3.50, 1.75, 'Slow cooked pork, served with onion, coriander, salsa, guacamole & coriander'),
            ('Cochinita', 'Tacos', 3.50, 1.75, 'Marinated pulled pork served with pickle red onion'),
            ('Barbacoa de Res', 'Tacos', 3.50, 1.85, 'Juicy pulled beef topped with onion, guacamole & coriander'),
            ('Chorizo', 'Tacos', 3.50, 1.65, 'Grilled chorizo with black beans, onions, salsa, coriander & guacamole'),
            ('Chicken Fajita', 'Tacos', 3.50, 1.75, 'Chicken, peppers & onion with black beans. Topped with salsa, guac & coriander'),
            ('Pescado', 'Tacos', 3.50, 2.00, 'Battered cod with guacamole & coriander. Topped with red cabbage & mango chilli salsa'),
            
            # SPECIAL TACOS
            ('Carne Asada', 'Special Tacos', 4.50, 2.75, 'Diced rump steak with peppers and red onion. Served on black beans, topped with chimichurri sauce & coriander'),
            ('Camaron', 'Special Tacos', 4.50, 3.00, 'Prawns with chorizo, peppers and red onion. Served on black beans, topped with tomato salsa, coriander & guacamole'),
            
            # BURRITOS
            ('Regular Burrito', 'Burritos', 8.00, 4.50, 'Choose any filling from the taco menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.'),
            ('Special Burrito', 'Burritos', 10.00, 5.50, 'Choose any filling from the special tacos menu! With black beans, lettuce, pico de gallo, & guacamole. Topped with salsa, feta and coriander.'),
            
            # SIDES
            ('Skinny Fries', 'Sides', 3.50, 1.25, 'Thin cut fries'),
            ('Pico de Gallo', 'Sides', 0.00, 0.00, 'Diced tomato, onion and chilli - FREE!'),
            
            # DRINKS
            ('Pink Paloma', 'Drinks', 3.75, 1.50, 'An alcohol-free version of our refreshing cocktail. Tangy lime juice and grapefruit soda, with a splash of grenadine'),
            ('Corona', 'Drinks', 3.80, 2.00, 'Mexican beer'),
            ('Modelo', 'Drinks', 4.00, 2.20, 'Rich, full-flavoured Pilsner style Lager. Crisp and refreshing. 355ml'),
        ]
        
        product_ids = []
        for name, category, price, cost, description in products_data:
            category_id = category_map[category]
            sku = f"FYNLO-{name.upper().replace(' ', '-')}"
            
            cur.execute("""
                INSERT INTO products 
                (restaurant_id, category_id, name, description, price, cost, sku, is_active, available_in_pos, track_inventory)
                VALUES (%s, %s, %s, %s, %s, %s, %s, true, true, true)
                RETURNING id;
            """, (restaurant_id, category_id, name, description, price, cost, sku))
            product_ids.append(cur.fetchone()[0])
        
        return product_ids

def create_suppliers(conn, restaurant_id):
    """Create supplier data"""
    with conn.cursor() as cur:
        suppliers_data = [
            ('Fresh Foods Ltd', 'Maria Garcia', 'maria@freshfoods.co.uk', '+44 20 7123 4567', '45 Wholesale Market, London E1 6AA', 'Net 30'),
            ('Mexican Imports Co', 'Carlos Rodriguez', 'carlos@mexicanimports.co.uk', '+44 20 8234 5678', '12 Spice Street, London NW1 2BB', 'Net 15'),
            ('Premium Beverages', 'Sarah Johnson', 'sarah@premiumbev.co.uk', '+44 20 9345 6789', '78 Brewery Lane, London SE1 3CC', 'Net 21'),
            ('Local Produce Hub', 'David Smith', 'david@localproduce.co.uk', '+44 20 6456 7890', '23 Farm Gate, London SW2 4DD', 'Net 7'),
        ]
        
        supplier_ids = []
        for name, contact, email, phone, address, terms in suppliers_data:
            cur.execute("""
                INSERT INTO suppliers 
                (restaurant_id, name, contact_person, email, phone, address, payment_terms, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id;
            """, (restaurant_id, name, contact, email, phone, address, terms))
            supplier_ids.append(cur.fetchone()[0])
            
        return supplier_ids

def create_inventory_data(conn, restaurant_id, product_ids, supplier_ids):
    """Create inventory tracking data"""
    with conn.cursor() as cur:
        for product_id in product_ids:
            supplier_id = random.choice(supplier_ids)
            current_stock = random.randint(10, 100)
            min_stock = random.randint(5, 15)
            max_stock = current_stock + random.randint(50, 150)
            
            cur.execute("""
                INSERT INTO inventory_items 
                (restaurant_id, product_id, supplier_id, current_stock, minimum_stock, maximum_stock, 
                 reorder_point, unit_cost, unit_measure, last_restocked, turnover_rate, wastage_rate)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                restaurant_id, product_id, supplier_id, current_stock, min_stock, max_stock,
                min_stock + 5, round(random.uniform(1.50, 5.00), 2), 'each',
                datetime.now() - timedelta(days=random.randint(1, 30)),
                round(random.uniform(2.0, 8.5), 2), round(random.uniform(1.0, 5.0), 2)
            ))

def create_users_and_employees(conn, restaurant_id, platform_id):
    """Create users and employee data from MockDataService"""
    with conn.cursor() as cur:
        # Create platform owner
        cur.execute("""
            INSERT INTO users 
            (platform_id, email, password_hash, first_name, last_name, phone, role, is_active)
            VALUES (%s, %s, %s, %s, %s, %s, %s, true)
            RETURNING id;
        """, (platform_id, 'admin@fynlo.com', '$2b$12$dummy_hash', 'Platform', 'Admin', '+44 20 1111 0000', 'platform_owner'))
        platform_owner_id = cur.fetchone()[0]
        
        # Create restaurant users and employees
        employees_data = [
            ('manager@demo.com', 'Demo', 'Manager', '+44 20 1234 5001', 'manager', 'Manager', 'Management', 18.50, 'full_time'),
            ('sarah.johnson@demo.com', 'Sarah', 'Johnson', '+44 20 1234 5002', 'cashier', 'Senior Cashier', 'Front of House', 12.50, 'full_time'),
            ('mike.chen@demo.com', 'Mike', 'Chen', '+44 20 1234 5003', 'cook', 'Head Chef', 'Kitchen', 16.75, 'full_time'),
            ('emma.davis@demo.com', 'Emma', 'Davis', '+44 20 1234 5004', 'server', 'Senior Server', 'Front of House', 11.25, 'part_time'),
            ('tom.wilson@demo.com', 'Tom', 'Wilson', '+44 20 1234 5005', 'cashier', 'Cashier', 'Front of House', 10.50, 'part_time'),
            ('anna.garcia@demo.com', 'Anna', 'Garcia', '+44 20 1234 5006', 'cook', 'Line Cook', 'Kitchen', 13.25, 'full_time'),
        ]
        
        employee_ids = []
        for email, first_name, last_name, phone, role, job_title, department, hourly_rate, emp_type in employees_data:
            # Create user
            cur.execute("""
                INSERT INTO users 
                (restaurant_id, platform_id, email, password_hash, first_name, last_name, phone, role, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id;
            """, (restaurant_id, platform_id, email, '$2b$12$dummy_hash', first_name, last_name, phone, role))
            user_id = cur.fetchone()[0]
            
            # Create employee
            hire_date = datetime.now() - timedelta(days=random.randint(30, 730))
            employee_number = f"EMP{1000 + len(employee_ids) + 1}"
            
            cur.execute("""
                INSERT INTO employees 
                (restaurant_id, user_id, employee_number, hire_date, job_title, department, 
                 hourly_rate, employment_type, is_active)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, true)
                RETURNING id;
            """, (restaurant_id, user_id, employee_number, hire_date, job_title, department, hourly_rate, emp_type))
            employee_ids.append(cur.fetchone()[0])
            
        return employee_ids

def create_sample_orders(conn, restaurant_id, product_ids, employee_ids):
    """Create sample order data for testing"""
    with conn.cursor() as cur:
        # Create 20 sample orders from the last week
        for i in range(20):
            order_date = datetime.now() - timedelta(days=random.randint(0, 7), 
                                                  hours=random.randint(10, 22), 
                                                  minutes=random.randint(0, 59))
            order_number = f"ORD-{int(order_date.timestamp()) % 1000000}"
            
            # Create order
            cur.execute("""
                INSERT INTO orders 
                (restaurant_id, order_number, table_number, order_type, status, 
                 subtotal, tax_amount, service_charge, total_amount, items_count, 
                 served_by, created_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id;
            """, (
                restaurant_id, order_number, f"Table {random.randint(1, 20)}",
                random.choice(['dine_in', 'takeaway']), 'completed',
                0, 0, 0, 0, 0,  # Will be calculated after adding items
                random.choice(employee_ids), order_date
            ))
            order_id = cur.fetchone()[0]
            
            # Add 1-4 items to each order
            items_count = random.randint(1, 4)
            subtotal = 0
            
            selected_products = random.sample(product_ids, items_count)
            for product_id in selected_products:
                # Get product price
                cur.execute("SELECT price FROM products WHERE id = %s", (product_id,))
                unit_price = cur.fetchone()[0]
                
                quantity = random.randint(1, 3)
                total_price = unit_price * quantity
                subtotal += total_price
                
                cur.execute("""
                    INSERT INTO order_items (order_id, product_id, quantity, unit_price, total_price)
                    VALUES (%s, %s, %s, %s, %s)
                """, (order_id, product_id, quantity, unit_price, total_price))
            
            # Update order totals
            tax_amount = subtotal * 0.20  # 20% VAT
            service_charge = subtotal * 0.125  # 12.5% service charge
            total_amount = subtotal + tax_amount + service_charge
            
            cur.execute("""
                UPDATE orders 
                SET subtotal = %s, tax_amount = %s, service_charge = %s, 
                    total_amount = %s, items_count = %s
                WHERE id = %s
            """, (subtotal, tax_amount, service_charge, total_amount, items_count, order_id))
            
            # Create payment record
            cur.execute("""
                INSERT INTO payments 
                (restaurant_id, order_id, payment_method, amount, commission_rate, 
                 commission_amount, status, processed_at)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """, (
                restaurant_id, order_id, random.choice(['card', 'cash', 'apple_pay']),
                total_amount, 8.00, total_amount * 0.08, 'completed', order_date
            ))

def main():
    """Main migration function"""
    print("🌱 Starting mock data to database seed migration...")
    
    conn = connect_db()
    conn.autocommit = False
    
    try:
        # Create all seed data
        platform_id = create_platform_data(conn)
        print(f"✅ Created platform with ID: {platform_id}")
        
        restaurant_id = create_restaurant_data(conn, platform_id)
        print(f"✅ Created restaurant with ID: {restaurant_id}")
        
        product_ids = create_categories_and_products(conn, restaurant_id)
        print(f"✅ Created {len(product_ids)} products with categories")
        
        supplier_ids = create_suppliers(conn, restaurant_id)
        print(f"✅ Created {len(supplier_ids)} suppliers")
        
        create_inventory_data(conn, restaurant_id, product_ids, supplier_ids)
        print("✅ Created inventory tracking data")
        
        employee_ids = create_users_and_employees(conn, restaurant_id, platform_id)
        print(f"✅ Created {len(employee_ids)} employees with user accounts")
        
        create_sample_orders(conn, restaurant_id, product_ids, employee_ids)
        print("✅ Created sample order data")
        
        # Commit all changes
        conn.commit()
        print("✅ All seed data committed successfully!")
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Error during migration: {e}")
        raise
    finally:
        conn.close()

if __name__ == "__main__":
    main()
EOF

# Make the script executable
chmod +x migrate_mock_data.py

# Install required Python packages
pip install psycopg2-binary

# Run the migration
python3 migrate_mock_data.py

echo "✅ Mock data successfully migrated to database"
```

### Step 4: Cache Migration (Sessions → Valkey)

#### 4.1 Export Current Session Data
```bash
# If using Redis currently, export session data
# Adjust connection details for your current Redis instance

# Export all session keys
redis-cli -h current-redis-host \
          -p 6379 \
          --scan \
          --pattern "session:*" > session_keys.txt

# Export session data
while read key; do
    echo "SET $key \"$(redis-cli -h current-redis-host GET $key)\"" >> sessions_export.redis
done < session_keys.txt

echo "✅ Session data exported"
```

#### 4.2 Import Sessions to Valkey
```bash
# Import sessions to DigitalOcean Valkey
redis-cli -u "$FYNLO_REDIS_URL" < sessions_export.redis

# Verify session import
redis-cli -u "$FYNLO_REDIS_URL" INFO keyspace

# Test session functionality
redis-cli -u "$FYNLO_REDIS_URL" SET "test_session" "test_value" EX 3600
redis-cli -u "$FYNLO_REDIS_URL" GET "test_session"

echo "✅ Sessions migrated to Valkey"
```

### Step 5: File Path Migration

#### 5.1 Update File References in Database
```sql
-- Update file paths to point to DigitalOcean Spaces
-- This assumes you've migrated files to Spaces (covered in next phase)

-- Update user profile images
UPDATE users 
SET profile_image_url = REPLACE(
    profile_image_url, 
    'https://old-storage-domain.com/', 
    'https://fynlo-pos-storage.lon1.digitaloceanspaces.com/'
) 
WHERE profile_image_url IS NOT NULL;

-- Update restaurant logos
UPDATE restaurants 
SET logo_url = REPLACE(
    logo_url, 
    'https://old-storage-domain.com/', 
    'https://fynlo-pos-storage.lon1.digitaloceanspaces.com/'
) 
WHERE logo_url IS NOT NULL;

-- Update menu item images
UPDATE menu_items 
SET image_url = REPLACE(
    image_url, 
    'https://old-storage-domain.com/', 
    'https://fynlo-pos-storage.lon1.digitaloceanspaces.com/'
) 
WHERE image_url IS NOT NULL;

-- Update receipt attachments
UPDATE orders 
SET receipt_url = REPLACE(
    receipt_url, 
    'https://old-storage-domain.com/', 
    'https://fynlo-pos-storage.lon1.digitaloceanspaces.com/'
) 
WHERE receipt_url IS NOT NULL;
```

Run the file path updates:
```bash
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
-- Paste the above SQL updates here
"

# Verify file path updates
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SELECT COUNT(*) as total_files,
       COUNT(CASE WHEN logo_url LIKE '%digitaloceanspaces%' THEN 1 END) as migrated_files
FROM restaurants 
WHERE logo_url IS NOT NULL;
"

echo "✅ File paths updated"
```

### Step 6: Update Backend Configuration

#### 6.1 Update Backend Database Connection
Update `backend/.env`:
```bash
# Update backend environment with new database URLs
cat >> backend/.env << EOF

# DigitalOcean Database Configuration (UPDATED)
DATABASE_URL=$FYNLO_DATABASE_URL/fynlo_production
DATABASE_POOL_SIZE=20
DATABASE_MAX_OVERFLOW=30

# DigitalOcean Cache Configuration (UPDATED)
REDIS_URL=$FYNLO_REDIS_URL
CACHE_TTL=3600

# Connection Health Checks
DATABASE_HEALTH_CHECK_INTERVAL=30
CACHE_HEALTH_CHECK_INTERVAL=60

EOF

echo "✅ Backend configuration updated"
```

#### 6.2 Test Backend Database Connectivity
```bash
# Test backend can connect to new database
cd backend/

# Run database connectivity test
python -c "
import os
import psycopg2
from urllib.parse import urlparse

database_url = os.getenv('DATABASE_URL')
parsed = urlparse(database_url)

try:
    conn = psycopg2.connect(
        host=parsed.hostname,
        port=parsed.port,
        user=parsed.username,
        password=parsed.password,
        database=parsed.path[1:]  # Remove leading slash
    )
    
    cursor = conn.cursor()
    cursor.execute('SELECT COUNT(*) FROM users;')
    user_count = cursor.fetchone()[0]
    
    print(f'✅ Database connection successful')
    print(f'✅ Found {user_count} users in database')
    
    conn.close()
    
except Exception as e:
    print(f'❌ Database connection failed: {e}')
"

# Test cache connectivity
python -c "
import os
import redis

redis_url = os.getenv('REDIS_URL')

try:
    r = redis.from_url(redis_url)
    r.ping()
    
    # Test set/get
    r.set('test_key', 'test_value', ex=60)
    value = r.get('test_key')
    
    print(f'✅ Cache connection successful')
    print(f'✅ Test value: {value.decode() if value else None}')
    
except Exception as e:
    print(f'❌ Cache connection failed: {e}')
"

echo "✅ Backend connectivity verified"
```

### Step 7: Application Cutover

#### 7.1 Prepare for Cutover
```bash
# Create cutover checklist
echo "📋 Pre-cutover verification:"

# 1. Verify data integrity
echo "1. Checking data integrity..."
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SELECT 
    'users' as table_name, COUNT(*) as record_count 
FROM users
UNION ALL
SELECT 
    'restaurants' as table_name, COUNT(*) as record_count 
FROM restaurants
UNION ALL
SELECT 
    'orders' as table_name, COUNT(*) as record_count 
FROM orders
UNION ALL
SELECT 
    'payments' as table_name, COUNT(*) as record_count 
FROM payments;
"

# 2. Verify cache connectivity
echo "2. Checking cache connectivity..."
redis-cli -u "$FYNLO_REDIS_URL" PING

# 3. Verify backend health
echo "3. Checking backend health..."
curl -f https://$FYNLO_APP_URL/health || echo "❌ Backend health check failed"

echo "✅ Pre-cutover checks completed"
```

#### 7.2 Execute Cutover
```bash
# Maintenance mode (if applicable)
echo "🚧 Entering maintenance mode..."

# 1. Stop old backend services
echo "1. Stopping old services..."
# Stop your current backend service
# systemctl stop your-old-backend  # Adjust for your setup

# 2. Update mobile app configuration
echo "2. Updating mobile app configuration..."
# Update mobile app to point to new DigitalOcean backend
# This should be done via environment variables

# 3. Deploy updated backend
echo "3. Deploying updated backend..."
cd backend/
# Deploy to DigitalOcean App Platform
doctl apps create-deployment $FYNLO_APP_ID

# Wait for deployment
echo "⏳ Waiting for backend deployment..."
while [ "$(doctl apps get $FYNLO_APP_ID --format Phase --no-header)" != "ACTIVE" ]; do
  echo "Backend still deploying... waiting 30 seconds"
  sleep 30
done

echo "✅ Backend deployed successfully"

# 4. Verify application functionality
echo "4. Verifying application functionality..."
curl -f https://$FYNLO_APP_URL/health
curl -f https://$FYNLO_APP_URL/api/restaurants  # Test API endpoint

echo "✅ Cutover completed successfully"
```

## ✅ Verification Steps

### Step 1: Data Integrity Verification
```bash
# Comprehensive data verification
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
-- Check table row counts
SELECT 
    schemaname,
    tablename,
    n_tup_ins as total_rows
FROM pg_stat_user_tables 
ORDER BY tablename;

-- Check for data consistency
SELECT 
    COUNT(DISTINCT platform_id) as platforms,
    COUNT(DISTINCT id) as restaurants
FROM restaurants;

SELECT 
    COUNT(DISTINCT restaurant_id) as restaurants_with_users,
    COUNT(*) as total_users
FROM users;

-- Check recent data
SELECT 
    DATE(created_at) as date,
    COUNT(*) as orders_count
FROM orders 
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
"
```

### Step 2: Performance Verification
```bash
# Test database performance
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
-- Test query performance
EXPLAIN ANALYZE 
SELECT u.*, r.name as restaurant_name 
FROM users u 
JOIN restaurants r ON u.restaurant_id = r.id 
WHERE u.is_active = true 
LIMIT 100;
"

# Test cache performance
redis-cli -u "$FYNLO_REDIS_URL" --latency-history -i 1

echo "✅ Performance verification completed"
```

### Step 3: Application Integration Testing
```bash
# Test critical application flows
echo "🧪 Testing critical application flows..."

# 1. User authentication
curl -X POST https://$FYNLO_APP_URL/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass"}'

# 2. Restaurant data retrieval
curl https://$FYNLO_APP_URL/api/restaurants

# 3. Order creation
curl -X POST https://$FYNLO_APP_URL/api/orders \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"restaurant_id":1,"items":[{"name":"Test Item","price":10.00}]}'

# 4. Payment processing (test endpoint)
curl -X POST https://$FYNLO_APP_URL/api/payments/sumup/initialize \
  -H "Authorization: Bearer YOUR_TOKEN"

echo "✅ Application integration testing completed"
```

## 🚨 Troubleshooting

### Issue: Data Migration Fails with Foreign Key Constraints
**Symptoms**: Constraint violation errors during data import
**Solution**:
```bash
# Temporarily disable foreign key checks
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SET session_replication_role = replica;
-- Run your data imports here
SET session_replication_role = DEFAULT;
"

# Alternative: Import in dependency order
# 1. Platforms, 2. Restaurants, 3. Users, 4. Orders, 5. Payments
```

### Issue: Connection Pool Exhaustion
**Symptoms**: "Too many connections" errors
**Solution**:
```bash
# Check current connections
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "
SELECT count(*) as active_connections 
FROM pg_stat_activity 
WHERE state = 'active';
"

# Optimize connection pool settings
# Update backend/.env:
# DATABASE_POOL_SIZE=10
# DATABASE_MAX_OVERFLOW=20
```

### Issue: Cache Connection Failures
**Symptoms**: Redis connection timeout or authentication errors
**Solution**:
```bash
# Verify Valkey cluster status
doctl databases get fynlo-pos-cache

# Test connection with verbose output
redis-cli -u "$FYNLO_REDIS_URL" --verbose PING

# Check firewall rules
doctl compute firewall get $FYNLO_FIREWALL_ID
```

### Issue: Slow Query Performance
**Symptoms**: Database queries taking too long
**Solution**:
```sql
-- Analyze query performance
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM orders 
WHERE restaurant_id = 1 
AND created_at >= '2024-01-01';

-- Add missing indexes
CREATE INDEX CONCURRENTLY idx_orders_restaurant_date 
ON orders(restaurant_id, created_at);

-- Update table statistics
ANALYZE orders;
```

## 🔄 Rollback Procedures

### Emergency Rollback to Previous Database
```bash
echo "🚨 EMERGENCY ROLLBACK PROCEDURE"
echo "This will restore the previous database configuration"

# 1. Update backend to use old database
cp backend/.env.backup backend/.env

# 2. Restart backend with old configuration
doctl apps create-deployment $FYNLO_APP_ID

# 3. Update mobile app configuration (if needed)
# Revert mobile app environment to point to old backend

# 4. Verify old system is working
curl -f https://old-backend-url/health

echo "✅ Rollback completed - verify all systems working"
echo "⚠️  Remember to sync any new data created during migration"
```

### Partial Rollback (Database Only)
```bash
# Keep DigitalOcean infrastructure but restore old data
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "DROP SCHEMA public CASCADE;"
psql "$FYNLO_DATABASE_URL/fynlo_production" -c "CREATE SCHEMA public;"

# Restore from backup
psql "$FYNLO_DATABASE_URL/fynlo_production" -f fynlo_backup_*.sql

echo "✅ Database restored from backup"
```

## ✨ Completion Criteria

- [x] All application data migrated to DigitalOcean PostgreSQL
- [x] Session data migrated to Valkey cache
- [x] File references updated to point to Spaces
- [x] Backend connected to new databases
- [x] Application functionality verified end-to-end
- [x] Performance meets or exceeds previous system
- [x] Backup and recovery procedures tested
- [x] Monitoring shows healthy database metrics

## 📊 Migration Summary

### Data Migrated:
- **Users**: [X] records
- **Restaurants**: [X] records  
- **Orders**: [X] records
- **Payments**: [X] records
- **Settings**: [X] records
- **Session Data**: [X] keys migrated to Valkey

### Performance Improvements:
- **Query Performance**: [X]% faster (due to SSD storage and optimized indexes)
- **Backup Reliability**: Daily automated backups with point-in-time recovery
- **Scalability**: Instant scaling capabilities with managed service
- **Availability**: 99.95% uptime SLA with automatic failover

## 📝 Next Steps

After completing this phase:
1. **Continue to**: `DIGITALOCEAN_STORAGE_CDN_SETUP.md`
2. **Verify**: All database operations working smoothly
3. **Monitor**: Database performance and optimize as needed
4. **Document**: Any custom configurations or optimizations made

## 📈 Progress Tracking

- **Risk Level**: 🔴 High (data migration always carries risk)
- **Time Estimate**: 4-8 hours (depending on data size)
- **Dependencies**: Phase 3 completed (infrastructure ready)
- **Impacts**: All application data, Session management, File references

---

**💾 Database Status**: Fully migrated to DigitalOcean managed services
**🚀 Performance**: Optimized with proper indexing and connection pooling
**🔄 Next Phase**: File storage and CDN setup for complete migration