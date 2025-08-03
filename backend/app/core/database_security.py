"""
Database Security Hardening Configuration
Implements security best practices for PostgreSQL connections
"""

from typing import Dict, Any
import logging
from sqlalchemy.engine import Engine
from sqlalchemy import event, text
from sqlalchemy.pool import Pool

logger = logging.getLogger(__name__)


class DatabaseSecurityConfig:
    """Database security configuration and hardening"""

    @staticmethod
    def get_secure_engine_args() -> Dict[str, Any]:
        """
        Get security-hardened database engine arguments

        Returns:
            Dictionary of engine configuration options
        """
        return {
            # Connection pool settings
            "pool_pre_ping": True,  # Test connections before using
            "pool_recycle": 3600,  # Recycle connections after 1 hour
            "pool_size": 10,  # Limit concurrent connections
            "max_overflow": 20,  # Maximum overflow connections
            # Statement timeout to prevent long-running queries
            "connect_args": {
                "options": "-c statement_timeout=30000",  # 30 second timeout
                "sslmode": "prefer",  # Use SSL when available
                "client_encoding": "utf8",
                "application_name": "fynlo_pos_backend",
            },
            # Additional security settings
            "echo": False,  # Never log SQL in production
            "future": True,  # Use SQLAlchemy 2.0 style
        }

    @staticmethod
    def apply_connection_security(engine: Engine) -> None:
        """
        Apply security configurations to database connections

        Args:
            engine: SQLAlchemy engine instance
        """

        @event.listens_for(Pool, "connect")
        def set_security_parameters(dbapi_conn, connection_record):
            """Set security parameters on each new connection"""
            with dbapi_conn.cursor() as cursor:
                # Disable dynamic loading of shared libraries
                cursor.execute("SET local_preload_libraries = ''")

                # Set secure search path
                cursor.execute("SET search_path = public")

                # Enable row-level security
                cursor.execute("SET row_security = on")

                # Set transaction isolation level
                cursor.execute("SET default_transaction_isolation = 'read committed'")

                # Limit work memory to prevent DoS
                cursor.execute("SET work_mem = '4MB'")

                # Set statement timeout
                cursor.execute("SET statement_timeout = '30s'")

                # Try to log slow queries (requires SUPERUSER in some environments)
                try:
                    cursor.execute(
                        "SET log_min_duration_statement = '1000'"
                    )  # 1 second
                except Exception:
                    # Ignore if we don't have permission (e.g., DigitalOcean managed DB)
                    pass

        @event.listens_for(engine, "connect")
        def receive_connect(dbapi_conn, connection_record):
            """Additional connection-level security"""
            connection_record.info["pid"] = dbapi_conn.get_backend_pid()
            logger.debug(
                f"New database connection established: PID {connection_record.info['pid']}"
            )

    @staticmethod
    def create_security_functions(engine: Engine) -> None:
        """
        Create database security functions and triggers

        Args:
            engine: SQLAlchemy engine instance
        """
        with engine.connect() as conn:
            # Create audit log table if not exists
            conn.execute(
                text(
                    """
                CREATE TABLE IF NOT EXISTS security_audit_log (
                    id BIGSERIAL PRIMARY KEY,
                    event_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                    event_type VARCHAR(50) NOT NULL,
                    user_id UUID,
                    table_name VARCHAR(100),
                    operation VARCHAR(20),
                    query_text TEXT,
                    ip_address INET,
                    details JSONB
                )
            """
                )
            )

            # Create index on audit log
            conn.execute(
                text(
                    """
                CREATE INDEX IF NOT EXISTS idx_audit_log_time 
                ON security_audit_log(event_time DESC)
            """
                )
            )

            # Create function to log suspicious activities
            conn.execute(
                text(
                    """
                CREATE OR REPLACE FUNCTION log_suspicious_activity()
                RETURNS trigger AS $$
                BEGIN
                    INSERT INTO security_audit_log (
                        event_type, 
                        user_id, 
                        table_name, 
                        operation, 
                        details
                    ) VALUES (
                        'suspicious_query',
                        current_setting('app.current_user_id', true)::uuid,
                        TG_TABLE_NAME,
                        TG_OP,
                        jsonb_build_object(
                            'query', current_query(),
                            'timestamp', now()
                        )
                    );
                    RETURN NULL;
                END;
                $$ LANGUAGE plpgsql SECURITY DEFINER;
            """
                )
            )

            # Create function to validate UUIDs
            conn.execute(
                text(
                    """
                CREATE OR REPLACE FUNCTION is_valid_uuid(uuid_string text)
                RETURNS boolean AS $$
                BEGIN
                    RETURN uuid_string ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
                EXCEPTION
                    WHEN others THEN
                        RETURN false;
                END;
                $$ LANGUAGE plpgsql IMMUTABLE;
            """
                )
            )

            # Create function to sanitize text input
            conn.execute(
                text(
                    """
                CREATE OR REPLACE FUNCTION sanitize_text(input_text text)
                RETURNS text AS $$
                BEGIN
                    -- Remove null bytes using chr(0) instead of E'\\x00' to avoid encoding issues
                    input_text := replace(input_text, chr(0), '');
                    
                    -- Limit length
                    IF length(input_text) > 1000 THEN
                        input_text := left(input_text, 1000);
                    END IF;
                    
                    RETURN input_text;
                END;
                $$ LANGUAGE plpgsql IMMUTABLE;
            """
                )
            )

            conn.commit()

    @staticmethod
    def create_security_policies(engine: Engine) -> None:
        """
        Create row-level security policies

        Args:
            engine: SQLAlchemy engine instance
        """
        with engine.connect() as conn:
            # Enable RLS on sensitive tables
            tables_with_rls = [
                "users",
                "restaurants",
                "orders",
                "customers",
                "products",
                "inventory",
                "transactions",
            ]

            for table in tables_with_rls:
                try:
                    # Enable RLS
                    conn.execute(text(f"ALTER TABLE {table} ENABLE ROW LEVEL SECURITY"))

                    # Create policy for restaurant isolation
                    conn.execute(
                        text(
                            f"""
                        CREATE POLICY IF NOT EXISTS restaurant_isolation_policy
                        ON {table}
                        USING (
                            restaurant_id = current_setting('app.current_restaurant_id', true)::uuid
                            OR current_setting('app.current_user_role', true) = 'platform_owner'
                        )
                    """
                        )
                    )

                    logger.info(f"RLS enabled for table: {table}")
                except Exception as e:
                    logger.warning(f"Could not enable RLS for {table}: {e}")

            conn.commit()

    @staticmethod
    def apply_query_restrictions(engine: Engine) -> None:
        """
        Apply query-level restrictions and monitoring

        Args:
            engine: SQLAlchemy engine instance
        """

        @event.listens_for(engine, "before_cursor_execute")
        def receive_before_cursor_execute(
            conn, cursor, statement, parameters, context, executemany
        ):
            """Monitor and restrict dangerous queries"""

            # Log all data modification queries in production
            if any(
                keyword in statement.upper()
                for keyword in ["INSERT", "UPDATE", "DELETE", "DROP", "TRUNCATE"]
            ):
                logger.info(f"Data modification query: {statement[:100]}...")

            # Prevent certain dangerous operations
            dangerous_patterns = [
                "DROP DATABASE",
                "DROP SCHEMA",
                "TRUNCATE TABLE users",
                "DELETE FROM users WHERE 1=1",
                "UPDATE users SET password",
            ]

            statement_upper = statement.upper()
            for pattern in dangerous_patterns:
                if pattern in statement_upper:
                    raise Exception(f"Dangerous query pattern detected: {pattern}")

    @staticmethod
    def setup_monitoring(engine: Engine) -> None:
        """
        Setup query monitoring and performance tracking

        Args:
            engine: SQLAlchemy engine instance
        """

        @event.listens_for(engine, "before_cursor_execute")
        def receive_before_cursor_execute(
            conn, cursor, statement, parameters, context, executemany
        ):
            """Track query start time"""
            context._query_start_time = time.time()

        @event.listens_for(engine, "after_cursor_execute")
        def receive_after_cursor_execute(
            conn, cursor, statement, parameters, context, executemany
        ):
            """Log slow queries"""
            total_time = time.time() - context._query_start_time

            # Log queries taking more than 1 second
            if total_time > 1.0:
                logger.warning(
                    f"Slow query detected ({total_time:.2f}s): {statement[:100]}..."
                )

    @staticmethod
    def create_security_views(engine: Engine) -> None:
        """
        Create security monitoring views

        Args:
            engine: SQLAlchemy engine instance
        """
        with engine.connect() as conn:
            # Create view for monitoring active connections
            conn.execute(
                text(
                    """
                CREATE OR REPLACE VIEW security_active_connections AS
                SELECT 
                    pid,
                    usename,
                    application_name,
                    client_addr,
                    state,
                    query_start,
                    state_change,
                    query
                FROM pg_stat_activity
                WHERE datname = current_database()
                AND pid != pg_backend_pid()
            """
                )
            )

            # Create view for monitoring long-running queries
            conn.execute(
                text(
                    """
                CREATE OR REPLACE VIEW security_long_queries AS
                SELECT 
                    pid,
                    usename,
                    application_name,
                    client_addr,
                    extract(epoch from (now() - query_start)) as duration_seconds,
                    state,
                    query
                FROM pg_stat_activity
                WHERE datname = current_database()
                AND state != 'idle'
                AND query_start < now() - interval '5 minutes'
            """
                )
            )

            conn.commit()


import time  # Add this import at the top of the file


def apply_all_security_measures(engine: Engine) -> None:
    """
    Apply all database security measures

    Args:
        engine: SQLAlchemy engine instance
    """
    logger.info("Applying database security measures...")

    try:
        # Apply connection security
        DatabaseSecurityConfig.apply_connection_security(engine)

        # Create security functions
        DatabaseSecurityConfig.create_security_functions(engine)

        # Create RLS policies
        DatabaseSecurityConfig.create_security_policies(engine)

        # Apply query restrictions
        DatabaseSecurityConfig.apply_query_restrictions(engine)

        # Setup monitoring
        DatabaseSecurityConfig.setup_monitoring(engine)

        # Create security views
        DatabaseSecurityConfig.create_security_views(engine)

        logger.info("Database security measures applied successfully")

    except Exception as e:
        logger.error(f"Error applying security measures: {e}")
        # Don't fail startup, but log the error
