"""Add subscription tables

Revision ID: add_subscription_tables
Revises: 
Create Date: 2025-01-10 19:15:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'add_subscription_tables'
down_revision = '001_initial_schema'  # Update this based on latest migration
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create subscription_plans table
    op.create_table('subscription_plans',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('name', sa.String(50), nullable=False, unique=True),
        sa.Column('display_name', sa.String(100), nullable=False),
        sa.Column('price_monthly', sa.DECIMAL(10, 2), nullable=False),
        sa.Column('price_yearly', sa.DECIMAL(10, 2), nullable=False),
        sa.Column('transaction_fee_percentage', sa.DECIMAL(5, 2), nullable=False, default=1.0),
        sa.Column('max_orders_per_month', sa.Integer(), nullable=True),
        sa.Column('max_staff_accounts', sa.Integer(), nullable=True),
        sa.Column('max_menu_items', sa.Integer(), nullable=True),
        sa.Column('features', postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column('is_active', sa.Boolean(), default=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('NOW()'))
    )

    # Create restaurant_subscriptions table
    op.create_table('restaurant_subscriptions',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('plan_id', sa.Integer(), nullable=False),
        sa.Column('status', sa.String(20), nullable=False),  # active, trial, suspended, cancelled
        sa.Column('trial_end_date', sa.TIMESTAMP(), nullable=True),
        sa.Column('current_period_start', sa.TIMESTAMP(), nullable=False),
        sa.Column('current_period_end', sa.TIMESTAMP(), nullable=False),
        sa.Column('stripe_subscription_id', sa.String(255), nullable=True),
        sa.Column('stripe_customer_id', sa.String(255), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('NOW()'))
    )

    # Add foreign key constraints
    op.create_foreign_key(
        'fk_restaurant_subscriptions_plan_id',
        'restaurant_subscriptions', 'subscription_plans',
        ['plan_id'], ['id'],
        ondelete='RESTRICT'
    )
    
    # Note: restaurant_id FK will be added when restaurants table exists
    # op.create_foreign_key(
    #     'fk_restaurant_subscriptions_restaurant_id',
    #     'restaurant_subscriptions', 'restaurants',
    #     ['restaurant_id'], ['id'],
    #     ondelete='CASCADE'
    # )

    # Create subscription_usage table
    op.create_table('subscription_usage',
        sa.Column('id', sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column('restaurant_id', sa.Integer(), nullable=False),
        sa.Column('month_year', sa.String(7), nullable=False),  # Format: 2025-01
        sa.Column('orders_count', sa.Integer(), default=0),
        sa.Column('staff_count', sa.Integer(), default=0),
        sa.Column('menu_items_count', sa.Integer(), default=0),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('NOW()')),
        sa.Column('updated_at', sa.TIMESTAMP(), server_default=sa.text('NOW()')),
        sa.UniqueConstraint('restaurant_id', 'month_year', name='unique_restaurant_month')
    )

    # Create indexes for performance
    op.create_index('idx_subscription_plans_name', 'subscription_plans', ['name'])
    op.create_index('idx_restaurant_subscriptions_restaurant_id', 'restaurant_subscriptions', ['restaurant_id'])
    op.create_index('idx_restaurant_subscriptions_status', 'restaurant_subscriptions', ['status'])
    op.create_index('idx_subscription_usage_restaurant_month', 'subscription_usage', ['restaurant_id', 'month_year'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('idx_subscription_usage_restaurant_month')
    op.drop_index('idx_restaurant_subscriptions_status')
    op.drop_index('idx_restaurant_subscriptions_restaurant_id')
    op.drop_index('idx_subscription_plans_name')
    
    # Drop tables in reverse order
    op.drop_table('subscription_usage')
    op.drop_table('restaurant_subscriptions')
    op.drop_table('subscription_plans')