# -*- coding: utf-8 -*-
# Part of CashApp. See LICENSE file for full copyright and licensing details.

from cashapp import api, fields, models


class ChooseDestinationLocation(models.TransientModel):
    _name = 'stock.package.destination'
    _description = 'Stock Package Destination'

    picking_id = fields.Many2one('stock.picking', required=True)
    move_line_ids = fields.Many2many('stock.move.line', 'Products', compute='_compute_move_line_ids', required=True)
    location_dest_id = fields.Many2one('stock.location', 'Destination location', required=True)
    filtered_location = fields.One2many(comodel_name='stock.location', compute='_filter_location')

    @api.depends('picking_id')
    def _compute_move_line_ids(self):
        # specific move lines selected from move line view
        move_lines_to_pack_ids = self.env.context.get('move_lines_to_pack_ids')
        for destination in self:
            destination.move_line_ids = destination.picking_id.move_line_ids.filtered(lambda l: l.quantity > 0 and not l.result_package_id)
            if move_lines_to_pack_ids:
                destination.move_line_ids = destination.move_line_ids.filtered(lambda l: l.id in move_lines_to_pack_ids)

    @api.depends('move_line_ids')
    def _filter_location(self):
        for destination in self:
            destination.filtered_location = destination.move_line_ids.mapped('location_dest_id')

    def action_done(self):
        # set the same location on each move line and pass again in action_put_in_pack
        self.move_line_ids.location_dest_id = self.location_dest_id
        return self.move_line_ids.action_put_in_pack()
