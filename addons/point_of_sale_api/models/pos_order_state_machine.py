# -*- coding: utf-8 -*-

import logging
import json
from datetime import datetime, timedelta
from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError
from .redis_client import redis_client
from .websocket import WebSocketEventHandler

_logger = logging.getLogger(__name__)

class POSOrderStateMachine(models.Model):
    """Enhanced POS Order with state machine business logic"""
    _inherit = 'pos.order'
    
    # State history tracking
    state_history = fields.Text('State History', help='JSON log of state changes')
    
    # Enhanced state tracking
    validation_status = fields.Selection([
        ('pending', 'Pending Validation'),
        ('validated', 'Validated'),
        ('failed', 'Validation Failed')
    ], default='pending', string='Validation Status')
    
    # Business rule fields
    inventory_checked = fields.Boolean('Inventory Checked', default=False)
    prices_calculated = fields.Boolean('Prices Calculated', default=False)
    taxes_calculated = fields.Boolean('Taxes Calculated', default=False)
    payment_required = fields.Float('Payment Required', compute='_compute_payment_required')
    
    # Kitchen integration
    kitchen_status = fields.Selection([
        ('not_sent', 'Not Sent to Kitchen'),
        ('sent', 'Sent to Kitchen'),
        ('preparing', 'Preparing'),
        ('ready', 'Ready'),
        ('served', 'Served')
    ], default='not_sent', string='Kitchen Status')
    
    kitchen_sent_at = fields.Datetime('Kitchen Sent At')
    kitchen_ready_at = fields.Datetime('Kitchen Ready At')
    estimated_ready_time = fields.Datetime('Estimated Ready Time')
    
    # Performance tracking
    order_processing_time = fields.Float('Processing Time (seconds)', compute='_compute_processing_time')
    payment_processing_time = fields.Float('Payment Time (seconds)')
    
    # State machine configuration
    ALLOWED_TRANSITIONS = {
        'draft': ['validated', 'cancel'],
        'validated': ['paid', 'cancel'],
        'paid': ['preparing', 'done', 'cancel'],
        'preparing': ['ready', 'cancel'],
        'ready': ['completed', 'cancel'],
        'done': ['invoiced'],
        'cancel': [],
        'invoiced': []
    }
    
    @api.depends('amount_total')
    def _compute_payment_required(self):
        """Calculate total payment required"""
        for order in self:
            order.payment_required = order.amount_total
    
    @api.depends('create_date', 'date_order')
    def _compute_processing_time(self):
        """Calculate order processing time"""
        for order in self:
            if order.create_date and order.date_order:
                delta = order.date_order - order.create_date
                order.order_processing_time = delta.total_seconds()
            else:
                order.order_processing_time = 0
    
    def _log_state_change(self, old_state, new_state, reason=None):
        """Log state change in history"""
        history_entry = {
            'timestamp': datetime.now().isoformat(),
            'old_state': old_state,
            'new_state': new_state,
            'user_id': self.env.user.id,
            'user_name': self.env.user.name,
            'reason': reason or 'System transition'
        }
        
        # Get existing history
        try:
            history = json.loads(self.state_history) if self.state_history else []
        except:
            history = []
        
        # Add new entry
        history.append(history_entry)
        
        # Keep only last 50 entries
        if len(history) > 50:
            history = history[-50:]
        
        self.state_history = json.dumps(history)
        
        # Cache the state change
        cache_key = f"pos:order_state_history:{self.id}"
        redis_client.set(cache_key, history, ttl=3600)
    
    def _validate_state_transition(self, new_state):
        """Validate if state transition is allowed"""
        current_state = self.state
        
        if new_state not in self.ALLOWED_TRANSITIONS.get(current_state, []):
            allowed = ', '.join(self.ALLOWED_TRANSITIONS.get(current_state, []))
            raise ValidationError(
                f"Invalid state transition from '{current_state}' to '{new_state}'. "
                f"Allowed transitions: {allowed}"
            )
    
    def _validate_business_rules(self):
        """Validate business rules before state transitions"""
        errors = []
        
        # Check inventory availability
        if not self.inventory_checked:
            if not self._check_inventory_availability():
                errors.append("Insufficient inventory for some items")
        
        # Validate pricing
        if not self.prices_calculated:
            if not self._validate_pricing():
                errors.append("Price validation failed")
        
        # Check payment requirements
        if self.state in ['paid', 'preparing', 'ready', 'done']:
            total_payments = sum(self.payment_ids.mapped('amount'))
            if total_payments < self.amount_total:
                errors.append(f"Insufficient payment: {total_payments} < {self.amount_total}")
        
        if errors:
            raise ValidationError("\n".join(errors))
    
    def _check_inventory_availability(self):
        """Check if all order items are available in inventory"""
        try:
            for line in self.lines:
                product = line.product_id
                
                # Skip services and non-tracked products
                if product.type != 'product':
                    continue
                
                # Check stock levels
                available_qty = product.qty_available
                if available_qty < line.qty:
                    _logger.warning(
                        f"Insufficient stock for {product.name}: "
                        f"Required {line.qty}, Available {available_qty}"
                    )
                    return False
            
            self.inventory_checked = True
            return True
            
        except Exception as e:
            _logger.error(f"Inventory check failed for order {self.name}: {e}")
            return False
    
    def _validate_pricing(self):
        """Validate order pricing and calculations"""
        try:
            calculated_total = 0
            
            for line in self.lines:
                # Validate line price
                expected_price = line.product_id.list_price
                if abs(line.price_unit - expected_price) > 0.01:
                    # Allow for price overrides by managers
                    if not self.env.user.has_group('point_of_sale.group_pos_manager'):
                        _logger.warning(
                            f"Price mismatch for {line.product_id.name}: "
                            f"Expected {expected_price}, Got {line.price_unit}"
                        )
                        return False
                
                line_total = line.price_unit * line.qty
                
                # Apply discounts
                if line.discount:
                    line_total *= (1 - line.discount / 100)
                
                calculated_total += line_total
            
            # Add taxes
            calculated_total += self.amount_tax
            
            # Validate total
            if abs(calculated_total - self.amount_total) > 0.01:
                _logger.warning(
                    f"Total amount mismatch: Expected {calculated_total}, Got {self.amount_total}"
                )
                return False
            
            self.prices_calculated = True
            return True
            
        except Exception as e:
            _logger.error(f"Price validation failed for order {self.name}: {e}")
            return False
    
    def action_validate_order(self):
        """Validate order and move to validated state"""
        self._validate_state_transition('validated')
        
        # Run business rule validation
        self._validate_business_rules()
        
        # Update state
        old_state = self.state
        self.state = 'validated'
        self.validation_status = 'validated'
        
        # Log state change
        self._log_state_change(old_state, 'validated', 'Order validated')
        
        # Trigger WebSocket event
        WebSocketEventHandler.order_updated(self)
        
        # Cache validated order
        self._cache_order_data()
        
        return True
    
    def action_process_payment(self, payment_data):
        """Process payment and move to paid state"""
        if self.state != 'validated':
            self.action_validate_order()
        
        self._validate_state_transition('paid')
        
        start_time = datetime.now()
        
        try:
            # Process payment through payment gateway
            payment_result = self._process_payment_gateway(payment_data)
            
            if not payment_result['success']:
                raise UserError(f"Payment failed: {payment_result.get('error', 'Unknown error')}")
            
            # Update state
            old_state = self.state
            self.state = 'paid'
            
            # Calculate payment processing time
            self.payment_processing_time = (datetime.now() - start_time).total_seconds()
            
            # Log state change
            self._log_state_change(old_state, 'paid', 'Payment processed')
            
            # Send to kitchen if needed
            if self._requires_kitchen_preparation():
                self.action_send_to_kitchen()
            else:
                # Skip to done if no kitchen preparation needed
                self.state = 'done'
                self._log_state_change('paid', 'done', 'No kitchen preparation required')
            
            # Trigger WebSocket events
            WebSocketEventHandler.order_updated(self)
            
            return payment_result
            
        except Exception as e:
            _logger.error(f"Payment processing failed for order {self.name}: {e}")
            raise UserError(f"Payment processing failed: {str(e)}")
    
    def _process_payment_gateway(self, payment_data):
        """Process payment through configured gateway"""
        # This would integrate with the actual payment gateway
        # For now, return a mock success response
        return {
            'success': True,
            'transaction_id': f"TXN_{self.id}_{int(datetime.now().timestamp())}",
            'amount': payment_data.get('amount', self.amount_total),
            'method': payment_data.get('method', 'cash'),
            'processed_at': datetime.now().isoformat()
        }
    
    def _requires_kitchen_preparation(self):
        """Check if order requires kitchen preparation"""
        for line in self.lines:
            product = line.product_id
            # Check if product requires cooking (custom field)
            if hasattr(product, 'requires_cooking') and product.requires_cooking:
                return True
        return False
    
    def action_send_to_kitchen(self):
        """Send order to kitchen for preparation"""
        if self.state != 'paid':
            raise UserError("Order must be paid before sending to kitchen")
        
        self._validate_state_transition('preparing')
        
        # Update state
        old_state = self.state
        self.state = 'preparing'
        self.kitchen_status = 'sent'
        self.kitchen_sent_at = fields.Datetime.now()
        
        # Calculate estimated ready time (15 minutes default)
        estimated_prep_time = self._calculate_preparation_time()
        self.estimated_ready_time = fields.Datetime.now() + timedelta(minutes=estimated_prep_time)
        
        # Log state change
        self._log_state_change(old_state, 'preparing', 'Sent to kitchen')
        
        # Create kitchen order items if restaurant features available
        if 'pos_restaurant_features' in self.env.registry._init_modules:
            self._create_kitchen_items()
        
        # Trigger WebSocket events
        WebSocketEventHandler.order_updated(self)
        
        return True
    
    def _calculate_preparation_time(self):
        """Calculate estimated preparation time"""
        total_time = 0
        
        for line in self.lines:
            product = line.product_id
            # Get preparation time from product (default 5 minutes)
            prep_time = getattr(product, 'prep_time', 5)
            total_time += prep_time * line.qty
        
        # Add 5 minutes base time
        return max(total_time + 5, 10)
    
    def _create_kitchen_items(self):
        """Create kitchen order items for restaurant module"""
        try:
            KitchenItem = self.env['kitchen.order.item']
            
            for line in self.lines:
                product = line.product_id
                
                # Only create items for products that require cooking
                if hasattr(product, 'requires_cooking') and product.requires_cooking:
                    if hasattr(product, 'kitchen_station_id') and product.kitchen_station_id:
                        KitchenItem.create({
                            'order_id': self.id,
                            'order_line_id': line.id,
                            'station_id': product.kitchen_station_id.id,
                            'product_id': product.id,
                            'quantity': line.qty,
                            'status': 'pending',
                            'priority': 'normal'
                        })
            
        except Exception as e:
            _logger.error(f"Failed to create kitchen items for order {self.name}: {e}")
    
    def action_mark_ready(self):
        """Mark order as ready for pickup/serving"""
        self._validate_state_transition('ready')
        
        # Update state
        old_state = self.state
        self.state = 'ready'
        self.kitchen_status = 'ready'
        self.kitchen_ready_at = fields.Datetime.now()
        
        # Log state change
        self._log_state_change(old_state, 'ready', 'Order ready for pickup')
        
        # Trigger WebSocket events
        WebSocketEventHandler.kitchen_order_ready(self)
        
        return True
    
    def action_complete_order(self):
        """Complete the order"""
        if self.state == 'preparing':
            self.action_mark_ready()
        
        self._validate_state_transition('completed')
        
        # Update state
        old_state = self.state
        self.state = 'done'  # Map to Odoo's standard 'done' state
        self.kitchen_status = 'served'
        
        # Log state change
        self._log_state_change(old_state, 'done', 'Order completed')
        
        # Update inventory
        self._update_inventory()
        
        # Trigger WebSocket events
        WebSocketEventHandler.order_updated(self)
        
        # Clear cached data
        self._clear_order_cache()
        
        return True
    
    def action_cancel_order(self, reason=None):
        """Cancel the order"""
        if self.state in ['done', 'invoiced']:
            raise UserError("Cannot cancel completed orders")
        
        # Update state
        old_state = self.state
        self.state = 'cancel'
        self.kitchen_status = 'not_sent'
        
        # Log state change
        self._log_state_change(old_state, 'cancel', reason or 'Order cancelled')
        
        # Cancel any kitchen items
        if 'pos_restaurant_features' in self.env.registry._init_modules:
            kitchen_items = self.env['kitchen.order.item'].search([('order_id', '=', self.id)])
            kitchen_items.write({'status': 'cancelled'})
        
        # Process refunds if payment was made
        if old_state in ['paid', 'preparing', 'ready']:
            self._process_refunds(reason)
        
        # Trigger WebSocket events
        WebSocketEventHandler.order_updated(self)
        
        return True
    
    def _process_refunds(self, reason):
        """Process refunds for cancelled paid orders"""
        for payment in self.payment_ids:
            if payment.amount > 0:
                # Create refund record
                refund_data = {
                    'order_id': self.id,
                    'payment_id': payment.id,
                    'amount': payment.amount,
                    'reason': reason,
                    'processed_at': fields.Datetime.now()
                }
                
                # Process through payment gateway
                # This would integrate with actual gateway APIs
                _logger.info(f"Processing refund for order {self.name}: ${payment.amount}")
    
    def _update_inventory(self):
        """Update inventory levels after order completion"""
        for line in self.lines:
            product = line.product_id
            
            # Only update tracked products
            if product.type == 'product':
                # This would integrate with inventory management
                _logger.info(f"Updating inventory for {product.name}: -{line.qty}")
    
    def _cache_order_data(self):
        """Cache order data for quick access"""
        cache_key = f"pos:order:{self.id}"
        data = {
            'id': self.id,
            'name': self.name,
            'state': self.state,
            'kitchen_status': self.kitchen_status,
            'amount_total': self.amount_total,
            'session_id': self.session_id.id,
            'cached_at': datetime.now().isoformat()
        }
        redis_client.set(cache_key, data, ttl=1800)
    
    def _clear_order_cache(self):
        """Clear cached order data"""
        cache_key = f"pos:order:{self.id}"
        redis_client.delete(cache_key)
    
    @api.model
    def get_cached_order(self, order_id):
        """Get cached order data"""
        cache_key = f"pos:order:{order_id}"
        return redis_client.get(cache_key)
    
    def get_state_history(self):
        """Get order state change history"""
        try:
            history = json.loads(self.state_history) if self.state_history else []
            return sorted(history, key=lambda x: x['timestamp'], reverse=True)
        except:
            return []
    
    @api.model
    def get_orders_by_state(self, state, session_id=None):
        """Get orders by state with caching"""
        cache_key = f"pos:orders_by_state:{state}"
        if session_id:
            cache_key += f":session_{session_id}"
        
        # Try cache first
        cached_data = redis_client.get(cache_key)
        if cached_data:
            return cached_data
        
        # Query database
        domain = [('state', '=', state)]
        if session_id:
            domain.append(('session_id', '=', session_id))
        
        orders = self.search(domain)
        
        # Serialize order data
        data = []
        for order in orders:
            data.append({
                'id': order.id,
                'name': order.name,
                'state': order.state,
                'kitchen_status': order.kitchen_status,
                'amount_total': order.amount_total,
                'create_date': order.create_date.isoformat() if order.create_date else None
            })
        
        # Cache for 5 minutes
        redis_client.set(cache_key, data, ttl=300)
        
        return data

