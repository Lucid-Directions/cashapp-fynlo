"""
Report Aggregation Service
Generates and populates DailyReport and HourlyMetric models from actual order data
"""TODO: Add docstring."""

from datetime import datetime, date, timedelta
from decimal import Decimal
from typing import Dict, List, Optional
from sqlalchemy.orm import Session
from sqlalchemy import func, and_, or_
import logging

from app.core.database import Order, OrderItem, User, DailyReport, HourlyMetric
from app.models.reports import DailyReport, HourlyMetric

logger = logging.getLogger(__name__)


class ReportAggregationService:
    """Service for aggregating real order data into report models"""
    
    def __init__(self, db: Session):
        self.db = db
    
    def generate_daily_report(self, restaurant_id: str, report_date: date) -> Optional[DailyReport]:
        """
        Generate comprehensive daily report from actual order data
        """
        try:
            # Check if report already exists for this date
            existing_report = self.db.query(DailyReport).filter(
                and_(
                    DailyReport.restaurant_id == restaurant_id,
                    DailyReport.report_date == report_date
                )
            ).first()
            
            if existing_report:
                logger.info(f"Daily report already exists for {restaurant_id} on {report_date}")
                return existing_report
            
            # Get all completed orders for the date
            date_start = datetime.combine(report_date, datetime.min.time())
            date_end = date_start + timedelta(days=1)
            
            orders = self.db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant_id,
                    Order.status == "completed",
                    Order.created_at >= date_start,
                    Order.created_at < date_end
                )
            ).all()
            
            if not orders:
                logger.info(f"No orders found for {restaurant_id} on {report_date}")
                return None
            
            # Calculate aggregated metrics
            total_revenue = sum(order.total_amount for order in orders)
            total_orders = len(orders)
            average_order_value = total_revenue / total_orders if total_orders > 0 else Decimal('0.00')
            
            # Payment method breakdown
            cash_sales = sum(order.total_amount for order in orders if order.payment_method == 'cash')
            card_sales = sum(order.total_amount for order in orders if order.payment_method == 'card')
            qr_sales = sum(order.total_amount for order in orders if order.payment_method == 'qr')
            other_sales = sum(order.total_amount for order in orders 
                            if order.payment_method not in ['cash', 'card', 'qr'])
            
            # Order type breakdown
            dine_in_orders = len([o for o in orders if o.order_type == 'dine_in'])
            takeaway_orders = len([o for o in orders if o.order_type == 'takeaway'])
            delivery_orders = len([o for o in orders if o.order_type == 'delivery'])
            
            # Tax and fee calculations
            total_tax = sum(order.tax_amount or Decimal('0.00') for order in orders)
            total_service_charge = sum(order.service_charge or Decimal('0.00') for order in orders)
            total_discounts = sum(order.discount_amount or Decimal('0.00') for order in orders)
            
            # Calculate payment processing fees (approximate)
            payment_processing_fees = (card_sales + qr_sales) * Decimal('0.029')  # 2.9% for cards/QR
            
            # Labor metrics (would be enhanced with actual labor tracking)
            employees_worked = self.db.query(func.count(func.distinct(User.id))).filter(
                and_(
                    User.restaurant_id == restaurant_id,
                    User.role.in_(['employee', 'manager']),
                    User.is_active == True
                )
            ).scalar() or 0
            
            # Estimated labor hours and cost (placeholder - would connect to actual time tracking)
            total_labor_hours = employees_worked * Decimal('8.0')  # Assuming 8-hour shifts
            total_labor_cost = total_labor_hours * Decimal('12.50')  # £12.50/hour average
            
            # COGS estimation (would connect to actual inventory tracking)
            cogs = total_revenue * Decimal('0.30')  # Approximate 30% food cost
            waste_cost = cogs * Decimal('0.05')  # Approximate 5% waste
            
            # Create DailyReport instance
            daily_report = DailyReport(
                restaurant_id=restaurant_id,
                report_date=report_date,
                total_revenue=total_revenue,
                total_orders=total_orders,
                average_order_value=average_order_value,
                cash_sales=cash_sales,
                card_sales=card_sales,
                qr_sales=qr_sales,
                other_sales=other_sales,
                dine_in_orders=dine_in_orders,
                takeaway_orders=takeaway_orders,
                delivery_orders=delivery_orders,
                total_tax=total_tax,
                total_service_charge=total_service_charge,
                total_discounts=total_discounts,
                payment_processing_fees=payment_processing_fees,
                total_labor_hours=total_labor_hours,
                total_labor_cost=total_labor_cost,
                employees_worked=employees_worked,
                cogs=cogs,
                waste_cost=waste_cost
            )
            
            # Save to database
            self.db.add(daily_report)
            self.db.commit()
            self.db.refresh(daily_report)
            
            logger.info(f"Generated daily report for {restaurant_id} on {report_date}: "
                       f"£{total_revenue} revenue, {total_orders} orders")
            
            return daily_report
            
        except Exception as e:
            logger.error(f"Failed to generate daily report for {restaurant_id} on {report_date}: {str(e)}")
            self.db.rollback()
            return None
    
    def generate_hourly_metrics(self, restaurant_id: str, report_date: date) -> List[HourlyMetric]:
        """
        Generate hourly breakdown metrics for a specific date
        """
        try:
            hourly_metrics = []
            date_start = datetime.combine(report_date, datetime.min.time())
            
            for hour in range(24):
                hour_start = date_start + timedelta(hours=hour)
                hour_end = hour_start + timedelta(hours=1)
                
                # Get orders for this hour
                hourly_orders = self.db.query(Order).filter(
                    and_(
                        Order.restaurant_id == restaurant_id,
                        Order.status == "completed",
                        Order.created_at >= hour_start,
                        Order.created_at < hour_end
                    )
                ).all()
                
                if hourly_orders:
                    hourly_revenue = sum(order.total_amount for order in hourly_orders)
                    hourly_order_count = len(hourly_orders)
                    avg_order_value = hourly_revenue / hourly_order_count if hourly_order_count > 0 else Decimal('0.00')
                    
                    # Customer count (unique customers per hour)
                    unique_customers = len(set(order.customer_id for order in hourly_orders if order.customer_id))
                    
                    hourly_metric = HourlyMetric(
                        restaurant_id=restaurant_id,
                        report_date=report_date,
                        hour=hour,
                        revenue=hourly_revenue,
                        order_count=hourly_order_count,
                        customer_count=unique_customers,
                        avg_order_value=avg_order_value
                    )
                    
                    hourly_metrics.append(hourly_metric)
            
            # Bulk save
            if hourly_metrics:
                self.db.add_all(hourly_metrics)
                self.db.commit()
                logger.info(f"Generated {len(hourly_metrics)} hourly metrics for {restaurant_id} on {report_date}")
            
            return hourly_metrics
            
        except Exception as e:
            logger.error(f"Failed to generate hourly metrics for {restaurant_id} on {report_date}: {str(e)}")
            self.db.rollback()
            return []
    
    def generate_reports_for_date_range(self, restaurant_id: str, start_date: date, end_date: date):
        """
        Generate reports for a range of dates
        """
        current_date = start_date
        while current_date <= end_date:
            self.generate_daily_report(restaurant_id, current_date)
            self.generate_hourly_metrics(restaurant_id, current_date)
            current_date += timedelta(days=1)
    
    def get_financial_summary(self, restaurant_id: str, start_date: date, end_date: date) -> Dict:
        """
        Get aggregated financial summary from daily reports
        """
        try:
            daily_reports = self.db.query(DailyReport).filter(
                and_(
                    DailyReport.restaurant_id == restaurant_id,
                    DailyReport.report_date >= start_date,
                    DailyReport.report_date <= end_date
                )
            ).all()
            
            if not daily_reports:
                return {}
            
            total_revenue = sum(report.total_revenue for report in daily_reports)
            total_costs = sum(report.cogs + report.total_labor_cost for report in daily_reports)
            gross_profit = total_revenue - total_costs
            
            return {
                "total_revenue": float(total_revenue),
                "total_costs": float(total_costs),
                "gross_profit": float(gross_profit),
                "profit_margin": float(gross_profit / total_revenue * 100) if total_revenue > 0 else 0,
                "daily_reports": len(daily_reports),
                "food_sales": float(sum(report.total_revenue for report in daily_reports)),
                "labor_costs": float(sum(report.total_labor_cost for report in daily_reports)),
                "cogs": float(sum(report.cogs for report in daily_reports)),
                "cash_payments": float(sum(report.cash_sales for report in daily_reports)),
                "card_payments": float(sum(report.card_sales for report in daily_reports)),
                "qr_payments": float(sum(report.qr_sales for report in daily_reports)),
                "vat_collected": float(sum(report.total_tax for report in daily_reports)),
                "service_charge_collected": float(sum(report.total_service_charge for report in daily_reports))
            }
            
        except Exception as e:
            logger.error(f"Failed to get financial summary: {str(e)}")
            return {}


def get_report_service(db: Session) -> ReportAggregationService:
    """Factory function to get report aggregation service"""
    return ReportAggregationService(db)