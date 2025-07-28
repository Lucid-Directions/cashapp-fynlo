import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class CashDenomination(models.Model):
    """Cash denomination configuration"""
    _name = 'pos.cash.denomination'
    _description = 'Cash Denomination'
    _order = 'value desc'
    
    name = fields.Char('Name', required=True)
    value = fields.Float('Value', required=True, digits=(12, 2))
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    denomination_type = fields.Selection([
        ('bill', 'Bill'),
        ('coin', 'Coin')
    ], string='Type', required=True)
    
    active = fields.Boolean('Active', default=True)
    
    @api.model
    def get_default_denominations(self):
        """Get default USD denominations"""
        denominations = [
            {'name': '$100 Bill', 'value': 100.00, 'denomination_type': 'bill'},
            {'name': '$50 Bill', 'value': 50.00, 'denomination_type': 'bill'},
            {'name': '$20 Bill', 'value': 20.00, 'denomination_type': 'bill'},
            {'name': '$10 Bill', 'value': 10.00, 'denomination_type': 'bill'},
            {'name': '$5 Bill', 'value': 5.00, 'denomination_type': 'bill'},
            {'name': '$1 Bill', 'value': 1.00, 'denomination_type': 'bill'},
            {'name': '$1 Coin', 'value': 1.00, 'denomination_type': 'coin'},
            {'name': '50¢ Coin', 'value': 0.50, 'denomination_type': 'coin'},
            {'name': '25¢ Coin', 'value': 0.25, 'denomination_type': 'coin'},
            {'name': '10¢ Coin', 'value': 0.10, 'denomination_type': 'coin'},
            {'name': '5¢ Coin', 'value': 0.05, 'denomination_type': 'coin'},
            {'name': '1¢ Coin', 'value': 0.01, 'denomination_type': 'coin'},
        ]
        return denominations


class CashDrawerCount(models.Model):
    """Cash drawer count details"""
    _name = 'pos.cash.drawer.count'
    _description = 'Cash Drawer Count'
    
    session_id = fields.Many2one('pos.session', 'POS Session', required=True)
    denomination_id = fields.Many2one('pos.cash.denomination', 'Denomination', required=True)
    
    # Count details
    quantity = fields.Integer('Quantity', default=0)
    amount = fields.Float('Amount', compute='_compute_amount', store=True)
    
    # Count type
    count_type = fields.Selection([
        ('opening', 'Opening Count'),
        ('closing', 'Closing Count'),
        ('drop', 'Safe Drop'),
        ('pickup', 'Cash Pickup')
    ], string='Count Type', required=True)
    
    # Timestamps
    count_date = fields.Datetime('Count Date', default=fields.Datetime.now)
    user_id = fields.Many2one('res.users', 'Counted By', default=lambda self: self.env.user)
    
    @api.depends('denomination_id.value', 'quantity')
    def _compute_amount(self):
        for record in self:
            record.amount = record.denomination_id.value * record.quantity


class CashTransaction(models.Model):
    """Cash transaction tracking"""
    _name = 'pos.cash.transaction'
    _description = 'Cash Transaction'
    _order = 'create_date desc'
    
    session_id = fields.Many2one('pos.session', 'POS Session', required=True)
    
    # Transaction details
    transaction_type = fields.Selection([
        ('sale', 'Sale'),
        ('refund', 'Refund'),
        ('drop', 'Safe Drop'),
        ('pickup', 'Cash Pickup'),
        ('opening', 'Opening Balance'),
        ('closing', 'Closing Balance'),
        ('adjustment', 'Adjustment')
    ], string='Type', required=True)
    
    amount = fields.Monetary('Amount', currency_field='currency_id')
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    
    # References
    payment_id = fields.Many2one('pos.payment', 'Related Payment')
    order_id = fields.Many2one('pos.order', 'Related Order')
    
    # Details
    description = fields.Text('Description')
    reason = fields.Text('Reason')
    
    # User and timestamp
    user_id = fields.Many2one('res.users', 'User', default=lambda self: self.env.user)
    timestamp = fields.Datetime('Timestamp', default=fields.Datetime.now)
    
    # Denominations (JSON)
    denominations = fields.Text('Denominations JSON')
    
    def get_denominations_dict(self):
        """Get denominations as dictionary"""
        if self.denominations:
            import json
            return json.loads(self.denominations)
        return {}
    
    def set_denominations_dict(self, denominations_dict: Dict[str, int]):
        """Set denominations from dictionary"""
        import json
        self.denominations = json.dumps(denominations_dict)


