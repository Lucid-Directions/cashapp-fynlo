from odoo import models, fields, api
from datetime import datetime, timedelta
from collections import defaultdict
import logging

_logger = logging.getLogger(__name__)

class ProductAnalytics(models.Model):
    _name = 'pos.product.analytics'
    _description = 'Product Performance Analytics Engine'
    
    product_id = fields.Many2one('product.product', 'Product', required=True)
    period_start = fields.Date('Period Start', required=True)
    period_end = fields.Date('Period End', required=True)
    
    # Sales metrics
    units_sold = fields.Integer('Units Sold')
    total_revenue = fields.Float('Total Revenue')
    avg_price = fields.Float('Average Price')
    total_cost = fields.Float('Total Cost')
    gross_profit = fields.Float('Gross Profit')
    margin_percent = fields.Float('Margin %')
    
    # Performance metrics
    sales_rank = fields.Integer('Sales Rank')
    revenue_rank = fields.Integer('Revenue Rank')
    velocity = fields.Float('Sales Velocity (units/day)')
    
    # Trend analysis
    trend_direction = fields.Selection([
        ('up', 'Trending Up'),
        ('down', 'Trending Down'),
        ('stable', 'Stable'),
        ('new', 'New Product')
    ], string='Trend Direction')
    trend_percentage = fields.Float('Trend %')
    
    # Customer insights
    unique_customers = fields.Integer('Unique Customers')
    repeat_rate = fields.Float('Repeat Purchase Rate %')
    avg_quantity_per_order = fields.Float('Avg Qty per Order')
    
    @api.model
    def analyze_product_performance(self, product_id=None, date_from=None, date_to=None, config_ids=None):
        """Comprehensive product performance analysis"""
        
        # Set defaults
        if not date_from:
            date_from = fields.Date.today() - timedelta(days=30)
        if not date_to:
            date_to = fields.Date.today()
            
        if product_id:
            return self._analyze_single_product(product_id, date_from, date_to, config_ids)
        else:
            return self._analyze_all_products(date_from, date_to, config_ids)
    
    def _analyze_single_product(self, product_id, date_from, date_to, config_ids=None):
        """Detailed analysis for a single product"""
        product = self.env['product.product'].browse(product_id)
        
        # Get order lines for this product
        domain = [
            ('product_id', '=', product_id),
            ('order_id.date_order', '>=', date_from),
            ('order_id.date_order', '<=', date_to),
            ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if config_ids:
            domain.append(('order_id.config_id', 'in', config_ids))
            
        order_lines = self.env['pos.order.line'].search(domain)
        
        if not order_lines:
            return self._empty_product_analysis(product)
            
        # Basic metrics
        units_sold = sum(order_lines.mapped('qty'))
        total_revenue = sum(order_lines.mapped('price_subtotal_incl'))
        total_cost = product.standard_price * units_sold
        gross_profit = total_revenue - total_cost
        
        # Performance metrics
        days_in_period = (date_to - date_from).days + 1
        velocity = units_sold / days_in_period if days_in_period > 0 else 0
        
        # Customer insights
        unique_customers = len(set(order_lines.mapped('order_id.partner_id.id')))
        unique_orders = len(set(order_lines.mapped('order_id.id')))
        
        # Trend analysis
        trend_data = self._calculate_product_trend(product_id, date_from, date_to)
        
        # Peak hours analysis
        peak_hours = self._get_product_peak_hours(order_lines)
        
        # Combination analysis
        combinations = self._get_product_combinations(product_id, date_from, date_to)
        
        # Price optimization insights
        price_analysis = self._analyze_price_performance(order_lines)
        
        return {
            'product_info': {
                'id': product.id,
                'name': product.name,
                'category': product.pos_categ_id.name if product.pos_categ_id else 'Uncategorized',
                'current_price': product.list_price,
                'cost_price': product.standard_price
            },
            'sales_metrics': {
                'units_sold': int(units_sold),
                'total_revenue': round(total_revenue, 2),
                'avg_price': round(total_revenue / units_sold, 2) if units_sold > 0 else 0,
                'total_cost': round(total_cost, 2),
                'gross_profit': round(gross_profit, 2),
                'margin_percent': round(gross_profit / total_revenue * 100, 2) if total_revenue > 0 else 0
            },
            'performance_metrics': {
                'sales_velocity': round(velocity, 2),
                'unique_customers': unique_customers,
                'unique_orders': unique_orders,
                'avg_qty_per_order': round(units_sold / unique_orders, 2) if unique_orders > 0 else 0,
                'customer_loyalty': round(unique_orders / unique_customers, 2) if unique_customers > 0 else 0
            },
            'trend_analysis': trend_data,
            'peak_hours': peak_hours,
            'combinations': combinations,
            'price_analysis': price_analysis,
            'recommendations': self._generate_product_recommendations(product, order_lines, trend_data)
        }
    
    def _analyze_all_products(self, date_from, date_to, config_ids=None):
        """Analysis for all products with rankings"""
        
        # Get all order lines in period
        domain = [
            ('order_id.date_order', '>=', date_from),
            ('order_id.date_order', '<=', date_to),
            ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ]
        
        if config_ids:
            domain.append(('order_id.config_id', 'in', config_ids))
            
        order_lines = self.env['pos.order.line'].search(domain)
        
        if not order_lines:
            return {'products': [], 'summary': {}}
            
        # Aggregate by product
        product_data = defaultdict(lambda: {
            'name': '',
            'category': '',
            'units_sold': 0,
            'revenue': 0,
            'orders': set(),
            'customers': set(),
            'cost': 0
        })
        
        for line in order_lines:
            product_id = line.product_id.id
            product_data[product_id]['name'] = line.product_id.name
            product_data[product_id]['category'] = line.product_id.pos_categ_id.name if line.product_id.pos_categ_id else 'Uncategorized'
            product_data[product_id]['units_sold'] += line.qty
            product_data[product_id]['revenue'] += line.price_subtotal_incl
            product_data[product_id]['orders'].add(line.order_id.id)
            product_data[product_id]['customers'].add(line.order_id.partner_id.id if line.order_id.partner_id else None)
            product_data[product_id]['cost'] += line.product_id.standard_price * line.qty
        
        # Convert to list and calculate metrics
        products = []
        for product_id, data in product_data.items():
            units_sold = data['units_sold']
            revenue = data['revenue']
            cost = data['cost']
            
            product_metrics = {
                'product_id': product_id,
                'name': data['name'],
                'category': data['category'],
                'units_sold': int(units_sold),
                'revenue': round(revenue, 2),
                'avg_price': round(revenue / units_sold, 2) if units_sold > 0 else 0,
                'gross_profit': round(revenue - cost, 2),
                'margin_percent': round((revenue - cost) / revenue * 100, 2) if revenue > 0 else 0,
                'unique_orders': len(data['orders']),
                'unique_customers': len([c for c in data['customers'] if c is not None]),
                'velocity': round(units_sold / ((date_to - date_from).days + 1), 2)
            }
            products.append(product_metrics)
        
        # Sort by revenue and add rankings
        products.sort(key=lambda x: x['revenue'], reverse=True)
        for i, product in enumerate(products):
            product['revenue_rank'] = i + 1
        
        # Sort by units and add rankings
        products.sort(key=lambda x: x['units_sold'], reverse=True)
        for i, product in enumerate(products):
            product['units_rank'] = i + 1
        
        # Sort by margin and add rankings
        products.sort(key=lambda x: x['margin_percent'], reverse=True)
        for i, product in enumerate(products):
            product['margin_rank'] = i + 1
        
        # Categorize products
        categorized = self._categorize_products(products)
        
        # Summary statistics
        summary = {
            'total_products': len(products),
            'total_revenue': sum(p['revenue'] for p in products),
            'total_units': sum(p['units_sold'] for p in products),
            'avg_margin': round(sum(p['margin_percent'] for p in products) / len(products), 2) if products else 0,
            'top_revenue_product': products[0]['name'] if products else None,
            'categories': self._get_category_summary(products)
        }
        
        return {
            'products': sorted(products, key=lambda x: x['revenue'], reverse=True),
            'categorized_products': categorized,
            'summary': summary,
            'insights': self._generate_product_insights(products)
        }
    
    def _categorize_products(self, products):
        """Categorize products by performance"""
        if not products:
            return {'stars': [], 'performers': [], 'sleepers': [], 'dogs': []}
            
        # Sort by revenue for categorization
        sorted_products = sorted(products, key=lambda x: x['revenue'], reverse=True)
        total_products = len(sorted_products)
        
        # ABC Analysis
        stars = sorted_products[:int(total_products * 0.2)]  # Top 20%
        performers = sorted_products[int(total_products * 0.2):int(total_products * 0.6)]  # Next 40%
        sleepers = sorted_products[int(total_products * 0.6):int(total_products * 0.8)]  # Next 20%
        dogs = sorted_products[int(total_products * 0.8):]  # Bottom 20%
        
        return {
            'stars': stars,  # High revenue, keep promoting
            'performers': performers,  # Good revenue, maintain
            'sleepers': sleepers,  # Potential, needs attention
            'dogs': dogs  # Low revenue, consider removing
        }
    
    def _calculate_product_trend(self, product_id, date_from, date_to):
        """Calculate product sales trend"""
        # Split period into two halves
        period_days = (date_to - date_from).days + 1
        mid_point = date_from + timedelta(days=period_days // 2)
        
        # First half
        first_half_lines = self.env['pos.order.line'].search([
            ('product_id', '=', product_id),
            ('order_id.date_order', '>=', date_from),
            ('order_id.date_order', '<', mid_point),
            ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        # Second half
        second_half_lines = self.env['pos.order.line'].search([
            ('product_id', '=', product_id),
            ('order_id.date_order', '>=', mid_point),
            ('order_id.date_order', '<=', date_to),
            ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        first_half_qty = sum(first_half_lines.mapped('qty'))
        second_half_qty = sum(second_half_lines.mapped('qty'))
        
        if first_half_qty == 0:
            trend_direction = 'new' if second_half_qty > 0 else 'stable'
            trend_percentage = 0
        else:
            trend_percentage = ((second_half_qty - first_half_qty) / first_half_qty) * 100
            if trend_percentage > 10:
                trend_direction = 'up'
            elif trend_percentage < -10:
                trend_direction = 'down'
            else:
                trend_direction = 'stable'
        
        return {
            'direction': trend_direction,
            'percentage': round(trend_percentage, 2),
            'first_half_qty': int(first_half_qty),
            'second_half_qty': int(second_half_qty)
        }
    
    def _get_product_peak_hours(self, order_lines):
        """Get peak selling hours for a product"""
        hourly_sales = defaultdict(int)
        
        for line in order_lines:
            hour = line.order_id.date_order.hour
            hourly_sales[hour] += line.qty
        
        if not hourly_sales:
            return {'peak_hour': None, 'peak_qty': 0, 'hourly_breakdown': []}
        
        peak_hour = max(hourly_sales, key=hourly_sales.get)
        peak_qty = hourly_sales[peak_hour]
        
        hourly_breakdown = [
            {'hour': f"{hour:02d}:00", 'qty': qty}
            for hour, qty in sorted(hourly_sales.items())
        ]
        
        return {
            'peak_hour': f"{peak_hour:02d}:00",
            'peak_qty': int(peak_qty),
            'hourly_breakdown': hourly_breakdown
        }
    
    def _get_product_combinations(self, product_id, date_from, date_to):
        """Find products commonly bought together"""
        
        # Get orders containing this product
        orders_with_product = self.env['pos.order'].search([
            ('lines.product_id', '=', product_id),
            ('date_order', '>=', date_from),
            ('date_order', '<=', date_to),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        # Count combinations
        combination_count = defaultdict(int)
        
        for order in orders_with_product:
            other_products = order.lines.filtered(lambda l: l.product_id.id != product_id)
            for line in other_products:
                combination_count[line.product_id.id] += 1
        
        # Sort by frequency and get top 5
        combinations = []
        for prod_id, count in sorted(combination_count.items(), key=lambda x: x[1], reverse=True)[:5]:
            product = self.env['product.product'].browse(prod_id)
            frequency = round(count / len(orders_with_product) * 100, 2) if orders_with_product else 0
            
            combinations.append({
                'product_id': prod_id,
                'product_name': product.name,
                'frequency_count': count,
                'frequency_percent': frequency
            })
        
        return combinations
    
    def _analyze_price_performance(self, order_lines):
        """Analyze price performance and optimization opportunities"""
        if not order_lines:
            return {'analysis': 'No data available'}
        
        prices = order_lines.mapped('price_unit')
        quantities = order_lines.mapped('qty')
        
        avg_price = sum(prices) / len(prices) if prices else 0
        price_variance = max(prices) - min(prices) if prices else 0
        
        # Price elasticity estimation (simplified)
        high_price_lines = order_lines.filtered(lambda l: l.price_unit > avg_price)
        low_price_lines = order_lines.filtered(lambda l: l.price_unit <= avg_price)
        
        high_price_avg_qty = sum(high_price_lines.mapped('qty')) / len(high_price_lines) if high_price_lines else 0
        low_price_avg_qty = sum(low_price_lines.mapped('qty')) / len(low_price_lines) if low_price_lines else 0
        
        return {
            'avg_price': round(avg_price, 2),
            'min_price': round(min(prices), 2) if prices else 0,
            'max_price': round(max(prices), 2) if prices else 0,
            'price_variance': round(price_variance, 2),
            'high_price_avg_qty': round(high_price_avg_qty, 2),
            'low_price_avg_qty': round(low_price_avg_qty, 2),
            'elasticity_indicator': 'price_sensitive' if low_price_avg_qty > high_price_avg_qty * 1.2 else 'price_insensitive'
        }
    
    def _generate_product_recommendations(self, product, order_lines, trend_data):
        """Generate actionable recommendations for a product"""
        recommendations = []
        
        # Revenue analysis
        total_revenue = sum(order_lines.mapped('price_subtotal_incl'))
        units_sold = sum(order_lines.mapped('qty'))
        
        if units_sold > 0:
            avg_price = total_revenue / units_sold
            
            # Price recommendations
            if product.list_price < avg_price * 0.9:
                recommendations.append({
                    'type': 'pricing',
                    'priority': 'high',
                    'message': f'Consider increasing price from {product.list_price} to {round(avg_price, 2)} based on sales data'
                })
            
            # Trend recommendations
            if trend_data['direction'] == 'up':
                recommendations.append({
                    'type': 'promotion',
                    'priority': 'medium',
                    'message': 'Product is trending up, consider featuring in promotions'
                })
            elif trend_data['direction'] == 'down':
                recommendations.append({
                    'type': 'attention',
                    'priority': 'high',
                    'message': 'Product sales declining, investigate and consider action'
                })
            
            # Volume recommendations
            if units_sold < 10:  # Configurable threshold
                recommendations.append({
                    'type': 'inventory',
                    'priority': 'low',
                    'message': 'Low sales volume, consider reducing inventory or removing from menu'
                })
        
        return recommendations
    
    def _get_category_summary(self, products):
        """Get summary by category"""
        categories = defaultdict(lambda: {'revenue': 0, 'units': 0, 'products': 0})
        
        for product in products:
            category = product['category']
            categories[category]['revenue'] += product['revenue']
            categories[category]['units'] += product['units_sold']
            categories[category]['products'] += 1
        
        return [
            {
                'category': category,
                'total_revenue': round(data['revenue'], 2),
                'total_units': data['units'],
                'product_count': data['products'],
                'avg_revenue_per_product': round(data['revenue'] / data['products'], 2) if data['products'] > 0 else 0
            }
            for category, data in categories.items()
        ]
    
    def _generate_product_insights(self, products):
        """Generate business insights from product data"""
        if not products:
            return []
        
        insights = []
        
        # Revenue concentration
        top_20_percent = int(len(products) * 0.2)
        top_20_revenue = sum(p['revenue'] for p in products[:top_20_percent])
        total_revenue = sum(p['revenue'] for p in products)
        
        if top_20_revenue / total_revenue > 0.8:
            insights.append({
                'type': 'concentration',
                'message': f'Top 20% of products generate {round(top_20_revenue/total_revenue*100, 1)}% of revenue',
                'recommendation': 'Focus marketing efforts on top performers'
            })
        
        # Margin analysis
        high_margin_products = [p for p in products if p['margin_percent'] > 50]
        if len(high_margin_products) > 0:
            insights.append({
                'type': 'margin',
                'message': f'{len(high_margin_products)} products have margins above 50%',
                'recommendation': 'Promote high-margin products to increase profitability'
            })
        
        # Slow movers
        slow_movers = [p for p in products if p['units_sold'] < 5]  # Configurable threshold
        if len(slow_movers) > len(products) * 0.3:
            insights.append({
                'type': 'inventory',
                'message': f'{len(slow_movers)} products are slow movers',
                'recommendation': 'Review menu to remove underperforming items'
            })
        
        return insights
    
    def _empty_product_analysis(self, product):
        """Return empty analysis structure"""
        return {
            'product_info': {
                'id': product.id,
                'name': product.name,
                'category': product.pos_categ_id.name if product.pos_categ_id else 'Uncategorized',
                'current_price': product.list_price,
                'cost_price': product.standard_price
            },
            'sales_metrics': {
                'units_sold': 0,
                'total_revenue': 0,
                'avg_price': 0,
                'total_cost': 0,
                'gross_profit': 0,
                'margin_percent': 0
            },
            'message': 'No sales data found for the selected period'
        }
    
    @api.model
    def get_abc_analysis(self, date_from=None, date_to=None, config_ids=None):
        """Perform ABC analysis on all products"""
        analysis = self._analyze_all_products(date_from, date_to, config_ids)
        
        if not analysis['products']:
            return {'error': 'No data available for ABC analysis'}
        
        products = analysis['products']
        total_revenue = sum(p['revenue'] for p in products)
        
        # Calculate cumulative revenue percentage
        cumulative_revenue = 0
        for product in products:
            cumulative_revenue += product['revenue']
            product['cumulative_percentage'] = round(cumulative_revenue / total_revenue * 100, 2)
        
        # Classify products
        a_products = [p for p in products if p['cumulative_percentage'] <= 80]
        b_products = [p for p in products if 80 < p['cumulative_percentage'] <= 95]
        c_products = [p for p in products if p['cumulative_percentage'] > 95]
        
        return {
            'classification': {
                'A_products': {
                    'products': a_products,
                    'count': len(a_products),
                    'revenue_percentage': round(sum(p['revenue'] for p in a_products) / total_revenue * 100, 2)
                },
                'B_products': {
                    'products': b_products,
                    'count': len(b_products),
                    'revenue_percentage': round(sum(p['revenue'] for p in b_products) / total_revenue * 100, 2)
                },
                'C_products': {
                    'products': c_products,
                    'count': len(c_products),
                    'revenue_percentage': round(sum(p['revenue'] for p in c_products) / total_revenue * 100, 2)
                }
            },
            'recommendations': {
                'A_products': 'Focus on maintaining and growing these high-value products',
                'B_products': 'Monitor performance and consider promotions to move to A category',
                'C_products': 'Evaluate if these products should remain on the menu'
            }
        }