"""
Advanced Payment Analytics Service
Provides detailed insights into payment performance, cost optimization, and provider analytics


"""
import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func, text
from collections import defaultdict

from app.core.database import Payment, Order, Restaurant
from app.services.payment_providers import PaymentProvider

logger = logging.getLogger(__name__)

class PaymentAnalyticsService:
    """Service for analyzing payment data and generating insights"""
    
    def __init__(self, db: Session):
        self.db = db
    
    async def get_provider_performance_summary(
        self, 
        restaurant_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Get comprehensive provider performance analytics"""
        
        # Default to last 30 days if no dates provided
        if not end_date:
            end_date = datetime.utcnow()
        if not start_date:
            start_date = end_date - timedelta(days=30)
        
        # Base query
        query = self.db.query(Payment).filter(
            Payment.processed_at.between(start_date, end_date),
            Payment.status == "completed"
        )
        
        if restaurant_id:
            # Join with Order to filter by restaurant
            query = query.join(Order).filter(Order.restaurant_id == restaurant_id)
        
        payments = query.all()
        
        # Analyze by provider
        provider_stats = defaultdict(lambda: {
            'transaction_count': 0,
            'total_volume': Decimal('0'),
            'total_fees': Decimal('0'),
            'avg_transaction_size': Decimal('0'),
            'success_rate': 0.0,
            'avg_processing_time': 0.0,
            'fee_percentage': 0.0
        })
        
        total_volume = Decimal('0')
        total_fees = Decimal('0')
        
        for payment in payments:
            provider = payment.provider or 'unknown'
            amount = Decimal(str(payment.amount))
            fee = Decimal(str(payment.provider_fee or payment.fee_amount or 0))
            
            provider_stats[provider]['transaction_count'] += 1
            provider_stats[provider]['total_volume'] += amount
            provider_stats[provider]['total_fees'] += fee
            
            total_volume += amount
            total_fees += fee
        
        # Calculate derived metrics
        for provider, stats in provider_stats.items():
            if stats['transaction_count'] > 0:
                stats['avg_transaction_size'] = stats['total_volume'] / stats['transaction_count']
                stats['fee_percentage'] = (stats['total_fees'] / stats['total_volume'] * 100) if stats['total_volume'] > 0 else 0
        
        # Calculate cost savings opportunities
        cost_savings = await self._calculate_cost_savings(provider_stats, total_volume)
        
        # Get optimal provider recommendations
        optimal_providers = await self._get_optimal_provider_recommendations(total_volume, provider_stats)
        
        return {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': (end_date - start_date).days
            },
            'overall_metrics': {
                'total_volume': float(total_volume),
                'total_fees': float(total_fees),
                'avg_fee_percentage': float((total_fees / total_volume * 100)) if total_volume > 0 else 0,
                'transaction_count': sum(stats['transaction_count'] for stats in provider_stats.values())
            },
            'provider_performance': {
                provider: {
                    'transaction_count': stats['transaction_count'],
                    'total_volume': float(stats['total_volume']),
                    'total_fees': float(stats['total_fees']),
                    'avg_transaction_size': float(stats['avg_transaction_size']),
                    'fee_percentage': float(stats['fee_percentage'])
                }
                for provider, stats in provider_stats.items()
            },
            'cost_savings': cost_savings,
            'recommendations': optimal_providers
        }
    
    async def get_transaction_volume_trends(
        self, 
        restaurant_id: Optional[str] = None,
        days: int = 30
    ) -> Dict:
        """Get transaction volume trends over time"""
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=days)
        
        # Query daily transaction volumes
        query = self.db.query(
            func.date(Payment.processed_at).label('date'),
            Payment.provider,
            func.count(Payment.id).label('transaction_count'),
            func.sum(Payment.amount).label('volume'),
            func.sum(Payment.provider_fee).label('fees')
        ).filter(
            Payment.processed_at.between(start_date, end_date),
            Payment.status == "completed"
        ).group_by(
            func.date(Payment.processed_at),
            Payment.provider
        ).order_by(func.date(Payment.processed_at))
        
        if restaurant_id:
            query = query.join(Order).filter(Order.restaurant_id == restaurant_id)
        
        results = query.all()
        
        # Organize data by date
        daily_data = defaultdict(lambda: {
            'date': None,
            'total_volume': 0,
            'total_transactions': 0,
            'total_fees': 0,
            'providers': {}
        })
        
        for result in results:
            date_str = result.date.isoformat()
            if daily_data[date_str]['date'] is None:
                daily_data[date_str]['date'] = date_str
            
            daily_data[date_str]['total_volume'] += float(result.volume or 0)
            daily_data[date_str]['total_transactions'] += result.transaction_count
            daily_data[date_str]['total_fees'] += float(result.fees or 0)
            
            daily_data[date_str]['providers'][result.provider] = {
                'transaction_count': result.transaction_count,
                'volume': float(result.volume or 0),
                'fees': float(result.fees or 0)
            }
        
        # Convert to list and sort by date
        trend_data = list(daily_data.values())
        trend_data.sort(key=lambda x: x['date'])
        
        # Calculate growth rates
        growth_metrics = self._calculate_growth_metrics(trend_data)
        
        return {
            'period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': days
            },
            'daily_trends': trend_data,
            'growth_metrics': growth_metrics
        }
    
    async def get_cost_optimization_report(
        self, 
        restaurant_id: Optional[str] = None,
        start_date: Optional[datetime] = None,
        end_date: Optional[datetime] = None
    ) -> Dict:
        """Generate detailed cost optimization report"""
        
        # Get current performance
        current_performance = await self.get_provider_performance_summary(
            restaurant_id, start_date, end_date
        )
        
        total_volume = Decimal(str(current_performance['overall_metrics']['total_volume']))
        current_fees = Decimal(str(current_performance['overall_metrics']['total_fees']))
        
        # Calculate optimal fee structure
        optimal_breakdown = await self._calculate_optimal_provider_mix(total_volume)
        
        # Calculate potential savings
        potential_savings = current_fees - optimal_breakdown['total_optimal_fees']
        savings_percentage = (potential_savings / current_fees * 100) if current_fees > 0 else 0
        
        # Generate specific recommendations
        recommendations = await self._generate_optimization_recommendations(
            current_performance, optimal_breakdown, total_volume
        )
        
        return {
            'current_state': {
                'total_volume': float(total_volume),
                'current_fees': float(current_fees),
                'avg_fee_rate': float(current_fees / total_volume * 100) if total_volume > 0 else 0
            },
            'optimal_state': {
                'optimal_fees': float(optimal_breakdown['total_optimal_fees']),
                'optimal_fee_rate': float(optimal_breakdown['total_optimal_fees'] / total_volume * 100) if total_volume > 0 else 0,
                'provider_breakdown': {
                    provider: {
                        'recommended_volume': float(data['volume']),
                        'expected_fees': float(data['fees']),
                        'volume_percentage': float(data['volume'] / total_volume * 100) if total_volume > 0 else 0
                    }
                    for provider, data in optimal_breakdown['provider_breakdown'].items()
                }
            },
            'savings_opportunity': {
                'potential_savings': float(potential_savings),
                'savings_percentage': float(savings_percentage),
                'annual_savings_projection': float(potential_savings * 12) if start_date and end_date and (end_date - start_date).days >= 28 else None
            },
            'recommendations': recommendations
        }
    
    async def get_provider_health_scores(
        self, 
        restaurant_id: Optional[str] = None
    ) -> Dict:
        """Calculate health scores for each provider based on multiple factors"""
        
        # Get last 7 and 30 days of data
        end_date = datetime.utcnow()
        start_date_7 = end_date - timedelta(days=7)
        start_date_30 = end_date - timedelta(days=30)
        
        # Query recent payment data
        query_7 = self.db.query(Payment).filter(
            Payment.processed_at.between(start_date_7, end_date)
        )
        query_30 = self.db.query(Payment).filter(
            Payment.processed_at.between(start_date_30, end_date)
        )
        
        if restaurant_id:
            query_7 = query_7.join(Order).filter(Order.restaurant_id == restaurant_id)
            query_30 = query_30.join(Order).filter(Order.restaurant_id == restaurant_id)
        
        payments_7d = query_7.all()
        payments_30d = query_30.all()
        
        provider_health = {}
        
        # Calculate health scores for each provider
        for provider in ['stripe', 'square', 'sumup', 'qr_code']:
            # Filter payments for this provider
            provider_payments_7d = [p for p in payments_7d if p.provider == provider]
            provider_payments_30d = [p for p in payments_30d if p.provider == provider]
            
            health_score = await self._calculate_provider_health_score(
                provider, provider_payments_7d, provider_payments_30d
            )
            
            provider_health[provider] = health_score
        
        return {
            'evaluation_date': end_date.isoformat(),
            'health_scores': provider_health,
            'overall_system_health': sum(score['overall_score'] for score in provider_health.values()) / len(provider_health) if provider_health else 0
        }
    
    async def _calculate_cost_savings(self, provider_stats: Dict, total_volume: Decimal) -> Dict:
        """Calculate potential cost savings with optimal provider mix"""
        
        if total_volume == 0:
            return {'potential_savings': 0, 'optimal_mix': {}}
        
        current_total_fees = sum(Decimal(str(stats['total_fees'])) for stats in provider_stats.values())
        
        # Calculate optimal fees based on volume tiers
        optimal_fees = Decimal('0')
        optimal_mix = {}
        
        # SumUp is best for high volume (£2,714+/month)
        if total_volume >= Decimal('2714'):
            # Use SumUp for all transactions
            sumup_fee_rate = Decimal('0.0069')  # 0.69%
            monthly_fee = Decimal('19')  # £19/month
            optimal_fees = (total_volume * sumup_fee_rate) + monthly_fee
            optimal_mix['sumup'] = {
                'percentage': 100,
                'volume': float(total_volume),
                'fees': float(optimal_fees)
            }
        else:
            # Use QR code for best rates under threshold
            qr_fee_rate = Decimal('0.012')  # 1.2%
            optimal_fees = total_volume * qr_fee_rate
            optimal_mix['qr_code'] = {
                'percentage': 100,
                'volume': float(total_volume),
                'fees': float(optimal_fees)
            }
        
        potential_savings = current_total_fees - optimal_fees
        
        return {
            'potential_savings': float(potential_savings),
            'savings_percentage': float(potential_savings / current_total_fees * 100) if current_total_fees > 0 else 0,
            'optimal_mix': optimal_mix
        }
    
    async def _get_optimal_provider_recommendations(
        self, 
        total_volume: Decimal, 
        provider_stats: Dict
    ) -> List[Dict]:
        """Generate specific provider recommendations"""
        
        recommendations = []
        
        # Volume-based recommendations
        if total_volume >= Decimal('2714'):
            recommendations.append({
                'type': 'provider_switch',
                'priority': 'high',
                'title': 'Switch to SumUp for optimal rates',
                'description': f'Your monthly volume of £{total_volume:,.2f} qualifies for SumUp\'s 0.69% + £19/month plan',
                'estimated_savings': float((total_volume * Decimal('0.014') - (total_volume * Decimal('0.0069') + Decimal('19')))),
                'action': 'Configure SumUp integration'
            })
        elif total_volume >= Decimal('1000'):
            recommendations.append({
                'type': 'provider_optimization',
                'priority': 'medium',
                'title': 'Consider volume-based pricing',
                'description': f'At £{total_volume:,.2f}/month, you may benefit from negotiated rates',
                'action': 'Contact providers for volume discounts'
            })
        
        # QR code recommendation
        qr_usage = provider_stats.get('qr_code', {}).get('transaction_count', 0)
        total_transactions = sum(stats.get('transaction_count', 0) for stats in provider_stats.values())
        
        if total_transactions > 0 and qr_usage / total_transactions < 0.3:
            recommendations.append({
                'type': 'payment_method',
                'priority': 'medium',
                'title': 'Promote QR code payments',
                'description': 'QR payments have lower fees (1.2%) and could reduce your costs',
                'action': 'Add QR payment incentives or training'
            })
        
        return recommendations
    
    async def _calculate_optimal_provider_mix(self, total_volume: Decimal) -> Dict:
        """Calculate optimal provider distribution for given volume"""
        
        provider_breakdown = {}
        total_optimal_fees = Decimal('0')
        
        if total_volume >= Decimal('2714'):
            # High volume - use SumUp
            sumup_fees = (total_volume * Decimal('0.0069')) + Decimal('19')
            provider_breakdown['sumup'] = {
                'volume': total_volume,
                'fees': sumup_fees
            }
            total_optimal_fees = sumup_fees
            
        elif total_volume >= Decimal('1000'):
            # Medium volume - mix of Stripe and QR
            qr_volume = total_volume * Decimal('0.7')  # 70% QR
            stripe_volume = total_volume * Decimal('0.3')  # 30% Stripe
            
            qr_fees = qr_volume * Decimal('0.012')  # 1.2%
            stripe_fees = (stripe_volume * Decimal('0.014')) + (stripe_volume * Decimal('0.20') / stripe_volume)  # 1.4% + 20p per transaction (approximated)
            
            provider_breakdown['qr_code'] = {'volume': qr_volume, 'fees': qr_fees}
            provider_breakdown['stripe'] = {'volume': stripe_volume, 'fees': stripe_fees}
            total_optimal_fees = qr_fees + stripe_fees
            
        else:
            # Low volume - primarily QR code
            qr_fees = total_volume * Decimal('0.012')  # 1.2%
            provider_breakdown['qr_code'] = {
                'volume': total_volume,
                'fees': qr_fees
            }
            total_optimal_fees = qr_fees
        
        return {
            'total_optimal_fees': total_optimal_fees,
            'provider_breakdown': provider_breakdown
        }
    
    async def _generate_optimization_recommendations(
        self, 
        current_performance: Dict, 
        optimal_breakdown: Dict, 
        total_volume: Decimal
    ) -> List[Dict]:
        """Generate specific optimization recommendations"""
        
        recommendations = []
        current_fees = Decimal(str(current_performance['overall_metrics']['total_fees']))
        optimal_fees = optimal_breakdown['total_optimal_fees']
        
        # High-impact recommendations
        if current_fees > optimal_fees * Decimal('1.2'):  # More than 20% above optimal
            recommendations.append({
                'impact': 'high',
                'category': 'provider_mix',
                'title': 'Optimize Provider Mix',
                'description': 'Your current provider mix is not cost-optimal for your volume',
                'savings': float(current_fees - optimal_fees),
                'action_items': [
                    'Review monthly transaction volume',
                    'Consider SumUp for high volume' if total_volume >= Decimal('2714') else 'Increase QR payment adoption',
                    'Renegotiate rates with current providers'
                ]
            })
        
        # Medium-impact recommendations
        if total_volume >= Decimal('1000'):
            recommendations.append({
                'impact': 'medium',
                'category': 'volume_discounts',
                'title': 'Negotiate Volume Discounts',
                'description': 'Your transaction volume qualifies for better rates',
                'action_items': [
                    'Contact Stripe for volume pricing',
                    'Explore Square\'s volume discount tiers',
                    'Consider SumUp\'s high-volume plan'
                ]
            })
        
        return recommendations
    
    async def _calculate_provider_health_score(
        self, 
        provider: str, 
        payments_7d: List[Payment], 
        payments_30d: List[Payment]
    ) -> Dict:
        """Calculate comprehensive health score for a provider"""
        
        health_factors = {
            'success_rate': 0,
            'avg_processing_time': 0,
            'cost_efficiency': 0,
            'volume_trend': 0,
            'reliability': 0
        }
        
        if not payments_30d:
            return {
                'overall_score': 0,
                'factors': health_factors,
                'status': 'inactive'
            }
        
        # Success rate (30%)
        completed_payments = [p for p in payments_30d if p.status == 'completed']
        success_rate = len(completed_payments) / len(payments_30d) if payments_30d else 0
        health_factors['success_rate'] = success_rate * 100
        
        # Cost efficiency (25%) - lower fees = higher score
        if completed_payments:
            avg_fee_rate = sum(Decimal(str(p.provider_fee or 0)) / Decimal(str(p.amount)) for p in completed_payments) / len(completed_payments)
            # Normalize to 0-100 scale (assuming max 3% fees)
            cost_efficiency = max(0, (1 - float(avg_fee_rate)) * 100)
            health_factors['cost_efficiency'] = cost_efficiency
        
        # Volume trend (20%) - comparing 7d vs 30d
        volume_7d = len(payments_7d)
        volume_30d = len(payments_30d)
        expected_7d = volume_30d * (7/30)  # Expected based on 30d average
        
        if expected_7d > 0:
            trend_score = min(100, (volume_7d / expected_7d) * 100)
            health_factors['volume_trend'] = trend_score
        
        # Reliability (15%) - consistency of processing
        reliability_score = 100 - (len([p for p in payments_30d if p.status == 'failed']) / len(payments_30d) * 100)
        health_factors['reliability'] = reliability_score
        
        # Processing time (10%) - mock data for now
        health_factors['avg_processing_time'] = 85  # Mock score
        
        # Calculate weighted overall score
        weights = {
            'success_rate': 0.30,
            'cost_efficiency': 0.25,
            'volume_trend': 0.20,
            'reliability': 0.15,
            'avg_processing_time': 0.10
        }
        
        overall_score = sum(
            health_factors[factor] * weight 
            for factor, weight in weights.items()
        )
        
        # Determine status
        if overall_score >= 80:
            status = 'excellent'
        elif overall_score >= 60:
            status = 'good'
        elif overall_score >= 40:
            status = 'needs_attention'
        else:
            status = 'poor'
        
        return {
            'overall_score': round(overall_score, 2),
            'factors': {k: round(v, 2) for k, v in health_factors.items()},
            'status': status
        }
    
    def _calculate_growth_metrics(self, trend_data: List[Dict]) -> Dict:
        """Calculate growth rates and trends"""
        
        if len(trend_data) < 2:
            return {'volume_growth': 0, 'transaction_growth': 0, 'trend': 'insufficient_data'}
        
        # Compare first and last periods
        first_period = trend_data[0]
        last_period = trend_data[-1]
        
        volume_growth = 0
        transaction_growth = 0
        
        if first_period['total_volume'] > 0:
            volume_growth = ((last_period['total_volume'] - first_period['total_volume']) / first_period['total_volume']) * 100
        
        if first_period['total_transactions'] > 0:
            transaction_growth = ((last_period['total_transactions'] - first_period['total_transactions']) / first_period['total_transactions']) * 100
        
        # Determine overall trend
        if volume_growth > 10:
            trend = 'strong_growth'
        elif volume_growth > 0:
            trend = 'growth'
        elif volume_growth > -10:
            trend = 'stable'
        else:
            trend = 'declining'
        
        return {
            'volume_growth': round(volume_growth, 2),
            'transaction_growth': round(transaction_growth, 2),
            'trend': trend,
            'period_count': len(trend_data)
        }