"""create_refunds_and_refunds_ledger_tables

Revision ID: 701baf8cafd6
Revises: 469efcd81217
Create Date: 2025-07-01 15:03:49.827998

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '701baf8cafd6'
down_revision = '469efcd81217'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.create_table('refunds',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('order_id', sa.String(length=36), nullable=False), # Changed type to String(36) for UUID
    sa.Column('amount', sa.Numeric(precision=10, scale=2), nullable=False),
    sa.Column('reason', sa.Text(), nullable=True),
    sa.Column('state', sa.String(length=50), nullable=False, server_default='done', index=True),
    sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True, onupdate=sa.text('now()')),
    sa.ForeignKeyConstraint(['order_id'], ['orders.id'], name='fk_refunds_order_id', ondelete='CASCADE'), # Changed to 'orders.id'
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refunds_order_id'), 'refunds', ['order_id'], unique=False)
    op.create_index(op.f('ix_refunds_state'), 'refunds', ['state'], unique=False)

    op.create_table('refunds_ledger',
    sa.Column('id', sa.String(length=36), nullable=False),
    sa.Column('refund_id', sa.String(length=36), nullable=False),
    sa.Column('user_id', sa.Integer(), nullable=True), # Allow null if system performs action
    sa.Column('device_id', sa.Text(), nullable=True),
    sa.Column('action', sa.Text(), nullable=False),
    sa.Column('timestamp', sa.DateTime(timezone=True), server_default=sa.text('now()'), nullable=True),
    sa.ForeignKeyConstraint(['refund_id'], ['refunds.id'], name='fk_refunds_ledger_refund_id', ondelete='CASCADE'), # Added ON DELETE CASCADE
    sa.ForeignKeyConstraint(['user_id'], ['res_users.id'], name='fk_refunds_ledger_user_id'), # Not cascading user deletion by default
    sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_refunds_ledger_refund_id'), 'refunds_ledger', ['refund_id'], unique=False)
    op.create_index(op.f('ix_refunds_ledger_user_id'), 'refunds_ledger', ['user_id'], unique=False)
    # ### end Alembic commands ###


def downgrade() -> None:
    # ### commands auto generated by Alembic - please adjust! ###
    op.drop_index(op.f('ix_refunds_ledger_user_id'), table_name='refunds_ledger')
    op.drop_index(op.f('ix_refunds_ledger_refund_id'), table_name='refunds_ledger')
    op.drop_table('refunds_ledger')
    op.drop_index(op.f('ix_refunds_order_id'), table_name='refunds')
    op.drop_table('refunds')
    # ### end Alembic commands ###