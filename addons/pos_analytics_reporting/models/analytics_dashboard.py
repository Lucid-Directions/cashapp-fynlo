from odoo import models, fields, api
from datetime import datetime, timedelta
import json
import logging
from collections import defaultdict

_logger = logging.getLogger(__name__)

class AnalyticsDashboard(models.Model):
    _name = 'pos.analytics.dashboard'
    _description = 'Real-time POS Analytics Dashboard'
    _order = 'create_date desc'

    name = fields.Char(string='Dashboard Name', required=True)
    user_id = fields.Many2one('res.users', string='User', default=lambda self: self.env.user)
    pos_config_ids = fields.Many2many('pos.config', string='POS Configurations')
    widget_config = fields.Text(string='Widget Configuration', default='{}')
    is_default = fields.Boolean(string='Default Dashboard', default=False)
    refresh_interval = fields.Integer(string='Refresh Interval (seconds)', default=30)
    
    @api.model
    def get_realtime_metrics(self, config_ids=None, date_from=None, date_to=None):
        """Get comprehensive real-time dashboard metrics"""
        try:
            # Set default date range (today)
            if not date_from:
                date_from = fields.Date.today()
            if not date_to:
                date_to = fields.Date.today()
                
            # Build domain for orders
            domain = [
                ('date_order', '>=', date_from),
                ('date_order', '<=', date_to),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ]
            
            if config_ids:
                domain.append(('config_id', 'in', config_ids))
                
            orders = self.env['pos.order'].search(domain)
            
            return {
                'sales_metrics': self._get_sales_metrics(orders, date_from, date_to),
                'order_metrics': self._get_order_metrics(orders),
                'product_metrics': self._get_product_metrics(orders),
                'payment_metrics': self._get_payment_metrics(orders),
                'staff_metrics': self._get_staff_metrics(orders),
                'hourly_sales': self._get_hourly_sales(orders),
                'comparison_data': self._get_comparison_data(orders, date_from),
                'kpi_summary': self._get_kpi_summary(orders),
                'alerts': self._get_dashboard_alerts(orders),
                'last_updated': datetime.now().isoformat(),
                'data_range': {
                    'from': str(date_from),
                    'to': str(date_to),
                    'orders_count': len(orders)
                }
            }
        except Exception as e:
            _logger.error(f"Error generating dashboard metrics: {str(e)}")
            return {'error': str(e)}
    
    def _get_sales_metrics(self, orders, date_from, date_to):
        """Calculate comprehensive sales metrics"""
        if not orders:
            return {
                'total_sales': 0,
                'total_orders': 0,
                'average_ticket': 0,
                'sales_growth': 0,
                'gross_margin': 0
            }
            
        total_sales = sum(orders.mapped('amount_total'))
        total_tax = sum(orders.mapped('amount_tax'))
        total_orders = len(orders)
        
        # Calculate previous period for comparison
        period_diff = (date_to - date_from).days + 1
        prev_date_from = date_from - timedelta(days=period_diff)
        prev_date_to = date_from - timedelta(days=1)
        
        prev_orders = self.env['pos.order'].search([
            ('date_order', '>=', prev_date_from),
            ('date_order', '<=', prev_date_to),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        prev_sales = sum(prev_orders.mapped('amount_total')) if prev_orders else 0
        sales_growth = ((total_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else 0
        
        return {
            'total_sales': round(total_sales, 2),
            'total_orders': total_orders,
            'average_ticket': round(total_sales / total_orders, 2) if total_orders > 0 else 0,
            'sales_growth': round(sales_growth, 2),
            'total_tax': round(total_tax, 2),
            'net_sales': round(total_sales - total_tax, 2),
            'sales_target': self._get_sales_target(date_from, date_to),
            'target_achievement': self._calculate_target_achievement(total_sales, date_from, date_to)
        }
    
    def _get_order_metrics(self, orders):
        """Calculate order-related metrics"""
        if not orders:
            return {
                'total_orders': 0,
                'orders_per_hour': 0,
                'average_items_per_order': 0,
                'return_rate': 0
            }
            
        total_items = sum(len(order.lines) for order in orders)
        
        # Calculate orders per hour
        if orders:
            first_order = min(orders.mapped('date_order'))
            last_order = max(orders.mapped('date_order'))
            hours_diff = (last_order - first_order).total_seconds() / 3600
            orders_per_hour = len(orders) / hours_diff if hours_diff > 0 else len(orders)
        else:
            orders_per_hour = 0
            
        # Calculate return/refund rate
        refunded_orders = orders.filtered(lambda o: o.amount_total < 0)
        return_rate = (len(refunded_orders) / len(orders) * 100) if orders else 0
        
        return {
            'total_orders': len(orders),
            'orders_per_hour': round(orders_per_hour, 2),
            'average_items_per_order': round(total_items / len(orders), 2) if orders else 0,
            'return_rate': round(return_rate, 2),
            'refunded_orders': len(refunded_orders),
            'largest_order': max(orders.mapped('amount_total')) if orders else 0,
            'smallest_order': min(orders.mapped('amount_total')) if orders else 0
        }
    
    def _get_product_metrics(self, orders):
        """Get top products and category performance"""
        if not orders:
            return {'top_products': [], 'category_performance': []}
            
        # Aggregate product sales
        product_sales = defaultdict(lambda: {'qty': 0, 'amount': 0, 'name': ''})
        category_sales = defaultdict(lambda: {'qty': 0, 'amount': 0, 'name': ''})
        
        for order in orders:
            for line in order.lines:
                product_id = line.product_id.id
                product_sales[product_id]['qty'] += line.qty
                product_sales[product_id]['amount'] += line.price_subtotal_incl
                product_sales[product_id]['name'] = line.product_id.name
                
                # Category aggregation
                if line.product_id.pos_categ_id:
                    cat_id = line.product_id.pos_categ_id.id
                    category_sales[cat_id]['qty'] += line.qty
                    category_sales[cat_id]['amount'] += line.price_subtotal_incl
                    category_sales[cat_id]['name'] = line.product_id.pos_categ_id.name
        
        # Sort by amount and get top 10
        top_products = sorted(
            [{'id': k, **v} for k, v in product_sales.items()],
            key=lambda x: x['amount'],
            reverse=True
        )[:10]
        
        top_categories = sorted(
            [{'id': k, **v} for k, v in category_sales.items()],
            key=lambda x: x['amount'],
            reverse=True
        )[:5]
        
        return {
            'top_products': top_products,
            'category_performance': top_categories,
            'total_products_sold': sum(p['qty'] for p in product_sales.values()),
            'unique_products': len(product_sales)
        }
    
    def _get_payment_metrics(self, orders):
        """Get payment method breakdown"""
        if not orders:
            return {'payment_methods': [], 'cash_vs_card': {}}
            
        payment_breakdown = defaultdict(lambda: {'count': 0, 'amount': 0})
        
        for order in orders:
            for payment in order.payment_ids:
                method = payment.payment_method_id.name
                payment_breakdown[method]['count'] += 1
                payment_breakdown[method]['amount'] += payment.amount
        
        payment_methods = [
            {
                'method': method,
                'count': data['count'],
                'amount': round(data['amount'], 2),
                'percentage': round(data['amount'] / sum(orders.mapped('amount_total')) * 100, 2) if orders else 0
            }
            for method, data in payment_breakdown.items()
        ]
        
        # Calculate cash vs card ratio
        total_amount = sum(orders.mapped('amount_total'))
        cash_amount = sum(
            payment_breakdown.get(method, {'amount': 0})['amount']
            for method in ['Cash', 'cash', 'Cash Payment']
        )
        card_amount = total_amount - cash_amount
        
        return {
            'payment_methods': sorted(payment_methods, key=lambda x: x['amount'], reverse=True),
            'cash_vs_card': {
                'cash_amount': round(cash_amount, 2),
                'card_amount': round(card_amount, 2),
                'cash_percentage': round(cash_amount / total_amount * 100, 2) if total_amount > 0 else 0,
                'card_percentage': round(card_amount / total_amount * 100, 2) if total_amount > 0 else 0
            }
        }
    
    def _get_staff_metrics(self, orders):
        """Get staff performance metrics"""
        if not orders:
            return {'staff_performance': [], 'top_performer': None}
            
        staff_performance = defaultdict(lambda: {
            'name': '',
            'orders_count': 0,
            'total_sales': 0,
            'average_ticket': 0
        })
        
        for order in orders:
            if order.user_id:
                user_id = order.user_id.id
                staff_performance[user_id]['name'] = order.user_id.name
                staff_performance[user_id]['orders_count'] += 1
                staff_performance[user_id]['total_sales'] += order.amount_total
        
        # Calculate averages and sort
        staff_list = []
        for user_id, data in staff_performance.items():
            data['average_ticket'] = round(
                data['total_sales'] / data['orders_count'], 2
            ) if data['orders_count'] > 0 else 0
            data['user_id'] = user_id
            staff_list.append(data)
        
        staff_list.sort(key=lambda x: x['total_sales'], reverse=True)
        
        return {
            'staff_performance': staff_list,
            'top_performer': staff_list[0] if staff_list else None,
            'total_staff': len(staff_list)
        }
    
    def _get_hourly_sales(self, orders):
        """Get hourly sales breakdown"""
        hourly_data = defaultdict(lambda: {'sales': 0, 'orders': 0})
        
        for order in orders:
            hour = order.date_order.hour
            hourly_data[hour]['sales'] += order.amount_total
            hourly_data[hour]['orders'] += 1
        
        # Create 24-hour format
        hourly_sales = []
        for hour in range(24):
            hourly_sales.append({
                'hour': f"{hour:02d}:00",
                'sales': round(hourly_data[hour]['sales'], 2),
                'orders': hourly_data[hour]['orders']
            })
        
        return hourly_sales
    
    def _get_comparison_data(self, orders, current_date):
        """Get comparison with previous periods"""
        if not orders:
            return {'yesterday': 0, 'last_week': 0, 'last_month': 0}
            
        current_sales = sum(orders.mapped('amount_total'))
        
        # Yesterday
        yesterday = current_date - timedelta(days=1)
        yesterday_orders = self.env['pos.order'].search([
            ('date_order', '>=', yesterday),
            ('date_order', '<', current_date),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        yesterday_sales = sum(yesterday_orders.mapped('amount_total'))
        
        # Last week same day
        last_week = current_date - timedelta(days=7)
        last_week_orders = self.env['pos.order'].search([
            ('date_order', '>=', last_week),
            ('date_order', '<', last_week + timedelta(days=1)),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        last_week_sales = sum(last_week_orders.mapped('amount_total'))
        
        return {
            'yesterday': {
                'sales': round(yesterday_sales, 2),
                'change': round(((current_sales - yesterday_sales) / yesterday_sales * 100), 2) if yesterday_sales > 0 else 0
            },
            'last_week': {
                'sales': round(last_week_sales, 2),
                'change': round(((current_sales - last_week_sales) / last_week_sales * 100), 2) if last_week_sales > 0 else 0
            }
        }
    
    def _get_kpi_summary(self, orders):
        """Get key performance indicators summary"""
        if not orders:
            return {}
            
        total_sales = sum(orders.mapped('amount_total'))
        total_orders = len(orders)
        
        return {
            'revenue_per_customer': round(total_sales / total_orders, 2) if total_orders > 0 else 0,
            'orders_per_hour': self._calculate_orders_per_hour(orders),
            'conversion_rate': 100,  # Assuming all POS interactions result in orders
            'customer_satisfaction': self._get_customer_satisfaction_score()
        }
    
    def _get_dashboard_alerts(self, orders):
        """Generate dashboard alerts for important events"""
        alerts = []
        
        # Low sales alert
        if orders:
            avg_sales = sum(orders.mapped('amount_total')) / len(orders)
            if avg_sales < 10:  # Configurable threshold
                alerts.append({
                    'type': 'warning',
                    'message': 'Average ticket size is below threshold',
                    'severity': 'medium'
                })
        
        # High refund rate alert
        refunded_orders = orders.filtered(lambda o: o.amount_total < 0)
        if len(refunded_orders) > len(orders) * 0.05:  # More than 5% refunds
            alerts.append({
                'type': 'error',
                'message': 'High refund rate detected',
                'severity': 'high'
            })
        
        return alerts
    
    def _get_sales_target(self, date_from, date_to):
        """Get sales target for the period"""
        # This would typically come from a sales target model
        # For now, return a sample target
        return 5000.0
    
    def _calculate_target_achievement(self, actual_sales, date_from, date_to):
        """Calculate target achievement percentage"""
        target = self._get_sales_target(date_from, date_to)
        return round((actual_sales / target * 100), 2) if target > 0 else 0
    
    def _calculate_orders_per_hour(self, orders):
        """Calculate orders per hour for the period"""
        if not orders:
            return 0
            
        first_order = min(orders.mapped('date_order'))
        last_order = max(orders.mapped('date_order'))
        hours = (last_order - first_order).total_seconds() / 3600
        
        return round(len(orders) / hours, 2) if hours > 0 else len(orders)
    
    def _get_customer_satisfaction_score(self):
        """Get customer satisfaction score (placeholder)"""
        # This would integrate with a customer feedback system
        return 4.5  # Out of 5
    
    @api.model
    def get_dashboard_config(self, user_id=None):
        """Get dashboard configuration for user"""
        if not user_id:
            user_id = self.env.user.id
            
        dashboard = self.search([
            ('user_id', '=', user_id),
            ('is_default', '=', True)
        ], limit=1)
        
        if not dashboard:
            # Create default dashboard
            dashboard = self.create({
                'name': 'Default Dashboard',
                'user_id': user_id,
                'is_default': True,
                'widget_config': json.dumps({
                    'widgets': [
                        {'type': 'sales_summary', 'position': 1, 'size': 'large'},
                        {'type': 'top_products', 'position': 2, 'size': 'medium'},
                        {'type': 'hourly_sales', 'position': 3, 'size': 'large'},
                        {'type': 'payment_methods', 'position': 4, 'size': 'medium'},
                        {'type': 'staff_performance', 'position': 5, 'size': 'medium'}
                    ]
                })
            })
        
        return {
            'dashboard_id': dashboard.id,
            'name': dashboard.name,
            'widgets': json.loads(dashboard.widget_config),
            'refresh_interval': dashboard.refresh_interval
        }