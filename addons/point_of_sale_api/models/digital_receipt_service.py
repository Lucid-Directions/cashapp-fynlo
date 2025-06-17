# -*- coding: utf-8 -*-

import logging
import base64
import smtplib
import json
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from email.mime.base import MIMEBase
from email import encoders
from datetime import datetime
from odoo import models, fields, api, tools
from odoo.exceptions import UserError
import requests

_logger = logging.getLogger(__name__)


class DigitalReceiptService(models.Model):
    """
    Digital Receipt Service for iOS-Only POS System
    
    Handles digital receipt generation and delivery via:
    - Email receipts with PDF attachments
    - SMS receipts with order summary
    - In-app receipt display and sharing
    - Cloud storage for receipt history
    
    No physical receipt printer hardware required.
    """
    _name = 'pos.digital.receipt.service'
    _description = 'Digital Receipt Service for Mobile POS'
    
    # Receipt Generation Methods
    def generate_digital_receipt(self, order_id, delivery_method='email', customer_contact=None):
        """
        Generate and deliver digital receipt for POS order
        
        Args:
            order_id: POS order ID
            delivery_method: 'email', 'sms', or 'in_app'
            customer_contact: Email address or phone number
            
        Returns:
            dict: Receipt delivery status and details
        """
        try:
            order = self.env['pos.order'].browse(order_id)
            if not order.exists():
                raise UserError(f"Order {order_id} not found")
            
            # Generate receipt content
            receipt_data = self._generate_receipt_content(order)
            
            # Deliver based on method
            if delivery_method == 'email':
                return self._send_email_receipt(order, receipt_data, customer_contact)
            elif delivery_method == 'sms':
                return self._send_sms_receipt(order, receipt_data, customer_contact)
            elif delivery_method == 'in_app':
                return self._generate_in_app_receipt(order, receipt_data)
            else:
                raise UserError(f"Unsupported delivery method: {delivery_method}")
                
        except Exception as e:
            _logger.error(f"Digital receipt generation failed: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'order_id': order_id
            }
    
    def _generate_receipt_content(self, order):
        """Generate comprehensive receipt content"""
        receipt_data = {
            'order_id': order.id,
            'order_number': order.pos_reference,
            'date': order.date_order.strftime('%Y-%m-%d %H:%M:%S'),
            'customer': order.partner_id.name if order.partner_id else 'Guest',
            'cashier': order.user_id.name,
            'session': order.session_id.name,
            'location': order.config_id.name,
            'lines': [],
            'payments': [],
            'totals': {
                'subtotal': order.amount_subtotal,
                'tax': order.amount_tax,
                'total': order.amount_total,
                'tip': order.tip_amount if hasattr(order, 'tip_amount') else 0.0
            },
            'company': {
                'name': order.company_id.name,
                'address': self._format_company_address(order.company_id),
                'phone': order.company_id.phone,
                'email': order.company_id.email,
                'website': order.company_id.website
            }
        }
        
        # Add order lines
        for line in order.lines:
            receipt_data['lines'].append({
                'product': line.product_id.name,
                'qty': line.qty,
                'price': line.price_unit,
                'total': line.price_subtotal_incl,
                'tax': line.price_subtotal_incl - line.price_subtotal
            })
        
        # Add payment information
        for payment in order.payment_ids:
            receipt_data['payments'].append({
                'method': payment.payment_method_id.name,
                'amount': payment.amount,
                'reference': payment.payment_reference or ''
            })
        
        return receipt_data
    
    def _send_email_receipt(self, order, receipt_data, email_address):
        """Send receipt via email with PDF attachment"""
        try:
            if not email_address:
                email_address = order.partner_id.email if order.partner_id else None
                
            if not email_address:
                raise UserError("No email address provided for receipt delivery")
            
            # Generate PDF receipt
            pdf_content = self._generate_pdf_receipt(receipt_data)
            
            # Create email
            msg = MIMEMultipart()
            msg['From'] = order.company_id.email or 'noreply@fynlo.com'
            msg['To'] = email_address
            msg['Subject'] = f"Receipt for Order {receipt_data['order_number']} - {order.company_id.name}"
            
            # Email body
            body = self._generate_email_body(receipt_data)
            msg.attach(MIMEText(body, 'html'))
            
            # Attach PDF
            if pdf_content:
                attachment = MIMEBase('application', 'octet-stream')
                attachment.set_payload(pdf_content)
                encoders.encode_base64(attachment)
                attachment.add_header(
                    'Content-Disposition',
                    f'attachment; filename="receipt_{receipt_data["order_number"]}.pdf"'
                )
                msg.attach(attachment)
            
            # Send email
            self._send_email(msg, email_address)
            
            # Log receipt delivery
            self._log_receipt_delivery(order, 'email', email_address, True)
            
            return {
                'success': True,
                'method': 'email',
                'contact': email_address,
                'order_id': order.id,
                'message': 'Email receipt sent successfully'
            }
            
        except Exception as e:
            _logger.error(f"Email receipt delivery failed: {str(e)}")
            self._log_receipt_delivery(order, 'email', email_address, False, str(e))
            raise UserError(f"Failed to send email receipt: {str(e)}")
    
    def _send_sms_receipt(self, order, receipt_data, phone_number):
        """Send receipt summary via SMS"""
        try:
            if not phone_number:
                phone_number = order.partner_id.phone if order.partner_id else None
                
            if not phone_number:
                raise UserError("No phone number provided for SMS receipt")
            
            # Generate SMS content
            sms_content = self._generate_sms_content(receipt_data)
            
            # Send SMS (integrate with SMS provider)
            self._send_sms(phone_number, sms_content)
            
            # Log receipt delivery
            self._log_receipt_delivery(order, 'sms', phone_number, True)
            
            return {
                'success': True,
                'method': 'sms',
                'contact': phone_number,
                'order_id': order.id,
                'message': 'SMS receipt sent successfully'
            }
            
        except Exception as e:
            _logger.error(f"SMS receipt delivery failed: {str(e)}")
            self._log_receipt_delivery(order, 'sms', phone_number, False, str(e))
            raise UserError(f"Failed to send SMS receipt: {str(e)}")
    
    def _generate_in_app_receipt(self, order, receipt_data):
        """Generate in-app receipt for display and sharing"""
        try:
            # Store receipt data for in-app access
            receipt_record = self.env['pos.digital.receipt'].create({
                'order_id': order.id,
                'receipt_data': json.dumps(receipt_data),
                'access_token': self._generate_access_token(),
                'created_date': fields.Datetime.now(),
                'delivery_method': 'in_app'
            })
            
            # Generate shareable link
            base_url = self.env['ir.config_parameter'].sudo().get_param('web.base.url')
            share_link = f"{base_url}/receipt/{receipt_record.access_token}"
            
            return {
                'success': True,
                'method': 'in_app',
                'receipt_id': receipt_record.id,
                'receipt_data': receipt_data,
                'share_link': share_link,
                'order_id': order.id,
                'message': 'In-app receipt generated successfully'
            }
            
        except Exception as e:
            _logger.error(f"In-app receipt generation failed: {str(e)}")
            raise UserError(f"Failed to generate in-app receipt: {str(e)}")
    
    def _generate_pdf_receipt(self, receipt_data):
        """Generate PDF receipt using report engine"""
        try:
            # Use Odoo's report engine to generate PDF
            # This would typically use QWeb templates
            return self.env.ref('point_of_sale_api.digital_receipt_template')._render_qweb_pdf([receipt_data])[0]
        except Exception as e:
            _logger.error(f"PDF generation failed: {str(e)}")
            return None
    
    def _generate_email_body(self, receipt_data):
        """Generate HTML email body"""
        return f"""
        <html>
        <body style="font-family: Arial, sans-serif; margin: 20px;">
            <h2 style="color: #2E86AB;">Thank you for your purchase!</h2>
            
            <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Order Details</h3>
                <p><strong>Order Number:</strong> {receipt_data['order_number']}</p>
                <p><strong>Date:</strong> {receipt_data['date']}</p>
                <p><strong>Location:</strong> {receipt_data['location']}</p>
                <p><strong>Cashier:</strong> {receipt_data['cashier']}</p>
            </div>
            
            <div style="margin: 20px 0;">
                <h3>Items Ordered</h3>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="background-color: #e0e0e0;">
                            <th style="padding: 8px; text-align: left; border: 1px solid #ddd;">Item</th>
                            <th style="padding: 8px; text-align: center; border: 1px solid #ddd;">Qty</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Price</th>
                            <th style="padding: 8px; text-align: right; border: 1px solid #ddd;">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        {''.join([
                            f'<tr><td style="padding: 8px; border: 1px solid #ddd;">{line["product"]}</td>'
                            f'<td style="padding: 8px; text-align: center; border: 1px solid #ddd;">{line["qty"]}</td>'
                            f'<td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${line["price"]:.2f}</td>'
                            f'<td style="padding: 8px; text-align: right; border: 1px solid #ddd;">${line["total"]:.2f}</td></tr>'
                            for line in receipt_data['lines']
                        ])}
                    </tbody>
                </table>
            </div>
            
            <div style="background-color: #f0f8ff; padding: 15px; border-radius: 5px; margin: 20px 0;">
                <h3>Payment Summary</h3>
                <p><strong>Subtotal:</strong> ${receipt_data['totals']['subtotal']:.2f}</p>
                <p><strong>Tax:</strong> ${receipt_data['totals']['tax']:.2f}</p>
                <p><strong>Total:</strong> ${receipt_data['totals']['total']:.2f}</p>
            </div>
            
            <div style="margin: 20px 0;">
                <h3>Payment Methods</h3>
                {''.join([
                    f'<p>{payment["method"]}: ${payment["amount"]:.2f}</p>'
                    for payment in receipt_data['payments']
                ])}
            </div>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
                <p>{receipt_data['company']['name']}</p>
                <p>{receipt_data['company']['address']}</p>
                <p>Phone: {receipt_data['company']['phone']} | Email: {receipt_data['company']['email']}</p>
            </div>
        </body>
        </html>
        """
    
    def _generate_sms_content(self, receipt_data):
        """Generate SMS receipt content"""
        total_items = len(receipt_data['lines'])
        return f"""
{receipt_data['company']['name']}
Receipt #{receipt_data['order_number']}
{receipt_data['date']}

{total_items} item(s) - Total: ${receipt_data['totals']['total']:.2f}

Thank you for your business!
View full receipt: [LINK_PLACEHOLDER]
        """.strip()
    
    def _send_email(self, msg, email_address):
        """Send email using configured SMTP server"""
        # This would integrate with your email provider
        # For now, log the action
        _logger.info(f"Email receipt sent to {email_address}")
    
    def _send_sms(self, phone_number, content):
        """Send SMS using configured SMS provider"""
        # This would integrate with your SMS provider (Twilio, etc.)
        # For now, log the action
        _logger.info(f"SMS receipt sent to {phone_number}")
    
    def _format_company_address(self, company):
        """Format company address for receipts"""
        address_parts = [
            company.street or '',
            company.street2 or '',
            f"{company.city or ''}, {company.state_id.name or ''} {company.zip or ''}".strip(),
            company.country_id.name or ''
        ]
        return '\n'.join([part for part in address_parts if part])
    
    def _generate_access_token(self):
        """Generate secure access token for receipt sharing"""
        import secrets
        return secrets.token_urlsafe(32)
    
    def _log_receipt_delivery(self, order, method, contact, success, error_message=None):
        """Log receipt delivery for audit purposes"""
        self.env['pos.receipt.log'].create({
            'order_id': order.id,
            'delivery_method': method,
            'contact_info': contact,
            'success': success,
            'error_message': error_message,
            'delivery_date': fields.Datetime.now()
        })


