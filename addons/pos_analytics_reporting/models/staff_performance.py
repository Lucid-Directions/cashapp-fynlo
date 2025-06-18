# -*- coding: utf-8 -*-

from odoo import models, fields, api
from datetime import datetime, timedelta
from odoo.exceptions import ValidationError
import logging

_logger = logging.getLogger(__name__)

class StaffPerformance(models.Model):
    _name = 'pos.staff.performance'
    _description = 'POS Staff Performance Analytics'
    _order = 'date desc, employee_id'
    _rec_name = 'display_name'

    # Basic Information
    employee_id = fields.Many2one(
        'hr.employee',
        string='Employee',
        required=True,
        index=True
    )
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
    
    # Performance Metrics
    total_sales = fields.Float(
        string='Total Sales',
        compute='_compute_performance_metrics',
        store=True
    )
    total_orders = fields.Integer(
        string='Total Orders',
        compute='_compute_performance_metrics',
        store=True
    )
    avg_order_value = fields.Float(
        string='Average Order Value',
        compute='_compute_performance_metrics',
        store=True
    )
    orders_per_hour = fields.Float(
        string='Orders per Hour',
        compute='_compute_performance_metrics',
        store=True
    )
    sales_per_hour = fields.Float(
        string='Sales per Hour',
        compute='_compute_performance_metrics',
        store=True
    )
    
    # Time Analytics
    total_hours_worked = fields.Float(
        string='Hours Worked',
        compute='_compute_time_metrics',
        store=True
    )
    active_selling_time = fields.Float(
        string='Active Selling Time',
        compute='_compute_time_metrics',
        store=True
    )
    efficiency_rate = fields.Float(
        string='Efficiency Rate (%)',
        compute='_compute_time_metrics',
        store=True
    )
    
    # Customer Service Metrics
    total_customers_served = fields.Integer(
        string='Customers Served',
        compute='_compute_service_metrics',
        store=True
    )
    avg_service_time = fields.Float(
        string='Avg Service Time (minutes)',
        compute='_compute_service_metrics',
        store=True
    )
    customer_satisfaction_score = fields.Float(
        string='Customer Satisfaction',
        default=0.0
    )
    
    # Payment Processing
    cash_transactions = fields.Integer(
        string='Cash Transactions',
        compute='_compute_payment_metrics',
        store=True
    )
    card_transactions = fields.Integer(
        string='Card Transactions',
        compute='_compute_payment_metrics',
        store=True
    )
    digital_transactions = fields.Integer(
        string='Digital Transactions',
        compute='_compute_payment_metrics',
        store=True
    )
    payment_accuracy = fields.Float(
        string='Payment Accuracy (%)',
        compute='_compute_payment_metrics',
        store=True
    )
    
    # Product Knowledge
    products_sold_count = fields.Integer(
        string='Different Products Sold',
        compute='_compute_product_metrics',
        store=True
    )
    upsell_success_rate = fields.Float(
        string='Upsell Success Rate (%)',
        compute='_compute_product_metrics',
        store=True
    )
    product_return_rate = fields.Float(
        string='Product Return Rate (%)',
        compute='_compute_product_metrics',
        store=True
    )
    
    # Performance Score
    overall_performance_score = fields.Float(
        string='Overall Performance Score',
        compute='_compute_performance_score',
        store=True
    )
    performance_grade = fields.Selection([
        ('excellent', 'Excellent (90-100)'),
        ('good', 'Good (80-89)'),
        ('average', 'Average (70-79)'),
        ('needs_improvement', 'Needs Improvement (60-69)'),
        ('poor', 'Poor (Below 60)')
    ], string='Performance Grade', compute='_compute_performance_score', store=True)
    
    # Display Fields
    display_name = fields.Char(
        string='Display Name',
        compute='_compute_display_name',
        store=True
    )
    
    @api.depends('employee_id', 'date')
    def _compute_display_name(self):
        for record in self:
            if record.employee_id and record.date:
                record.display_name = f"{record.employee_id.name} - {record.date}"
            else:
                record.display_name = "Staff Performance"
    
    @api.depends('session_ids')
    def _compute_performance_metrics(self):
        for record in self:
            if not record.session_ids:
                record.total_sales = 0.0
                record.total_orders = 0
                record.avg_order_value = 0.0
                record.orders_per_hour = 0.0
                record.sales_per_hour = 0.0
                continue
                
            # Get all orders from sessions
            orders = self.env['pos.order'].search([
                ('session_id', 'in', record.session_ids.ids),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            record.total_orders = len(orders)
            record.total_sales = sum(orders.mapped('amount_total'))
            record.avg_order_value = record.total_sales / record.total_orders if record.total_orders > 0 else 0.0
            
            if record.total_hours_worked > 0:
                record.orders_per_hour = record.total_orders / record.total_hours_worked
                record.sales_per_hour = record.total_sales / record.total_hours_worked
            else:
                record.orders_per_hour = 0.0
                record.sales_per_hour = 0.0
    
    @api.depends('session_ids', 'date')
    def _compute_time_metrics(self):
        for record in self:
            if not record.session_ids:
                record.total_hours_worked = 0.0
                record.active_selling_time = 0.0
                record.efficiency_rate = 0.0
                continue
            
            total_session_time = 0.0
            active_time = 0.0
            
            for session in record.session_ids:
                if session.start_at and session.stop_at:
                    session_duration = (session.stop_at - session.start_at).total_seconds() / 3600
                    total_session_time += session_duration
                    
                    # Calculate active selling time based on orders
                    orders = self.env['pos.order'].search([
                        ('session_id', '=', session.id),
                        ('state', 'in', ['paid', 'done', 'invoiced'])
                    ])
                    
                    if orders:
                        # Estimate active time as 5 minutes per order on average
                        estimated_active_time = len(orders) * 5 / 60  # Convert to hours
                        active_time += min(estimated_active_time, session_duration)
            
            record.total_hours_worked = total_session_time
            record.active_selling_time = active_time
            record.efficiency_rate = (active_time / total_session_time * 100) if total_session_time > 0 else 0.0
    
    @api.depends('session_ids')
    def _compute_service_metrics(self):
        for record in self:
            if not record.session_ids:
                record.total_customers_served = 0
                record.avg_service_time = 0.0
                continue
            
            orders = self.env['pos.order'].search([
                ('session_id', 'in', record.session_ids.ids),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            record.total_customers_served = len(orders)
            
            # Estimate average service time (simplified calculation)
            if record.active_selling_time > 0 and record.total_customers_served > 0:
                record.avg_service_time = (record.active_selling_time * 60) / record.total_customers_served
            else:
                record.avg_service_time = 0.0
    
    @api.depends('session_ids')
    def _compute_payment_metrics(self):
        for record in self:
            if not record.session_ids:
                record.cash_transactions = 0
                record.card_transactions = 0
                record.digital_transactions = 0
                record.payment_accuracy = 0.0
                continue
            
            payments = self.env['pos.payment'].search([
                ('session_id', 'in', record.session_ids.ids)
            ])
            
            cash_count = card_count = digital_count = 0
            
            for payment in payments:
                if payment.payment_method_id.is_cash_count:
                    cash_count += 1
                elif payment.payment_method_id.use_payment_terminal:
                    card_count += 1
                else:
                    digital_count += 1
            
            record.cash_transactions = cash_count
            record.card_transactions = card_count
            record.digital_transactions = digital_count
            
            # Calculate payment accuracy (simplified - could be enhanced with actual error tracking)
            total_payments = len(payments)
            record.payment_accuracy = 98.0 if total_payments > 0 else 0.0  # Default assumption
    
    @api.depends('session_ids')
    def _compute_product_metrics(self):
        for record in self:
            if not record.session_ids:
                record.products_sold_count = 0
                record.upsell_success_rate = 0.0
                record.product_return_rate = 0.0
                continue
            
            order_lines = self.env['pos.order.line'].search([
                ('order_id.session_id', 'in', record.session_ids.ids),
                ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            # Count unique products
            unique_products = order_lines.mapped('product_id')
            record.products_sold_count = len(unique_products)
            
            # Estimate upsell success rate (simplified calculation)
            total_orders = len(order_lines.mapped('order_id'))
            orders_with_multiple_items = len([
                order for order in order_lines.mapped('order_id')
                if len(order.lines) > 1
            ])
            
            record.upsell_success_rate = (orders_with_multiple_items / total_orders * 100) if total_orders > 0 else 0.0
            
            # Calculate return rate (simplified)
            returned_items = order_lines.filtered(lambda l: l.qty < 0)
            record.product_return_rate = (len(returned_items) / len(order_lines) * 100) if order_lines else 0.0
    
    @api.depends('total_sales', 'total_orders', 'efficiency_rate', 'payment_accuracy', 'upsell_success_rate')
    def _compute_performance_score(self):
        for record in self:
            # Calculate weighted performance score
            scores = []
            weights = []
            
            # Sales performance (30%)
            if record.sales_per_hour > 0:
                # Normalize against average (assuming $200/hour is excellent)
                score = min(record.sales_per_hour / 200 * 100, 100)
                scores.append(score)
                weights.append(0.30)
            
            # Efficiency (25%)
            if record.efficiency_rate > 0:
                scores.append(record.efficiency_rate)
                weights.append(0.25)
            
            # Payment accuracy (20%)
            if record.payment_accuracy > 0:
                scores.append(record.payment_accuracy)
                weights.append(0.20)
            
            # Customer service (15%)
            if record.orders_per_hour > 0:
                # Normalize against target (assuming 12 orders/hour is excellent)
                score = min(record.orders_per_hour / 12 * 100, 100)
                scores.append(score)
                weights.append(0.15)
            
            # Upselling (10%)
            if record.upsell_success_rate > 0:
                scores.append(record.upsell_success_rate)
                weights.append(0.10)
            
            if scores and weights:
                weighted_sum = sum(score * weight for score, weight in zip(scores, weights))
                total_weight = sum(weights)
                record.overall_performance_score = weighted_sum / total_weight
            else:
                record.overall_performance_score = 0.0
            
            # Assign grade
            if record.overall_performance_score >= 90:
                record.performance_grade = 'excellent'
            elif record.overall_performance_score >= 80:
                record.performance_grade = 'good'
            elif record.overall_performance_score >= 70:
                record.performance_grade = 'average'
            elif record.overall_performance_score >= 60:
                record.performance_grade = 'needs_improvement'
            else:
                record.performance_grade = 'poor'
    
    def action_generate_daily_reports(self):
        """Generate staff performance reports for all employees for a specific date"""
        employees = self.env['hr.employee'].search([
            ('active', '=', True)
        ])
        
        date = self.env.context.get('date', fields.Date.today())
        
        for employee in employees:
            sessions = self.env['pos.session'].search([
                ('user_id.employee_id', '=', employee.id),
                ('start_at', '>=', f"{date} 00:00:00"),
                ('start_at', '<=', f"{date} 23:59:59"),
                ('state', 'in', ['closed'])
            ])
            
            if sessions:
                existing = self.search([
                    ('employee_id', '=', employee.id),
                    ('date', '=', date)
                ])
                
                if existing:
                    existing.session_ids = [(6, 0, sessions.ids)]
                else:
                    self.create({
                        'employee_id': employee.id,
                        'date': date,
                        'session_ids': [(6, 0, sessions.ids)]
                    })
    
    @api.model
    def get_staff_performance_dashboard_data(self, date_from=None, date_to=None, employee_ids=None):
        """Get comprehensive staff performance data for dashboard"""
        domain = []
        
        if date_from:
            domain.append(('date', '>=', date_from))
        if date_to:
            domain.append(('date', '<=', date_to))
        if employee_ids:
            domain.append(('employee_id', 'in', employee_ids))
        
        records = self.search(domain)
        
        # Top performers
        top_performers = records.sorted('overall_performance_score', reverse=True)[:5]
        
        # Performance trends
        performance_by_date = {}
        for record in records:
            date_str = str(record.date)
            if date_str not in performance_by_date:
                performance_by_date[date_str] = []
            performance_by_date[date_str].append(record.overall_performance_score)
        
        avg_performance_by_date = {
            date: sum(scores) / len(scores) if scores else 0 
            for date, scores in performance_by_date.items()
        }
        
        return {
            'summary': {
                'total_staff': len(records.mapped('employee_id')),
                'avg_performance_score': sum(records.mapped('overall_performance_score')) / len(records) if records else 0,
                'top_performer': top_performers[0] if top_performers else None,
                'total_hours_worked': sum(records.mapped('total_hours_worked')),
                'total_sales_generated': sum(records.mapped('total_sales')),
            },
            'top_performers': [{
                'employee_name': p.employee_id.name,
                'performance_score': p.overall_performance_score,
                'sales_per_hour': p.sales_per_hour,
                'orders_per_hour': p.orders_per_hour,
                'efficiency_rate': p.efficiency_rate,
            } for p in top_performers],
            'performance_trends': avg_performance_by_date,
            'grade_distribution': {
                grade: len(records.filtered(lambda r: r.performance_grade == grade))
                for grade in ['excellent', 'good', 'average', 'needs_improvement', 'poor']
            }
        }

class StaffPerformanceWizard(models.TransientModel):
    _name = 'pos.staff.performance.wizard'
    _description = 'Staff Performance Report Wizard'
    
    date_from = fields.Date(
        string='From Date',
        required=True,
        default=lambda self: fields.Date.today() - timedelta(days=7)
    )
    date_to = fields.Date(
        string='To Date',
        required=True,
        default=fields.Date.today
    )
    employee_ids = fields.Many2many(
        'hr.employee',
        string='Employees',
        domain=[('active', '=', True)]
    )
    
    def action_generate_report(self):
        """Generate and display staff performance report"""
        data = self.env['pos.staff.performance'].get_staff_performance_dashboard_data(
            date_from=self.date_from,
            date_to=self.date_to,
            employee_ids=self.employee_ids.ids if self.employee_ids else None
        )
        
        return {
            'type': 'ir.actions.client',
            'tag': 'staff_performance_dashboard',
            'context': {
                'data': data,
                'date_from': self.date_from,
                'date_to': self.date_to,
            }
        } 