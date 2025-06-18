# -*- coding: utf-8 -*-

from odoo import http
from odoo.http import request
from datetime import datetime, timedelta
import json
import logging

_logger = logging.getLogger(__name__)

class POSAnalyticsController(http.Controller):
    
    @http.route('/pos_analytics/dashboard_data', type='json', auth='user')
    def get_dashboard_data(self, date_range='today', date_from=None, date_to=None, **kwargs):
        """Get comprehensive dashboard data for the analytics dashboard"""
        try:
            # Calculate date range
            if date_range == 'today':
                date_from = date_to = datetime.now().date()
            elif date_range == 'yesterday':
                date_from = date_to = datetime.now().date() - timedelta(days=1)
            elif date_range == 'this_week':
                today = datetime.now().date()
                date_from = today - timedelta(days=today.weekday())
                date_to = today
            elif date_range == 'last_week':
                today = datetime.now().date()
                date_from = today - timedelta(days=today.weekday() + 7)
                date_to = date_from + timedelta(days=6)
            elif date_range == 'this_month':
                today = datetime.now().date()
                date_from = today.replace(day=1)
                date_to = today
            elif date_range == 'last_month':
                today = datetime.now().date()
                first_day = today.replace(day=1)
                date_to = first_day - timedelta(days=1)
                date_from = date_to.replace(day=1)
            elif date_range == 'custom' and date_from and date_to:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
            else:
                date_from = date_to = datetime.now().date()
            
            # Get dashboard data from models
            dashboard_model = request.env['pos.analytics.dashboard']
            sales_model = request.env['pos.sales.report']
            product_model = request.env['pos.product.analytics']
            staff_model = request.env['pos.staff.performance']
            financial_model = request.env['pos.financial.analytics']
            
            # Get summary data
            summary_data = self._get_summary_data(date_from, date_to)
            
            # Get sales trends
            sales_trends = self._get_sales_trends(date_from, date_to)
            
            # Get hourly breakdown
            hourly_breakdown = self._get_hourly_breakdown(date_from, date_to)
            
            # Get payment methods data
            payment_methods = self._get_payment_methods_data(date_from, date_to)
            
            # Get staff performance data
            staff_performance = self._get_staff_performance_data(date_from, date_to)
            
            # Get product performance data
            product_performance = self._get_product_performance_data(date_from, date_to)
            
            # Get financial metrics
            financial_metrics = self._get_financial_metrics_data(date_from, date_to)
            
            # Get alerts
            alerts = self._get_alerts_data(date_from, date_to)
            
            return {
                'summary': summary_data,
                'sales_trends': sales_trends,
                'hourly_breakdown': hourly_breakdown,
                'payment_methods': payment_methods,
                'staff_performance': staff_performance,
                'product_performance': product_performance,
                'financial_metrics': financial_metrics,
                'alerts': alerts,
                'date_range': {
                    'from': date_from.strftime('%Y-%m-%d'),
                    'to': date_to.strftime('%Y-%m-%d')
                }
            }
            
        except Exception as e:
            _logger.error(f"Error getting dashboard data: {str(e)}")
            return {'error': str(e)}
    
    def _get_summary_data(self, date_from, date_to):
        """Get summary metrics for the dashboard"""
        # Get orders in date range
        orders = request.env['pos.order'].search([
            ('date_order', '>=', f"{date_from} 00:00:00"),
            ('date_order', '<=', f"{date_to} 23:59:59"),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        # Calculate metrics
        total_sales = sum(orders.mapped('amount_total'))
        total_orders = len(orders)
        avg_order_value = total_sales / total_orders if total_orders > 0 else 0
        total_customers = len(orders.mapped('partner_id').filtered(lambda p: p))
        
        # Get comparison data (previous period)
        period_days = (date_to - date_from).days + 1
        prev_date_from = date_from - timedelta(days=period_days)
        prev_date_to = date_from - timedelta(days=1)
        
        prev_orders = request.env['pos.order'].search([
            ('date_order', '>=', f"{prev_date_from} 00:00:00"),
            ('date_order', '<=', f"{prev_date_to} 23:59:59"),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        prev_sales = sum(prev_orders.mapped('amount_total'))
        prev_order_count = len(prev_orders)
        prev_aov = prev_sales / prev_order_count if prev_order_count > 0 else 0
        prev_customers = len(prev_orders.mapped('partner_id').filtered(lambda p: p))
        
        # Calculate changes
        sales_change = ((total_sales - prev_sales) / prev_sales * 100) if prev_sales > 0 else 0
        orders_change = ((total_orders - prev_order_count) / prev_order_count * 100) if prev_order_count > 0 else 0
        aov_change = ((avg_order_value - prev_aov) / prev_aov * 100) if prev_aov > 0 else 0
        customers_change = ((total_customers - prev_customers) / prev_customers * 100) if prev_customers > 0 else 0
        
        return {
            'total_sales': total_sales,
            'total_orders': total_orders,
            'avg_order_value': avg_order_value,
            'total_customers': total_customers,
            'sales_change': sales_change,
            'orders_change': orders_change,
            'aov_change': aov_change,
            'customers_change': customers_change
        }
    
    def _get_sales_trends(self, date_from, date_to):
        """Get sales trends data for charts"""
        # Generate date range
        current_date = date_from
        labels = []
        sales_data = []
        orders_data = []
        
        while current_date <= date_to:
            labels.append(current_date.strftime('%Y-%m-%d'))
            
            # Get orders for this date
            orders = request.env['pos.order'].search([
                ('date_order', '>=', f"{current_date} 00:00:00"),
                ('date_order', '<=', f"{current_date} 23:59:59"),
                ('state', 'in', ['paid', 'done', 'invoiced'])
            ])
            
            sales_data.append(sum(orders.mapped('amount_total')))
            orders_data.append(len(orders))
            
            current_date += timedelta(days=1)
        
        return {
            'labels': labels,
            'sales': sales_data,
            'orders': orders_data
        }
    
    def _get_hourly_breakdown(self, date_from, date_to):
        """Get hourly sales breakdown"""
        hourly_data = {}
        
        # Initialize hours
        for hour in range(24):
            hourly_data[hour] = 0
        
        # Get orders in date range
        orders = request.env['pos.order'].search([
            ('date_order', '>=', f"{date_from} 00:00:00"),
            ('date_order', '<=', f"{date_to} 23:59:59"),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        # Group by hour
        for order in orders:
            hour = order.date_order.hour
            hourly_data[hour] += order.amount_total
        
        return {
            'hours': [f"{hour:02d}:00" for hour in range(24)],
            'sales': list(hourly_data.values())
        }
    
    def _get_payment_methods_data(self, date_from, date_to):
        """Get payment methods distribution"""
        payments = request.env['pos.payment'].search([
            ('pos_order_id.date_order', '>=', f"{date_from} 00:00:00"),
            ('pos_order_id.date_order', '<=', f"{date_to} 23:59:59"),
            ('pos_order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        cash_total = card_total = digital_total = 0
        
        for payment in payments:
            if payment.payment_method_id.is_cash_count:
                cash_total += payment.amount
            elif payment.payment_method_id.use_payment_terminal:
                card_total += payment.amount
            else:
                digital_total += payment.amount
        
        return {
            'labels': ['Cash', 'Card', 'Digital'],
            'values': [cash_total, card_total, digital_total]
        }
    
    def _get_staff_performance_data(self, date_from, date_to):
        """Get staff performance data for charts"""
        staff_records = request.env['pos.staff.performance'].search([
            ('date', '>=', date_from),
            ('date', '<=', date_to)
        ])
        
        # Group by employee
        employee_data = {}
        for record in staff_records:
            emp_name = record.employee_id.name
            if emp_name not in employee_data:
                employee_data[emp_name] = []
            employee_data[emp_name].append(record.overall_performance_score)
        
        # Calculate averages
        employees = []
        scores = []
        for emp_name, score_list in employee_data.items():
            employees.append(emp_name)
            scores.append(sum(score_list) / len(score_list))
        
        return {
            'employees': employees,
            'scores': scores
        }
    
    def _get_product_performance_data(self, date_from, date_to):
        """Get top products performance data"""
        order_lines = request.env['pos.order.line'].search([
            ('order_id.date_order', '>=', f"{date_from} 00:00:00"),
            ('order_id.date_order', '<=', f"{date_to} 23:59:59"),
            ('order_id.state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        # Group by product
        product_data = {}
        for line in order_lines:
            product = line.product_id
            if product.id not in product_data:
                product_data[product.id] = {
                    'name': product.name,
                    'qty': 0,
                    'revenue': 0
                }
            product_data[product.id]['qty'] += line.qty
            product_data[product.id]['revenue'] += line.price_subtotal_incl
        
        # Sort by revenue and get top 10
        sorted_products = sorted(product_data.values(), key=lambda x: x['revenue'], reverse=True)[:10]
        
        return {
            'products': [p['name'] for p in sorted_products],
            'quantities': [p['qty'] for p in sorted_products],
            'revenues': [p['revenue'] for p in sorted_products]
        }
    
    def _get_financial_metrics_data(self, date_from, date_to):
        """Get financial metrics data"""
        financial_records = request.env['pos.financial.analytics'].search([
            ('date', '>=', date_from),
            ('date', '<=', date_to)
        ])
        
        if not financial_records:
            # Generate basic data if no financial records exist
            return {
                'periods': [date_from.strftime('%Y-%m-%d')],
                'revenue': [0],
                'profit': [0]
            }
        
        return {
            'periods': [record.date.strftime('%Y-%m-%d') for record in financial_records],
            'revenue': [record.gross_revenue for record in financial_records],
            'profit': [record.gross_profit for record in financial_records]
        }
    
    def _get_alerts_data(self, date_from, date_to):
        """Get alerts and notifications"""
        alerts = []
        
        # Check for low sales
        orders = request.env['pos.order'].search([
            ('date_order', '>=', f"{date_from} 00:00:00"),
            ('date_order', '<=', f"{date_to} 23:59:59"),
            ('state', 'in', ['paid', 'done', 'invoiced'])
        ])
        
        total_sales = sum(orders.mapped('amount_total'))
        
        if total_sales < 1000:  # Example threshold
            alerts.append({
                'title': 'Low Sales Alert',
                'message': f'Sales for the selected period (${total_sales:.2f}) are below expected threshold.'
            })
        
        # Check for staff performance issues
        staff_records = request.env['pos.staff.performance'].search([
            ('date', '>=', date_from),
            ('date', '<=', date_to),
            ('performance_grade', '=', 'poor')
        ])
        
        if staff_records:
            alerts.append({
                'title': 'Staff Performance Alert',
                'message': f'{len(staff_records)} staff members have poor performance ratings.'
            })
        
        return alerts
    
    @http.route('/pos_analytics/staff_performance_data', type='json', auth='user')
    def get_staff_performance_data(self, employee_ids=None, date_from=None, date_to=None, **kwargs):
        """Get staff performance data for staff dashboard"""
        try:
            # Parse dates
            if date_from:
                date_from = datetime.strptime(date_from, '%Y-%m-%d').date()
            else:
                date_from = datetime.now().date() - timedelta(days=7)
                
            if date_to:
                date_to = datetime.strptime(date_to, '%Y-%m-%d').date()
            else:
                date_to = datetime.now().date()
            
            # Get staff performance data
            staff_model = request.env['pos.staff.performance']
            data = staff_model.get_staff_performance_dashboard_data(
                date_from=date_from,
                date_to=date_to,
                employee_ids=employee_ids
            )
            
            # Get available employees
            employees = request.env['hr.employee'].search([('active', '=', True)])
            data['employees'] = [
                {'id': emp.id, 'name': emp.name}
                for emp in employees
            ]
            
            return data
            
        except Exception as e:
            _logger.error(f"Error getting staff performance data: {str(e)}")
            return {'error': str(e)}
    
    @http.route('/pos_analytics/export_dashboard', type='json', auth='user')
    def export_dashboard(self, date_range='today', date_from=None, date_to=None, format='pdf', **kwargs):
        """Export dashboard data to PDF or Excel"""
        try:
            # Get dashboard data
            data = self.get_dashboard_data(date_range, date_from, date_to)
            
            if format == 'pdf':
                # Generate PDF report
                report = request.env.ref('pos_analytics_reporting.action_report_dashboard')
                pdf, _ = report._render_qweb_pdf([], data={'data': data})
                
                # Return PDF as base64
                import base64
                pdf_base64 = base64.b64encode(pdf).decode()
                
                return {
                    'type': 'ir.actions.report',
                    'report_type': 'qweb-pdf',
                    'data': pdf_base64,
                    'filename': f'pos_dashboard_{date_from or "today"}.pdf'
                }
            
            elif format == 'excel':
                # Generate Excel report (basic implementation)
                import io
                from xlsxwriter import Workbook
                
                output = io.BytesIO()
                workbook = Workbook(output)
                worksheet = workbook.add_worksheet('Dashboard Summary')
                
                # Write data to Excel
                row = 0
                worksheet.write(row, 0, 'POS Analytics Dashboard')
                row += 2
                
                # Summary data
                summary = data.get('summary', {})
                worksheet.write(row, 0, 'Total Sales:')
                worksheet.write(row, 1, summary.get('total_sales', 0))
                row += 1
                
                worksheet.write(row, 0, 'Total Orders:')
                worksheet.write(row, 1, summary.get('total_orders', 0))
                row += 1
                
                worksheet.write(row, 0, 'Avg Order Value:')
                worksheet.write(row, 1, summary.get('avg_order_value', 0))
                row += 1
                
                workbook.close()
                output.seek(0)
                
                import base64
                excel_base64 = base64.b64encode(output.read()).decode()
                
                return {
                    'type': 'ir.actions.report',
                    'report_type': 'xlsx',
                    'data': excel_base64,
                    'filename': f'pos_dashboard_{date_from or "today"}.xlsx'
                }
            
        except Exception as e:
            _logger.error(f"Error exporting dashboard: {str(e)}")
            return {'error': str(e)} 