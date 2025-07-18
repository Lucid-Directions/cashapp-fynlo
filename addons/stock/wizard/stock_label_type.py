# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import _, fields, models


class ProductLabelLayout(models.TransientModel):
    _name = 'picking.label.type'
    _description = 'Choose whether to print product or lot/sn labels'

    picking_ids = fields.Many2many('stock.picking')
    label_type = fields.Selection([
        ('products', 'Product Labels'),
        ('lots', 'Lot/SN Labels')], string="Labels to print", required=True, default='products')

    def process(self):
        if not self.picking_ids:
            return
        if self.label_type == 'products':
            return self.picking_ids.action_open_label_layout()
        view = self.env.ref('stock.lot_label_layout_form_picking')
        return {
            'name': _('Choose Labels Layout'),
            'type': 'ir.actions.act_window',
            'res_model': 'lot.label.layout',
            'views': [(view.id, 'form')],
            'target': 'new',
            'context': {'default_move_line_ids': self.picking_ids.move_line_ids.ids},
        }
