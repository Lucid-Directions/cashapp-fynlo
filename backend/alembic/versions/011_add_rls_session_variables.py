"""
Add RLS session variable support

Revision ID: 011_add_rls_session_variables
Revises: 010_add_row_level_security
Create Date: 2024-01-29 10:00:00.000000
"""

from alembic import op

# revision identifiers
revision = '011_add_rls_session_variables'
down_revision = '11cec540dd38'
branch_labels = None
depends_on = None


def upgrade():
    """
    Add session variable configuration for RLS
    """
    # Create custom configuration parameters for session variables
    op.execute("""
        -- Create custom configuration parameters for RLS session variables
        -- These will be used to pass user context to RLS policies
        
        -- Note: These need to be set in postgresql.conf or via ALTER SYSTEM
        -- For development/testing, we'll use SET LOCAL in each session
        
        -- Create a function to safely get session variables with defaults
        CREATE OR REPLACE FUNCTION current_setting_or_default(
            setting_name text,
            default_value text DEFAULT NULL
        ) RETURNS text AS $$
        BEGIN
            RETURN current_setting(setting_name, true);
        EXCEPTION
            WHEN undefined_object THEN
                RETURN default_value;
            WHEN OTHERS THEN
                RETURN default_value;
        END;
        $$ LANGUAGE plpgsql STABLE;
        
        -- Create helper functions for RLS policies to use session variables
        CREATE OR REPLACE FUNCTION get_current_user_id() RETURNS UUID AS $$
        BEGIN
            RETURN current_setting_or_default('app.current_user_id', NULL)::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
        
        CREATE OR REPLACE FUNCTION get_current_restaurant_id() RETURNS UUID AS $$
        BEGIN
            RETURN current_setting_or_default('app.current_restaurant_id', NULL)::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql STABLE;
        
        CREATE OR REPLACE FUNCTION get_current_user_role() RETURNS TEXT AS $$
        BEGIN
            RETURN current_setting_or_default('app.current_user_role', 'anonymous');
        END;
        $$ LANGUAGE plpgsql STABLE;
        
        CREATE OR REPLACE FUNCTION is_current_platform_owner() RETURNS BOOLEAN AS $$
        BEGIN
            RETURN COALESCE(
                current_setting_or_default('app.is_platform_owner', 'false')::BOOLEAN,
                FALSE
            );
        END;
        $$ LANGUAGE plpgsql STABLE;
    """)
    
    # Update RLS policies to use session variables
    # This ensures policies work with connection pooling
    
    # Drop existing policies
    tables_with_rls = [
        'orders', 'order_items', 'payments', 'tables', 'categories',
        'products', 'product_variations', 'product_modifiers',
        'modifier_groups', 'employees', 'customers', 'inventory_items',
        'inventory_movements', 'suppliers', 'supplier_orders',
        'shifts', 'cash_movements', 'reports', 'activity_logs'
    ]
    
    for table in tables_with_rls:
        op.execute(f"""
            DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};
            DROP POLICY IF EXISTS {table}_platform_owner_access ON {table};
        """)
    
    # Create new policies using session variables
    for table in tables_with_rls:
        # Regular tenant isolation policy
        op.execute(f"""
            CREATE POLICY {table}_tenant_isolation ON {table}
            FOR ALL
            TO authenticated
            USING (
                restaurant_id = get_current_restaurant_id()
                OR is_current_platform_owner()
            );
        """)
        
        # Platform owner bypass policy (redundant but explicit)
        op.execute(f"""
            CREATE POLICY {table}_platform_owner_access ON {table}
            FOR ALL
            TO authenticated
            USING (
                is_current_platform_owner()
            );
        """)
    
    # Special handling for users table
    op.execute("""
        DROP POLICY IF EXISTS users_tenant_isolation ON users;
        DROP POLICY IF EXISTS users_platform_owner_access ON users;
        
        -- Users can only see users from their restaurant
        CREATE POLICY users_tenant_isolation ON users
        FOR ALL
        TO authenticated
        USING (
            restaurant_id = get_current_restaurant_id()
            OR is_current_platform_owner()
            OR id = get_current_user_id()  -- Users can always see themselves
        );
        
        -- Platform owners can see all users
        CREATE POLICY users_platform_owner_access ON users
        FOR ALL
        TO authenticated
        USING (
            is_current_platform_owner()
        );
    """)
    
    # Create an audit trigger for session variable usage
    op.execute("""
        CREATE OR REPLACE FUNCTION audit_session_variables()
        RETURNS TRIGGER AS $$
        DECLARE
            session_user_id UUID;
            session_restaurant_id UUID;
            session_role TEXT;
            session_is_platform_owner BOOLEAN;
        BEGIN
            -- Get current session variables
            session_user_id := get_current_user_id();
            session_restaurant_id := get_current_restaurant_id();
            session_role := get_current_user_role();
            session_is_platform_owner := is_current_platform_owner();
            
            -- Add session info to audit columns if they exist
            IF TG_OP IN ('INSERT', 'UPDATE') THEN
                -- Set audit user if column exists
                IF column_exists(TG_TABLE_NAME, 'last_modified_by') THEN
                    NEW.last_modified_by := session_user_id;
                END IF;
                
                -- Log platform owner access in activity logs
                IF session_is_platform_owner AND session_restaurant_id IS NOT NULL THEN
                    INSERT INTO activity_logs (
                        user_id,
                        restaurant_id,
                        action,
                        entity_type,
                        entity_id,
                        details,
                        created_at
                    ) VALUES (
                        session_user_id,
                        COALESCE(NEW.restaurant_id, session_restaurant_id),
                        TG_OP,
                        TG_TABLE_NAME,
                        NEW.id::TEXT,
                        jsonb_build_object(
                            'platform_owner_access', true,
                            'session_role', session_role
                        ),
                        NOW()
                    );
                END IF;
            END IF;
            
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;
        
        -- Helper function to check if column exists
        CREATE OR REPLACE FUNCTION column_exists(
            table_name text,
            column_name text
        ) RETURNS BOOLEAN AS $$
        BEGIN
            RETURN EXISTS (
                SELECT 1 
                FROM information_schema.columns 
                WHERE table_name = $1 
                AND column_name = $2
            );
        END;
        $$ LANGUAGE plpgsql;
    """)
    
    # Add session variable audit triggers to critical tables
    critical_tables = ['orders', 'payments', 'users', 'employees']
    
    for table in critical_tables:
        op.execute(f"""
            CREATE TRIGGER {table}_session_audit
            BEFORE INSERT OR UPDATE ON {table}
            FOR EACH ROW
            EXECUTE FUNCTION audit_session_variables();
        """)


