from odoo import models, fields, api, tools
from datetime import datetime, timedelta
import json
import logging
from collections import defaultdict
import base64
import io

_logger = logging.getLogger(__name__)

class POSSalesReport(models.Model):
    _name = 'pos.sales.report'
    _description = 'POS Sales Reporting Engine'
    _auto = False
    _order = 'date desc'

    # Report fields
    date = fields.Date('Date')
    config_id = fields.Many2one('pos.config', 'POS Configuration')
    user_id = fields.Many2one('res.users', 'Salesperson')
    product_id = fields.Many2one('product.product', 'Product')
    category_id = fields.Many2one('pos.category', 'Category')
    
    # Financial metrics
    gross_sales = fields.Float('Gross Sales')
    net_sales = fields.Float('Net Sales')
    tax_amount = fields.Float('Tax Amount')
    discount_amount = fields.Float('Discount Amount')
    refund_amount = fields.Float('Refund Amount')
    
    # Volume metrics
    qty_sold = fields.Float('Quantity Sold')
    order_count = fields.Integer('Order Count')
    customer_count = fields.Integer('Customer Count')
    
    # Performance metrics
    avg_ticket = fields.Float('Average Ticket')
    margin = fields.Float('Margin %')
    
    def init(self):
        """Initialize the report view"""
        tools.drop_view_if_exists(self.env.cr, self._table)
        self.env.cr.execute("""
            CREATE OR REPLACE VIEW %s AS (
                SELECT 
                    row_number() OVER () AS id,
                    DATE(po.date_order) AS date,
                    po.config_id,
                    po.user_id,
                    pol.product_id,
                    pp.pos_categ_id AS category_id,
                    SUM(pol.price_subtotal_incl) AS gross_sales,
                    SUM(pol.price_subtotal) AS net_sales,
                    SUM(pol.price_subtotal_incl - pol.price_subtotal) AS tax_amount,
                    SUM(CASE WHEN pol.discount > 0 THEN pol.price_unit * pol.qty * pol.discount / 100 ELSE 0 END) AS discount_amount,
                    SUM(CASE WHEN po.amount_total < 0 THEN ABS(pol.price_subtotal_incl) ELSE 0 END) AS refund_amount,
                    SUM(pol.qty) AS qty_sold,
                    COUNT(DISTINCT po.id) AS order_count,
                    COUNT(DISTINCT po.partner_id) AS customer_count,
                    AVG(po.amount_total) AS avg_ticket,
                    AVG(CASE WHEN pol.price_unit > 0 THEN ((pol.price_unit - pp.standard_price) / pol.price_unit * 100) ELSE 0 END) AS margin
                FROM pos_order po
                JOIN pos_order_line pol ON po.id = pol.order_id
                JOIN product_product pp ON pol.product_id = pp.id
                WHERE po.state IN ('paid', 'done', 'invoiced')
                GROUP BY 
                    DATE(po.date_order),
                    po.config_id,
                    po.user_id,
                    pol.product_id,
                    pp.pos_categ_id
            )
        """ % self._table)

