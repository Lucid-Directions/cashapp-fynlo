# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class FinancialAnalytics(models.Model):
    _name = 'pos.financial.analytics'
    _description = 'POS Financial Analytics'
    _order = 'date desc'
    _rec_name = 'display_name'

    # Basic Information
    date = fields.Date(
        string='Date',
        required=True,
        default=fields.Date.today,
        index=True
    )
    session_ids = fields.Many2many(
        'pos.session',
        string='Related Sessions'
    )
    
    # Revenue Metrics
    gross_revenue = fields.Float(
        string='Gross Revenue',
        compute='_compute_financial_metrics',
        store=True
    )
    net_revenue = fields.Float(
        string='Net Revenue',
        compute='_compute_financial_metrics',
        store=True
    )
    tax_collected = fields.Float(
        string='Tax Collected',
        compute='_compute_financial_metrics',
        store=True
    )
    discounts_given = fields.Float(
        string='Discounts Given',
        compute='_compute_financial_metrics',
        store=True
    )
    refunds_processed = fields.Float(
        string='Refunds Processed',
        compute='_compute_financial_metrics',
        store=True
    )
    
    # Payment Methods
    cash_collected = fields.Float(
        string='Cash Collected',
        compute='_compute_payment_methods',
        store=True
    )
    card_collected = fields.Float(
        string='Card Collected',
        compute='_compute_payment_methods',
        store=True
    )
    digital_collected = fields.Float(
        string='Digital Payments',
        compute='_compute_payment_methods',
        store=True
    )
    
    # Cost Analysis
    cost_of_goods_sold = fields.Float(
        string='Cost of Goods Sold',
        compute='_compute_cost_metrics',
        store=True
    )
    gross_profit = fields.Float(
        string='Gross Profit',
        compute='_compute_cost_metrics',
        store=True
    )
    gross_margin_percentage = fields.Float(
        string='Gross Margin %',
        compute='_compute_cost_metrics',
        store=True
    )
    
    # Display
    display_name = fields.Char(
        string='Display Name',
        compute='_compute_display_name',
        store=True
    )
    
    @api.depends('date')
    def _compute_display_name(self):
        for record in self:
            if record.date:
                record.display_name = f"Financial Analytics - {record.date}"
            else:
                record.display_name = "Financial Analytics"
    
    @api.depends('session_ids')
    def _compute_financial_metrics(self):
        for record in self:
            if not record.session_ids:
                record.gross_revenue = 0.0
                record.net_revenue = 0.0
                record.tax_collected = 0.0
                record.discounts_given = 0.0
                record.refunds_processed = 0.0
                continue
            
            orders = self.env['pos.order'].search([
                ('session_id', 'in', record.session_ids.ids),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            record.gross_revenue = sum(orders.mapped('amount_total'))
            record.net_revenue = sum(orders.mapped('amount_paid'))
            record.tax_collected = sum(orders.mapped('amount_tax'))
            
            # Calculate discounts (simplified)
            total_discount = 0.0
            for order in orders:
                for line in order.lines:
                    if line.discount > 0:
                        total_discount += (line.price_unit * line.qty * line.discount / 100)
            record.discounts_given = total_discount
            
            # Calculate refunds
            refund_orders = orders.filtered(lambda o: o.amount_total < 0)
            record.refunds_processed = abs(sum(refund_orders.mapped('amount_total')))
    
    @api.depends('session_ids')
    def _compute_payment_methods(self):
        for record in self:
            if not record.session_ids:
                record.cash_collected = 0.0
                record.card_collected = 0.0
                record.digital_collected = 0.0
                continue
            
            payments = self.env['pos.payment'].search([
                ('session_id', 'in', record.session_ids.ids)
            ])
            
            cash_total = card_total = digital_total = 0.0
            
            for payment in payments:
                if payment.payment_method_id.is_cash_count:
                    cash_total += payment.amount
                elif payment.payment_method_id.use_payment_terminal:
                    card_total += payment.amount
                else:
                    digital_total += payment.amount
            
            record.cash_collected = cash_total
            record.card_collected = card_total
            record.digital_collected = digital_total
    
    @api.depends('session_ids', 'gross_revenue')
    def _compute_cost_metrics(self):
        for record in self:
            if not record.session_ids:
                record.cost_of_goods_sold = 0.0
                record.gross_profit = 0.0
                record.gross_margin_percentage = 0.0
                continue
            
            order_lines = self.env['pos.order.line'].search([
                ('order_id.session_id', 'in', record.session_ids.ids),
                ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            total_cost = 0.0
            for line in order_lines:
                if line.product_id.standard_price:
                    total_cost += line.product_id.standard_price * line.qty
            
            record.cost_of_goods_sold = total_cost
            record.gross_profit = record.gross_revenue - total_cost
            record.gross_margin_percentage = (record.gross_profit / record.gross_revenue * 100) if record.gross_revenue > 0 else 0.0
    
    @api.model
    def get_financial_dashboard_data(self, date_from=None, date_to=None):
        """Get financial analytics data for dashboard"""
        domain = []
        
        if date_from:
            domain.append(('date', '>=', date_from))
        if date_to:
            domain.append(('date', '<=', date_to))
        
        records = self.search(domain)
        
        return {
            'summary': {
                'total_revenue': sum(records.mapped('gross_revenue')),
                'total_profit': sum(records.mapped('gross_profit')),
                'avg_margin': sum(records.mapped('gross_margin_percentage')) / len(records) if records else 0,
                'total_tax': sum(records.mapped('tax_collected')),
                'total_discounts': sum(records.mapped('discounts_given')),
                'total_refunds': sum(records.mapped('refunds_processed')),
            },
            'payment_breakdown': {
                'cash': sum(records.mapped('cash_collected')),
                'card': sum(records.mapped('card_collected')),
                'digital': sum(records.mapped('digital_collected')),
            },
            'trends': [
                {
                    'date': str(record.date),
                    'revenue': record.gross_revenue,
                    'profit': record.gross_profit,
                    'margin': record.gross_margin_percentage,
                }
                for record in records.sorted('date')
            ]
        } 