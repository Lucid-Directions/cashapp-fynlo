"""Merge floor plan and foreign key constraints

Revision ID: 370119f53344
Revises: 003_add_floor_plan_and_pos_tables, 006_add_foreign_key_constraints
Create Date: 2025-06-21 08:48:51.172366

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '370119f53344'
down_revision = ('003_add_floor_plan_and_pos_tables', '006_add_foreign_key_constraints')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass