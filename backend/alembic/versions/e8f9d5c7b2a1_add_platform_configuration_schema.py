"""
Add platform configuration schema

Revision ID: e8f9d5c7b2a1
Revises: 77e7b418a2a8
Create Date: 2024-06-22 10:30:00.000000

"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision = 'e8f9d5c7b2a1'
down_revision = '77e7b418a2a8'
branch_labels = None
depends_on = None


def upgrade():
    # Create platform_configurations table
    op.create_table('platform_configurations',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('config_key', sa.String(length=255), nullable=False),
        sa.Column('config_value', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('category', sa.String(length=100), nullable=False),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('is_sensitive', sa.Boolean(), nullable=True, default=False),
        sa.Column('validation_schema', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_active', sa.Boolean(), nullable=True, default=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for platform_configurations
    op.create_index('idx_platform_config_category_active', 'platform_configurations', ['category', 'is_active'])
    op.create_index('idx_platform_config_key_active', 'platform_configurations', ['config_key', 'is_active'])
    op.create_index(op.f('ix_platform_configurations_category'), 'platform_configurations', ['category'])
    op.create_index(op.f('ix_platform_configurations_config_key'), 'platform_configurations', ['config_key'])
    op.create_unique_constraint('uq_platform_configurations_config_key', 'platform_configurations', ['config_key'])

    # Create restaurant_overrides table
    op.create_table('restaurant_overrides',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('restaurant_id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('config_key', sa.String(length=255), nullable=False),
        sa.Column('override_value', postgresql.JSON(astext_type=sa.Text()), nullable=False),
        sa.Column('platform_limit', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('is_approved', sa.Boolean(), nullable=True, default=True),
        sa.Column('approved_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('approved_at', sa.DateTime(timezone=True), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for restaurant_overrides
    op.create_index('idx_restaurant_override_approval', 'restaurant_overrides', ['is_approved', 'approved_at'])
    op.create_index('idx_restaurant_override_unique', 'restaurant_overrides', ['restaurant_id', 'config_key'], unique=True)
    op.create_index(op.f('ix_restaurant_overrides_restaurant_id'), 'restaurant_overrides', ['restaurant_id'])

    # Create configuration_audit table
    op.create_table('configuration_audit',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('config_type', sa.String(length=50), nullable=False),
        sa.Column('config_key', sa.String(length=255), nullable=False),
        sa.Column('entity_id', postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column('old_value', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('new_value', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('change_reason', sa.Text(), nullable=True),
        sa.Column('change_source', sa.String(length=100), nullable=True),
        sa.Column('changed_by', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('changed_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('ip_address', sa.String(length=45), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for configuration_audit
    op.create_index('idx_config_audit_entity', 'configuration_audit', ['entity_id', 'changed_at'])
    op.create_index('idx_config_audit_type_key', 'configuration_audit', ['config_type', 'config_key'])
    op.create_index('idx_config_audit_user_time', 'configuration_audit', ['changed_by', 'changed_at'])

    # Create platform_feature_flags table
    op.create_table('platform_feature_flags',
        sa.Column('id', postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column('feature_key', sa.String(length=255), nullable=False),
        sa.Column('is_enabled', sa.Boolean(), nullable=True, default=False),
        sa.Column('rollout_percentage', sa.Numeric(precision=5, scale=2), nullable=True, default=0.0),
        sa.Column('target_restaurants', postgresql.JSON(astext_type=sa.Text()), nullable=True),
        sa.Column('description', sa.Text(), nullable=True),
        sa.Column('feature_category', sa.String(length=100), nullable=True),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
        sa.Column('created_by', postgresql.UUID(as_uuid=True), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for platform_feature_flags
    op.create_index(op.f('ix_platform_feature_flags_feature_key'), 'platform_feature_flags', ['feature_key'])
    op.create_unique_constraint('uq_platform_feature_flags_feature_key', 'platform_feature_flags', ['feature_key'])


def downgrade():
    # Drop tables in reverse order
    op.drop_table('platform_feature_flags')
    op.drop_table('configuration_audit')
    op.drop_table('restaurant_overrides')
    op.drop_table('platform_configurations')