class SalesReportGenerator(models.Model):
    _name = 'pos.sales.report.generator'
    _description = 'Sales Report Generator'
    
    name = fields.Char('Report Name', required=True)
    report_type = fields.Selection([
        ('daily', 'Daily Sales'),
        ('weekly', 'Weekly Sales'),
        ('monthly', 'Monthly Sales'),
        ('yearly', 'Yearly Sales'),
        ('custom', 'Custom Period'),
        ('comparison', 'Comparison Report'),
        ('detailed', 'Detailed Transaction Report')
    ], string='Report Type', required=True, default='daily')
    
    date_from = fields.Date('From Date', required=True, default=fields.Date.today)
    date_to = fields.Date('To Date', required=True, default=fields.Date.today)
    
    config_ids = fields.Many2many('pos.config', string='POS Configurations')
    user_ids = fields.Many2many('res.users', string='Salespersons')
    category_ids = fields.Many2many('pos.category', string='Product Categories')
    
    group_by = fields.Selection([
        ('date', 'Date'),
        ('config', 'POS Configuration'),
        ('user', 'Salesperson'),
        ('category', 'Category'),
        ('product', 'Product')
    ], string='Group By', default='date')
    
    include_refunds = fields.Boolean('Include Refunds', default=True)
    include_taxes = fields.Boolean('Include Tax Details', default=True)
    
    @api.model
    def generate_daily_report(self, date=None, config_ids=None):
        """Generate comprehensive daily sales report"""
        if not date:
            date = fields.Date.today()
            
        # Build domain
        domain = [
            ('date_order', '>=', date),
            ('date_order', '<', date + timedelta(days=1)),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if config_ids:
            domain.append(('config_id', 'in', config_ids))
            
        orders = self.env['pos.order'].search(domain)
        
        if not orders:
            return self._empty_report_structure()
            
        return {
            'report_info': {
                'type': 'daily',
                'date': str(date),
                'generated_at': datetime.now().isoformat(),
                'total_orders': len(orders)
            },
            'summary': self._calculate_sales_summary(orders),
            'hourly_breakdown': self._get_hourly_breakdown(orders),
            'payment_methods': self._get_payment_breakdown(orders),
            'products': self._get_product_sales(orders),
            'categories': self._get_category_sales(orders),
            'staff_performance': self._get_staff_sales(orders),
            'tax_summary': self._get_tax_summary(orders),
            'discounts': self._get_discount_summary(orders),
            'refunds': self._get_refund_summary(orders)
        }
    
    @api.model
    def generate_weekly_report(self, week_start=None, config_ids=None):
        """Generate weekly sales report"""
        if not week_start:
            today = fields.Date.today()
            week_start = today - timedelta(days=today.weekday())
            
        week_end = week_start + timedelta(days=6)
        
        # Get daily data for the week
        daily_reports = []
        current_date = week_start
        
        while current_date <= week_end:
            daily_data = self.generate_daily_report(current_date, config_ids)
            daily_reports.append({
                'date': str(current_date),
                'weekday': current_date.strftime('%A'),
                'data': daily_data
            })
            current_date += timedelta(days=1)
        
        # Calculate week totals
        week_orders = self.env['pos.order'].search([
            ('date_order', '>=', week_start),
            ('date_order', '<=', week_end + timedelta(days=1)),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        return {
            'report_info': {
                'type': 'weekly',
                'week_start': str(week_start),
                'week_end': str(week_end),
                'generated_at': datetime.now().isoformat()
            },
            'week_summary': self._calculate_sales_summary(week_orders),
            'daily_breakdown': daily_reports,
            'week_trends': self._calculate_week_trends(daily_reports),
            'comparison': self._get_weekly_comparison(week_start)
        }
    
    @api.model
    def generate_monthly_report(self, month=None, year=None, config_ids=None):
        """Generate monthly sales report"""
        if not month:
            month = datetime.now().month
        if not year:
            year = datetime.now().year
            
        # Calculate month boundaries
        month_start = datetime(year, month, 1).date()
        if month == 12:
            month_end = datetime(year + 1, 1, 1).date() - timedelta(days=1)
        else:
            month_end = datetime(year, month + 1, 1).date() - timedelta(days=1)
        
        domain = [
            ('date_order', '>=', month_start),
            ('date_order', '<=', month_end + timedelta(days=1)),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if config_ids:
            domain.append(('config_id', 'in', config_ids))
            
        orders = self.env['pos.order'].search(domain)
        
        # Generate weekly breakdown
        weekly_data = []
        current_week_start = month_start
        
        while current_week_start <= month_end:
            week_end = min(current_week_start + timedelta(days=6), month_end)
            week_orders = orders.filtered(
                lambda o: current_week_start <= o.date_order.date() <= week_end
            )
            
            weekly_data.append({
                'week_start': str(current_week_start),
                'week_end': str(week_end),
                'summary': self._calculate_sales_summary(week_orders)
            })
            
            current_week_start += timedelta(days=7)
        
        return {
            'report_info': {
                'type': 'monthly',
                'month': month,
                'year': year,
                'month_name': month_start.strftime('%B'),
                'generated_at': datetime.now().isoformat()
            },
            'month_summary': self._calculate_sales_summary(orders),
            'weekly_breakdown': weekly_data,
            'daily_averages': self._calculate_daily_averages(orders),
            'growth_analysis': self._calculate_monthly_growth(month, year),
            'top_performers': self._get_monthly_top_performers(orders)
        }
    
    @api.model
    def generate_comparison_report(self, period1_start, period1_end, period2_start, period2_end, config_ids=None):
        """Generate comparison report between two periods"""
        
        # Get data for both periods
        period1_orders = self._get_orders_for_period(period1_start, period1_end, config_ids)
        period2_orders = self._get_orders_for_period(period2_start, period2_end, config_ids)
        
        period1_summary = self._calculate_sales_summary(period1_orders)
        period2_summary = self._calculate_sales_summary(period2_orders)
        
        # Calculate differences and percentages
        comparison = {}
        for key in period1_summary:
            if isinstance(period1_summary[key], (int, float)):
                difference = period1_summary[key] - period2_summary[key]
                percentage = (difference / period2_summary[key] * 100) if period2_summary[key] != 0 else 0
                
                comparison[key] = {
                    'period1': period1_summary[key],
                    'period2': period2_summary[key],
                    'difference': difference,
                    'percentage_change': round(percentage, 2)
                }
        
        return {
            'report_info': {
                'type': 'comparison',
                'period1': {'start': str(period1_start), 'end': str(period1_end)},
                'period2': {'start': str(period2_start), 'end': str(period2_end)},
                'generated_at': datetime.now().isoformat()
            },
            'comparison': comparison,
            'period1_details': {
                'summary': period1_summary,
                'top_products': self._get_product_sales(period1_orders)[:10]
            },
            'period2_details': {
                'summary': period2_summary,
                'top_products': self._get_product_sales(period2_orders)[:10]
            }
        }
    
    def _calculate_sales_summary(self, orders):
        """Calculate comprehensive sales summary"""
        if not orders:
            return self._empty_summary()
            
        total_sales = sum(orders.mapped('amount_total'))
        total_tax = sum(orders.mapped('amount_tax'))
        total_orders = len(orders)
        
        # Calculate refunds
        refunded_orders = orders.filtered(lambda o: o.amount_total < 0)
        refund_amount = sum(refunded_orders.mapped('amount_total'))
        
        # Calculate discounts
        total_discount = 0
        for order in orders:
            for line in order.lines:
                if line.discount > 0:
                    total_discount += line.price_unit * line.qty * line.discount / 100
        
        return {
            'total_sales': round(total_sales, 2),
            'net_sales': round(total_sales - total_tax, 2),
            'total_tax': round(total_tax, 2),
            'total_orders': total_orders,
            'average_ticket': round(total_sales / total_orders, 2) if total_orders > 0 else 0,
            'total_items': sum(len(order.lines) for order in orders),
            'average_items_per_order': round(sum(len(order.lines) for order in orders) / total_orders, 2) if total_orders > 0 else 0,
            'refund_amount': abs(round(refund_amount, 2)),
            'refund_count': len(refunded_orders),
            'discount_amount': round(total_discount, 2),
            'gross_margin': self._calculate_gross_margin(orders)
        }
    
    def _get_hourly_breakdown(self, orders):
        """Get sales breakdown by hour"""
        hourly_data = defaultdict(lambda: {'sales': 0, 'orders': 0, 'items': 0})
        
        for order in orders:
            hour = order.date_order.hour
            hourly_data[hour]['sales'] += order.amount_total
            hourly_data[hour]['orders'] += 1
            hourly_data[hour]['items'] += len(order.lines)
        
        return [
            {
                'hour': f"{hour:02d}:00",
                'sales': round(data['sales'], 2),
                'orders': data['orders'],
                'items': data['items'],
                'avg_ticket': round(data['sales'] / data['orders'], 2) if data['orders'] > 0 else 0
            }
            for hour, data in sorted(hourly_data.items())
        ]
    
    def _get_payment_breakdown(self, orders):
        """Get payment method breakdown"""
        payment_data = defaultdict(lambda: {'amount': 0, 'count': 0, 'orders': set()})
        
        for order in orders:
            for payment in order.payment_ids:
                method = payment.payment_method_id.name
                payment_data[method]['amount'] += payment.amount
                payment_data[method]['count'] += 1
                payment_data[method]['orders'].add(order.id)
        
        total_amount = sum(orders.mapped('amount_total'))
        
        return [
            {
                'method': method,
                'amount': round(data['amount'], 2),
                'count': data['count'],
                'orders': len(data['orders']),
                'percentage': round(data['amount'] / total_amount * 100, 2) if total_amount > 0 else 0
            }
            for method, data in payment_data.items()
        ]
    
    def _get_product_sales(self, orders):
        """Get product sales analysis"""
        product_data = defaultdict(lambda: {
            'name': '',
            'qty': 0,
            'amount': 0,
            'orders': set(),
            'category': ''
        })
        
        for order in orders:
            for line in order.lines:
                product_id = line.product_id.id
                product_data[product_id]['name'] = line.product_id.name
                product_data[product_id]['category'] = line.product_id.pos_categ_id.name if line.product_id.pos_categ_id else 'Uncategorized'
                product_data[product_id]['qty'] += line.qty
                product_data[product_id]['amount'] += line.price_subtotal_incl
                product_data[product_id]['orders'].add(order.id)
        
        products = []
        for product_id, data in product_data.items():
            data['product_id'] = product_id
            data['orders'] = len(data['orders'])
            data['avg_price'] = round(data['amount'] / data['qty'], 2) if data['qty'] > 0 else 0
            products.append(data)
        
        return sorted(products, key=lambda x: x['amount'], reverse=True)
    
    def _get_category_sales(self, orders):
        """Get category sales analysis"""
        category_data = defaultdict(lambda: {'name': '', 'qty': 0, 'amount': 0, 'products': set()})
        
        for order in orders:
            for line in order.lines:
                if line.product_id.pos_categ_id:
                    cat_id = line.product_id.pos_categ_id.id
                    category_data[cat_id]['name'] = line.product_id.pos_categ_id.name
                    category_data[cat_id]['qty'] += line.qty
                    category_data[cat_id]['amount'] += line.price_subtotal_incl
                    category_data[cat_id]['products'].add(line.product_id.id)
        
        categories = []
        total_amount = sum(data['amount'] for data in category_data.values())
        
        for cat_id, data in category_data.items():
            data['category_id'] = cat_id
            data['products'] = len(data['products'])
            data['percentage'] = round(data['amount'] / total_amount * 100, 2) if total_amount > 0 else 0
            categories.append(data)
        
        return sorted(categories, key=lambda x: x['amount'], reverse=True)
    
    def _get_staff_sales(self, orders):
        """Get staff sales performance"""
        staff_data = defaultdict(lambda: {'name': '', 'orders': 0, 'sales': 0, 'items': 0})
        
        for order in orders:
            if order.user_id:
                user_id = order.user_id.id
                staff_data[user_id]['name'] = order.user_id.name
                staff_data[user_id]['orders'] += 1
                staff_data[user_id]['sales'] += order.amount_total
                staff_data[user_id]['items'] += len(order.lines)
        
        staff = []
        for user_id, data in staff_data.items():
            data['user_id'] = user_id
            data['avg_ticket'] = round(data['sales'] / data['orders'], 2) if data['orders'] > 0 else 0
            data['items_per_order'] = round(data['items'] / data['orders'], 2) if data['orders'] > 0 else 0
            staff.append(data)
        
        return sorted(staff, key=lambda x: x['sales'], reverse=True)
    
    def _get_tax_summary(self, orders):
        """Get tax summary"""
        tax_data = defaultdict(lambda: {'amount': 0, 'base': 0})
        
        for order in orders:
            for line in order.lines:
                tax_amount = line.price_subtotal_incl - line.price_subtotal
                tax_data['total']['amount'] += tax_amount
                tax_data['total']['base'] += line.price_subtotal
        
        return {
            'total_tax': round(tax_data['total']['amount'], 2),
            'tax_base': round(tax_data['total']['base'], 2),
            'effective_rate': round(tax_data['total']['amount'] / tax_data['total']['base'] * 100, 2) if tax_data['total']['base'] > 0 else 0
        }
    
    def _get_discount_summary(self, orders):
        """Get discount summary"""
        total_discount = 0
        discount_orders = 0
        
        for order in orders:
            order_discount = 0
            for line in order.lines:
                if line.discount > 0:
                    order_discount += line.price_unit * line.qty * line.discount / 100
            
            if order_discount > 0:
                total_discount += order_discount
                discount_orders += 1
        
        return {
            'total_discount': round(total_discount, 2),
            'discount_orders': discount_orders,
            'avg_discount': round(total_discount / discount_orders, 2) if discount_orders > 0 else 0,
            'discount_rate': round(discount_orders / len(orders) * 100, 2) if orders else 0
        }
    
    def _get_refund_summary(self, orders):
        """Get refund summary"""
        refunded_orders = orders.filtered(lambda o: o.amount_total < 0)
        
        return {
            'refund_count': len(refunded_orders),
            'refund_amount': abs(round(sum(refunded_orders.mapped('amount_total')), 2)),
            'refund_rate': round(len(refunded_orders) / len(orders) * 100, 2) if orders else 0
        }
    
    def _empty_report_structure(self):
        """Return empty report structure"""
        return {
            'report_info': {'type': 'empty', 'message': 'No data found for the selected period'},
            'summary': self._empty_summary(),
            'hourly_breakdown': [],
            'payment_methods': [],
            'products': [],
            'categories': [],
            'staff_performance': []
        }
    
    def _empty_summary(self):
        """Return empty summary structure"""
        return {
            'total_sales': 0,
            'net_sales': 0,
            'total_tax': 0,
            'total_orders': 0,
            'average_ticket': 0,
            'total_items': 0,
            'refund_amount': 0,
            'discount_amount': 0
        }
    
    def _get_orders_for_period(self, date_from, date_to, config_ids=None):
        """Get orders for a specific period"""
        domain = [
            ('date_order', '>=', date_from),
            ('date_order', '<=', date_to + timedelta(days=1)),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if config_ids:
            domain.append(('config_id', 'in', config_ids))
            
        return self.env['pos.order'].search(domain)
    
    def _calculate_gross_margin(self, orders):
        """Calculate gross margin percentage"""
        total_cost = 0
        total_revenue = 0
        
        for order in orders:
            for line in order.lines:
                cost = line.product_id.standard_price * line.qty
                revenue = line.price_subtotal
                total_cost += cost
                total_revenue += revenue
        
        return round((total_revenue - total_cost) / total_revenue * 100, 2) if total_revenue > 0 else 0
    
    def _calculate_week_trends(self, daily_reports):
        """Calculate week trends from daily data"""
        if len(daily_reports) < 2:
            return {}
            
        sales_trend = []
        for i, day in enumerate(daily_reports):
            if i > 0:
                prev_sales = daily_reports[i-1]['data']['summary']['total_sales']
                curr_sales = day['data']['summary']['total_sales']
                change = ((curr_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else 0
                sales_trend.append(change)
        
        return {
            'sales_trend': sales_trend,
            'avg_daily_growth': round(sum(sales_trend) / len(sales_trend), 2) if sales_trend else 0
        }
    
    def _get_weekly_comparison(self, week_start):
        """Get comparison with previous week"""
        prev_week_start = week_start - timedelta(days=7)
        prev_week_end = week_start - timedelta(days=1)
        
        prev_orders = self._get_orders_for_period(prev_week_start, prev_week_end)
        prev_summary = self._calculate_sales_summary(prev_orders)
        
        return {
            'previous_week': prev_summary,
            'period': f"{prev_week_start} to {prev_week_end}"
        }
    
    def _calculate_daily_averages(self, orders):
        """Calculate daily averages for the month"""
        if not orders:
            return {}
            
        # Group by date
        daily_sales = defaultdict(float)
        for order in orders:
            date = order.date_order.date()
            daily_sales[date] += order.amount_total
        
        days_with_sales = len(daily_sales)
        total_sales = sum(daily_sales.values())
        
        return {
            'avg_daily_sales': round(total_sales / days_with_sales, 2) if days_with_sales > 0 else 0,
            'best_day': max(daily_sales, key=daily_sales.get) if daily_sales else None,
            'worst_day': min(daily_sales, key=daily_sales.get) if daily_sales else None,
            'days_with_sales': days_with_sales
        }
    
    def _calculate_monthly_growth(self, month, year):
        """Calculate growth compared to previous month"""
        # Previous month calculation
        if month == 1:
            prev_month = 12
            prev_year = year - 1
        else:
            prev_month = month - 1
            prev_year = year
        
        prev_month_start = datetime(prev_year, prev_month, 1).date()
        if prev_month == 12:
            prev_month_end = datetime(prev_year + 1, 1, 1).date() - timedelta(days=1)
        else:
            prev_month_end = datetime(prev_year, prev_month + 1, 1).date() - timedelta(days=1)
        
        prev_orders = self._get_orders_for_period(prev_month_start, prev_month_end)
        prev_summary = self._calculate_sales_summary(prev_orders)
        
        return {
            'previous_month': prev_summary,
            'period': f"{prev_month_start.strftime('%B %Y')}"
        }
    
    def _get_monthly_top_performers(self, orders):
        """Get monthly top performers"""
        product_sales = self._get_product_sales(orders)
        staff_sales = self._get_staff_sales(orders)
        
        return {
            'top_product': product_sales[0] if product_sales else None,
            'top_staff': staff_sales[0] if staff_sales else None,
            'top_5_products': product_sales[:5],
            'top_5_staff': staff_sales[:5]
        }