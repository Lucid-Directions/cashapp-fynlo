"""add platform audit logs table

Revision ID: 569b8ab547cb
Revises: 11cec540dd38
Create Date: 2025-07-11 09:55:20.151429

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '569b8ab547cb'
down_revision = '11cec540dd38'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Create platform_audit_logs table
    op.create_table(
        'platform_audit_logs',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('user_id', sa.String(), nullable=False),
        sa.Column('user_email', sa.String(), nullable=False),
        sa.Column('action', sa.String(), nullable=False),
        sa.Column('resource_type', sa.String(), nullable=False),
        sa.Column('resource_id', sa.String(), nullable=True),
        sa.Column('details', sa.JSON(), nullable=True),
        sa.Column('ip_address', sa.String(), nullable=True),
        sa.Column('user_agent', sa.Text(), nullable=True),
        sa.Column('request_id', sa.String(), nullable=True),
        sa.Column('http_method', sa.String(), nullable=True),
        sa.Column('endpoint', sa.String(), nullable=True),
        sa.Column('created_at', sa.TIMESTAMP(), server_default=sa.text('now()'), nullable=False),
        sa.ForeignKeyConstraint(['user_id'], ['users.id'], ),
        sa.PrimaryKeyConstraint('id')
    )
    
    # Create indexes for better query performance
    op.create_index('ix_platform_audit_logs_user_id', 'platform_audit_logs', ['user_id'])
    op.create_index('ix_platform_audit_logs_action', 'platform_audit_logs', ['action'])
    op.create_index('ix_platform_audit_logs_resource_type', 'platform_audit_logs', ['resource_type'])
    op.create_index('ix_platform_audit_logs_resource_id', 'platform_audit_logs', ['resource_id'])
    op.create_index('ix_platform_audit_logs_request_id', 'platform_audit_logs', ['request_id'])
    op.create_index('ix_platform_audit_logs_created_at', 'platform_audit_logs', ['created_at'])
    op.create_index('ix_platform_audit_logs_id', 'platform_audit_logs', ['id'])


def downgrade() -> None:
    # Drop indexes
    op.drop_index('ix_platform_audit_logs_id', table_name='platform_audit_logs')
    op.drop_index('ix_platform_audit_logs_created_at', table_name='platform_audit_logs')
    op.drop_index('ix_platform_audit_logs_request_id', table_name='platform_audit_logs')
    op.drop_index('ix_platform_audit_logs_resource_id', table_name='platform_audit_logs')
    op.drop_index('ix_platform_audit_logs_resource_type', table_name='platform_audit_logs')
    op.drop_index('ix_platform_audit_logs_action', table_name='platform_audit_logs')
    op.drop_index('ix_platform_audit_logs_user_id', table_name='platform_audit_logs')
    
    # Drop table
    op.drop_table('platform_audit_logs')