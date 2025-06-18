# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
from odoo.exceptions import ValidationError, UserError
import logging

_logger = logging.getLogger(__name__)

class KitchenStation(models.Model):
    _name = 'kitchen.station'
    _description = 'Kitchen Station'
    _order = 'sequence, name'

    name = fields.Char('Station Name', required=True)
    code = fields.Char('Station Code', required=True, size=10)
    sequence = fields.Integer('Sequence', default=10)
    
    station_type = fields.Selection([
        ('grill', 'Grill'),
        ('fryer', 'Fryer'),
        ('salad', 'Salad/Cold'),
        ('dessert', 'Dessert'),
        ('beverage', 'Beverage'),
        ('expo', 'Expo'),
        ('prep', 'Prep'),
        ('pizza', 'Pizza'),
        ('sushi', 'Sushi'),
        ('bakery', 'Bakery')
    ], string='Station Type', required=True)
    
    # Station Configuration
    color = fields.Char('Color', default='#2ecc71', help='Hex color code for station display')
    active = fields.Boolean('Active', default=True)
    display_order = fields.Integer('Display Order', default=1)
    
    # Staff Assignment
    chef_ids = fields.Many2many('res.users', string='Assigned Chefs')
    supervisor_id = fields.Many2one('res.users', 'Station Supervisor')
    
    # Operational Settings
    max_concurrent_orders = fields.Integer('Max Concurrent Orders', default=10)
    avg_prep_time = fields.Integer('Average Prep Time (minutes)', default=15)
    priority_level = fields.Selection([
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent')
    ], default='normal')
    
    # Statistics
    orders_today = fields.Integer('Orders Today', compute='_compute_daily_stats')
    avg_completion_time = fields.Float('Avg Completion Time (minutes)', compute='_compute_performance_stats')
    efficiency_rating = fields.Float('Efficiency Rating', compute='_compute_performance_stats')
    
    @api.depends('station_type')
    def _compute_daily_stats(self):
        today = fields.Date.today()
        for station in self:
            # Count orders that have items for this station
            orders = self.env['kitchen.order.item'].search([
                ('station_id', '=', station.id),
                ('order_id.date_order', '>=', f"{today} 00:00:00"),
                ('order_id.date_order', '<=', f"{today} 23:59:59")
            ])
            station.orders_today = len(orders.mapped('order_id'))
    
    def _compute_performance_stats(self):
        for station in self:
            # Calculate performance metrics
            station.avg_completion_time = station.avg_prep_time  # Simplified
            station.efficiency_rating = 85.0  # Placeholder calculation

class KitchenDisplay(models.Model):
    _name = 'kitchen.display'
    _description = 'Kitchen Display System'
    _order = 'name'

    name = fields.Char('Display Name', required=True)
    station_ids = fields.Many2many('kitchen.station', string='Stations')
    
    # Display Configuration
    layout = fields.Selection([
        ('grid', 'Grid Layout'),
        ('list', 'List Layout'),
        ('kanban', 'Kanban Layout')
    ], default='grid')
    
    max_orders_display = fields.Integer('Max Orders to Display', default=20)
    auto_refresh_interval = fields.Integer('Auto Refresh (seconds)', default=10)
    show_elapsed_time = fields.Boolean('Show Elapsed Time', default=True)
    show_customer_notes = fields.Boolean('Show Customer Notes', default=True)
    
    # Alert Settings
    warning_time = fields.Integer('Warning Time (minutes)', default=15, help='Show warning after this time')
    critical_time = fields.Integer('Critical Time (minutes)', default=25, help='Show critical alert after this time')
    
    active = fields.Boolean('Active', default=True)

