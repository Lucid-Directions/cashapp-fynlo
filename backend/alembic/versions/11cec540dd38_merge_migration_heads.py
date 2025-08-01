"""merge migration heads

Revision ID: 11cec540dd38
Revises: 701baf8cafd6, c9882ae130a2
Create Date: 2025-07-11 09:55:13.193863

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '11cec540dd38'
down_revision = ('701baf8cafd6', 'c9882ae130a2')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass