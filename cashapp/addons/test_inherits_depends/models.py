# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import models, fields


# We add a field on this model
class Unit(models.Model):
    _inherit = 'test.unit'

    second_name = fields.Char()