class KitchenOrderItem(models.Model):
    _name = 'kitchen.order.item'
    _description = 'Kitchen Order Item'
    _order = 'order_id, sequence'

    order_id = fields.Many2one('pos.order', 'Order', required=True, ondelete='cascade')
    order_line_id = fields.Many2one('pos.order.line', 'Order Line', required=True, ondelete='cascade')
    station_id = fields.Many2one('kitchen.station', 'Kitchen Station', required=True)
    
    # Item Details
    product_id = fields.Many2one('product.product', 'Product', required=True)
    product_name = fields.Char('Product Name', related='product_id.name', store=True)
    quantity = fields.Float('Quantity', required=True)
    sequence = fields.Integer('Sequence', default=1)
    
    # Status and Timing
    status = fields.Selection([
        ('pending', 'Pending'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('served', 'Served'),
        ('cancelled', 'Cancelled')
    ], default='pending', required=True, index=True)
    
    created_time = fields.Datetime('Created Time', default=fields.Datetime.now, required=True)
    started_time = fields.Datetime('Started Time')
    completed_time = fields.Datetime('Completed Time')
    served_time = fields.Datetime('Served Time')
    
    # Preparation Details
    prep_time_estimated = fields.Integer('Estimated Prep Time (minutes)', related='product_id.prep_time')
    prep_time_actual = fields.Integer('Actual Prep Time (minutes)', compute='_compute_actual_prep_time', store=True)
    chef_id = fields.Many2one('res.users', 'Assigned Chef')
    
    # Customer Requirements
    customer_notes = fields.Text('Customer Notes')
    modifications = fields.Text('Modifications')
    allergies = fields.Text('Allergies/Dietary Restrictions')
    
    # Priority and Urgency
    priority = fields.Selection([
        ('low', 'Low'),
        ('normal', 'Normal'),
        ('high', 'High'),
        ('urgent', 'Urgent')
    ], default='normal')
    
    rush_order = fields.Boolean('Rush Order', default=False)
    
    @api.depends('started_time', 'completed_time')
    def _compute_actual_prep_time(self):
        for item in self:
            if item.started_time and item.completed_time:
                delta = item.completed_time - item.started_time
                item.prep_time_actual = int(delta.total_seconds() / 60)
            else:
                item.prep_time_actual = 0
    
    def action_start_preparation(self):
        """Mark item as being prepared"""
        self.ensure_one()
        if self.status != 'pending':
            raise UserError("Can only start preparation for pending items.")
        
        self.write({
            'status': 'preparing',
            'started_time': fields.Datetime.now(),
            'chef_id': self.env.user.id
        })
        return True
    
    def action_mark_ready(self):
        """Mark item as ready"""
        self.ensure_one()
        if self.status != 'preparing':
            raise UserError("Can only mark preparing items as ready.")
        
        self.write({
            'status': 'ready',
            'completed_time': fields.Datetime.now()
        })
        
        # Check if all items for this order are ready
        order_items = self.search([('order_id', '=', self.order_id.id)])
        if all(item.status in ['ready', 'served'] for item in order_items):
            # Notify expo/server that order is complete
            self._notify_order_complete()
        
        return True
    
    def action_mark_served(self):
        """Mark item as served"""
        self.ensure_one()
        if self.status != 'ready':
            raise UserError("Can only serve ready items.")
        
        self.write({
            'status': 'served',
            'served_time': fields.Datetime.now()
        })
        return True
    
    def action_cancel_item(self, reason=None):
        """Cancel item preparation"""
        self.ensure_one()
        if self.status in ['served', 'cancelled']:
            raise UserError("Cannot cancel served or already cancelled items.")
        
        self.write({
            'status': 'cancelled',
            'customer_notes': (self.customer_notes or '') + f"\nCancelled: {reason or 'No reason provided'}"
        })
        return True
    
    def _notify_order_complete(self):
        """Notify relevant parties that order is complete"""
        # This could send notifications to servers, expo, etc.
        pass

# Extend Product to include kitchen information
class ProductProduct(models.Model):
    _inherit = 'product.product'
    
    kitchen_station_id = fields.Many2one('kitchen.station', 'Kitchen Station')
    prep_time = fields.Integer('Preparation Time (minutes)', default=10)
    cooking_instructions = fields.Text('Cooking Instructions')
    
    # Kitchen categorization
    requires_cooking = fields.Boolean('Requires Cooking', default=True)
    can_be_prepared_ahead = fields.Boolean('Can Be Prepared Ahead', default=False)
    temperature_sensitive = fields.Boolean('Temperature Sensitive', default=False)

# Extend POS Order Line to create kitchen items
class PosOrderLine(models.Model):
    _inherit = 'pos.order.line'
    
    kitchen_item_ids = fields.One2many('kitchen.order.item', 'order_line_id', string='Kitchen Items')
    special_instructions = fields.Text('Special Instructions')
    
    @api.model_create_multi
    def create(self, vals_list):
        lines = super().create(vals_list)
        
        # Create kitchen items for products that require cooking
        for line in lines:
            if line.product_id.requires_cooking and line.product_id.kitchen_station_id:
                self.env['kitchen.order.item'].create({
                    'order_id': line.order_id.id,
                    'order_line_id': line.id,
                    'station_id': line.product_id.kitchen_station_id.id,
                    'product_id': line.product_id.id,
                    'quantity': line.qty,
                    'customer_notes': line.special_instructions,
                    'priority': 'urgent' if line.order_id.table_id and line.order_id.table_id.status == 'occupied' else 'normal'
                })
        
        return lines

class KitchenDisplayController(models.Model):
    _name = 'kitchen.display.controller'
    _description = 'Kitchen Display Controller'
    
    @api.model
    def get_kitchen_orders(self, station_ids=None, limit=50):
        """Get orders for kitchen display"""
        domain = [('status', 'in', ['pending', 'preparing'])]
        
        if station_ids:
            domain.append(('station_id', 'in', station_ids))
        
        items = self.env['kitchen.order.item'].search(domain, order='created_time asc', limit=limit)
        
        # Group items by order
        orders_data = {}
        for item in items:
            order_id = item.order_id.id
            if order_id not in orders_data:
                orders_data[order_id] = {
                    'id': order_id,
                    'name': item.order_id.name,
                    'pos_reference': item.order_id.pos_reference,
                    'table': {
                        'id': item.order_id.table_id.id,
                        'name': item.order_id.table_id.display_name
                    } if item.order_id.table_id else None,
                    'server': {
                        'id': item.order_id.server_id.id,
                        'name': item.order_id.server_id.name
                    } if item.order_id.server_id else None,
                    'order_time': item.order_id.date_order.isoformat(),
                    'elapsed_minutes': int((datetime.now() - item.order_id.date_order.replace(tzinfo=None)).total_seconds() / 60),
                    'special_instructions': item.order_id.special_instructions,
                    'items': [],
                    'priority': 'normal',
                    'rush_order': False
                }
            
            # Add item to order
            orders_data[order_id]['items'].append({
                'id': item.id,
                'product_name': item.product_name,
                'quantity': item.quantity,
                'status': item.status,
                'station': {
                    'id': item.station_id.id,
                    'name': item.station_id.name,
                    'color': item.station_id.color
                },
                'prep_time_estimated': item.prep_time_estimated,
                'prep_time_actual': item.prep_time_actual,
                'customer_notes': item.customer_notes,
                'modifications': item.modifications,
                'allergies': item.allergies,
                'chef': {
                    'id': item.chef_id.id,
                    'name': item.chef_id.name
                } if item.chef_id else None,
                'created_time': item.created_time.isoformat(),
                'started_time': item.started_time.isoformat() if item.started_time else None,
                'priority': item.priority,
                'rush_order': item.rush_order
            })
            
            # Update order priority based on items
            if item.priority in ['high', 'urgent'] or item.rush_order:
                orders_data[order_id]['priority'] = 'high'
                orders_data[order_id]['rush_order'] = True
        
        return {
            'orders': list(orders_data.values()),
            'timestamp': datetime.now().isoformat(),
            'total_orders': len(orders_data),
            'stations': [{
                'id': station.id,
                'name': station.name,
                'type': station.station_type,
                'color': station.color,
                'orders_count': len([item for item in items if item.station_id.id == station.id])
            } for station in self.env['kitchen.station'].search([('active', '=', True)])]
        }
    
    @api.model
    def get_station_summary(self, station_id=None):
        """Get summary statistics for kitchen stations"""
        domain = [('active', '=', True)]
        if station_id:
            domain.append(('id', '=', station_id))
            
        stations = self.env['kitchen.station'].search(domain)
        today = fields.Date.today()
        
        summary = []
        for station in stations:
            # Get today's items for this station
            items = self.env['kitchen.order.item'].search([
                ('station_id', '=', station.id),
                ('created_time', '>=', f"{today} 00:00:00"),
                ('created_time', '<=', f"{today} 23:59:59")
            ])
            
            pending_items = items.filtered(lambda i: i.status == 'pending')
            preparing_items = items.filtered(lambda i: i.status == 'preparing')
            completed_items = items.filtered(lambda i: i.status in ['ready', 'served'])
            
            # Calculate average prep time
            completed_with_time = completed_items.filtered(lambda i: i.prep_time_actual > 0)
            avg_prep_time = sum(completed_with_time.mapped('prep_time_actual')) / len(completed_with_time) if completed_with_time else 0
            
            summary.append({
                'station': {
                    'id': station.id,
                    'name': station.name,
                    'type': station.station_type,
                    'color': station.color
                },
                'stats': {
                    'pending_orders': len(pending_items),
                    'preparing_orders': len(preparing_items),
                    'completed_orders': len(completed_items),
                    'total_orders': len(items),
                    'avg_prep_time': round(avg_prep_time, 1),
                    'efficiency': min(100, max(0, 100 - (avg_prep_time - station.avg_prep_time) * 2)) if avg_prep_time > 0 else 100
                }
            })
        
        return {
            'stations': summary,
            'timestamp': datetime.now().isoformat()
        } 