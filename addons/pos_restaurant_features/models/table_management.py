# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
from odoo.exceptions import ValidationError, UserError
import logging

_logger = logging.getLogger(__name__)

class RestaurantSection(models.Model):
    _name = 'restaurant.section'
    _description = 'Restaurant Section'
    _order = 'name'

    name = fields.Char('Section Name', required=True)
    description = fields.Text('Description')
    color = fields.Char('Color', default='#3498db', help='Hex color code for section display')
    active = fields.Boolean('Active', default=True)
    
    # Section management
    manager_id = fields.Many2one('res.users', 'Section Manager')
    server_ids = fields.Many2many('res.users', string='Assigned Servers')
    table_ids = fields.One2many('restaurant.table', 'section_id', string='Tables')
    
    # Statistics
    table_count = fields.Integer('Number of Tables', compute='_compute_table_count', store=True)
    total_capacity = fields.Integer('Total Capacity', compute='_compute_total_capacity', store=True)
    
    @api.depends('table_ids')
    def _compute_table_count(self):
        for section in self:
            section.table_count = len(section.table_ids)
    
    @api.depends('table_ids.capacity')
    def _compute_total_capacity(self):
        for section in self:
            section.total_capacity = sum(section.table_ids.mapped('capacity'))

class RestaurantTable(models.Model):
    _name = 'restaurant.table'
    _description = 'Restaurant Table Management'
    _order = 'section_id, name'
    _rec_name = 'display_name'

    name = fields.Char('Table Number', required=True)
    display_name = fields.Char('Display Name', compute='_compute_display_name', store=True)
    capacity = fields.Integer('Capacity', required=True, default=4)
    
    # Table Status
    status = fields.Selection([
        ('available', 'Available'),
        ('occupied', 'Occupied'),
        ('reserved', 'Reserved'),
        ('cleaning', 'Cleaning'),
        ('blocked', 'Blocked'),
        ('maintenance', 'Maintenance')
    ], string='Status', default='available', required=True, index=True)
    
    # Position and Layout
    pos_x = fields.Float('X Position', default=100, help='X coordinate on floor plan')
    pos_y = fields.Float('Y Position', default=100, help='Y coordinate on floor plan')
    width = fields.Float('Width', default=100, help='Table width in pixels')
    height = fields.Float('Height', default=100, help='Table height in pixels')
    rotation = fields.Float('Rotation', default=0, help='Table rotation in degrees')
    
    shape = fields.Selection([
        ('round', 'Round'),
        ('square', 'Square'),
        ('rectangle', 'Rectangle'),
        ('oval', 'Oval')
    ], string='Shape', default='round', required=True)
    
    # Operational Fields
    current_order_id = fields.Many2one('pos.order', 'Current Order', ondelete='set null')
    server_id = fields.Many2one('res.users', 'Assigned Server')
    section_id = fields.Many2one('restaurant.section', 'Section', required=True)
    
    # Reservation and Timing
    reserved_by = fields.Char('Reserved By')
    reservation_time = fields.Datetime('Reservation Time')
    occupied_since = fields.Datetime('Occupied Since')
    estimated_duration = fields.Integer('Estimated Duration (minutes)', default=90)
    
    # Table Features
    smoking_allowed = fields.Boolean('Smoking Allowed', default=False)
    outdoor = fields.Boolean('Outdoor Table', default=False)
    wheelchair_accessible = fields.Boolean('Wheelchair Accessible', default=True)
    has_power_outlet = fields.Boolean('Has Power Outlet', default=False)
    
    # Notes and Special Requirements
    notes = fields.Text('Notes')
    special_requirements = fields.Text('Special Requirements')
    
    # Statistics
    total_orders_today = fields.Integer('Orders Today', compute='_compute_daily_stats')
    revenue_today = fields.Float('Revenue Today', compute='_compute_daily_stats')
    avg_turnover_time = fields.Float('Avg Turnover Time (minutes)', compute='_compute_turnover_stats')
    
    # Active status
    active = fields.Boolean('Active', default=True)
    
    @api.depends('name', 'section_id.name')
    def _compute_display_name(self):
        for table in self:
            if table.section_id:
                table.display_name = f"{table.section_id.name} - Table {table.name}"
            else:
                table.display_name = f"Table {table.name}"
    
    @api.depends('current_order_id')
    def _compute_daily_stats(self):
        today = fields.Date.today()
        for table in self:
            orders = self.env['pos.order'].search([
                ('table_id', '=', table.id),
                ('date_order', '>=', f"{today} 00:00:00"),
                ('date_order', '<=', f"{today} 23:59:59"),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ])
            table.total_orders_today = len(orders)
            table.revenue_today = sum(orders.mapped('amount_total'))
    
    def _compute_turnover_stats(self):
        # Calculate average turnover time based on historical data
        for table in self:
            # This would be calculated from historical order data
            table.avg_turnover_time = 75.0  # Default placeholder
    
    @api.constrains('capacity')
    def _check_capacity(self):
        for table in self:
            if table.capacity <= 0:
                raise ValidationError("Table capacity must be greater than 0.")
            if table.capacity > 20:
                raise ValidationError("Table capacity cannot exceed 20 people.")
    
    @api.constrains('pos_x', 'pos_y')
    def _check_position(self):
        for table in self:
            if table.pos_x < 0 or table.pos_y < 0:
                raise ValidationError("Table position coordinates must be positive.")
    
    def action_set_available(self):
        """Set table status to available"""
        self.ensure_one()
        if self.current_order_id:
            raise UserError("Cannot set table as available while there's an active order.")
        
        self.write({
            'status': 'available',
            'server_id': False,
            'occupied_since': False,
            'reserved_by': False,
            'reservation_time': False
        })
        return True
    
    def action_set_occupied(self, server_id=None):
        """Set table status to occupied"""
        self.ensure_one()
        if self.status == 'blocked':
            raise UserError("Cannot occupy a blocked table.")
        
        values = {
            'status': 'occupied',
            'occupied_since': fields.Datetime.now()
        }
        if server_id:
            values['server_id'] = server_id
            
        self.write(values)
        return True
    
    def action_set_reserved(self, reserved_by, reservation_time=None):
        """Set table status to reserved"""
        self.ensure_one()
        if self.status == 'occupied':
            raise UserError("Cannot reserve an occupied table.")
        
        self.write({
            'status': 'reserved',
            'reserved_by': reserved_by,
            'reservation_time': reservation_time or fields.Datetime.now()
        })
        return True
    
    def action_set_cleaning(self):
        """Set table status to cleaning"""
        self.ensure_one()
        self.write({
            'status': 'cleaning',
            'server_id': False
        })
        return True
    
    def action_assign_server(self, server_id):
        """Assign a server to the table"""
        self.ensure_one()
        server = self.env['res.users'].browse(server_id)
        if not server.exists():
            raise UserError("Invalid server selected.")
        
        self.server_id = server_id
        return True
    
    def action_update_position(self, pos_x, pos_y, width=None, height=None, rotation=None):
        """Update table position and dimensions"""
        self.ensure_one()
        values = {
            'pos_x': pos_x,
            'pos_y': pos_y
        }
        if width is not None:
            values['width'] = width
        if height is not None:
            values['height'] = height
        if rotation is not None:
            values['rotation'] = rotation
            
        self.write(values)
        return True
    
    @api.model
    def get_floor_plan(self, section_id=None):
        """Get complete floor plan with real-time status"""
        domain = [('active', '=', True)]
        if section_id:
            domain.append(('section_id', '=', section_id))
            
        tables = self.search(domain)
        sections = self.env['restaurant.section'].search([('active', '=', True)])
        
        return {
            'tables': [{
                'id': table.id,
                'name': table.name,
                'display_name': table.display_name,
                'capacity': table.capacity,
                'status': table.status,
                'position': {
                    'x': table.pos_x, 
                    'y': table.pos_y,
                    'width': table.width,
                    'height': table.height,
                    'rotation': table.rotation
                },
                'shape': table.shape,
                'section': {
                    'id': table.section_id.id,
                    'name': table.section_id.name,
                    'color': table.section_id.color
                },
                'current_order': {
                    'id': table.current_order_id.id,
                    'name': table.current_order_id.name,
                    'amount': table.current_order_id.amount_total
                } if table.current_order_id else None,
                'server': {
                    'id': table.server_id.id,
                    'name': table.server_id.name
                } if table.server_id else None,
                'occupied_since': table.occupied_since.isoformat() if table.occupied_since else None,
                'reservation': {
                    'by': table.reserved_by,
                    'time': table.reservation_time.isoformat() if table.reservation_time else None
                } if table.status == 'reserved' else None,
                'features': {
                    'smoking_allowed': table.smoking_allowed,
                    'outdoor': table.outdoor,
                    'wheelchair_accessible': table.wheelchair_accessible,
                    'has_power_outlet': table.has_power_outlet
                },
                'stats': {
                    'orders_today': table.total_orders_today,
                    'revenue_today': table.revenue_today,
                    'avg_turnover': table.avg_turnover_time
                }
            } for table in tables],
            'sections': [{
                'id': section.id,
                'name': section.name,
                'color': section.color,
                'table_count': section.table_count,
                'total_capacity': section.total_capacity
            } for section in sections]
        }
    
    @api.model
    def get_table_statistics(self, date_from=None, date_to=None):
        """Get table utilization and performance statistics"""
        if not date_from:
            date_from = fields.Date.today()
        if not date_to:
            date_to = fields.Date.today()
            
        tables = self.search([('active', '=', True)])
        
        stats = []
        for table in tables:
            orders = self.env['pos.order'].search([
                ('table_id', '=', table.id),
                ('date_order', '>=', f"{date_from} 00:00:00"),
                ('date_order', '<=', f"{date_to} 23:59:59"),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            total_revenue = sum(orders.mapped('amount_total'))
            total_orders = len(orders)
            avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
            
            stats.append({
                'table_id': table.id,
                'table_name': table.display_name,
                'section': table.section_id.name,
                'capacity': table.capacity,
                'total_orders': total_orders,
                'total_revenue': total_revenue,
                'avg_order_value': avg_order_value,
                'utilization_rate': (total_orders / 10) * 100 if total_orders <= 10 else 100  # Simplified calculation
            })
        
        return {
            'period': {
                'from': date_from.strftime('%Y-%m-%d'),
                'to': date_to.strftime('%Y-%m-%d')
            },
            'table_stats': stats,
            'summary': {
                'total_tables': len(tables),
                'total_orders': sum(stat['total_orders'] for stat in stats),
                'total_revenue': sum(stat['total_revenue'] for stat in stats),
                'avg_utilization': sum(stat['utilization_rate'] for stat in stats) / len(stats) if stats else 0
            }
        }

# Extend POS Order to include table information
class PosOrder(models.Model):
    _inherit = 'pos.order'
    
    table_id = fields.Many2one('restaurant.table', 'Table', ondelete='set null')
    server_id = fields.Many2one('res.users', 'Server')
    course_number = fields.Integer('Course Number', default=1)
    special_instructions = fields.Text('Special Instructions')
    
    @api.model_create_multi
    def create(self, vals_list):
        orders = super().create(vals_list)
        
        # Update table status when order is created
        for order in orders:
            if order.table_id and order.table_id.status == 'available':
                order.table_id.action_set_occupied(order.server_id.id if order.server_id else None)
                order.table_id.current_order_id = order.id
        
        return orders
    
    def write(self, vals):
        result = super().write(vals)
        
        # Update table status when order state changes
        if 'state' in vals:
            for order in self:
                if order.table_id and vals['state'] in ['done', 'invoiced']:
                    # Order completed, table needs cleaning
                    order.table_id.write({
                        'status': 'cleaning',
                        'current_order_id': False
                    })
        
        return result 