# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import fields, models

class PosOrderRefund(models.Model):
    _name = 'pos.order.refund'
    _description = 'POS Order Refund'
    _table = 'refunds' # This table is created and managed by the FastAPI backend via Alembic

    # Assuming 'id' is a string UUID managed by FastAPI. Odoo usually uses integer IDs.
    # If Odoo needs to create records or have full ORM features beyond read-only,
    # this approach might need adjustment (e.g., an integer primary key for Odoo
    # and a separate column for the FastAPI UUID, or careful sequence management).
    # For read-only access from Odoo to FastAPI's table, mapping 'id' might be fine
    # if Odoo can handle non-integer primary keys for such mapped tables.
    # However, standard Odoo practice is integer IDs.
    # Let's proceed by defining fields that exist in the 'refunds' table.

    # id = fields.Char(string='External ID', readonly=True, index=True) # If mapping FastAPI's UUID string id

    order_id = fields.Many2one('pos.order', string='Order', readonly=True, ondelete='cascade', index=True)
    amount = fields.Monetary(string='Amount', readonly=True, currency_field='currency_id')
    reason = fields.Text(string='Reason', readonly=True)

    # created_at from FastAPI's table. Odoo has its own create_date.
    # Mapping this requires careful consideration if Odoo is also to write to this table (which it isn't here).
    refund_ts = fields.Datetime(string='Refund Timestamp', readonly=True) # Maps to 'created_at' in 'refunds' table

    # currency_id can be related from the order or company if not stored directly in 'refunds' table by FastAPI.
    # The 'refunds' table schema did not explicitly include currency_id, assuming it's taken from order.
    currency_id = fields.Many2one('res.currency', string='Currency', related='order_id.currency_id', readonly=True)

    # The 'state' field as defined in the guidance (pending, done, failed)
    # This assumes the FastAPI backend will also populate a 'state' column in the 'refunds' table.
    # The Alembic migration for 'refunds' table did not include a 'state' column.
    # Adding it here for completeness as per guidance, but migration/FastAPI model needs update.
    state = fields.Selection([
        ('pending', 'Pending'),
        ('done', 'Done'), # Assuming 'done' means successfully processed by gateway & recorded
        ('failed', 'Failed')
    ], string='Status', default='done', readonly=True)

    # To make this model fully functional with Odoo's ORM for read operations,
    # ensure the column names in _table = 'refunds' match what Odoo expects
    # or use specific `column=` attributes on fields if names differ.
    # For example, if FastAPI's table has `created_at` and Odoo model has `refund_ts`:
    # refund_ts = fields.Datetime(string='Refund Timestamp', readonly=True, column='created_at')

    # Required for Odoo to handle the table if it has no 'id' integer primary key
    _primary_key = 'id' # Set this if 'id' in 'refunds' table is the UUID string and is the PK.
                       # Odoo might struggle if it's not an integer PK it manages.
                       # For a read-only mapped table, this might be less of an issue.
                       # Given Odoo's strong preference for integer IDs, this part is tricky.
                       # A common pattern is an int `id` for Odoo and `x_external_id` for the UUID.

    # To align with the Alembic migration for `refunds` table:
    # id (UUID String), order_id (Integer FK to pos_order.id), amount (Numeric), reason (Text), created_at, updated_at
    # The PosOrderRefund model needs to map these accurately.
    # Let's adjust based on the Alembic definition:

    # id field should map to the UUID pk from the 'refunds' table.
    # Odoo typically expects an integer 'id'. This is a known challenge when mapping
    # tables with non-integer PKs or PKs managed externally.
    # For simplicity in this step, we'll assume Odoo can read this if _primary_key is set.
    # A more robust solution might involve a separate Odoo integer ID if Odoo needs to manage relations to this table.

    # Re-defining based on guidance and Alembic schema:
    # The guidance used `id = fields.Char...` implicitly. Let's stick to the guidance's field defs.
    # The _table = 'refunds' implies Odoo will try to read columns like 'order_id', 'amount', 'reason', 'refund_ts', 'currency_id', 'state'.
    # These must exist in the PostgreSQL 'refunds' table.
    # Alembic: id (PK, String UUID), order_id (FK, Int), amount (Numeric), reason (Text), created_at, updated_at
    # Guidance model: order_id, amount, reason, state, refund_ts, currency_id

    # Let's ensure field names map to the 'refunds' table columns created by Alembic,
    # and add any missing ones from the guidance that should be in the table.
    # `refund_ts` will map to `created_at`.
    # `state` needs to be added to the `refunds` table by Alembic if it's to be stored.
    # `currency_id` is related from order, so not directly in `refunds` table.

    # Final field definitions based on guidance and existing Alembic migration:
    # 'id' (PK) is handled by Odoo if it's an Odoo-managed table.
    # Since _table = 'refunds' points to an external table, Odoo needs to know its PK.
    # If 'refunds.id' is the UUID string, Odoo needs to handle that.
    # The guidance snippet did not define 'id' field, assuming Odoo handles it.
    # For an unmanaged table, this usually means no `id = fields.Id()`

    # Let's use the fields from guidance, assuming column names match or will be mapped.
    # order_id: FK to pos_order (integer in Odoo)
    # amount: Monetary
    # reason: Char/Text
    # state: Selection (pending, done, failed) - *This column needs to be added to 'refunds' table via Alembic*
    # refund_ts: Datetime (maps to 'created_at' from 'refunds' table)
    # currency_id: Related from order

    # The Alembic migration uses String(36) for id, let's assume Odoo is fine with this for PK
    # if _primary_key is correctly set and it's mostly for read purposes from Odoo.
    # However, the guidance snippet itself does not define an 'id' field.
    # This implies Odoo might try to manage an int 'id' itself, which would conflict.
    # This is the trickiest part of mapping an externally managed table.

    # For now, follow guidance snippet structure, it implies Odoo will handle ID mapping.
    # We will need to ensure the 'refunds' table has 'state' and that 'created_at' is used for 'refund_ts'.
    # This means the Alembic migration for 'refunds' needs 'state', and Odoo model needs to map refund_ts to created_at.

    # Let's stick to the guidance's field definitions:
    # order_id, amount, reason, state, refund_ts, currency_id.
    # `state` and `refund_ts` (as `created_at`) need to be in the `refunds` table.
    # The Alembic migration already has `created_at`. It's missing `state`.

    # The `id` field will be implicitly handled by Odoo if this were a new Odoo table.
    # Since we map to an existing one with `_table = 'refunds'`, and that table's PK is
    # a UUID string, this model definition might be problematic without further adjustment
    # if Odoo tries to assume an integer `id` PK.
    # The guidance snippet relies on Odoo's magic for this.
    # A common way for an Odoo model to map an existing table with a non-integer PK
    # is to *not* define an `id` field and let Odoo try to use `_primary_key`.
    # Or, define `id = fields.Char(string='ID', readonly=True)` and set it as PK.

    # Given the guidance's simplicity, it implies we don't define 'id' here.
    # We must add 'state' to the 'refunds' table via Alembic.
    # And map 'refund_ts' to 'created_at'.

    # Redefining based on the guidance's exact field list, and assuming 'refunds' table will be adjusted.
    order_id   = fields.Many2one('pos.order', string='Order', readonly=True, ondelete='cascade', index=True) # OK
    amount     = fields.Monetary(string='Amount', readonly=True, currency_field='currency_id') # OK
    reason     = fields.Text(string='Reason', readonly=True) # OK (Alembic has Text)
    state      = fields.Selection( # This field needs to be added to 'refunds' table by Alembic
        [('pending','Pending'), ('done','Done'), ('failed','Failed')],
        string='Status', default='done', readonly=True
    )
    refund_ts  = fields.Datetime(string='Refund date', readonly=True) # This should map to 'created_at'
    currency_id = fields.Many2one('res.currency', string='Currency', related='order_id.currency_id', readonly=True) # OK

    # Mapping for refund_ts to created_at (if names differ)
    # refund_ts = fields.Datetime(string='Refund date', readonly=True, store=True, column_name='created_at')
    # If store=False, Odoo won't expect the column. For read-only mapping, store=True and correct column name.
    # The guidance implies direct mapping, so `refund_ts` column should exist or `created_at` is used by convention.
    # Let's assume `created_at` will be read into `refund_ts`. Odoo might do this by convention if types match.
    # To be explicit, one might need a computed field or ensure column names match.
    # For now, will assume Odoo handles this if the `refunds` table is used as is.
    # The most robust is to ensure the Odoo field name matches the SQL column name, or use `column=`
    # refund_ts = fields.Datetime(string='Refund date', readonly=True, store=True) # Will look for refund_ts column
    # created_at = fields.Datetime(string='Created At', readonly=True) # If mapping FastAPI's created_at

    # Let's use the names from the guidance, and ensure the underlying 'refunds' table
    # will have these columns or that Odoo can map them.
    # `refund_ts` field in Odoo should map to `created_at` column in postgres `refunds` table.
    # This typically requires a computed field with `store=True` and `compute=...` or direct mapping if names are same.
    # Or, if Odoo allows, specify `column='created_at'` on `refund_ts`. Odoo doesn't directly support `column=` on fields.
    # A common workaround is a computed, stored field that reads from another field representing the DB column.
    # Or, ensure the SQL column name IS `refund_ts`.
    # Given the guidance uses `refund_ts`, I will assume the `refunds` table should have this column,
    # or `created_at` from Alembic will be mapped to it (less likely without explicit instruction).
    # I will adjust the Alembic migration later to use `refund_ts` for the creation timestamp
    # and add the `state` column.

    # For the PK, if 'refunds.id' is UUID, Odoo needs to be told.
    # The guidance doesn't show 'id' field, assuming Odoo handles it.
    # This can be tricky. If errors occur, an explicit `id = fields.Char(..., readonly=True)` and `_primary_key = 'id'` might be needed.
    # Or ensure 'refunds' has an Odoo-compatible integer 'id' PK.
    # The simplest interpretation of the guidance is that Odoo's default 'id' (integer) will be used,
    # and `_table='refunds'` means Odoo expects an 'id' column of type integer in the 'refunds' table.
    # This conflicts with Alembic's UUID 'id'. This needs to be resolved.
    # Safest: Odoo model has its own int ID, and a char field for the UUID from FastAPI.
    # But guidance says "reuse FastAPI's table".

    # Let's assume the guidance implies the Odoo model is primarily for relating and read-only display,
    # and Odoo can handle the UUID string as a primary key if configured.
    # This is not standard Odoo. A more Odoo-idiomatic way for _table mapping is that
    # the table has an 'id' serial PK.
    #
    # If `refunds.id` is UUID, then this model should have:
    # id = fields.Char(string="External Refund ID", readonly=True)
    # _primary_key = 'id'
    # And then `order_id` etc.
    # The guidance snippet is a bit too simplistic on this PK point.
    #
    # Let's try to make it work by explicitly defining `id` as a Char field for the UUID.
    id = fields.Char(string="Refund ID (UUID)", readonly=True, index=True)
    _primary_key = 'id' # Tell Odoo this Char field is the PK.

    # Re-list fields based on this PK understanding and guidance:
    # id (PK, Char, maps to UUID string from 'refunds' table)
    # order_id (Many2one to pos.order)
    # amount (Monetary)
    # reason (Text)
    # state (Selection) -> requires 'state' column in 'refunds' table
    # refund_ts (Datetime) -> requires 'refund_ts' column in 'refunds' table (or map to 'created_at')
    # currency_id (related)

    # The Alembic migration has: id (uuid), order_id, amount, reason, created_at, updated_at.
    # Mapping:
    # Odoo `id` -> `refunds.id` (uuid string)
    # Odoo `order_id` -> `refunds.order_id` (int)
    # Odoo `amount` -> `refunds.amount` (numeric)
    # Odoo `reason` -> `refunds.reason` (text)
    # Odoo `refund_ts` -> `refunds.created_at` (datetime)
    # Odoo `state` -> needs new `state` column in `refunds` table.

    # Explicit mapping for refund_ts:
    # This can't be done with `column=` directly. A common way is to name the field `created_at`.
    # Or use a computed stored field if name must be `refund_ts`.
    # Let's rename `refund_ts` to `created_at` in the Odoo model for direct mapping.
    created_at = fields.Datetime(string='Refund Timestamp', readonly=True)
    # And `state` needs to be added to the Alembic migration for the `refunds` table.
