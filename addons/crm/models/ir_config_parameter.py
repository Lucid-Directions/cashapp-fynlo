# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import api, models
from cashapp.addons.base.models.ir_model import MODULE_UNINSTALL_FLAG


class IrConfigParameter(models.Model):
    _inherit = 'ir.config_parameter'

    def write(self, vals):
        result = super(IrConfigParameter, self).write(vals)
        if any(record.key == "crm.pls_fields" for record in self):
            self.env.flush_all()
            self.env.registry.setup_models(self.env.cr)
        return result

    @api.model_create_multi
    def create(self, vals_list):
        records = super(IrConfigParameter, self).create(vals_list)
        if any(record.key == "crm.pls_fields" for record in records):
            self.env.flush_all()
            self.env.registry.setup_models(self.env.cr)
        return records

    def unlink(self):
        pls_emptied = any(record.key == "crm.pls_fields" for record in self)
        result = super(IrConfigParameter, self).unlink()
        if pls_emptied and not self._context.get(MODULE_UNINSTALL_FLAG):
            self.env.flush_all()
            self.env.registry.setup_models(self.env.cr)
        return result
