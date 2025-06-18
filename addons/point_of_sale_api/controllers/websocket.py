# -*- coding: utf-8 -*-

import json
import logging
import time
from datetime import datetime, timedelta
from odoo import http, models, fields, api
from odoo.http import request
from odoo.exceptions import AccessError, ValidationError
import uuid
import asyncio
import websocket
from threading import Thread
import redis

_logger = logging.getLogger(__name__)

class WebSocketConnection(models.Model):
    _name = 'pos.websocket.connection'
    _description = 'WebSocket Connection Tracking'
    _order = 'created_at desc'
    
    connection_id = fields.Char('Connection ID', required=True, index=True)
    session_id = fields.Many2one('pos.session', 'POS Session', required=True, ondelete='cascade')
    user_id = fields.Many2one('res.users', 'User', required=True)
    created_at = fields.Datetime('Created At', default=fields.Datetime.now)
    last_ping = fields.Datetime('Last Ping', default=fields.Datetime.now)
    is_active = fields.Boolean('Active', default=True)
    device_info = fields.Text('Device Info')
    
    @api.model
    def cleanup_stale_connections(self):
        """Remove connections that haven't pinged in 5 minutes"""
        cutoff_time = datetime.now() - timedelta(minutes=5)
        stale_connections = self.search([
            ('last_ping', '<', cutoff_time),
            ('is_active', '=', True)
        ])
        stale_connections.write({'is_active': False})
        _logger.info(f"Cleaned up {len(stale_connections)} stale WebSocket connections")

class WebSocketManager:
    """Manages WebSocket connections and message broadcasting"""
    
    def __init__(self):
        self.connections = {}  # connection_id -> connection_info
        self.rooms = {}  # room_id -> set of connection_ids
        self.redis_client = None
        self.setup_redis()
    
    def setup_redis(self):
        """Setup Redis connection for message queue"""
        try:
            self.redis_client = redis.Redis(
                host='localhost',
                port=6379,
                db=0,
                decode_responses=True,
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True
            )
            self.redis_client.ping()
            _logger.info("Redis connection established for WebSocket manager")
        except Exception as e:
            _logger.error(f"Failed to connect to Redis: {e}")
            self.redis_client = None
    
    def register_connection(self, connection_id, session_id, user_id, websocket_conn):
        """Register a new WebSocket connection"""
        self.connections[connection_id] = {
            'websocket': websocket_conn,
            'session_id': session_id,
            'user_id': user_id,
            'created_at': datetime.now(),
            'last_ping': datetime.now()
        }
        
        # Join session room
        room_id = f"pos_session_{session_id}"
        if room_id not in self.rooms:
            self.rooms[room_id] = set()
        self.rooms[room_id].add(connection_id)
        
        _logger.info(f"WebSocket connection {connection_id} registered for session {session_id}")
        
        # Update database
        request.env['pos.websocket.connection'].sudo().create({
            'connection_id': connection_id,
            'session_id': session_id,
            'user_id': user_id,
            'is_active': True
        })
    
    def unregister_connection(self, connection_id):
        """Unregister a WebSocket connection"""
        if connection_id in self.connections:
            session_id = self.connections[connection_id]['session_id']
            room_id = f"pos_session_{session_id}"
            
            # Remove from room
            if room_id in self.rooms:
                self.rooms[room_id].discard(connection_id)
                if not self.rooms[room_id]:
                    del self.rooms[room_id]
            
            # Remove connection
            del self.connections[connection_id]
            
            _logger.info(f"WebSocket connection {connection_id} unregistered")
            
            # Update database
            request.env['pos.websocket.connection'].sudo().search([
                ('connection_id', '=', connection_id)
            ]).write({'is_active': False})
    
    def broadcast_to_room(self, room_id, message):
        """Broadcast message to all connections in a room"""
        if room_id not in self.rooms:
            return
        
        message_json = json.dumps(message)
        dead_connections = []
        
        for connection_id in self.rooms[room_id]:
            if connection_id in self.connections:
                try:
                    websocket_conn = self.connections[connection_id]['websocket']
                    websocket_conn.send(message_json)
                except Exception as e:
                    _logger.error(f"Failed to send message to {connection_id}: {e}")
                    dead_connections.append(connection_id)
        
        # Clean up dead connections
        for conn_id in dead_connections:
            self.unregister_connection(conn_id)
    
    def broadcast_to_session(self, session_id, message):
        """Broadcast message to all connections in a POS session"""
        room_id = f"pos_session_{session_id}"
        self.broadcast_to_room(room_id, message)
    
    def send_to_connection(self, connection_id, message):
        """Send message to specific connection"""
        if connection_id in self.connections:
            try:
                websocket_conn = self.connections[connection_id]['websocket']
                websocket_conn.send(json.dumps(message))
                return True
            except Exception as e:
                _logger.error(f"Failed to send message to {connection_id}: {e}")
                self.unregister_connection(connection_id)
        return False
    
    def update_ping(self, connection_id):
        """Update last ping time for connection"""
        if connection_id in self.connections:
            self.connections[connection_id]['last_ping'] = datetime.now()
            
            # Update database
            request.env['pos.websocket.connection'].sudo().search([
                ('connection_id', '=', connection_id)
            ]).write({'last_ping': fields.Datetime.now()})

# Global WebSocket manager instance
websocket_manager = WebSocketManager()

