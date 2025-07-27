"""Add subscription fields to restaurants table

Revision ID: add_subscription_fields
Revises: 
Create Date: 2025-01-27 22:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from sqlalchemy import text

# revision identifiers, used by Alembic.
revision = 'add_subscription_fields'
down_revision = 'performance_indexes_20250117'
branch_labels = None
depends_on = None


def upgrade():
    """Add subscription fields to restaurants table"""
    # Add subscription fields if they don't exist
    op.add_column('restaurants', 
        sa.Column('subscription_plan', sa.String(50), 
                  server_default='alpha', nullable=True))
    op.add_column('restaurants', 
        sa.Column('subscription_status', sa.String(50), 
                  server_default='trial', nullable=True))
    op.add_column('restaurants', 
        sa.Column('subscription_started_at', sa.DateTime(timezone=True), 
                  nullable=True))
    
    # Update any existing restaurants without a plan
    op.execute("""
        UPDATE restaurants 
        SET subscription_plan = 'alpha',
            subscription_status = 'trial'
        WHERE subscription_plan IS NULL
    """)
    
    # Special case: Update Chucho to Omega if it exists
    # Using parameterized query to prevent SQL injection
    op.execute(
        text("""
            UPDATE restaurants 
            SET subscription_plan = :plan,
                subscription_status = :status,
                subscription_started_at = NOW()
            WHERE LOWER(name) LIKE :pattern
        """),
        {"plan": "omega", "status": "active", "pattern": "%chucho%"}
    )


def downgrade():
    """Remove subscription fields from restaurants table"""
    op.drop_column('restaurants', 'subscription_started_at')
    op.drop_column('restaurants', 'subscription_status')
    op.drop_column('restaurants', 'subscription_plan')