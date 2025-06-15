import logging
from datetime import datetime, timedelta
from typing import Dict, List, Any

from odoo import models, fields, api
from odoo.exceptions import ValidationError, UserError

_logger = logging.getLogger(__name__)


class TipConfiguration(models.Model):
    """Tip configuration and suggestions"""
    _name = 'pos.tip.configuration'
    _description = 'Tip Configuration'
    
    name = fields.Char('Configuration Name', required=True)
    
    # Tip suggestions
    tip_percentages = fields.Char('Tip Percentages', default='15,18,20,25',
                                 help='Comma-separated tip percentages')
    custom_tip_enabled = fields.Boolean('Allow Custom Tip', default=True)
    
    # Pre/Post authorization
    tip_timing = fields.Selection([
        ('pre_auth', 'Pre-Authorization'),
        ('post_auth', 'Post-Authorization')
    ], string='Tip Timing', default='pre_auth')
    
    # Minimum/Maximum limits
    min_tip_amount = fields.Monetary('Minimum Tip Amount', currency_field='currency_id', default=0.0)
    max_tip_amount = fields.Monetary('Maximum Tip Amount', currency_field='currency_id', default=1000.0)
    max_tip_percentage = fields.Float('Maximum Tip Percentage', default=50.0)
    
    # Display settings
    show_no_tip_option = fields.Boolean('Show No Tip Option', default=True)
    tip_prompt_message = fields.Text('Tip Prompt Message', 
                                    default='Would you like to add a tip?')
    
    # Active configuration
    active = fields.Boolean('Active', default=True)
    is_default = fields.Boolean('Default Configuration', default=False)
    
    # Currency
    currency_id = fields.Many2one('res.currency', 'Currency', 
                                 default=lambda self: self.env.company.currency_id)
    
    @api.model
    def get_default_config(self):
        """Get default tip configuration"""
        config = self.search([('is_default', '=', True), ('active', '=', True)], limit=1)
        if not config:
            config = self.search([('active', '=', True)], limit=1)
        return config
    
    def get_tip_percentages_list(self):
        """Get tip percentages as list"""
        if self.tip_percentages:
            return [float(p.strip()) for p in self.tip_percentages.split(',')]
        return [15.0, 18.0, 20.0, 25.0]
    
    def calculate_tip_suggestions(self, order_amount: float):
        """Calculate tip suggestions for an order"""
        suggestions = []
        percentages = self.get_tip_percentages_list()
        
        for percentage in percentages:
            tip_amount = (order_amount * percentage) / 100
            tip_amount = round(tip_amount, 2)
            
            # Check limits
            if self.min_tip_amount <= tip_amount <= self.max_tip_amount:
                suggestions.append({
                    'percentage': percentage,
                    'amount': tip_amount,
                    'total': order_amount + tip_amount
                })
        
        return suggestions


