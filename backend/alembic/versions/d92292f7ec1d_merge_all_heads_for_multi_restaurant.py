"""merge_all_heads_for_multi_restaurant

Revision ID: d92292f7ec1d
Revises: add_row_level_security, 011_add_rls_session_variables, 569b8ab547cb, add_portal_tables_2025, add_subscription_fields
Create Date: 2025-07-29 23:14:24.051900

"""


# revision identifiers, used by Alembic.
revision = 'd92292f7ec1d'
down_revision = ('add_row_level_security', '011_add_rls_session_variables', '569b8ab547cb', 'add_portal_tables_2025', 'add_subscription_fields')
branch_labels = None
depends_on = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
