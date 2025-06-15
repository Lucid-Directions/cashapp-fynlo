import json
import logging
from datetime import datetime, timedelta

from odoo import http, fields
from odoo.http import request
from odoo.exceptions import ValidationError, AccessDenied, UserError
from odoo.addons.point_of_sale_api.controllers.base import POSAPIController, api_route

_logger = logging.getLogger(__name__)


class OrdersController(POSAPIController):
    """Order management endpoints for POS API"""

    # Order state transitions
    ALLOWED_TRANSITIONS = {
        'draft': ['paid', 'cancel'],
        'paid': ['done', 'invoiced'],
        'done': ['invoiced'],
        'cancel': [],
        'invoiced': []
    }

    @api_route('/api/v1/orders', methods=['POST'], auth=True, permissions=['pos.order.create'])
    def create_order(self, auth_info=None):
        """
        Create a new POS order
        
        POST /api/v1/orders
        {
            "session_id": 123,
            "partner_id": 456,
            "lines": [
                {
                    "product_id": 789,
                    "qty": 2,
                    "price_unit": 15.99,
                    "discount": 0
                }
            ],
            "amount_tax": 2.40,
            "amount_total": 34.38,
            "amount_paid": 34.38,
            "amount_return": 0,
            "pos_reference": "Order 001-001-0001"
        }
        """
        try:
            # Validate request data
            data = self._validate_json(['session_id', 'lines'])
            
            session_id = data.get('session_id')
            partner_id = data.get('partner_id')
            lines_data = data.get('lines', [])
            
            # Validate session
            session = request.env['pos.session'].browse(session_id)
            if not session.exists() or session.state != 'opened':
                raise ValidationError("Invalid or closed POS session")
            
            # Check session access
            if session.user_id.id != auth_info.get('user_id'):
                raise AccessDenied("Cannot create orders for other users' sessions")
            
            # Validate partner if provided
            partner = None
            if partner_id:
                partner = request.env['res.partner'].browse(partner_id)
                if not partner.exists():
                    raise ValidationError("Invalid partner")
            
            # Create order
            order_vals = {
                'session_id': session_id,
                'partner_id': partner_id,
                'date_order': fields.Datetime.now(),
                'pos_reference': data.get('pos_reference') or self._generate_pos_reference(session),
                'amount_tax': data.get('amount_tax', 0),
                'amount_total': data.get('amount_total', 0),
                'amount_paid': data.get('amount_paid', 0),
                'amount_return': data.get('amount_return', 0),
                'state': 'draft',
                'config_id': session.config_id.id,
                'company_id': session.config_id.company_id.id,
                'pricelist_id': session.config_id.pricelist_id.id,
                'fiscal_position_id': data.get('fiscal_position_id'),
                'user_id': auth_info.get('user_id'),
            }
            
            order = request.env['pos.order'].create(order_vals)
            
            # Create order lines
            for line_data in lines_data:
                self._create_order_line(order, line_data)
            
            # Recalculate totals
            order._compute_amount_all()
            
            response_data = self._serialize_order(order, detailed=True)
            
            return self._json_response(response_data, message="Order created successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error creating order: {e}")
            return self._error_response("Failed to create order", status=500)

    @api_route('/api/v1/orders/<int:order_id>', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_order(self, order_id, auth_info=None):
        """
        Get specific order by ID
        
        GET /api/v1/orders/123
        """
        try:
            order = request.env['pos.order'].search([
                ('id', '=', order_id)
            ], limit=1)
            
            if not order:
                return self._error_response("Order not found", status=404)
            
            # Check access permissions
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            order_data = self._serialize_order(order, detailed=True)
            
            return self._json_response(order_data)
            
        except AccessDenied as e:
            return self._error_response(str(e), status=403)
        except Exception as e:
            _logger.error(f"Error fetching order {order_id}: {e}")
            return self._error_response("Failed to fetch order", status=500)

    @api_route('/api/v1/orders/<int:order_id>', methods=['PUT'], auth=True, permissions=['pos.order.update'])
    def update_order(self, order_id, auth_info=None):
        """
        Update existing order
        
        PUT /api/v1/orders/123
        {
            "partner_id": 456,
            "lines": [...],
            "amount_total": 45.99
        }
        """
        try:
            order = request.env['pos.order'].search([
                ('id', '=', order_id),
                ('state', '=', 'draft')  # Only draft orders can be updated
            ], limit=1)
            
            if not order:
                return self._error_response("Order not found or cannot be updated", status=404)
            
            # Check access permissions
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Validate request data
            data = self._validate_json()
            
            # Update order fields
            update_vals = {}
            if 'partner_id' in data:
                partner_id = data['partner_id']
                if partner_id:
                    partner = request.env['res.partner'].browse(partner_id)
                    if not partner.exists():
                        raise ValidationError("Invalid partner")
                update_vals['partner_id'] = partner_id
            
            if 'fiscal_position_id' in data:
                update_vals['fiscal_position_id'] = data['fiscal_position_id']
            
            if update_vals:
                order.write(update_vals)
            
            # Update order lines if provided
            if 'lines' in data:
                # Remove existing lines
                order.lines.unlink()
                
                # Create new lines
                for line_data in data['lines']:
                    self._create_order_line(order, line_data)
                
                # Recalculate totals
                order._compute_amount_all()
            
            response_data = self._serialize_order(order, detailed=True)
            
            return self._json_response(response_data, message="Order updated successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error updating order {order_id}: {e}")
            return self._error_response("Failed to update order", status=500)

    @api_route('/api/v1/orders/<int:order_id>', methods=['DELETE'], auth=True, permissions=['pos.order.delete'])
    def delete_order(self, order_id, auth_info=None):
        """
        Delete/cancel order
        
        DELETE /api/v1/orders/123
        """
        try:
            order = request.env['pos.order'].search([
                ('id', '=', order_id)
            ], limit=1)
            
            if not order:
                return self._error_response("Order not found", status=404)
            
            # Check access permissions
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Check if order can be deleted
            if order.state not in ['draft', 'cancel']:
                return self._error_response("Cannot delete processed orders", status=400)
            
            order.unlink()
            
            return self._json_response(message="Order deleted successfully")
            
        except AccessDenied as e:
            return self._error_response(str(e), status=403)
        except Exception as e:
            _logger.error(f"Error deleting order {order_id}: {e}")
            return self._error_response("Failed to delete order", status=500)

    @api_route('/api/v1/orders/recent', methods=['GET'], auth=True, permissions=['pos.order.read'])
    def get_recent_orders(self, auth_info=None):
        """
        Get recent orders for the current user/session
        
        GET /api/v1/orders/recent?limit=20&session_id=123
        """
        try:
            limit = int(request.httprequest.args.get('limit', 20))
            session_id = request.httprequest.args.get('session_id')
            
            # Validate limits
            if limit > 100:
                limit = 100
            
            # Build domain
            domain = []
            
            # Filter by session if provided
            if session_id:
                session = request.env['pos.session'].browse(int(session_id))
                if not session.exists():
                    raise ValidationError("Invalid session")
                domain.append(('session_id', '=', int(session_id)))
            else:
                # Filter by user's sessions
                user_sessions = request.env['pos.session'].search([
                    ('user_id', '=', auth_info.get('user_id'))
                ])
                if user_sessions:
                    domain.append(('session_id', 'in', user_sessions.ids))
            
            # Get recent orders
            orders = request.env['pos.order'].search(
                domain,
                limit=limit,
                order='date_order desc'
            )
            
            # Serialize orders
            order_data = []
            for order in orders:
                order_data.append(self._serialize_order(order))
            
            return self._json_response({'orders': order_data})
            
        except Exception as e:
            _logger.error(f"Error fetching recent orders: {e}")
            return self._error_response("Failed to fetch recent orders", status=500)

    @api_route('/api/v1/orders/<int:order_id>/lines', methods=['POST'], auth=True, permissions=['pos.order.update'])
    def add_order_line(self, order_id, auth_info=None):
        """
        Add line to existing order
        
        POST /api/v1/orders/123/lines
        {
            "product_id": 789,
            "qty": 2,
            "price_unit": 15.99,
            "discount": 0
        }
        """
        try:
            order = request.env['pos.order'].search([
                ('id', '=', order_id),
                ('state', '=', 'draft')
            ], limit=1)
            
            if not order:
                return self._error_response("Order not found or cannot be modified", status=404)
            
            # Check access permissions
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Validate request data
            data = self._validate_json(['product_id', 'qty'])
            
            # Create order line
            line = self._create_order_line(order, data)
            
            # Recalculate order totals
            order._compute_amount_all()
            
            line_data = self._serialize_order_line(line)
            
            return self._json_response(line_data, message="Order line added successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error adding line to order {order_id}: {e}")
            return self._error_response("Failed to add order line", status=500)

    @api_route('/api/v1/orders/<int:order_id>/validate', methods=['POST'], auth=True, permissions=['pos.order.create'])
    def validate_order(self, order_id, auth_info=None):
        """
        Validate and process order (mark as paid)
        
        POST /api/v1/orders/123/validate
        {
            "payments": [
                {
                    "payment_method_id": 1,
                    "amount": 34.38
                }
            ]
        }
        """
        try:
            order = request.env['pos.order'].search([
                ('id', '=', order_id),
                ('state', '=', 'draft')
            ], limit=1)
            
            if not order:
                return self._error_response("Order not found or already processed", status=404)
            
            # Check access permissions
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Validate request data
            data = self._validate_json(['payments'])
            payments_data = data.get('payments', [])
            
            # Validate payments
            total_paid = 0
            for payment_data in payments_data:
                if 'payment_method_id' not in payment_data or 'amount' not in payment_data:
                    raise ValidationError("Each payment must have payment_method_id and amount")
                total_paid += payment_data['amount']
            
            # Check if payment amount matches order total
            if abs(total_paid - order.amount_total) > 0.01:  # Allow for minor rounding differences
                raise ValidationError(f"Payment amount ({total_paid}) does not match order total ({order.amount_total})")
            
            # Create payments
            for payment_data in payments_data:
                payment_method = request.env['pos.payment.method'].browse(payment_data['payment_method_id'])
                if not payment_method.exists():
                    raise ValidationError(f"Invalid payment method: {payment_data['payment_method_id']}")
                
                request.env['pos.payment'].create({
                    'pos_order_id': order.id,
                    'payment_method_id': payment_data['payment_method_id'],
                    'amount': payment_data['amount'],
                    'session_id': order.session_id.id,
                })
            
            # Mark order as paid
            order.write({
                'state': 'paid',
                'amount_paid': total_paid
            })
            
            # Process the order (create accounting entries, etc.)
            order.action_pos_order_paid()
            
            response_data = self._serialize_order(order, detailed=True)
            
            return self._json_response(response_data, message="Order validated successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error validating order {order_id}: {e}")
            return self._error_response("Failed to validate order", status=500)

    @api_route('/api/v1/orders/<int:order_id>/cancel', methods=['POST'], auth=True, permissions=['pos.order.update'])
    def cancel_order(self, order_id, auth_info=None):
        """
        Cancel order
        
        POST /api/v1/orders/123/cancel
        {
            "reason": "Customer cancelled"
        }
        """
        try:
            order = request.env['pos.order'].search([
                ('id', '=', order_id)
            ], limit=1)
            
            if not order:
                return self._error_response("Order not found", status=404)
            
            # Check access permissions
            if not self._can_access_order(order, auth_info):
                raise AccessDenied("Access denied to this order")
            
            # Check if order can be cancelled
            if order.state not in ['draft', 'paid']:
                return self._error_response("Cannot cancel processed orders", status=400)
            
            # Get cancellation reason
            data = self._validate_json()
            reason = data.get('reason', 'Cancelled via API')
            
            # Cancel order
            order.write({
                'state': 'cancel',
                'note': (order.note or '') + f'\nCancelled: {reason}'
            })
            
            response_data = self._serialize_order(order, detailed=True)
            
            return self._json_response(response_data, message="Order cancelled successfully")
            
        except (ValidationError, AccessDenied) as e:
            return self._error_response(str(e), status=400)
        except Exception as e:
            _logger.error(f"Error cancelling order {order_id}: {e}")
            return self._error_response("Failed to cancel order", status=500)

    def _create_order_line(self, order, line_data):
        """Create order line from data"""
        product_id = line_data.get('product_id')
        qty = line_data.get('qty', 1)
        price_unit = line_data.get('price_unit')
        discount = line_data.get('discount', 0)
        
        # Validate product
        product = request.env['product.product'].browse(product_id)
        if not product.exists() or not product.available_in_pos:
            raise ValidationError(f"Invalid or unavailable product: {product_id}")
        
        # Use product price if not provided
        if price_unit is None:
            price_unit = product.lst_price
        
        # Calculate taxes
        taxes = product.taxes_id.filtered(lambda t: t.company_id == order.company_id)
        
        line_vals = {
            'order_id': order.id,
            'product_id': product_id,
            'qty': qty,
            'price_unit': price_unit,
            'discount': discount,
            'tax_ids': [(6, 0, taxes.ids)],
            'name': product.display_name,
            'full_product_name': product.display_name,
        }
        
        return request.env['pos.order.line'].create(line_vals)

    def _serialize_order(self, order, detailed=False):
        """Serialize order for API response"""
        data = {
            'id': order.id,
            'name': order.name,
            'pos_reference': order.pos_reference,
            'date_order': order.date_order.isoformat() if order.date_order else None,
            'state': order.state,
            'partner_id': order.partner_id.id if order.partner_id else None,
            'partner_name': order.partner_id.name if order.partner_id else None,
            'session_id': order.session_id.id,
            'session_name': order.session_id.name,
            'amount_tax': float(order.amount_tax),
            'amount_total': float(order.amount_total),
            'amount_paid': float(order.amount_paid),
            'amount_return': float(order.amount_return),
            'line_count': len(order.lines),
        }
        
        if detailed:
            data.update({
                'lines': [self._serialize_order_line(line) for line in order.lines],
                'payments': [self._serialize_payment(payment) for payment in order.payment_ids],
                'config_id': order.config_id.id,
                'config_name': order.config_id.name,
                'company_id': order.company_id.id,
                'user_id': order.user_id.id,
                'user_name': order.user_id.name,
                'fiscal_position_id': order.fiscal_position_id.id if order.fiscal_position_id else None,
                'note': order.note or '',
                'create_date': order.create_date.isoformat() if order.create_date else None,
                'write_date': order.write_date.isoformat() if order.write_date else None,
            })
        
        return data

    def _serialize_order_line(self, line):
        """Serialize order line for API response"""
        return {
            'id': line.id,
            'product_id': line.product_id.id,
            'product_name': line.product_id.name,
            'product_code': line.product_id.default_code,
            'qty': float(line.qty),
            'price_unit': float(line.price_unit),
            'discount': float(line.discount),
            'price_subtotal': float(line.price_subtotal),
            'price_subtotal_incl': float(line.price_subtotal_incl),
            'tax_ids': [tax.id for tax in line.tax_ids],
            'full_product_name': line.full_product_name,
        }

    def _serialize_payment(self, payment):
        """Serialize payment for API response"""
        return {
            'id': payment.id,
            'payment_method_id': payment.payment_method_id.id,
            'payment_method_name': payment.payment_method_id.name,
            'amount': float(payment.amount),
            'session_id': payment.session_id.id,
        }

    def _can_access_order(self, order, auth_info):
        """Check if user can access the order"""
        user_id = auth_info.get('user_id')
        
        # Managers can access all orders
        user = request.env['res.users'].browse(user_id)
        if user.has_group('point_of_sale.group_pos_manager'):
            return True
        
        # Users can access their own orders
        if order.user_id.id == user_id:
            return True
        
        # Users can access orders from their sessions
        if order.session_id.user_id.id == user_id:
            return True
        
        return False

    def _generate_pos_reference(self, session):
        """Generate POS reference for order"""
        sequence = session.config_id.sequence_id
        if sequence:
            return sequence.next_by_id()
        else:
            # Fallback to simple numbering
            last_order = request.env['pos.order'].search([
                ('session_id', '=', session.id)
            ], order='id desc', limit=1)
            
            if last_order and last_order.pos_reference:
                try:
                    last_num = int(last_order.pos_reference.split('-')[-1])
                    return f"{session.name}-{last_num + 1:04d}"
                except:
                    pass
            
            return f"{session.name}-0001" 