class WebSocketController(http.Controller):
    """WebSocket API endpoints and handlers"""
    
    @http.route('/ws/pos/<int:session_id>/', type='http', auth='user', methods=['GET'])
    def websocket_handshake(self, session_id, **kwargs):
        """Handle WebSocket handshake and upgrade"""
        try:
            # Validate session access
            session = request.env['pos.session'].browse(session_id)
            if not session.exists():
                return request.not_found()
            
            # Check user permissions
            if not request.env.user.has_group('point_of_sale.group_pos_user'):
                return request.make_response('Unauthorized', status=401)
            
            # Generate connection ID
            connection_id = str(uuid.uuid4())
            
            # WebSocket upgrade logic would go here
            # For now, return connection info
            return request.make_json_response({
                'connection_id': connection_id,
                'session_id': session_id,
                'user_id': request.env.user.id,
                'timestamp': datetime.now().isoformat()
            })
            
        except Exception as e:
            _logger.error(f"WebSocket handshake failed: {e}")
            return request.make_response('Internal Server Error', status=500)
    
    @http.route('/api/v1/ws/broadcast', type='json', auth='user')
    def broadcast_message(self, session_id, message_type, data=None, **kwargs):
        """Broadcast message to WebSocket connections"""
        try:
            # Validate session
            session = request.env['pos.session'].browse(session_id)
            if not session.exists():
                return {'error': 'Session not found'}
            
            # Prepare message
            message = {
                'type': message_type,
                'data': data or {},
                'timestamp': datetime.now().isoformat(),
                'session_id': session_id
            }
            
            # Broadcast to session
            websocket_manager.broadcast_to_session(session_id, message)
            
            return {'success': True, 'message': 'Message broadcasted'}
            
        except Exception as e:
            _logger.error(f"Broadcast failed: {e}")
            return {'error': str(e)}
    
    @http.route('/api/v1/ws/connections', type='json', auth='user')
    def get_connections(self, session_id=None, **kwargs):
        """Get active WebSocket connections"""
        try:
            domain = [('is_active', '=', True)]
            if session_id:
                domain.append(('session_id', '=', session_id))
            
            connections = request.env['pos.websocket.connection'].search(domain)
            
            return {
                'connections': [{
                    'connection_id': conn.connection_id,
                    'session_id': conn.session_id.id,
                    'user_id': conn.user_id.id,
                    'user_name': conn.user_id.name,
                    'created_at': conn.created_at.isoformat(),
                    'last_ping': conn.last_ping.isoformat()
                } for conn in connections]
            }
            
        except Exception as e:
            _logger.error(f"Get connections failed: {e}")
            return {'error': str(e)}

class WebSocketEventHandler:
    """Handles WebSocket events for different business entities"""
    
    @staticmethod
    def order_created(order):
        """Handle order created event"""
        message = {
            'type': 'order.created',
            'data': {
                'order_id': order.id,
                'order_name': order.name,
                'session_id': order.session_id.id,
                'amount_total': order.amount_total,
                'state': order.state,
                'created_at': order.create_date.isoformat() if order.create_date else None
            }
        }
        websocket_manager.broadcast_to_session(order.session_id.id, message)
    
    @staticmethod
    def order_updated(order):
        """Handle order updated event"""
        message = {
            'type': 'order.updated',
            'data': {
                'order_id': order.id,
                'order_name': order.name,
                'session_id': order.session_id.id,
                'amount_total': order.amount_total,
                'state': order.state,
                'updated_at': fields.Datetime.now().isoformat()
            }
        }
        websocket_manager.broadcast_to_session(order.session_id.id, message)
    
    @staticmethod
    def payment_processed(payment):
        """Handle payment processed event"""
        message = {
            'type': 'payment.processed',
            'data': {
                'payment_id': payment.id,
                'order_id': payment.pos_order_id.id,
                'session_id': payment.session_id.id,
                'amount': payment.amount,
                'payment_method': payment.payment_method_id.name,
                'state': payment.state if hasattr(payment, 'state') else 'processed'
            }
        }
        websocket_manager.broadcast_to_session(payment.session_id.id, message)
    
    @staticmethod
    def session_updated(session):
        """Handle session updated event"""
        message = {
            'type': 'session.updated',
            'data': {
                'session_id': session.id,
                'state': session.state,
                'cash_register_balance_end_real': session.cash_register_balance_end_real,
                'cash_register_balance_start': session.cash_register_balance_start,
                'updated_at': fields.Datetime.now().isoformat()
            }
        }
        websocket_manager.broadcast_to_session(session.id, message)
    
    @staticmethod
    def kitchen_order_ready(order):
        """Handle kitchen order ready event"""
        message = {
            'type': 'kitchen.order_ready',
            'data': {
                'order_id': order.id,
                'order_name': order.name,
                'session_id': order.session_id.id,
                'table_id': getattr(order, 'table_id', None),
                'ready_at': fields.Datetime.now().isoformat()
            }
        }
        websocket_manager.broadcast_to_session(order.session_id.id, message)

# Cleanup cron job
class WebSocketCleanupCron(models.Model):
    _name = 'pos.websocket.cleanup'
    _description = 'WebSocket Connection Cleanup'
    
    @api.model
    def cleanup_stale_connections(self):
        """Cron job to cleanup stale connections"""
        self.env['pos.websocket.connection'].cleanup_stale_connections() 