def downgrade():
    """
    Remove session variable support
    """
    # Drop audit triggers
    critical_tables = ['orders', 'payments', 'users', 'employees']
    for table in critical_tables:
        op.execute(f"DROP TRIGGER IF EXISTS {table}_session_audit ON {table}")
    
    # Drop functions
    op.execute("""
        DROP FUNCTION IF EXISTS audit_session_variables() CASCADE;
        DROP FUNCTION IF EXISTS column_exists(text, text) CASCADE;
        DROP FUNCTION IF EXISTS is_current_platform_owner() CASCADE;
        DROP FUNCTION IF EXISTS get_current_user_role() CASCADE;
        DROP FUNCTION IF EXISTS get_current_restaurant_id() CASCADE;
        DROP FUNCTION IF EXISTS get_current_user_id() CASCADE;
        DROP FUNCTION IF EXISTS current_setting_or_default(text, text) CASCADE;
    """)
    
    # Restore original RLS policies
    tables_with_rls = [
        'orders', 'order_items', 'payments', 'tables', 'categories',
        'products', 'product_variations', 'product_modifiers',
        'modifier_groups', 'employees', 'customers', 'inventory_items',
        'inventory_movements', 'suppliers', 'supplier_orders',
        'shifts', 'cash_movements', 'reports', 'activity_logs', 'users'
    ]
    
    for table in tables_with_rls:
        op.execute(f"""
            DROP POLICY IF EXISTS {table}_tenant_isolation ON {table};
            DROP POLICY IF EXISTS {table}_platform_owner_access ON {table};
        """)