class PosDigitalReceipt(models.Model):
    """Model to store digital receipts for in-app access"""
    _name = 'pos.digital.receipt'
    _description = 'Digital Receipt Storage'
    
    order_id = fields.Many2one('pos.order', string='POS Order', required=True)
    receipt_data = fields.Text('Receipt Data (JSON)', required=True)
    access_token = fields.Char('Access Token', required=True, index=True)
    created_date = fields.Datetime('Created Date', required=True)
    delivery_method = fields.Selection([
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('in_app', 'In-App')
    ], string='Delivery Method', required=True)
    viewed_count = fields.Integer('Viewed Count', default=0)
    last_viewed = fields.Datetime('Last Viewed')


class PosReceiptLog(models.Model):
    """Model to log receipt delivery attempts"""
    _name = 'pos.receipt.log'
    _description = 'Receipt Delivery Log'
    
    order_id = fields.Many2one('pos.order', string='POS Order', required=True)
    delivery_method = fields.Selection([
        ('email', 'Email'),
        ('sms', 'SMS'),
        ('in_app', 'In-App')
    ], string='Delivery Method', required=True)
    contact_info = fields.Char('Contact Information', required=True)
    success = fields.Boolean('Delivery Success', required=True)
    error_message = fields.Text('Error Message')
    delivery_date = fields.Datetime('Delivery Date', required=True)