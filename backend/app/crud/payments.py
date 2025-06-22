"""
CRUD operations for payments and provider analytics
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from datetime import datetime, timedelta
from decimal import Decimal
from typing import List, Dict, Any, Optional
from ..core.database import Payment, QRPayment, Restaurant, Order

async def get_restaurant_monthly_volume(
    restaurant_id: str,
    db: Session = None
) -> Decimal:
    """Get restaurant's average monthly transaction volume"""
    if not db:
        # Return default for now - this will be properly implemented later
        return Decimal("2000")
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=90)
    
    result = db.query(
        func.sum(Payment.amount)
    ).filter(
        and_(
            Payment.order_id.in_(
                db.query(Order.id).filter(Order.restaurant_id == restaurant_id)
            ),
            Payment.created_at >= start_date,
            Payment.created_at <= end_date,
            Payment.status == "completed"
        )
    ).scalar()
    
    if result:
        return Decimal(str(result)) / Decimal("3")  # 3 months average
    return Decimal("0")

async def get_provider_analytics(
    start_date: str,
    end_date: str,
    db: Session
) -> Dict[str, Any]:
    """Get payment provider analytics for date range"""
    # Parse dates
    start = datetime.fromisoformat(start_date)
    end = datetime.fromisoformat(end_date)
    
    # Get payments by provider
    provider_stats = db.query(
        Payment.provider,
        func.count(Payment.id).label("count"),
        func.sum(Payment.amount).label("volume"),
        func.sum(Payment.provider_fee).label("fees"),
        func.avg(Payment.amount).label("avg_transaction")
    ).filter(
        and_(
            Payment.created_at >= start,
            Payment.created_at <= end,
            Payment.status == "completed"
        )
    ).group_by(Payment.provider).all()
    
    # Calculate totals
    total_volume = sum(stat.volume or 0 for stat in provider_stats)
    total_fees = sum(stat.fees or 0 for stat in provider_stats)
    
    # Build analytics response
    by_provider = {}
    for stat in provider_stats:
        by_provider[stat.provider] = {
            "transaction_count": stat.count,
            "total_volume": float(stat.volume or 0),
            "total_fees": float(stat.fees or 0),
            "average_transaction": float(stat.avg_transaction or 0),
            "effective_rate": (
                float(stat.fees / stat.volume * 100) 
                if stat.volume else 0
            )
        }
    
    # Calculate potential savings
    optimal_fees = _calculate_optimal_fees(provider_stats)
    potential_savings = float(total_fees - optimal_fees)
    
    # Generate recommendations
    recommendations = _generate_recommendations(by_provider, total_volume)
    
    return {
        "by_provider": by_provider,
        "total_volume": float(total_volume),
        "total_fees": float(total_fees),
        "potential_savings": potential_savings,
        "recommendations": recommendations
    }

def _calculate_optimal_fees(provider_stats) -> Decimal:
    """Calculate what fees would be with optimal provider selection"""
    total_optimal = Decimal("0")
    
    for stat in provider_stats:
        volume = Decimal(str(stat.volume or 0))
        
        # Calculate optimal provider for this volume
        if volume >= Decimal("2714"):
            # SumUp Plus rate
            optimal_fee = volume * Decimal("0.0069") + Decimal("19")
        else:
            # Stripe rate for lower volumes
            optimal_fee = volume * Decimal("0.014") + (stat.count * Decimal("0.20"))
        
        total_optimal += optimal_fee
    
    return total_optimal

def _generate_recommendations(
    by_provider: Dict[str, Any],
    total_volume: float
) -> List[str]:
    """Generate recommendations based on analytics"""
    recommendations = []
    
    monthly_volume = total_volume / 3  # Assuming 3 month period
    
    if monthly_volume >= 2714:
        if "sumup" not in by_provider or by_provider["sumup"]["transaction_count"] == 0:
            recommendations.append(
                f"Your monthly volume of £{monthly_volume:.2f} qualifies for "
                f"SumUp Payments Plus at 0.69% + £19/month. "
                f"Potential savings: £{(monthly_volume * 0.007):.2f}/month"
            )
    
    # Check if using expensive providers
    for provider, stats in by_provider.items():
        if stats["effective_rate"] > 1.5:
            recommendations.append(
                f"Consider reducing usage of {provider} "
                f"(current rate: {stats['effective_rate']:.2f}%)"
            )
    
    return recommendations

async def create_payment_analytics_report(
    restaurant_id: str,
    db: Session
) -> Dict[str, Any]:
    """Create comprehensive payment analytics report for restaurant"""
    # Get last 12 months of data
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=365)
    
    # Monthly breakdown
    monthly_data = db.query(
        func.date_trunc('month', Payment.created_at).label('month'),
        Payment.provider,
        func.count(Payment.id).label('count'),
        func.sum(Payment.amount).label('volume'),
        func.sum(Payment.provider_fee).label('fees')
    ).join(Order, Payment.order_id == Order.id).filter(
        and_(
            Order.restaurant_id == restaurant_id,
            Payment.created_at >= start_date,
            Payment.status == "completed"
        )
    ).group_by('month', Payment.provider).all()
    
    # Process into report format
    report = {
        "restaurant_id": restaurant_id,
        "period": {
            "start": start_date.isoformat(),
            "end": end_date.isoformat()
        },
        "monthly_breakdown": [],
        "provider_summary": {},
        "cost_optimization": {
            "current_annual_fees": 0,
            "optimal_annual_fees": 0,
            "potential_annual_savings": 0
        }
    }
    
    # Process monthly data
    for row in monthly_data:
        month_data = {
            "month": row.month.isoformat(),
            "provider": row.provider,
            "transactions": row.count,
            "volume": float(row.volume or 0),
            "fees": float(row.fees or 0)
        }
        report["monthly_breakdown"].append(month_data)
        
        # Update provider summary
        if row.provider not in report["provider_summary"]:
            report["provider_summary"][row.provider] = {
                "total_transactions": 0,
                "total_volume": 0,
                "total_fees": 0
            }
        
        report["provider_summary"][row.provider]["total_transactions"] += row.count
        report["provider_summary"][row.provider]["total_volume"] += float(row.volume or 0)
        report["provider_summary"][row.provider]["total_fees"] += float(row.fees or 0)
    
    # Calculate cost optimization
    total_volume = sum(
        p["total_volume"] 
        for p in report["provider_summary"].values()
    )
    total_fees = sum(
        p["total_fees"] 
        for p in report["provider_summary"].values()
    )
    
    # Calculate optimal fees
    monthly_avg_volume = total_volume / 12
    if monthly_avg_volume >= 2714:
        optimal_annual_fees = (total_volume * 0.0069) + (12 * 19)
    else:
        optimal_annual_fees = total_volume * 0.014
    
    report["cost_optimization"]["current_annual_fees"] = total_fees
    report["cost_optimization"]["optimal_annual_fees"] = optimal_annual_fees
    report["cost_optimization"]["potential_annual_savings"] = max(
        0, 
        total_fees - optimal_annual_fees
    )
    
    return report