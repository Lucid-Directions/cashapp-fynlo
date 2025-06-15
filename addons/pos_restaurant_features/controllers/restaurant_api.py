# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
from datetime import datetime, timedelta
import json
import logging

_logger = logging.getLogger(__name__)

class RestaurantAPIController(http.Controller):
    
    # ============ TABLE MANAGEMENT ENDPOINTS ============
    
    @http.route('/restaurant/floor_plan', type='json', auth='user')
    def get_floor_plan(self, section_id=None, **kwargs):
        """Get floor plan with current table status"""
        try:
            return request.env['restaurant.table'].get_floor_plan(section_id=section_id)
        except Exception as e:
            _logger.error(f"Error getting floor plan: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/restaurant/table/update_status', type='json', auth='user')
    def update_table_status(self, table_id, status, **kwargs):
        """Update table status"""
        try:
            table = request.env['restaurant.table'].browse(table_id)
            if not table.exists():
                return {'error': 'Table not found'}
            
            if status == 'available':
                table.action_set_available()
            elif status == 'occupied':
                server_id = kwargs.get('server_id')
                table.action_set_occupied(server_id=server_id)
            elif status == 'reserved':
                reserved_by = kwargs.get('reserved_by', 'Unknown')
                reservation_time = kwargs.get('reservation_time')
                if reservation_time:
                    reservation_time = datetime.fromisoformat(reservation_time.replace('Z', '+00:00'))
                table.action_set_reserved(reserved_by, reservation_time)
            elif status == 'cleaning':
                table.action_set_cleaning()
            else:
                table.status = status
            
            return {'success': True, 'message': f'Table status updated to {status}'}
            
        except Exception as e:
            _logger.error(f"Error updating table status: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/restaurant/table/assign_server', type='json', auth='user')
    def assign_server_to_table(self, table_id, server_id, **kwargs):
        """Assign a server to a table"""
        try:
            table = request.env['restaurant.table'].browse(table_id)
            if not table.exists():
                return {'error': 'Table not found'}
            
            table.action_assign_server(server_id)
            return {'success': True, 'message': 'Server assigned successfully'}
            
        except Exception as e:
            _logger.error(f"Error assigning server: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/restaurant/table/update_position', type='json', auth='user')
    def update_table_position(self, table_id, pos_x, pos_y, width=None, height=None, rotation=None, **kwargs):
        """Update table position and dimensions"""
        try:
            table = request.env['restaurant.table'].browse(table_id)
            if not table.exists():
                return {'error': 'Table not found'}
            
            table.action_update_position(pos_x, pos_y, width, height, rotation)
            return {'success': True, 'message': 'Table position updated'}
            
        except Exception as e:
            _logger.error(f"Error updating table position: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/restaurant/table/statistics', type='json', auth='user')
    def get_table_statistics(self, date_from=None, date_to=None, **kwargs):
        """Get table utilization and performance statistics"""
        try:
            if date_from:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
            if date_to:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
                
            return request.env['restaurant.table'].get_table_statistics(date_from, date_to)
            
        except Exception as e:
            _logger.error(f"Error getting table statistics: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/restaurant/sections', type='json', auth='user')
    def get_sections(self, **kwargs):
        """Get all restaurant sections"""
        try:
            sections = request.env['restaurant.section'].search([('active', '=', True)])
            return {
                'sections': [{
                    'id': section.id,
                    'name': section.name,
                    'description': section.description,
                    'color': section.color,
                    'table_count': section.table_count,
                    'total_capacity': section.total_capacity,
                    'manager': {
                        'id': section.manager_id.id,
                        'name': section.manager_id.name
                    } if section.manager_id else None,
                    'servers': [{
                        'id': server.id,
                        'name': server.name
                    } for server in section.server_ids]
                } for section in sections]
            }
            
        except Exception as e:
            _logger.error(f"Error getting sections: {str(e)}")
            return {'error': str(e)}
    
    # ============ KITCHEN DISPLAY ENDPOINTS ============
    
    @http.route('/kitchen/orders', type='json', auth='user')
    def get_kitchen_orders(self, station_ids=None, limit=50, **kwargs):
        """Get orders for kitchen display"""
        try:
            if isinstance(station_ids, str):
                station_ids = [int(id) for id in station_ids.split(',') if id.strip()]
            
            return request.env['kitchen.display.controller'].get_kitchen_orders(
                station_ids=station_ids, 
                limit=limit
            )
            
        except Exception as e:
            _logger.error(f"Error getting kitchen orders: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/kitchen/item/start_preparation', type='json', auth='user')
    def start_item_preparation(self, item_id, **kwargs):
        """Start preparation of a kitchen item"""
        try:
            item = request.env['kitchen.order.item'].browse(item_id)
            if not item.exists():
                return {'error': 'Kitchen item not found'}
            
            item.action_start_preparation()
            return {'success': True, 'message': 'Item preparation started'}
            
        except Exception as e:
            _logger.error(f"Error starting item preparation: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/kitchen/item/mark_ready', type='json', auth='user')
    def mark_item_ready(self, item_id, **kwargs):
        """Mark kitchen item as ready"""
        try:
            item = request.env['kitchen.order.item'].browse(item_id)
            if not item.exists():
                return {'error': 'Kitchen item not found'}
            
            item.action_mark_ready()
            return {'success': True, 'message': 'Item marked as ready'}
            
        except Exception as e:
            _logger.error(f"Error marking item ready: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/kitchen/item/mark_served', type='json', auth='user')
    def mark_item_served(self, item_id, **kwargs):
        """Mark kitchen item as served"""
        try:
            item = request.env['kitchen.order.item'].browse(item_id)
            if not item.exists():
                return {'error': 'Kitchen item not found'}
            
            item.action_mark_served()
            return {'success': True, 'message': 'Item marked as served'}
            
        except Exception as e:
            _logger.error(f"Error marking item served: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/kitchen/item/cancel', type='json', auth='user')
    def cancel_kitchen_item(self, item_id, reason=None, **kwargs):
        """Cancel a kitchen item"""
        try:
            item = request.env['kitchen.order.item'].browse(item_id)
            if not item.exists():
                return {'error': 'Kitchen item not found'}
            
            item.action_cancel_item(reason=reason)
            return {'success': True, 'message': 'Item cancelled'}
            
        except Exception as e:
            _logger.error(f"Error cancelling item: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/kitchen/stations', type='json', auth='user')
    def get_kitchen_stations(self, **kwargs):
        """Get all kitchen stations"""
        try:
            stations = request.env['kitchen.station'].search([('active', '=', True)], order='sequence, name')
            return {
                'stations': [{
                    'id': station.id,
                    'name': station.name,
                    'code': station.code,
                    'type': station.station_type,
                    'color': station.color,
                    'sequence': station.sequence,
                    'max_concurrent_orders': station.max_concurrent_orders,
                    'avg_prep_time': station.avg_prep_time,
                    'priority_level': station.priority_level,
                    'orders_today': station.orders_today,
                    'efficiency_rating': station.efficiency_rating,
                    'supervisor': {
                        'id': station.supervisor_id.id,
                        'name': station.supervisor_id.name
                    } if station.supervisor_id else None,
                    'chefs': [{
                        'id': chef.id,
                        'name': chef.name
                    } for chef in station.chef_ids]
                } for station in stations]
            }
            
        except Exception as e:
            _logger.error(f"Error getting kitchen stations: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/kitchen/station/summary', type='json', auth='user')
    def get_station_summary(self, station_id=None, **kwargs):
        """Get kitchen station summary statistics"""
        try:
            return request.env['kitchen.display.controller'].get_station_summary(station_id=station_id)
            
        except Exception as e:
            _logger.error(f"Error getting station summary: {str(e)}")
            return {'error': str(e)}
    
    # ============ ORDER MANAGEMENT ENDPOINTS ============
    
    @http.route('/restaurant/order/create', type='json', auth='user')
    def create_restaurant_order(self, table_id, server_id=None, items=None, **kwargs):
        """Create a new restaurant order"""
        try:
            # Validate table
            table = request.env['restaurant.table'].browse(table_id)
            if not table.exists():
                return {'error': 'Table not found'}
            
            # Create POS order
            order_vals = {
                'table_id': table_id,
                'server_id': server_id,
                'partner_id': kwargs.get('customer_id'),
                'special_instructions': kwargs.get('special_instructions', ''),
                'session_id': kwargs.get('session_id'),  # This should come from active POS session
            }
            
            # Add order lines if provided
            if items:
                order_lines = []
                for item in items:
                    line_vals = {
                        'product_id': item['product_id'],
                        'qty': item['quantity'],
                        'price_unit': item.get('price_unit', 0),
                        'special_instructions': item.get('notes', ''),
                    }
                    order_lines.append((0, 0, line_vals))
                order_vals['lines'] = order_lines
            
            order = request.env['pos.order'].create(order_vals)
            
            return {
                'success': True,
                'order_id': order.id,
                'order_name': order.name,
                'message': 'Order created successfully'
            }
            
        except Exception as e:
            _logger.error(f"Error creating restaurant order: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/restaurant/order/update', type='json', auth='user')
    def update_restaurant_order(self, order_id, **kwargs):
        """Update restaurant order details"""
        try:
            order = request.env['pos.order'].browse(order_id)
            if not order.exists():
                return {'error': 'Order not found'}
            
            update_vals = {}
            if 'table_id' in kwargs:
                update_vals['table_id'] = kwargs['table_id']
            if 'server_id' in kwargs:
                update_vals['server_id'] = kwargs['server_id']
            if 'special_instructions' in kwargs:
                update_vals['special_instructions'] = kwargs['special_instructions']
            
            if update_vals:
                order.write(update_vals)
            
            return {'success': True, 'message': 'Order updated successfully'}
            
        except Exception as e:
            _logger.error(f"Error updating restaurant order: {str(e)}")
            return {'error': str(e)}
    
    # ============ REAL-TIME UPDATES ENDPOINT ============
    
    @http.route('/restaurant/realtime_status', type='json', auth='user')
    def get_realtime_status(self, **kwargs):
        """Get real-time status of tables and kitchen"""
        try:
            # Get table status
            floor_plan = request.env['restaurant.table'].get_floor_plan()
            
            # Get kitchen status
            kitchen_orders = request.env['kitchen.display.controller'].get_kitchen_orders(limit=20)
            
            # Get station summary
            station_summary = request.env['kitchen.display.controller'].get_station_summary()
            
            return {
                'timestamp': datetime.now().isoformat(),
                'tables': floor_plan,
                'kitchen': kitchen_orders,
                'stations': station_summary,
                'alerts': self._get_restaurant_alerts()
            }
            
        except Exception as e:
            _logger.error(f"Error getting real-time status: {str(e)}")
            return {'error': str(e)}
    
    def _get_restaurant_alerts(self):
        """Get restaurant alerts and notifications"""
        alerts = []
        
        try:
            # Check for tables that have been occupied too long
            long_occupied_tables = request.env['restaurant.table'].search([
                ('status', '=', 'occupied'),
                ('occupied_since', '<=', datetime.now() - timedelta(hours=2))
            ])
            
            for table in long_occupied_tables:
                alerts.append({
                    'type': 'warning',
                    'title': 'Long Occupied Table',
                    'message': f'Table {table.display_name} has been occupied for over 2 hours',
                    'table_id': table.id
                })
            
            # Check for kitchen items taking too long
            slow_items = request.env['kitchen.order.item'].search([
                ('status', '=', 'preparing'),
                ('started_time', '<=', datetime.now() - timedelta(minutes=30))
            ])
            
            for item in slow_items:
                alerts.append({
                    'type': 'critical',
                    'title': 'Slow Kitchen Item',
                    'message': f'{item.product_name} for {item.order_id.name} is taking longer than expected',
                    'item_id': item.id,
                    'order_id': item.order_id.id
                })
            
        except Exception as e:
            _logger.error(f"Error getting restaurant alerts: {str(e)}")
        
        return alerts
    
    # ============ REPORTING ENDPOINTS ============
    
    @http.route('/restaurant/reports/daily_summary', type='json', auth='user')
    def get_daily_summary(self, date=None, **kwargs):
        """Get daily restaurant summary report"""
        try:
            if not date:
                date = datetime.now().date()
            else:
                date = datetime.strptime(date, '%Y-%m-%d').date()
            
            # Table statistics
            table_stats = request.env['restaurant.table'].get_table_statistics(date, date)
            
            # Kitchen performance
            stations = request.env['kitchen.station'].search([('active', '=', True)])
            kitchen_stats = []
            
            for station in stations:
                items = request.env['kitchen.order.item'].search([
                    ('station_id', '=', station.id),
                    ('created_time', '>=', f"{date} 00:00:00"),
                    ('created_time', '<=', f"{date} 23:59:59")
                ])
                
                completed_items = items.filtered(lambda i: i.status in ['ready', 'served'])
                avg_prep_time = sum(completed_items.mapped('prep_time_actual')) / len(completed_items) if completed_items else 0
                
                kitchen_stats.append({
                    'station_name': station.name,
                    'total_items': len(items),
                    'completed_items': len(completed_items),
                    'avg_prep_time': round(avg_prep_time, 1),
                    'efficiency': station.efficiency_rating
                })
            
            return {
                'date': date.strftime('%Y-%m-%d'),
                'table_summary': table_stats,
                'kitchen_summary': kitchen_stats,
                'generated_at': datetime.now().isoformat()
            }
            
        except Exception as e:
            _logger.error(f"Error getting daily summary: {str(e)}")
            return {'error': str(e)} 