class POSOrderPerformanceTracker(models.Model):
    """Track order processing performance metrics"""
    _name = 'pos.order.performance'
    _description = 'POS Order Performance Tracking'
    
    order_id = fields.Many2one('pos.order', 'Order', required=True, ondelete='cascade')
    session_id = fields.Many2one('pos.session', 'Session', required=True)
    
    # Timing metrics
    created_at = fields.Datetime('Created At', required=True)
    validated_at = fields.Datetime('Validated At')
    paid_at = fields.Datetime('Paid At')
    kitchen_sent_at = fields.Datetime('Kitchen Sent At')
    ready_at = fields.Datetime('Ready At')
    completed_at = fields.Datetime('Completed At')
    
    # Performance calculations
    validation_time = fields.Float('Validation Time (seconds)')
    payment_time = fields.Float('Payment Time (seconds)')
    kitchen_time = fields.Float('Kitchen Time (seconds)')
    total_time = fields.Float('Total Time (seconds)')
    
    @api.model
    def track_order_performance(self, order):
        """Track performance metrics for an order"""
        tracker = self.search([('order_id', '=', order.id)])
        
        if not tracker:
            tracker = self.create({
                'order_id': order.id,
                'session_id': order.session_id.id,
                'created_at': order.create_date or fields.Datetime.now()
            })
        
        # Update timing based on current state
        if order.state == 'validated' and not tracker.validated_at:
            tracker.validated_at = fields.Datetime.now()
            if tracker.created_at:
                tracker.validation_time = (tracker.validated_at - tracker.created_at).total_seconds()
        
        elif order.state == 'paid' and not tracker.paid_at:
            tracker.paid_at = fields.Datetime.now()
            if tracker.validated_at:
                tracker.payment_time = (tracker.paid_at - tracker.validated_at).total_seconds()
        
        elif order.state == 'preparing' and not tracker.kitchen_sent_at:
            tracker.kitchen_sent_at = fields.Datetime.now()
        
        elif order.state == 'ready' and not tracker.ready_at:
            tracker.ready_at = fields.Datetime.now()
            if tracker.kitchen_sent_at:
                tracker.kitchen_time = (tracker.ready_at - tracker.kitchen_sent_at).total_seconds()
        
        elif order.state == 'done' and not tracker.completed_at:
            tracker.completed_at = fields.Datetime.now()
            if tracker.created_at:
                tracker.total_time = (tracker.completed_at - tracker.created_at).total_seconds()
        
        return tracker 