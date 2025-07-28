# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import timedelta
import logging

_logger = logging.getLogger(__name__)

class PosOrderExtension(models.Model):
    _inherit = 'pos.order'
    
    # Order Type for Restaurant Operations
    order_type = fields.Selection([
        ('dine_in', 'Dine In'),
        ('takeout', 'Takeout'),
        ('delivery', 'Delivery'),
        ('pickup', 'Pickup')
    ], string='Order Type', default='dine_in', required=True)
    
    # Guest count for dine-in orders
    guest_count = fields.Integer('Number of Guests', default=1)
    
    # Estimated pickup/ready time
    estimated_ready_time = fields.Datetime('Estimated Ready Time')
    
    # Order status for kitchen workflow
    kitchen_status = fields.Selection([
        ('new', 'New'),
        ('in_progress', 'In Progress'),
        ('ready', 'Ready'),
        ('served', 'Served'),
        ('completed', 'Completed')
    ], string='Kitchen Status', default='new')
    
    @api.model_create_multi
    def create(self, vals_list):
        """Override create to handle order type specific logic"""
        for vals in vals_list:
            # Set default guest count based on order type
            if vals.get('order_type') == 'dine_in' and not vals.get('guest_count'):
                vals['guest_count'] = 2  # Default for dine-in
            elif vals.get('order_type') in ['takeout', 'pickup', 'delivery']:
                vals['guest_count'] = 0  # Not applicable for non-dine-in
                
            # Set estimated ready time for takeout/pickup orders
            if vals.get('order_type') in ['takeout', 'pickup'] and not vals.get('estimated_ready_time'):
                # Default to 20 minutes from now
                vals['estimated_ready_time'] = fields.Datetime.now() + timedelta(minutes=20)
                
        return super().create(vals_list)
    
    def action_update_kitchen_status(self, new_status):
        """Update the kitchen status of the order"""
        self.ensure_one()
        old_status = self.kitchen_status
        self.kitchen_status = new_status
        
        # Log the status change
        _logger.info(f"Order {self.name} kitchen status changed from {old_status} to {new_status}")
        
        # If order is ready and it's takeout/pickup, send notification
        if new_status == 'ready' and self.order_type in ['takeout', 'pickup']:
            # This would trigger a notification to the customer
            # Implementation depends on notification system
            pass
            
        return True
    
    @api.depends('order_type', 'table_id')
    def _compute_display_name(self):
        """Override display name to include order type"""
        for order in self:
            name_parts = [order.name or 'New Order']
            
            if order.order_type:
                type_display = dict(self._fields['order_type'].selection).get(order.order_type, '')
                name_parts.append(f"[{type_display}]")
                
            if order.table_id and order.order_type == 'dine_in':
                name_parts.append(f"- {order.table_id.display_name}")
                
            order.display_name = ' '.join(name_parts)

# Add order type support to POS session for filtering
class PosSession(models.Model):
    _inherit = 'pos.session'
    
    def get_orders_by_type(self, order_type=None):
        """Get orders filtered by type for the current session"""
        domain = [('session_id', '=', self.id)]
        if order_type:
            domain.append(('order_type', '=', order_type))
            
        return self.env['pos.order'].search(domain)
    
    def get_order_type_summary(self):
        """Get summary of orders by type for the session"""
        orders = self.order_ids
        
        summary = {}
        for order_type, label in self.env['pos.order']._fields['order_type'].selection:
            type_orders = orders.filtered(lambda o: o.order_type == order_type)
            summary[order_type] = {
                'label': label,
                'count': len(type_orders),
                'total': sum(type_orders.mapped('amount_total')),
                'orders': type_orders.ids
            }
            
        return summary