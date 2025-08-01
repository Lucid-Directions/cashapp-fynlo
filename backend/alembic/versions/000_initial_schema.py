"""Initial database schema

Revision ID: 000_initial_schema
Revises: 
Create Date: 2025-01-31 11:00:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import UUID, JSONB

# revision identifiers, used by Alembic.
revision = '000_initial_schema'
down_revision = None
branch_labels = None
depends_on = None

def upgrade():
    """Create initial database schema"""
    
    # Create platforms table
    op.create_table('platforms',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('owner_email', sa.String(255), unique=True, nullable=False),
        sa.Column('subscription_tier', sa.String(50), default='basic'),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create restaurants table
    op.create_table('restaurants',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('platform_id', UUID(as_uuid=True), nullable=True),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('address', JSONB, nullable=False),
        sa.Column('phone', sa.String(20)),
        sa.Column('email', sa.String(255)),
        sa.Column('timezone', sa.String(50), default='UTC'),
        sa.Column('business_hours', JSONB, default={}),
        sa.Column('settings', JSONB, default={}),
        sa.Column('tax_configuration', JSONB, default={}),
        sa.Column('payment_methods', JSONB, default={}),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create users table (without username - will be added in next migration)
    op.create_table('users',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('email', sa.String(255), unique=True, nullable=False),
        sa.Column('password_hash', sa.String(255), nullable=False),
        sa.Column('first_name', sa.String(100), nullable=False),
        sa.Column('last_name', sa.String(100), nullable=False),
        sa.Column('role', sa.String(50), nullable=False),
        sa.Column('restaurant_id', UUID(as_uuid=True), nullable=True),
        sa.Column('platform_id', UUID(as_uuid=True), nullable=True),
        sa.Column('permissions', JSONB, default={}),
        sa.Column('pin_code', sa.String(6)),
        sa.Column('is_active', sa.Boolean, default=True),
        sa.Column('last_login', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create other essential tables
    op.create_table('customers',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('restaurant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('email', sa.String(255)),
        sa.Column('phone', sa.String(20)),
        sa.Column('first_name', sa.String(100)),
        sa.Column('last_name', sa.String(100)),
        sa.Column('loyalty_points', sa.Integer, default=0),
        sa.Column('total_spent', sa.Float, default=0.0),
        sa.Column('visit_count', sa.Integer, default=0),
        sa.Column('preferences', JSONB, default={}),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create products table
    op.create_table('products',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('restaurant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('name', sa.String(255), nullable=False),
        sa.Column('description', sa.Text),
        sa.Column('price', sa.Float, nullable=False),
        sa.Column('category', sa.String(100)),
        sa.Column('image_url', sa.String(500)),
        sa.Column('is_available', sa.Boolean, default=True),
        sa.Column('preparation_time', sa.Integer),
        sa.Column('allergens', JSONB, default=[]),
        sa.Column('nutritional_info', JSONB, default={}),
        sa.Column('variants', JSONB, default=[]),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create orders table
    op.create_table('orders',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('restaurant_id', UUID(as_uuid=True), nullable=False),
        sa.Column('customer_id', UUID(as_uuid=True), nullable=True),
        sa.Column('order_number', sa.String(50), unique=True, nullable=False),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('order_type', sa.String(20), default='dine_in'),
        sa.Column('items', JSONB, nullable=False),
        sa.Column('subtotal', sa.Float, nullable=False),
        sa.Column('tax_amount', sa.Float, default=0.0),
        sa.Column('service_charge', sa.Float, default=0.0),
        sa.Column('discount_amount', sa.Float, default=0.0),
        sa.Column('total_amount', sa.Float, nullable=False),
        sa.Column('payment_status', sa.String(20), default='pending'),
        sa.Column('notes', sa.Text),
        sa.Column('created_by', UUID(as_uuid=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime(timezone=True), onupdate=sa.func.now())
    )
    
    # Create payments table
    op.create_table('payments',
        sa.Column('id', UUID(as_uuid=True), primary_key=True),
        sa.Column('order_id', UUID(as_uuid=True), nullable=False),
        sa.Column('payment_method', sa.String(50), nullable=False),
        sa.Column('amount', sa.Float, nullable=False),
        sa.Column('fee_amount', sa.Float, default=0.0),
        sa.Column('net_amount', sa.Float, nullable=False),
        sa.Column('status', sa.String(20), default='pending'),
        sa.Column('external_id', sa.String(255)),
        sa.Column('metadata', JSONB, default={}),
        sa.Column('processed_at', sa.DateTime(timezone=True)),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now())
    )

def downgrade():
    """Drop all tables"""
    op.drop_table('payments')
    op.drop_table('orders')
    op.drop_table('products')
    op.drop_table('customers')
    op.drop_table('users')
    op.drop_table('restaurants')
    op.drop_table('platforms')