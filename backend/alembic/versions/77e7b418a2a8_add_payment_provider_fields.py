"""add_payment_provider_fields

Revision ID: 77e7b418a2a8
Revises: 1d25e080d454
Create Date: 2025-06-22 16:46:46.084623

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '77e7b418a2a8'
down_revision = '1d25e080d454'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add provider field to payments table (this is the main addition)
    op.add_column('payments', sa.Column('provider', sa.String(), nullable=False, server_default='stripe'))
    
    # Add provider-specific fields (note: we already have external_id and fee_amount)
    op.add_column('payments', sa.Column('provider_fee', sa.Numeric(10, 2), nullable=True))
    op.add_column('payments', sa.Column('refund_id', sa.String(), nullable=True))
    op.add_column('payments', sa.Column('refunded_amount', sa.Numeric(10, 2), nullable=True))
    
    # Add index on provider for faster queries
    op.create_index('ix_payments_provider', 'payments', ['provider'])
    
    # Add provider preferences to restaurants table
    op.add_column('restaurants', sa.Column('provider_preferences', sa.JSON(), nullable=True))
    op.add_column('restaurants', sa.Column('monthly_volume', sa.Numeric(10, 2), nullable=True))
    op.add_column('restaurants', sa.Column('preferred_provider', sa.String(), nullable=True))
    
    # Update existing payment records to have provider field based on payment_method
    op.execute("""
        UPDATE payments SET provider = 
        CASE 
            WHEN payment_method = 'qr_code' THEN 'qr'
            WHEN payment_method IN ('card', 'apple_pay') THEN 'stripe'
            WHEN payment_method = 'cash' THEN 'cash'
            ELSE 'stripe'
        END
        WHERE provider IS NULL
    """)
    
    # Update provider_fee based on existing fee_amount
    op.execute("UPDATE payments SET provider_fee = fee_amount WHERE provider_fee IS NULL")
    
    # Remove server default after populating existing records
    op.alter_column('payments', 'provider', server_default=None)


def downgrade() -> None:
    # Remove index
    op.drop_index('ix_payments_provider', table_name='payments')
    
    # Remove columns from payments table
    op.drop_column('payments', 'provider')
    op.drop_column('payments', 'provider_fee')
    op.drop_column('payments', 'refund_id')
    op.drop_column('payments', 'refunded_amount')
    
    # Remove columns from restaurants table
    op.drop_column('restaurants', 'provider_preferences')
    op.drop_column('restaurants', 'monthly_volume')
    op.drop_column('restaurants', 'preferred_provider')