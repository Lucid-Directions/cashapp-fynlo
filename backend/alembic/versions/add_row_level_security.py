"""Add Row Level Security (RLS) policies for multi-tenant isolation.

Revision ID: add_row_level_security
Revises: add_restaurant_id_inventory
Create Date: 2024-01-28 11:00:00.000000

"""

from sqlalchemy import text

from alembic import op

# revision identifiers, used by Alembic.
revision = "add_row_level_security"
down_revision = "add_restaurant_id_inventory"
branch_labels = None
depends_on = None


def upgrade():
    """Add Row Level Security policies to all tenant-specific tables."""
    # Get connection
    conn = op.get_bind()

    # List of tables that need RLS policies
    tenant_tables = [
        "restaurants",
        "users",
        "products",
        "categories",
        "orders",
        "order_items",
        "payments",
        "inventory",
        "recipe",
        "inventory_ledger",
        "suppliers",
        "purchase_orders",
        "stock_movements",
        "stock_alerts",
        "inventory_counts",
        "tables",
        "sections",
        "pos_sessions",
    ]

    # Enable RLS on all tenant tables
    for table in tenant_tables:
        conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))
        conn.execute(text(f"ALTER TABLE {table} FORCE ROW LEVEL SECURITY"))

    # Create a function to get current user's restaurant_id
    conn.execute(
        text(
            """
        CREATE OR REPLACE FUNCTION auth.restaurant_id()
        RETURNS UUID AS $$
        BEGIN
            -- Get restaurant_id from JWT claims or session
            -- This assumes you're setting restaurant_id in the session
            RETURN current_setting('app.current_restaurant_id', true)::UUID;
        EXCEPTION
            WHEN OTHERS THEN
                RETURN NULL;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
        )
    )

    # Create a function to check if user is platform owner
    conn.execute(
        text(
            """
        CREATE OR REPLACE FUNCTION auth.is_platform_owner()
        RETURNS BOOLEAN AS $$
        BEGIN
            -- Check if current user role is platform_owner
            RETURN current_setting('app.current_user_role', true)
                = 'platform_owner';
        EXCEPTION
            WHEN OTHERS THEN
                RETURN FALSE;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
        )
    )

    # Create RLS policies for each table
    for table in tenant_tables:
        if table == "restaurants":
            # Special policy for restaurants table
            conn.execute(
                text(
                    f"""
                CREATE POLICY restaurant_isolation_select ON {table}
                FOR SELECT
                USING (
                    auth.is_platform_owner() OR
                    id = auth.restaurant_id()
                )
            """
                )
            )

            conn.execute(
                text(
                    f"""
                CREATE POLICY restaurant_isolation_modify ON {table}
                FOR ALL
                USING (
                    auth.is_platform_owner() OR
                    id = auth.restaurant_id()
                )
                WITH CHECK (
                    auth.is_platform_owner() OR
                    id = auth.restaurant_id()
                )
            """
                )
            )
        else:
            # Standard policy for tables with restaurant_id column
            conn.execute(
                text(
                    f"""
                CREATE POLICY tenant_isolation_select ON {table}
                FOR SELECT
                USING (
                    auth.is_platform_owner() OR
                    restaurant_id = auth.restaurant_id()
                )
            """
                )
            )

            conn.execute(
                text(
                    f"""
                CREATE POLICY tenant_isolation_insert ON {table}
                FOR INSERT
                WITH CHECK (
                    auth.is_platform_owner() OR
                    restaurant_id = auth.restaurant_id()
                )
            """
                )
            )

            conn.execute(
                text(
                    f"""
                CREATE POLICY tenant_isolation_update ON {table}
                FOR UPDATE
                USING (
                    auth.is_platform_owner() OR
                    restaurant_id = auth.restaurant_id()
                )
                WITH CHECK (
                    auth.is_platform_owner() OR
                    restaurant_id = auth.restaurant_id()
                )
            """
                )
            )

            conn.execute(
                text(
                    f"""
                CREATE POLICY tenant_isolation_delete ON {table}
                FOR DELETE
                USING (
                    auth.is_platform_owner() OR
                    restaurant_id = auth.restaurant_id()
                )
            """
                )
            )

    # Create additional security functions
    conn.execute(
        text(
            """
        CREATE OR REPLACE FUNCTION auth.check_restaurant_access(
            target_restaurant_id UUID
        )
        RETURNS BOOLEAN AS $$
        BEGIN
            RETURN auth.is_platform_owner()
                OR target_restaurant_id = auth.restaurant_id();
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
        )
    )

    # Create audit trigger function
    conn.execute(
        text(
            """
        CREATE OR REPLACE FUNCTION audit.log_data_access()
        RETURNS TRIGGER AS $$
        BEGIN
            -- Log data access for security auditing
            -- This will be expanded in the audit logging implementation
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql SECURITY DEFINER;
    """
        )
    )


def downgrade():
    """Remove Row Level Security policies."""
    conn = op.get_bind()

    tenant_tables = [
        "restaurants",
        "users",
        "products",
        "categories",
        "orders",
        "order_items",
        "payments",
        "inventory",
        "recipe",
        "inventory_ledger",
        "suppliers",
        "purchase_orders",
        "stock_movements",
        "stock_alerts",
        "inventory_counts",
        "tables",
        "sections",
        "pos_sessions",
    ]

    # Drop all policies
    for table in tenant_tables:
        if table == "restaurants":
            conn.execute(
                text(
                    f"DROP POLICY IF EXISTS restaurant_isolation_select "
                    f"ON {table}"
                )
            )
            conn.execute(
                text(
                    f"DROP POLICY IF EXISTS restaurant_isolation_modify "
                    f"ON {table}"
                )
            )
        else:
            conn.execute(
                text(
                    f"DROP POLICY IF EXISTS tenant_isolation_select ON {table}"
                )
            )
            conn.execute(
                text(
                    f"DROP POLICY IF EXISTS tenant_isolation_insert ON {table}"
                )
            )
            conn.execute(
                text(
                    f"DROP POLICY IF EXISTS tenant_isolation_update ON {table}"
                )
            )
            conn.execute(
                text(
                    f"DROP POLICY IF EXISTS tenant_isolation_delete ON {table}"
                )
            )

    # Disable RLS
    for table in tenant_tables:
        conn.execute(text(f"ALTER TABLE {table} DISABLE ROW LEVEL SECURITY"))

    # Drop functions
    conn.execute(text("DROP FUNCTION IF EXISTS auth.restaurant_id()"))
    conn.execute(text("DROP FUNCTION IF EXISTS auth.is_platform_owner()"))
    conn.execute(
        text("DROP FUNCTION IF EXISTS auth.check_restaurant_access(UUID)")
    )
    conn.execute(text("DROP FUNCTION IF EXISTS audit.log_data_access()"))