class TipTransaction(models.Model):
    """Individual tip transactions"""
    _name = 'pos.tip.transaction'
    _description = 'Tip Transaction'
    _order = 'create_date desc'
    
    # Order and payment references
    order_id = fields.Many2one('pos.order', 'POS Order', required=True, ondelete='cascade')
    payment_id = fields.Many2one('pos.payment', 'Payment', required=True, ondelete='cascade')
    
    # Tip details
    tip_amount = fields.Monetary('Tip Amount', currency_field='currency_id', required=True)
    tip_percentage = fields.Float('Tip Percentage', compute='_compute_tip_percentage', store=True)
    tip_type = fields.Selection([
        ('percentage', 'Percentage'),
        ('custom', 'Custom Amount'),
        ('adjustment', 'Adjustment')
    ], string='Tip Type', required=True)
    
    # Order amount for percentage calculation
    order_amount = fields.Monetary('Order Amount', currency_field='currency_id')
    
    # Currency
    currency_id = fields.Many2one('res.currency', 'Currency', 
                                 default=lambda self: self.env.company.currency_id)
    
    # Processing details
    processed_at = fields.Datetime('Processed At', default=fields.Datetime.now)
    processed_by = fields.Many2one('res.users', 'Processed By', default=lambda self: self.env.user)
    
    # Status
    status = fields.Selection([
        ('pending', 'Pending'),
        ('processed', 'Processed'),
        ('adjusted', 'Adjusted'),
        ('voided', 'Voided')
    ], string='Status', default='pending')
    
    # Staff assignment (for tip pooling)
    assigned_staff_ids = fields.Many2many('hr.employee', string='Assigned Staff')
    
    # Adjustment details
    original_amount = fields.Monetary('Original Amount', currency_field='currency_id')
    adjustment_reason = fields.Text('Adjustment Reason')
    adjusted_by = fields.Many2one('res.users', 'Adjusted By')
    adjusted_at = fields.Datetime('Adjusted At')
    
    @api.depends('tip_amount', 'order_amount')
    def _compute_tip_percentage(self):
        for record in self:
            if record.order_amount and record.order_amount > 0:
                record.tip_percentage = (record.tip_amount / record.order_amount) * 100
            else:
                record.tip_percentage = 0.0
    
    @api.model
    def create_tip(self, order_id: int, payment_id: int, tip_amount: float, 
                   tip_type: str = 'percentage') -> Dict[str, Any]:
        """Create a tip transaction"""
        try:
            order = self.env['pos.order'].browse(order_id)
            payment = self.env['pos.payment'].browse(payment_id)
            
            if not order.exists() or not payment.exists():
                raise ValidationError("Invalid order or payment")
            
            # Validate tip amount
            config = self.env['pos.tip.configuration'].get_default_config()
            if config:
                if tip_amount < config.min_tip_amount:
                    raise ValidationError(f"Tip amount below minimum: ${config.min_tip_amount}")
                if tip_amount > config.max_tip_amount:
                    raise ValidationError(f"Tip amount exceeds maximum: ${config.max_tip_amount}")
            
            # Create tip transaction
            tip_transaction = self.create({
                'order_id': order_id,
                'payment_id': payment_id,
                'tip_amount': tip_amount,
                'tip_type': tip_type,
                'order_amount': order.amount_total,
                'status': 'processed'
            })
            
            # Update payment amount if pre-authorization tip
            if config and config.tip_timing == 'pre_auth':
                payment.write({
                    'amount': payment.amount + tip_amount
                })
            
            # Auto-assign to current session staff if tip pooling is enabled
            self._auto_assign_staff(tip_transaction)
            
            return {
                'success': True,
                'tip_transaction_id': tip_transaction.id,
                'tip_amount': tip_amount,
                'total_amount': payment.amount
            }
            
        except Exception as e:
            _logger.error(f"Tip creation error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def adjust_tip(self, new_amount: float, reason: str):
        """Adjust tip amount"""
        try:
            if self.status != 'processed':
                raise ValidationError("Can only adjust processed tips")
            
            self.write({
                'original_amount': self.tip_amount,
                'tip_amount': new_amount,
                'adjustment_reason': reason,
                'adjusted_by': self.env.user.id,
                'adjusted_at': fields.Datetime.now(),
                'status': 'adjusted'
            })
            
            # Update payment amount
            amount_difference = new_amount - self.original_amount
            self.payment_id.write({
                'amount': self.payment_id.amount + amount_difference
            })
            
            return {
                'success': True,
                'new_amount': new_amount,
                'adjustment': amount_difference
            }
            
        except Exception as e:
            _logger.error(f"Tip adjustment error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def void_tip(self, reason: str):
        """Void tip transaction"""
        try:
            if self.status == 'voided':
                raise ValidationError("Tip is already voided")
            
            # Update payment amount
            self.payment_id.write({
                'amount': self.payment_id.amount - self.tip_amount
            })
            
            self.write({
                'status': 'voided',
                'adjustment_reason': reason,
                'adjusted_by': self.env.user.id,
                'adjusted_at': fields.Datetime.now()
            })
            
            return {
                'success': True,
                'message': 'Tip voided successfully'
            }
            
        except Exception as e:
            _logger.error(f"Tip void error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def _auto_assign_staff(self, tip_transaction):
        """Auto-assign staff for tip pooling"""
        try:
            # Get current session staff
            session = tip_transaction.order_id.session_id
            if session and session.user_id:
                # Find employee record for user
                employee = self.env['hr.employee'].search([
                    ('user_id', '=', session.user_id.id)
                ], limit=1)
                
                if employee:
                    tip_transaction.write({
                        'assigned_staff_ids': [(6, 0, [employee.id])]
                    })
                    
        except Exception as e:
            _logger.error(f"Auto staff assignment error: {e}")
    
    def _serialize_for_api(self):
        """Serialize for API response"""
        return {
            'id': self.id,
            'order_id': self.order_id.id,
            'payment_id': self.payment_id.id,
            'tip_amount': self.tip_amount,
            'tip_percentage': self.tip_percentage,
            'tip_type': self.tip_type,
            'order_amount': self.order_amount,
            'status': self.status,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'processed_by': self.processed_by.name if self.processed_by else None,
            'assigned_staff': [{'id': emp.id, 'name': emp.name} for emp in self.assigned_staff_ids],
            'adjustment_reason': self.adjustment_reason
        }


class TipPool(models.Model):
    """Tip pooling configuration and distribution"""
    _name = 'pos.tip.pool'
    _description = 'Tip Pool'
    
    name = fields.Char('Pool Name', required=True)
    session_id = fields.Many2one('pos.session', 'POS Session', required=True)
    
    # Pool participants
    staff_ids = fields.Many2many('hr.employee', string='Staff Members')
    
    # Distribution method
    distribution_method = fields.Selection([
        ('equal', 'Equal Distribution'),
        ('hours_worked', 'By Hours Worked'),
        ('sales_percentage', 'By Sales Percentage'),
        ('custom', 'Custom Weights')
    ], string='Distribution Method', default='equal')
    
    # Totals
    total_tips = fields.Monetary('Total Tips', currency_field='currency_id', 
                                compute='_compute_totals', store=True)
    total_transactions = fields.Integer('Total Transactions', 
                                      compute='_compute_totals', store=True)
    
    # Status
    status = fields.Selection([
        ('active', 'Active'),
        ('closed', 'Closed'),
        ('distributed', 'Distributed')
    ], string='Status', default='active')
    
    # Currency
    currency_id = fields.Many2one('res.currency', 'Currency', 
                                 default=lambda self: self.env.company.currency_id)
    
    # Distribution records
    distribution_ids = fields.One2many('pos.tip.distribution', 'pool_id', 
                                      string='Distributions')
    
    # Timestamps
    closed_at = fields.Datetime('Closed At')
    distributed_at = fields.Datetime('Distributed At')
    
    @api.depends('session_id')
    def _compute_totals(self):
        for record in self:
            tips = self.env['pos.tip.transaction'].search([
                ('order_id.session_id', '=', record.session_id.id),
                ('status', '=', 'processed')
            ])
            
            record.total_tips = sum(tips.mapped('tip_amount'))
            record.total_transactions = len(tips)
    
    def close_pool(self):
        """Close the tip pool for distribution"""
        try:
            if self.status != 'active':
                raise ValidationError("Pool is not active")
            
            self.write({
                'status': 'closed',
                'closed_at': fields.Datetime.now()
            })
            
            return {
                'success': True,
                'total_tips': self.total_tips,
                'staff_count': len(self.staff_ids)
            }
            
        except Exception as e:
            _logger.error(f"Tip pool close error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def distribute_tips(self, distribution_data: List[Dict]):
        """Distribute tips to staff members"""
        try:
            if self.status != 'closed':
                raise ValidationError("Pool must be closed before distribution")
            
            # Create distribution records
            for dist in distribution_data:
                self.env['pos.tip.distribution'].create({
                    'pool_id': self.id,
                    'employee_id': dist['employee_id'],
                    'tip_amount': dist['amount'],
                    'percentage': dist.get('percentage', 0),
                    'hours_worked': dist.get('hours_worked', 0),
                    'sales_amount': dist.get('sales_amount', 0)
                })
            
            self.write({
                'status': 'distributed',
                'distributed_at': fields.Datetime.now()
            })
            
            return {
                'success': True,
                'message': 'Tips distributed successfully'
            }
            
        except Exception as e:
            _logger.error(f"Tip distribution error: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def calculate_equal_distribution(self):
        """Calculate equal distribution among staff"""
        if not self.staff_ids:
            return []
        
        amount_per_person = self.total_tips / len(self.staff_ids)
        percentage_per_person = 100.0 / len(self.staff_ids)
        
        return [
            {
                'employee_id': emp.id,
                'employee_name': emp.name,
                'amount': round(amount_per_person, 2),
                'percentage': round(percentage_per_person, 2)
            }
            for emp in self.staff_ids
        ]


class TipDistribution(models.Model):
    """Individual tip distribution records"""
    _name = 'pos.tip.distribution'
    _description = 'Tip Distribution'
    
    pool_id = fields.Many2one('pos.tip.pool', 'Tip Pool', required=True, ondelete='cascade')
    employee_id = fields.Many2one('hr.employee', 'Employee', required=True)
    
    # Distribution details
    tip_amount = fields.Monetary('Tip Amount', currency_field='currency_id', required=True)
    percentage = fields.Float('Percentage', digits=(5, 2))
    
    # Calculation basis
    hours_worked = fields.Float('Hours Worked')
    sales_amount = fields.Monetary('Sales Amount', currency_field='currency_id')
    
    # Currency
    currency_id = fields.Many2one('res.currency', 'Currency', 
                                 default=lambda self: self.env.company.currency_id)
    
    # Status
    paid_out = fields.Boolean('Paid Out', default=False)
    paid_out_at = fields.Datetime('Paid Out At')
    paid_out_by = fields.Many2one('res.users', 'Paid Out By')
    
    def mark_paid(self):
        """Mark distribution as paid out"""
        self.write({
            'paid_out': True,
            'paid_out_at': fields.Datetime.now(),
            'paid_out_by': self.env.user.id
        })


class TipReport(models.Model):
    """Tip reporting and analytics"""
    _name = 'pos.tip.report'
    _description = 'Tip Report'
    _auto = False
    
    # Dimensions
    date = fields.Date('Date')
    employee_id = fields.Many2one('hr.employee', 'Employee')
    session_id = fields.Many2one('pos.session', 'Session')
    
    # Measures
    tip_amount = fields.Monetary('Tip Amount', currency_field='currency_id')
    tip_count = fields.Integer('Tip Count')
    avg_tip = fields.Monetary('Average Tip', currency_field='currency_id')
    tip_percentage = fields.Float('Tip Percentage')
    
    # Currency
    currency_id = fields.Many2one('res.currency', 'Currency')
    
    def init(self):
        """Create the view"""
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute(f"""
            CREATE OR REPLACE VIEW {self._table} AS (
                SELECT
                    row_number() OVER () AS id,
                    DATE(tt.processed_at) AS date,
                    emp.id AS employee_id,
                    po.session_id AS session_id,
                    SUM(tt.tip_amount) AS tip_amount,
                    COUNT(tt.id) AS tip_count,
                    AVG(tt.tip_amount) AS avg_tip,
                    AVG(tt.tip_percentage) AS tip_percentage,
                    tt.currency_id
                FROM pos_tip_transaction tt
                JOIN pos_order po ON tt.order_id = po.id
                LEFT JOIN pos_tip_distribution td ON td.pool_id IN (
                    SELECT id FROM pos_tip_pool WHERE session_id = po.session_id
                )
                LEFT JOIN hr_employee emp ON td.employee_id = emp.id
                WHERE tt.status IN ('processed', 'adjusted')
                GROUP BY DATE(tt.processed_at), emp.id, po.session_id, tt.currency_id
            )
        """)
        
    @api.model
    def get_staff_tip_summary(self, employee_id: int, date_from: str, date_to: str):
        """Get tip summary for staff member"""
        domain = [
            ('employee_id', '=', employee_id),
            ('date', '>=', date_from),
            ('date', '<=', date_to)
        ]
        
        reports = self.search(domain)
        
        return {
            'total_tips': sum(reports.mapped('tip_amount')),
            'total_transactions': sum(reports.mapped('tip_count')),
            'average_tip': sum(reports.mapped('avg_tip')) / len(reports) if reports else 0,
            'average_percentage': sum(reports.mapped('tip_percentage')) / len(reports) if reports else 0,
            'daily_breakdown': [
                {
                    'date': r.date.isoformat(),
                    'amount': r.tip_amount,
                    'count': r.tip_count,
                    'average': r.avg_tip
                }
                for r in reports
            ]
        } 