class CashReconciliation(models.Model):
    """Cash reconciliation for POS sessions"""
    _name = 'pos.cash.reconciliation'
    _description = 'Cash Reconciliation'
    _order = 'create_date desc'
    
    session_id = fields.Many2one('pos.session', 'POS Session', required=True, ondelete='cascade')
    
    # Amounts
    opening_balance = fields.Monetary('Opening Balance', currency_field='currency_id')
    sales_total = fields.Monetary('Sales Total', currency_field='currency_id')
    refunds_total = fields.Monetary('Refunds Total', currency_field='currency_id')
    drops_total = fields.Monetary('Safe Drops Total', currency_field='currency_id')
    pickups_total = fields.Monetary('Cash Pickups Total', currency_field='currency_id')
    
    # Expected vs Actual
    expected_balance = fields.Monetary('Expected Balance', compute='_compute_expected_balance', store=True)
    actual_balance = fields.Monetary('Actual Balance', currency_field='currency_id')
    variance = fields.Monetary('Variance', compute='_compute_variance', store=True)
    
    # Status
    status = fields.Selection([
        ('draft', 'Draft'),
        ('reconciled', 'Reconciled'),
        ('variance', 'Has Variance')
    ], string='Status', default='draft')
    
    # Currency
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    
    # Timestamps
    reconciled_at = fields.Datetime('Reconciled At')
    reconciled_by = fields.Many2one('res.users', 'Reconciled By')
    
    # Denomination counts
    opening_count_ids = fields.One2many('pos.cash.drawer.count', 'session_id', 
                                       string='Opening Counts',
                                       domain=[('count_type', '=', 'opening')])
    closing_count_ids = fields.One2many('pos.cash.drawer.count', 'session_id', 
                                       string='Closing Counts',
                                       domain=[('count_type', '=', 'closing')])
    
    # Variance details
    variance_reason = fields.Text('Variance Reason')
    variance_approved = fields.Boolean('Variance Approved', default=False)
    variance_approved_by = fields.Many2one('res.users', 'Variance Approved By')
    
    @api.depends('opening_balance', 'sales_total', 'refunds_total', 'drops_total', 'pickups_total')
    def _compute_expected_balance(self):
        for record in self:
            record.expected_balance = (
                record.opening_balance + 
                record.sales_total - 
                record.refunds_total - 
                record.drops_total + 
                record.pickups_total
            )
    
    @api.depends('expected_balance', 'actual_balance')
    def _compute_variance(self):
        for record in self:
            record.variance = record.actual_balance - record.expected_balance
    
    @api.model
    def create_reconciliation(self, session_id: int) -> Dict[str, Any]:
        """Create cash reconciliation for session"""
        try:
            session = self.env['pos.session'].browse(session_id)
            if not session.exists():
                raise ValidationError("Invalid session")
            
            # Check if reconciliation already exists
            existing = self.search([('session_id', '=', session_id)], limit=1)
            if existing:
                return {
                    'success': False,
                    'error': 'Reconciliation already exists for this session'
                }
            
            # Calculate totals from cash transactions
            cash_transactions = self.env['pos.cash.transaction'].search([
                ('session_id', '=', session_id)
            ])
            
            opening_balance = sum(
                t.amount for t in cash_transactions 
                if t.transaction_type == 'opening'
            )
            
            sales_total = sum(
                t.amount for t in cash_transactions 
                if t.transaction_type == 'sale'
            )
            
            refunds_total = sum(
                t.amount for t in cash_transactions 
                if t.transaction_type == 'refund'
            )
            
            drops_total = sum(
                t.amount for t in cash_transactions 
                if t.transaction_type == 'drop'
            )
            
            pickups_total = sum(
                t.amount for t in cash_transactions 
                if t.transaction_type == 'pickup'
            )
            
            # Create reconciliation
            reconciliation = self.create({
                'session_id': session_id,
                'opening_balance': opening_balance,
                'sales_total': sales_total,
                'refunds_total': refunds_total,
                'drops_total': drops_total,
                'pickups_total': pickups_total
            })
            
            return {
                'success': True,
                'reconciliation_id': reconciliation.id,
                'expected_balance': reconciliation.expected_balance
            }
            
        except Exception as e:
            _logger.error(f"Cash reconciliation creation error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def finalize_reconciliation(self, actual_balance: float, denomination_counts: Dict[str, int]):
        """Finalize cash reconciliation"""
        try:
            self.write({
                'actual_balance': actual_balance,
                'reconciled_at': fields.Datetime.now(),
                'reconciled_by': self.env.user.id
            })
            
            # Create closing count records
            for denom_id, quantity in denomination_counts.items():
                if quantity > 0:
                    self.env['pos.cash.drawer.count'].create({
                        'session_id': self.session_id.id,
                        'denomination_id': int(denom_id),
                        'quantity': quantity,
                        'count_type': 'closing'
                    })
            
            # Determine status based on variance
            variance_threshold = 1.00  # $1.00 variance tolerance
            if abs(self.variance) <= variance_threshold:
                self.status = 'reconciled'
            else:
                self.status = 'variance'
                # Create variance alert/notification
                self._create_variance_alert()
            
            return {
                'success': True,
                'status': self.status,
                'variance': self.variance
            }
            
        except Exception as e:
            _logger.error(f"Cash reconciliation finalization error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _create_variance_alert(self):
        """Create variance alert for management"""
        try:
            # Create internal message/notification
            message = f"Cash variance detected in session {self.session_id.name}. " \
                     f"Variance: ${self.variance:.2f}"
            
            # Post message to session
            self.session_id.message_post(
                body=message,
                message_type='notification',
                subtype_xmlid='mail.mt_comment'
            )
            
            # Log the variance
            _logger.warning(f"Cash variance: Session {self.session_id.name}, Amount: ${self.variance:.2f}")
            
        except Exception as e:
            _logger.error(f"Error creating variance alert: {e}")
    
    def approve_variance(self, reason: str):
        """Approve cash variance"""
        try:
            self.write({
                'variance_reason': reason,
                'variance_approved': True,
                'variance_approved_by': self.env.user.id,
                'status': 'reconciled'
            })
            
            return {
                'success': True,
                'message': 'Variance approved'
            }
            
        except Exception as e:
            _logger.error(f"Variance approval error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _serialize_for_api(self):
        """Serialize for API response"""
        return {
            'id': self.id,
            'session_id': self.session_id.id,
            'session_name': self.session_id.name,
            'opening_balance': self.opening_balance,
            'sales_total': self.sales_total,
            'refunds_total': self.refunds_total,
            'drops_total': self.drops_total,
            'pickups_total': self.pickups_total,
            'expected_balance': self.expected_balance,
            'actual_balance': self.actual_balance,
            'variance': self.variance,
            'status': self.status,
            'reconciled_at': self.reconciled_at.isoformat() if self.reconciled_at else None,
            'reconciled_by': self.reconciled_by.name if self.reconciled_by else None,
            'variance_reason': self.variance_reason,
            'variance_approved': self.variance_approved
        }


class CashSafeDrop(models.Model):
    """Safe drop transactions"""
    _name = 'pos.cash.safe.drop'
    _description = 'Cash Safe Drop'
    _order = 'create_date desc'
    
    session_id = fields.Many2one('pos.session', 'POS Session', required=True)
    
    # Drop details
    amount = fields.Monetary('Amount', currency_field='currency_id', required=True)
    currency_id = fields.Many2one('res.currency', 'Currency', default=lambda self: self.env.company.currency_id)
    
    # Denominations
    denomination_details = fields.Text('Denomination Details (JSON)')
    
    # Authorization
    authorized_by = fields.Many2one('res.users', 'Authorized By', required=True)
    reason = fields.Text('Reason', required=True)
    
    # Timestamps
    drop_date = fields.Datetime('Drop Date', default=fields.Datetime.now)
    created_by = fields.Many2one('res.users', 'Created By', default=lambda self: self.env.user)
    
    # Status
    status = fields.Selection([
        ('pending', 'Pending'),
        ('confirmed', 'Confirmed'),
        ('canceled', 'Canceled')
    ], string='Status', default='pending')
    
    def confirm_drop(self):
        """Confirm safe drop"""
        try:
            # Create cash transaction
            self.env['pos.cash.transaction'].create({
                'session_id': self.session_id.id,
                'transaction_type': 'drop',
                'amount': -self.amount,  # Negative because it's leaving the drawer
                'description': f'Safe drop: {self.reason}',
                'denominations': self.denomination_details
            })
            
            self.status = 'confirmed'
            
            return {
                'success': True,
                'message': 'Safe drop confirmed'
            }
            
        except Exception as e:
            _logger.error(f"Safe drop confirmation error: {e}")
            return {
                'success': False,
                'error': str(e)
            } 