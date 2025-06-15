# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
import json
import logging

_logger = logging.getLogger(__name__)

class CustomReport(models.Model):
    _name = 'pos.custom.report'
    _description = 'POS Custom Report Builder'
    _order = 'name'

    name = fields.Char(
        string='Report Name',
        required=True
    )
    description = fields.Text(
        string='Description'
    )
    report_type = fields.Selection([
        ('sales', 'Sales Report'),
        ('products', 'Product Report'),
        ('staff', 'Staff Report'),
        ('financial', 'Financial Report'),
        ('custom', 'Custom Report')
    ], string='Report Type', required=True, default='custom')
    
    # Report Configuration
    date_range = fields.Selection([
        ('today', 'Today'),
        ('yesterday', 'Yesterday'),
        ('this_week', 'This Week'),
        ('last_week', 'Last Week'),
        ('this_month', 'This Month'),
        ('last_month', 'Last Month'),
        ('custom', 'Custom Range')
    ], string='Date Range', default='today')
    
    date_from = fields.Date(string='From Date')
    date_to = fields.Date(string='To Date')
    
    # Filters
    session_ids = fields.Many2many(
        'pos.session',
        string='Sessions'
    )
    product_ids = fields.Many2many(
        'product.product',
        string='Products'
    )
    employee_ids = fields.Many2many(
        'hr.employee',
        string='Employees'
    )
    
    # Report Fields Configuration
    fields_config = fields.Text(
        string='Fields Configuration',
        help='JSON configuration for report fields'
    )
    
    # Report Output
    report_data = fields.Text(
        string='Report Data',
        readonly=True
    )
    last_generated = fields.Datetime(
        string='Last Generated',
        readonly=True
    )
    
    # Status
    active = fields.Boolean(
        string='Active',
        default=True
    )
    
    def action_generate_report(self):
        """Generate custom report based on configuration"""
        self.ensure_one()
        
        # Calculate date range
        date_from, date_to = self._get_date_range()
        
        # Generate report data based on type
        if self.report_type == 'sales':
            data = self._generate_sales_report(date_from, date_to)
        elif self.report_type == 'products':
            data = self._generate_product_report(date_from, date_to)
        elif self.report_type == 'staff':
            data = self._generate_staff_report(date_from, date_to)
        elif self.report_type == 'financial':
            data = self._generate_financial_report(date_from, date_to)
        else:
            data = self._generate_custom_report(date_from, date_to)
        
        self.report_data = json.dumps(data, default=str)
        self.last_generated = fields.Datetime.now()
        
        return {
            'type': 'ir.actions.client',
            'tag': 'pos_custom_report_view',
            'context': {
                'report_data': data,
                'report_name': self.name,
                'report_id': self.id
            }
        }
    
    def _get_date_range(self):
        """Calculate date range based on configuration"""
        today = fields.Date.today()
        
        if self.date_range == 'today':
            return today, today
        elif self.date_range == 'yesterday':
            yesterday = today - timedelta(days=1)
            return yesterday, yesterday
        elif self.date_range == 'this_week':
            start_week = today - timedelta(days=today.weekday())
            return start_week, today
        elif self.date_range == 'last_week':
            start_week = today - timedelta(days=today.weekday() + 7)
            end_week = start_week + timedelta(days=6)
            return start_week, end_week
        elif self.date_range == 'this_month':
            start_month = today.replace(day=1)
            return start_month, today
        elif self.date_range == 'last_month':
            first_day = today.replace(day=1)
            last_month_end = first_day - timedelta(days=1)
            last_month_start = last_month_end.replace(day=1)
            return last_month_start, last_month_end
        else:  # custom
            return self.date_from or today, self.date_to or today
    
    def _generate_sales_report(self, date_from, date_to):
        """Generate sales report data"""
        domain = [
            ('date_order', '>=', f"{date_from} 00:00:00"),
            ('date_order', '<=', f"{date_to} 23:59:59"),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if self.session_ids:
            domain.append(('session_id', 'in', self.session_ids.ids))
        
        orders = self.env['pos.order'].search(domain)
        
        return {
            'type': 'sales',
            'summary': {
                'total_orders': len(orders),
                'total_revenue': sum(orders.mapped('amount_total')),
                'avg_order_value': sum(orders.mapped('amount_total')) / len(orders) if orders else 0,
                'total_tax': sum(orders.mapped('amount_tax')),
            },
            'details': [
                {
                    'order_ref': order.pos_reference,
                    'date': order.date_order,
                    'amount': order.amount_total,
                    'customer': order.partner_id.name if order.partner_id else 'Anonymous',
                    'session': order.session_id.name
                }
                for order in orders
            ]
        }
    
    def _generate_product_report(self, date_from, date_to):
        """Generate product report data"""
        domain = [
            ('order_id.date_order', '>=', f"{date_from} 00:00:00"),
            ('order_id.date_order', '<=', f"{date_to} 23:59:59"),
            ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if self.product_ids:
            domain.append(('product_id', 'in', self.product_ids.ids))
        if self.session_ids:
            domain.append(('order_id.session_id', 'in', self.session_ids.ids))
        
        order_lines = self.env['pos.order.line'].search(domain)
        
        # Group by product
        product_data = {}
        for line in order_lines:
            product = line.product_id
            if product.id not in product_data:
                product_data[product.id] = {
                    'name': product.name,
                    'qty_sold': 0,
                    'revenue': 0,
                    'avg_price': 0,
                }
            
            product_data[product.id]['qty_sold'] += line.qty
            product_data[product.id]['revenue'] += line.price_subtotal_incl
        
        # Calculate average prices
        for data in product_data.values():
            data['avg_price'] = data['revenue'] / data['qty_sold'] if data['qty_sold'] > 0 else 0
        
        return {
            'type': 'products',
            'summary': {
                'total_products': len(product_data),
                'total_qty_sold': sum(data['qty_sold'] for data in product_data.values()),
                'total_revenue': sum(data['revenue'] for data in product_data.values()),
            },
            'details': list(product_data.values())
        }
    
    def _generate_staff_report(self, date_from, date_to):
        """Generate staff report data"""
        domain = [
            ('date', '>=', date_from),
            ('date', '<=', date_to)
        ]
        
        if self.employee_ids:
            domain.append(('employee_id', 'in', self.employee_ids.ids))
        
        staff_records = self.env['pos.staff.performance'].search(domain)
        
        return {
            'type': 'staff',
            'summary': {
                'total_staff': len(staff_records.mapped('employee_id')),
                'avg_performance': sum(staff_records.mapped('overall_performance_score')) / len(staff_records) if staff_records else 0,
                'total_sales': sum(staff_records.mapped('total_sales')),
                'total_hours': sum(staff_records.mapped('total_hours_worked')),
            },
            'details': [
                {
                    'employee': record.employee_id.name,
                    'date': record.date,
                    'performance_score': record.overall_performance_score,
                    'sales': record.total_sales,
                    'orders': record.total_orders,
                    'hours': record.total_hours_worked,
                }
                for record in staff_records
            ]
        }
    
    def _generate_financial_report(self, date_from, date_to):
        """Generate financial report data"""
        domain = [
            ('date', '>=', date_from),
            ('date', '<=', date_to)
        ]
        
        financial_records = self.env['pos.financial.analytics'].search(domain)
        
        return {
            'type': 'financial',
            'summary': {
                'total_revenue': sum(financial_records.mapped('gross_revenue')),
                'total_profit': sum(financial_records.mapped('gross_profit')),
                'avg_margin': sum(financial_records.mapped('gross_margin_percentage')) / len(financial_records) if financial_records else 0,
                'total_tax': sum(financial_records.mapped('tax_collected')),
            },
            'details': [
                {
                    'date': record.date,
                    'revenue': record.gross_revenue,
                    'profit': record.gross_profit,
                    'margin': record.gross_margin_percentage,
                    'tax': record.tax_collected,
                }
                for record in financial_records
            ]
        }
    
    def _generate_custom_report(self, date_from, date_to):
        """Generate custom report based on configuration"""
        # This would implement custom field configuration
        # For now, return a basic structure
        return {
            'type': 'custom',
            'message': 'Custom report generation not yet implemented',
            'date_range': f"{date_from} to {date_to}"
        } 