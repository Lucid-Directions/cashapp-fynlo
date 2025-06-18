import json
import logging
from datetime import datetime

from odoo import http
from odoo.http import request
from odoo.exceptions import ValidationError
from odoo.addons.point_of_sale_api.controllers.base import POSAPIController

_logger = logging.getLogger(__name__)


class WebhooksController(POSAPIController):
    """Payment gateway webhook endpoints"""

    @http.route('/api/v1/webhooks/stripe', methods=['POST'], auth='none', csrf=False, cors='*')
    def stripe_webhook(self):
        """Handle Stripe webhooks"""
        try:
            # Get raw payload and signature
            payload = request.httprequest.get_data(as_text=True)
            signature = request.httprequest.headers.get('Stripe-Signature')
            
            if not signature:
                return self._error_response("Missing Stripe signature", status=400)
            
            # Get gateway and process webhook
            gateway_config = request.env['pos.payment.gateway.config']
            gateway = gateway_config.get_gateway_instance('stripe')
            
            result = gateway.process_webhook(payload, signature)
            
            if not result.get('success'):
                return self._error_response(result.get('error'), status=400)
            
            # Process the webhook event
            event_type = result.get('event_type')
            event_data = result.get('data', {})
            
            self._process_stripe_event(event_type, event_data)
            
            return self._json_response({'received': True})
            
        except Exception as e:
            _logger.error(f"Stripe webhook error: {e}")
            return self._error_response("Webhook processing failed", status=500)

    @http.route('/api/v1/webhooks/square', methods=['POST'], auth='none', csrf=False, cors='*')
    def square_webhook(self):
        """Handle Square webhooks"""
        try:
            # Get raw payload and signature
            payload = request.httprequest.get_data(as_text=True)
            signature = request.httprequest.headers.get('X-Square-Signature')
            
            if not signature:
                return self._error_response("Missing Square signature", status=400)
            
            # Get gateway and process webhook
            gateway_config = request.env['pos.payment.gateway.config']
            gateway = gateway_config.get_gateway_instance('square')
            
            result = gateway.process_webhook(payload, signature)
            
            if not result.get('success'):
                return self._error_response(result.get('error'), status=400)
            
            # Process the webhook event
            event_type = result.get('event_type')
            event_data = result.get('data', {})
            
            self._process_square_event(event_type, event_data)
            
            return self._json_response({'received': True})
            
        except Exception as e:
            _logger.error(f"Square webhook error: {e}")
            return self._error_response("Webhook processing failed", status=500)

    def _process_stripe_event(self, event_type: str, event_data: dict):
        """Process Stripe webhook events"""
        try:
            if event_type == 'payment_intent.succeeded':
                self._handle_payment_success(event_data.get('object', {}), 'stripe')
            elif event_type == 'payment_intent.payment_failed':
                self._handle_payment_failure(event_data.get('object', {}), 'stripe')
            elif event_type == 'charge.dispute.created':
                self._handle_dispute_created(event_data.get('object', {}), 'stripe')
            elif event_type == 'refund.created':
                self._handle_refund_created(event_data.get('object', {}), 'stripe')
            else:
                _logger.info(f"Unhandled Stripe event type: {event_type}")
                
        except Exception as e:
            _logger.error(f"Error processing Stripe event {event_type}: {e}")

    def _process_square_event(self, event_type: str, event_data: dict):
        """Process Square webhook events"""
        try:
            if event_type == 'payment.updated':
                payment_data = event_data.get('object', {}).get('payment', {})
                if payment_data.get('status') == 'COMPLETED':
                    self._handle_payment_success(payment_data, 'square')
                elif payment_data.get('status') == 'FAILED':
                    self._handle_payment_failure(payment_data, 'square')
            elif event_type == 'refund.updated':
                refund_data = event_data.get('object', {}).get('refund', {})
                if refund_data.get('status') == 'COMPLETED':
                    self._handle_refund_created(refund_data, 'square')
            else:
                _logger.info(f"Unhandled Square event type: {event_type}")
                
        except Exception as e:
            _logger.error(f"Error processing Square event {event_type}: {e}")

    def _handle_payment_success(self, payment_data: dict, provider: str):
        """Handle successful payment webhook"""
        try:
            transaction_id = payment_data.get('id')
            if not transaction_id:
                return
            
            # Find the payment transaction
            transaction = request.env['pos.payment.gateway.transaction'].sudo().search([
                ('transaction_id', '=', transaction_id)
            ], limit=1)
            
            if transaction:
                transaction.write({
                    'status': 'success',
                    'processed_at': datetime.now(),
                    'gateway_response': json.dumps(payment_data)
                })
                
                # Update POS payment status
                if transaction.payment_id:
                    transaction.payment_id.write({'payment_status': 'done'})
                
                _logger.info(f"Payment {transaction_id} marked as successful via webhook")
            
        except Exception as e:
            _logger.error(f"Error handling payment success webhook: {e}")

    def _handle_payment_failure(self, payment_data: dict, provider: str):
        """Handle failed payment webhook"""
        try:
            transaction_id = payment_data.get('id')
            if not transaction_id:
                return
            
            # Find the payment transaction
            transaction = request.env['pos.payment.gateway.transaction'].sudo().search([
                ('transaction_id', '=', transaction_id)
            ], limit=1)
            
            if transaction:
                error_message = payment_data.get('last_payment_error', {}).get('message', 'Payment failed')
                
                transaction.write({
                    'status': 'failed',
                    'processed_at': datetime.now(),
                    'error_message': error_message,
                    'gateway_response': json.dumps(payment_data)
                })
                
                # Update POS payment status
                if transaction.payment_id:
                    transaction.payment_id.write({'payment_status': 'failed'})
                
                _logger.info(f"Payment {transaction_id} marked as failed via webhook")
            
        except Exception as e:
            _logger.error(f"Error handling payment failure webhook: {e}")

    def _handle_dispute_created(self, dispute_data: dict, provider: str):
        """Handle payment dispute webhook"""
        try:
            charge_id = dispute_data.get('charge')
            if not charge_id:
                return
            
            # Find the payment transaction
            transaction = request.env['pos.payment.gateway.transaction'].sudo().search([
                ('transaction_id', '=', charge_id)
            ], limit=1)
            
            if transaction and transaction.payment_id:
                # Create a note or notification about the dispute
                message = f"Payment dispute created for transaction {charge_id}. " \
                         f"Reason: {dispute_data.get('reason', 'Unknown')}"
                
                transaction.payment_id.message_post(
                    body=message,
                    message_type='notification'
                )
                
                _logger.warning(f"Dispute created for payment {charge_id}: {dispute_data.get('reason')}")
            
        except Exception as e:
            _logger.error(f"Error handling dispute webhook: {e}")

    def _handle_refund_created(self, refund_data: dict, provider: str):
        """Handle refund created webhook"""
        try:
            if provider == 'stripe':
                transaction_id = refund_data.get('payment_intent')
                refund_id = refund_data.get('id')
                amount = refund_data.get('amount', 0) / 100  # Convert from cents
            else:  # square
                transaction_id = refund_data.get('payment_id')
                refund_id = refund_data.get('id')
                amount = refund_data.get('amount_money', {}).get('amount', 0) / 100
            
            if not transaction_id:
                return
            
            # Find the original payment transaction
            transaction = request.env['pos.payment.gateway.transaction'].sudo().search([
                ('transaction_id', '=', transaction_id)
            ], limit=1)
            
            if transaction and transaction.payment_id:
                # Create refund transaction record
                request.env['pos.payment.gateway.transaction'].sudo().create({
                    'payment_id': transaction.payment_id.id,
                    'gateway_config_id': transaction.gateway_config_id.id,
                    'transaction_id': refund_id,
                    'transaction_type': 'refund',
                    'amount': amount,
                    'status': 'success',
                    'processed_at': datetime.now(),
                    'gateway_response': json.dumps(refund_data)
                })
                
                _logger.info(f"Refund {refund_id} processed for payment {transaction_id}")
            
        except Exception as e:
            _logger.error(f"Error handling refund webhook: {e}") 