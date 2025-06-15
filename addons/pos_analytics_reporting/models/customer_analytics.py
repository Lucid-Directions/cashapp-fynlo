# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
import logging

_logger = logging.getLogger(__name__)

class CustomerAnalytics(models.Model):
    _name = 'pos.customer.analytics'
    _description = 'POS Customer Analytics'
    _order = 'date desc'
    _rec_name = 'display_name'

    # Basic Information
    date = fields.Date(
        string='Date',
        required=True,
        default=fields.Date.today,
        index=True
    )
    partner_id = fields.Many2one(
        'res.partner',
        string='Customer',
        index=True
    )
    
    # Customer Metrics
    total_visits = fields.Integer(
        string='Total Visits',
        default=0
    )
    total_spent = fields.Float(
        string='Total Spent',
        default=0.0
    )
    avg_order_value = fields.Float(
        string='Average Order Value',
        compute='_compute_customer_metrics',
        store=True
    )
    last_visit_date = fields.Datetime(
        string='Last Visit',
        compute='_compute_customer_metrics',
        store=True
    )
    customer_lifetime_value = fields.Float(
        string='Customer Lifetime Value',
        compute='_compute_customer_metrics',
        store=True
    )
    
    # Loyalty Metrics
    loyalty_points = fields.Integer(
        string='Loyalty Points',
        default=0
    )
    loyalty_tier = fields.Selection([
        ('bronze', 'Bronze'),
        ('silver', 'Silver'),
        ('gold', 'Gold'),
        ('platinum', 'Platinum')
    ], string='Loyalty Tier', compute='_compute_loyalty_tier', store=True)
    
    # Display
    display_name = fields.Char(
        string='Display Name',
        compute='_compute_display_name',
        store=True
    )
    
    @api.depends('partner_id', 'date')
    def _compute_display_name(self):
        for record in self:
            if record.partner_id:
                record.display_name = f"{record.partner_id.name} - {record.date}"
            else:
                record.display_name = f"Customer Analytics - {record.date}"
    
    @api.depends('total_visits', 'total_spent')
    def _compute_customer_metrics(self):
        for record in self:
            if record.partner_id:
                orders = self.env['pos.order'].search([
                    ('partner_id', '=', record.partner_id.id),
                    ('state', 'in', ['paid', 'done', 'invoiced'])
                ])
                
                record.total_visits = len(orders)
                record.total_spent = sum(orders.mapped('amount_total'))
                record.avg_order_value = record.total_spent / record.total_visits if record.total_visits > 0 else 0.0
                record.last_visit_date = max(orders.mapped('date_order')) if orders else False
                record.customer_lifetime_value = record.total_spent * 1.2  # Simple CLV calculation
            else:
                record.avg_order_value = 0.0
                record.last_visit_date = False
                record.customer_lifetime_value = 0.0
    
    @api.depends('total_spent')
    def _compute_loyalty_tier(self):
        for record in self:
            if record.total_spent >= 5000:
                record.loyalty_tier = 'platinum'
            elif record.total_spent >= 2000:
                record.loyalty_tier = 'gold'
            elif record.total_spent >= 500:
                record.loyalty_tier = 'silver'
            else:
                record.loyalty_tier = 'bronze'
    
    @api.model
    def get_customer_analytics_data(self, date_from=None, date_to=None):
        """Get customer analytics data for dashboard"""
        domain = []
        
        if date_from:
            domain.append(('date', '>=', date_from))
        if date_to:
            domain.append(('date', '<=', date_to))
        
        records = self.search(domain)
        
        return {
            'summary': {
                'total_customers': len(records.mapped('partner_id')),
                'avg_clv': sum(records.mapped('customer_lifetime_value')) / len(records) if records else 0,
                'total_visits': sum(records.mapped('total_visits')),
                'avg_order_value': sum(records.mapped('avg_order_value')) / len(records) if records else 0,
            },
            'loyalty_distribution': {
                tier: len(records.filtered(lambda r: r.loyalty_tier == tier))
                for tier in ['bronze', 'silver', 'gold', 'platinum']
            },
            'top_customers': records.sorted('total_spent', reverse=True)[:10]
        } 