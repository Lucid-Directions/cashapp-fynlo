"""
Transaction Volume Tracking Service
Tracks payment volumes, patterns, and triggers for routing optimization


"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from sqlalchemy.orm import Session
from sqlalchemy import func, text

from app.core.database import Payment, Order, Restaurant

logger = logging.getLogger(__name__)

@dataclass
class VolumeMetrics:
    """Volume metrics for a given period"""
    total_volume: Decimal
    transaction_count: int
    avg_transaction_size: Decimal
    peak_hour: int
    peak_day_volume: Decimal
    growth_rate: float

@dataclass
class VolumeThreshold:
    """Volume threshold configuration"""
    threshold_amount: Decimal
    provider_recommendation: str
    fee_benefit: str
    description: str

@dataclass
class VolumeAlert:
    """Volume-based alert"""
    alert_type: str
    threshold_name: str
    current_volume: Decimal
    threshold_volume: Decimal
    recommendation: str
    priority: str
    estimated_savings: Optional[Decimal] = None

class VolumeTracker:
    """Service for tracking transaction volumes and triggering optimizations"""
    
    def __init__(self, db: Session):
        self.db = db
        
        # Define volume thresholds for different optimizations
        self.volume_thresholds = {
            'sumup_optimal': VolumeThreshold(
                threshold_amount=Decimal('2714'),
                provider_recommendation='sumup',
                fee_benefit='0.69% + £19/month',
                description='Qualifies for SumUp high-volume pricing'
            ),
            'volume_discount_eligible': VolumeThreshold(
                threshold_amount=Decimal('10000'),
                provider_recommendation='negotiated',
                fee_benefit='Custom rates available',
                description='Eligible for negotiated volume discounts'
            ),
            'enterprise_tier': VolumeThreshold(
                threshold_amount=Decimal('50000'),
                provider_recommendation='enterprise',
                fee_benefit='Enterprise pricing',
                description='Qualifies for enterprise-level services'
            )
        }
    
    async def track_restaurant_volume(
        self,
        restaurant_id: str,
        period_days: int = 30
    ) -> VolumeMetrics:
        """Track volume metrics for a restaurant over a given period"""
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=period_days)
        
        # Query payments for the period
        payments_query = self.db.query(Payment).join(Order).filter(
            Order.restaurant_id == restaurant_id,
            Payment.processed_at.between(start_date, end_date),
            Payment.status == 'completed'
        )
        
        payments = payments_query.all()
        
        if not payments:
            return VolumeMetrics(
                total_volume=Decimal('0'),
                transaction_count=0,
                avg_transaction_size=Decimal('0'),
                peak_hour=12,  # Default noon
                peak_day_volume=Decimal('0'),
                growth_rate=0.0
            )
        
        # Calculate basic metrics
        total_volume = sum(Decimal(str(p.amount)) for p in payments)
        transaction_count = len(payments)
        avg_transaction_size = total_volume / transaction_count if transaction_count > 0 else Decimal('0')
        
        # Find peak hour
        peak_hour = await self._calculate_peak_hour(payments)
        
        # Calculate peak day volume
        peak_day_volume = await self._calculate_peak_day_volume(payments)
        
        # Calculate growth rate
        growth_rate = await self._calculate_growth_rate(
            restaurant_id, start_date, end_date, period_days
        )
        
        return VolumeMetrics(
            total_volume=total_volume,
            transaction_count=transaction_count,
            avg_transaction_size=avg_transaction_size,
            peak_hour=peak_hour,
            peak_day_volume=peak_day_volume,
            growth_rate=growth_rate
        )
    
    async def check_volume_thresholds(
        self,
        restaurant_id: str,
        current_metrics: Optional[VolumeMetrics] = None
    ) -> List[VolumeAlert]:
        """Check if restaurant volume has crossed any important thresholds"""
        
        if not current_metrics:
            current_metrics = await self.track_restaurant_volume(restaurant_id)
        
        alerts = []
        monthly_volume = current_metrics.total_volume  # Assuming 30-day tracking
        
        for threshold_name, threshold in self.volume_thresholds.items():
            # Check if approaching threshold (within 10%)
            threshold_90 = threshold.threshold_amount * Decimal('0.9')
            
            if monthly_volume >= threshold.threshold_amount:
                # Volume exceeds threshold
                alert = VolumeAlert(
                    alert_type='threshold_exceeded',
                    threshold_name=threshold_name,
                    current_volume=monthly_volume,
                    threshold_volume=threshold.threshold_amount,
                    recommendation=f'Consider switching to {threshold.provider_recommendation} for {threshold.fee_benefit}',
                    priority='high' if threshold_name == 'sumup_optimal' else 'medium',
                    estimated_savings=await self._calculate_threshold_savings(
                        monthly_volume, threshold_name
                    )
                )
                alerts.append(alert)
                
            elif monthly_volume >= threshold_90:
                # Approaching threshold
                alert = VolumeAlert(
                    alert_type='approaching_threshold',
                    threshold_name=threshold_name,
                    current_volume=monthly_volume,
                    threshold_volume=threshold.threshold_amount,
                    recommendation=f'Close to qualifying for {threshold.fee_benefit}',
                    priority='medium'
                )
                alerts.append(alert)
        
        return alerts
    
    async def get_volume_forecast(
        self,
        restaurant_id: str,
        forecast_days: int = 30
    ) -> Dict:
        """Forecast future volume based on historical trends"""
        
        # Get historical data for trend analysis
        historical_metrics = []
        
        for i in range(3):  # Get last 3 months
            start_offset = (i + 1) * 30
            end_offset = i * 30
            
            end_date = datetime.utcnow() - timedelta(days=end_offset)
            start_date = end_date - timedelta(days=30)
            
            period_metrics = await self._get_period_metrics(
                restaurant_id, start_date, end_date
            )
            historical_metrics.append(period_metrics)
        
        # Calculate trend
        if len(historical_metrics) >= 2:
            recent_volume = historical_metrics[0]['total_volume']
            previous_volume = historical_metrics[1]['total_volume']
            
            if previous_volume > 0:
                growth_rate = (recent_volume - previous_volume) / previous_volume
            else:
                growth_rate = 0
        else:
            growth_rate = 0
        
        # Project future volume
        current_volume = historical_metrics[0]['total_volume'] if historical_metrics else 0
        projected_volume = current_volume * (1 + growth_rate) * (forecast_days / 30)
        
        # Check what thresholds might be crossed
        upcoming_thresholds = []
        for name, threshold in self.volume_thresholds.items():
            if current_volume < threshold.threshold_amount <= projected_volume:
                upcoming_thresholds.append({
                    'threshold_name': name,
                    'threshold_amount': float(threshold.threshold_amount),
                    'description': threshold.description,
                    'estimated_benefit': threshold.fee_benefit
                })
        
        return {
            'current_monthly_volume': float(current_volume),
            'projected_volume': float(projected_volume),
            'growth_rate': float(growth_rate * 100),  # As percentage
            'forecast_period_days': forecast_days,
            'upcoming_thresholds': upcoming_thresholds,
            'confidence': self._calculate_forecast_confidence(historical_metrics)
        }
    
    async def get_volume_analytics(
        self,
        restaurant_id: str,
        analysis_period_days: int = 90
    ) -> Dict:
        """Get comprehensive volume analytics"""
        
        current_metrics = await self.track_restaurant_volume(restaurant_id, 30)
        volume_alerts = await self.check_volume_thresholds(restaurant_id, current_metrics)
        volume_forecast = await self.get_volume_forecast(restaurant_id)
        
        # Get hourly distribution
        hourly_distribution = await self._get_hourly_distribution(restaurant_id)
        
        # Get daily patterns
        daily_patterns = await self._get_daily_patterns(restaurant_id, analysis_period_days)
        
        # Calculate seasonality if enough data
        seasonality = await self._analyze_seasonality(restaurant_id, analysis_period_days)
        
        return {
            'current_metrics': {
                'total_volume': float(current_metrics.total_volume),
                'transaction_count': current_metrics.transaction_count,
                'avg_transaction_size': float(current_metrics.avg_transaction_size),
                'peak_hour': current_metrics.peak_hour,
                'peak_day_volume': float(current_metrics.peak_day_volume),
                'growth_rate': current_metrics.growth_rate
            },
            'volume_alerts': [
                {
                    'type': alert.alert_type,
                    'threshold': alert.threshold_name,
                    'current_volume': float(alert.current_volume),
                    'threshold_volume': float(alert.threshold_volume),
                    'recommendation': alert.recommendation,
                    'priority': alert.priority,
                    'estimated_savings': float(alert.estimated_savings) if alert.estimated_savings else None
                }
                for alert in volume_alerts
            ],
            'forecast': volume_forecast,
            'patterns': {
                'hourly_distribution': hourly_distribution,
                'daily_patterns': daily_patterns,
                'seasonality': seasonality
            }
        }
    
    async def _calculate_peak_hour(self, payments: List[Payment]) -> int:
        """Calculate the peak hour of transaction activity"""
        
        hourly_counts = {}
        for payment in payments:
            if payment.processed_at:
                hour = payment.processed_at.hour
                hourly_counts[hour] = hourly_counts.get(hour, 0) + 1
        
        if not hourly_counts:
            return 12  # Default to noon
        
        return max(hourly_counts.items(), key=lambda x: x[1])[0]
    
    async def _calculate_peak_day_volume(self, payments: List[Payment]) -> Decimal:
        """Calculate the highest single-day volume"""
        
        daily_volumes = {}
        for payment in payments:
            if payment.processed_at:
                date_key = payment.processed_at.date()
                amount = Decimal(str(payment.amount))
                daily_volumes[date_key] = daily_volumes.get(date_key, Decimal('0')) + amount
        
        if not daily_volumes:
            return Decimal('0')
        
        return max(daily_volumes.values())
    
    async def _calculate_growth_rate(
        self,
        restaurant_id: str,
        start_date: datetime,
        end_date: datetime,
        period_days: int
    ) -> float:
        """Calculate volume growth rate compared to previous period"""
        
        # Get previous period data
        previous_start = start_date - timedelta(days=period_days)
        previous_end = start_date
        
        previous_payments = self.db.query(Payment).join(Order).filter(
            Order.restaurant_id == restaurant_id,
            Payment.processed_at.between(previous_start, previous_end),
            Payment.status == 'completed'
        ).all()
        
        current_volume = end_date  # This should be calculated from current payments
        previous_volume = sum(Decimal(str(p.amount)) for p in previous_payments)
        
        if previous_volume == 0:
            return 0.0
        
        # This is a simplified calculation - in practice you'd pass current volume
        return 0.0  # Placeholder
    
    async def _calculate_threshold_savings(
        self,
        monthly_volume: Decimal,
        threshold_name: str
    ) -> Optional[Decimal]:
        """Calculate estimated monthly savings from reaching a threshold"""
        
        if threshold_name == 'sumup_optimal':
            # Compare SumUp pricing vs current estimated fees
            sumup_fees = (monthly_volume * Decimal('0.0069')) + Decimal('19')
            estimated_current_fees = monthly_volume * Decimal('0.014')  # Assume Stripe
            return max(Decimal('0'), estimated_current_fees - sumup_fees)
        
        return None
    
    async def _get_period_metrics(
        self,
        restaurant_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """Get metrics for a specific period"""
        
        payments = self.db.query(Payment).join(Order).filter(
            Order.restaurant_id == restaurant_id,
            Payment.processed_at.between(start_date, end_date),
            Payment.status == 'completed'
        ).all()
        
        total_volume = sum(Decimal(str(p.amount)) for p in payments)
        
        return {
            'total_volume': float(total_volume),
            'transaction_count': len(payments),
            'period_start': start_date.isoformat(),
            'period_end': end_date.isoformat()
        }
    
    async def _get_hourly_distribution(self, restaurant_id: str) -> Dict[int, float]:
        """Get transaction volume distribution by hour"""
        
        # Query last 30 days
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        
        # Group by hour
        hourly_data = self.db.query(
            func.extract('hour', Payment.processed_at).label('hour'),
            func.sum(Payment.amount).label('volume')
        ).join(Order).filter(
            Order.restaurant_id == restaurant_id,
            Payment.processed_at.between(start_date, end_date),
            Payment.status == 'completed'
        ).group_by(func.extract('hour', Payment.processed_at)).all()
        
        # Convert to dictionary
        distribution = {}
        for hour_data in hourly_data:
            hour = int(hour_data.hour) if hour_data.hour is not None else 0
            volume = float(hour_data.volume or 0)
            distribution[hour] = volume
        
        return distribution
    
    async def _get_daily_patterns(
        self,
        restaurant_id: str,
        analysis_days: int
    ) -> Dict:
        """Analyze daily patterns and trends"""
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=analysis_days)
        
        # Get daily volumes
        daily_data = self.db.query(
            func.date(Payment.processed_at).label('date'),
            func.sum(Payment.amount).label('volume'),
            func.count(Payment.id).label('transactions')
        ).join(Order).filter(
            Order.restaurant_id == restaurant_id,
            Payment.processed_at.between(start_date, end_date),
            Payment.status == 'completed'
        ).group_by(func.date(Payment.processed_at)).all()
        
        # Analyze patterns
        volumes = [float(d.volume or 0) for d in daily_data]
        avg_daily_volume = sum(volumes) / len(volumes) if volumes else 0
        
        # Find day-of-week patterns
        dow_patterns = {}
        for data in daily_data:
            if data.date:
                dow = data.date.weekday()  # 0 = Monday, 6 = Sunday
                if dow not in dow_patterns:
                    dow_patterns[dow] = []
                dow_patterns[dow].append(float(data.volume or 0))
        
        # Calculate average for each day of week
        dow_averages = {}
        for dow, volumes_list in dow_patterns.items():
            dow_averages[dow] = sum(volumes_list) / len(volumes_list)
        
        return {
            'avg_daily_volume': avg_daily_volume,
            'day_of_week_patterns': dow_averages,
            'analysis_period_days': analysis_days
        }
    
    async def _analyze_seasonality(
        self,
        restaurant_id: str,
        analysis_days: int
    ) -> Dict:
        """Analyze seasonal patterns if enough data available"""
        
        # For now, return basic seasonality info
        # In practice, you'd need more sophisticated time series analysis
        
        return {
            'seasonal_factor': 1.0,  # No seasonality detected
            'confidence': 'low',
            'note': 'Insufficient data for reliable seasonality analysis'
        }
    
    def _calculate_forecast_confidence(self, historical_metrics: List[Dict]) -> str:
        """Calculate confidence level for volume forecast"""
        
        if len(historical_metrics) < 2:
            return 'low'
        elif len(historical_metrics) < 3:
            return 'medium'
        else:
            # Check variability in growth rates
            volumes = [m['total_volume'] for m in historical_metrics]
            if len(volumes) >= 3:
                # Calculate coefficient of variation
                mean_vol = sum(volumes) / len(volumes)
                if mean_vol > 0:
                    variance = sum((v - mean_vol) ** 2 for v in volumes) / len(volumes)
                    cv = (variance ** 0.5) / mean_vol
                    
                    if cv < 0.2:
                        return 'high'
                    elif cv < 0.5:
                        return 'medium'
                    else:
                        return 'low'
            
            return 'medium'