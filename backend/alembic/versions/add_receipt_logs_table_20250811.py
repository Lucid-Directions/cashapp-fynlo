"""Add receipt_logs table for tracking sent receipts

Revision ID: add_receipt_logs_20250811
Revises: add_customer_email_to_orders_20250811
Create Date: 2025-08-11

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
import uuid

# revision identifiers, used by Alembic.
revision = 'add_receipt_logs_20250811'
down_revision = 'add_customer_email_to_orders_20250811'
branch_labels = None
depends_on = None


def upgrade():
    """Create receipt_logs table for compliance and audit trail"""
    
    # Create receipt_logs table
    op.create_table(
        'receipt_logs',
        sa.Column('id', postgresql.UUID(as_uuid=True), primary_key=True, default=uuid.uuid4),
        sa.Column('order_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('orders.id'), nullable=False),
        sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), sa.ForeignKey('restaurants.id'), nullable=False),
        sa.Column('receipt_number', sa.String(50), nullable=True, unique=True),
        sa.Column('receipt_type', sa.String(20), nullable=False),  # 'sale', 'refund', 'void'
        sa.Column('delivery_method', sa.String(20), nullable=False),  # 'email', 'sms', 'print', 'pdf'
        sa.Column('recipient', sa.String(255), nullable=False),  # email address or phone number
        sa.Column('sent_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('delivered', sa.Boolean(), default=False, nullable=False),
        sa.Column('delivery_status', sa.String(50), nullable=True),  # 'sent', 'delivered', 'failed', 'bounced'
        sa.Column('error_message', sa.Text(), nullable=True),
        sa.Column('pdf_url', sa.String(500), nullable=True),  # S3 URL if PDF generated
        sa.Column('metadata', postgresql.JSONB, nullable=True, default={}),  # Additional tracking data
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now(), nullable=True),
    )
    
    # Create indexes for better performance
    op.create_index('idx_receipt_logs_order_id', 'receipt_logs', ['order_id'])
    op.create_index('idx_receipt_logs_restaurant_id', 'receipt_logs', ['restaurant_id'])
    op.create_index('idx_receipt_logs_receipt_number', 'receipt_logs', ['receipt_number'])
    op.create_index('idx_receipt_logs_sent_at', 'receipt_logs', ['sent_at'])
    op.create_index('idx_receipt_logs_delivery_status', 'receipt_logs', ['delivery_status'])
    
    # Create composite index for common queries
    op.create_index(
        'idx_receipt_logs_restaurant_sent',
        'receipt_logs',
        ['restaurant_id', 'sent_at']
    )
    
    print("✅ Created receipt_logs table with indexes")


def downgrade():
    """Drop receipt_logs table and indexes"""
    
    # Drop indexes first
    op.drop_index('idx_receipt_logs_restaurant_sent', 'receipt_logs')
    op.drop_index('idx_receipt_logs_delivery_status', 'receipt_logs')
    op.drop_index('idx_receipt_logs_sent_at', 'receipt_logs')
    op.drop_index('idx_receipt_logs_receipt_number', 'receipt_logs')
    op.drop_index('idx_receipt_logs_restaurant_id', 'receipt_logs')
    op.drop_index('idx_receipt_logs_order_id', 'receipt_logs')
    
    # Drop the table
    op.drop_table('receipt_logs')
    
    print("✅ Dropped receipt_logs table")