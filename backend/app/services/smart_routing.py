"""
Smart Payment Routing Service
Advanced algorithms for optimal payment provider selection based on multiple factors
"""

import logging
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
import asyncio

from app.services.payment_analytics import PaymentAnalyticsService

logger = logging.getLogger(__name__)

class RoutingStrategy(Enum):
    """Different routing strategies available"""
    COST_OPTIMAL = "cost_optimal"
    RELIABILITY_FIRST = "reliability_first"
    SPEED_OPTIMAL = "speed_optimal"
    BALANCED = "balanced"
    VOLUME_AWARE = "volume_aware"

@dataclass
class ProviderScore:
    """Score breakdown for a provider"""
    provider: str
    total_score: float
    cost_score: float
    reliability_score: float
    speed_score: float
    volume_score: float
    availability_score: float

@dataclass
class RoutingDecision:
    """Result of routing decision"""
    selected_provider: str
    confidence: float
    reasoning: List[str]
    alternatives: List[Tuple[str, float]]
    cost_analysis: Dict
    risk_factors: List[str]

class SmartRoutingService:
    """Service for intelligent payment provider routing"""
    
    def __init__(self, analytics_service: PaymentAnalyticsService):
        self.analytics = analytics_service
        self.provider_configs = {
            'stripe': {
                'base_fee_percentage': Decimal('0.014'),  # 1.4%
                'fixed_fee': Decimal('0.20'),  # 20p
                'max_amount': Decimal('999999'),  # No practical limit
                'processing_time_ms': 2000,
                'reliability_score': 0.995,
                'availability_zones': ['EU', 'US', 'UK']
            },
            'square': {
                'base_fee_percentage': Decimal('0.0175'),  # 1.75%
                'fixed_fee': Decimal('0'),
                'max_amount': Decimal('50000'),  # £500 limit for contactless
                'processing_time_ms': 3000,
                'reliability_score': 0.992,
                'availability_zones': ['US', 'UK', 'CA']
            },
            'sumup': {
                'base_fee_percentage': Decimal('0.0069'),  # 0.69% for high volume
                'monthly_fee': Decimal('19'),  # £19/month
                'volume_threshold': Decimal('2714'),  # £2,714/month threshold
                'standard_fee_percentage': Decimal('0.0169'),  # 1.69% standard
                'max_amount': Decimal('999999'),
                'processing_time_ms': 2500,
                'reliability_score': 0.988,
                'availability_zones': ['EU', 'UK']
            },
            'qr_code': {
                'base_fee_percentage': Decimal('0.012'),  # 1.2%
                'fixed_fee': Decimal('0'),
                'max_amount': Decimal('999999'),
                'processing_time_ms': 5000,  # Longer due to customer interaction
                'reliability_score': 0.985,  # Depends on customer action
                'availability_zones': ['GLOBAL']
            }
        }
    
    async def route_payment(
        self,
        amount: Decimal,
        restaurant_id: str,
        strategy: RoutingStrategy = RoutingStrategy.BALANCED,
        customer_preferences: Optional[Dict] = None,
        force_provider: Optional[str] = None
    ) -> RoutingDecision:
        """
        Make intelligent routing decision based on multiple factors
        """
        
        if force_provider:
            return RoutingDecision(
                selected_provider=force_provider,
                confidence=1.0,
                reasoning=[f"Provider forced: {force_provider}"],
                alternatives=[],
                cost_analysis={},
                risk_factors=[]
            )
        
        # Get historical data and current state
        analytics_data = await self._get_routing_context(restaurant_id, amount)
        
        # Score all providers
        provider_scores = await self._score_providers(
            amount, restaurant_id, analytics_data, strategy
        )
        
        # Make routing decision
        decision = await self._make_routing_decision(
            provider_scores, analytics_data, strategy
        )
        
        return decision
    
    async def get_routing_recommendations(
        self,
        restaurant_id: str,
        analysis_period_days: int = 30
    ) -> Dict:
        """
        Get comprehensive routing recommendations for a restaurant
        """
        
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=analysis_period_days)
        
        # Get comprehensive analytics
        performance_data = await self.analytics.get_provider_performance_summary(
            restaurant_id, start_date, end_date
        )
        
        cost_optimization = await self.analytics.get_cost_optimization_report(
            restaurant_id, start_date, end_date
        )
        
        health_scores = await self.analytics.get_provider_health_scores(restaurant_id)
        
        # Analyze transaction patterns
        transaction_patterns = await self._analyze_transaction_patterns(
            restaurant_id, start_date, end_date
        )
        
        # Generate routing strategy recommendations
        strategy_recommendations = await self._recommend_routing_strategies(
            performance_data, cost_optimization, health_scores, transaction_patterns
        )
        
        return {
            'restaurant_id': restaurant_id,
            'analysis_period': {
                'start_date': start_date.isoformat(),
                'end_date': end_date.isoformat(),
                'days': analysis_period_days
            },
            'current_performance': performance_data,
            'cost_optimization': cost_optimization,
            'provider_health': health_scores,
            'transaction_patterns': transaction_patterns,
            'routing_recommendations': strategy_recommendations
        }
    
    async def simulate_routing_impact(
        self,
        restaurant_id: str,
        new_strategy: RoutingStrategy,
        simulation_days: int = 30
    ) -> Dict:
        """
        Simulate the impact of changing routing strategy
        """
        
        # Get historical transactions
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=simulation_days)
        
        # For simulation, we'll use the analytics service to get historical data
        # and re-route each transaction with the new strategy
        
        analytics_data = await self.analytics.get_provider_performance_summary(
            restaurant_id, start_date, end_date
        )
        
        current_fees = analytics_data['overall_metrics']['total_fees']
        current_volume = analytics_data['overall_metrics']['total_volume']
        
        # Simulate new routing
        simulated_fees = await self._simulate_fees_with_strategy(
            current_volume, new_strategy, restaurant_id
        )
        
        savings = current_fees - simulated_fees
        savings_percentage = (savings / current_fees * 100) if current_fees > 0 else 0
        
        return {
            'strategy': new_strategy.value,
            'simulation_period': simulation_days,
            'current_state': {
                'total_fees': current_fees,
                'total_volume': current_volume
            },
            'projected_state': {
                'total_fees': simulated_fees,
                'savings': savings,
                'savings_percentage': savings_percentage
            },
            'risk_assessment': await self._assess_strategy_risks(new_strategy, restaurant_id)
        }
    
    async def _get_routing_context(self, restaurant_id: str, amount: Decimal) -> Dict:
        """Gather context information for routing decision"""
        
        # Get recent performance data
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)  # Last week
        
        performance = await self.analytics.get_provider_performance_summary(
            restaurant_id, start_date, end_date
        )
        
        health_scores = await self.analytics.get_provider_health_scores(restaurant_id)
        
        # Calculate monthly volume projection
        weekly_volume = performance['overall_metrics']['total_volume']
        monthly_volume = weekly_volume * (30/7)  # Project monthly
        
        return {
            'performance': performance,
            'health_scores': health_scores,
            'monthly_volume': monthly_volume,
            'current_transaction_amount': float(amount)
        }
    
    async def _score_providers(
        self,
        amount: Decimal,
        restaurant_id: str,
        analytics_data: Dict,
        strategy: RoutingStrategy
    ) -> List[ProviderScore]:
        """Score all available providers based on multiple factors"""
        
        scores = []
        monthly_volume = Decimal(str(analytics_data['monthly_volume']))
        
        for provider, config in self.provider_configs.items():
            # Cost score (0-100, higher is better/cheaper)
            cost_score = await self._calculate_cost_score(
                provider, amount, monthly_volume, config
            )
            
            # Reliability score (0-100)
            reliability_score = await self._calculate_reliability_score(
                provider, analytics_data, config
            )
            
            # Speed score (0-100, faster is better)
            speed_score = await self._calculate_speed_score(provider, config)
            
            # Volume appropriateness score (0-100)
            volume_score = await self._calculate_volume_score(
                provider, amount, monthly_volume, config
            )
            
            # Availability score (0-100)
            availability_score = await self._calculate_availability_score(
                provider, config
            )
            
            # Calculate weighted total based on strategy
            weights = self._get_strategy_weights(strategy)
            total_score = (
                cost_score * weights['cost'] +
                reliability_score * weights['reliability'] +
                speed_score * weights['speed'] +
                volume_score * weights['volume'] +
                availability_score * weights['availability']
            )
            
            scores.append(ProviderScore(
                provider=provider,
                total_score=total_score,
                cost_score=cost_score,
                reliability_score=reliability_score,
                speed_score=speed_score,
                volume_score=volume_score,
                availability_score=availability_score
            ))
        
        # Sort by total score (highest first)
        scores.sort(key=lambda x: x.total_score, reverse=True)
        
        return scores
    
    async def _calculate_cost_score(
        self,
        provider: str,
        amount: Decimal,
        monthly_volume: Decimal,
        config: Dict
    ) -> float:
        """Calculate cost efficiency score (0-100, higher is cheaper)"""
        
        # Calculate fee for this transaction
        if provider == 'sumup':
            if monthly_volume >= config['volume_threshold']:
                fee = amount * config['base_fee_percentage']
                # Add proportional monthly fee
                monthly_fee_per_transaction = config['monthly_fee'] / (monthly_volume / amount) if monthly_volume > 0 else Decimal('0')
                fee += monthly_fee_per_transaction
            else:
                fee = amount * config['standard_fee_percentage']
        else:
            fee = amount * config['base_fee_percentage']
            if 'fixed_fee' in config:
                fee += config['fixed_fee']
        
        # Convert to percentage
        fee_percentage = (fee / amount * 100) if amount > 0 else 0
        
        # Score: 100 - (fee_percentage * 50) to normalize to 0-100 range
        # Assuming max reasonable fee is 2%
        cost_score = max(0, 100 - (float(fee_percentage) * 50))
        
        return cost_score
    
    async def _calculate_reliability_score(
        self,
        provider: str,
        analytics_data: Dict,
        config: Dict
    ) -> float:
        """Calculate reliability score based on historical data and config"""
        
        # Start with base reliability from config
        base_reliability = config.get('reliability_score', 0.99) * 100
        
        # Adjust based on health scores if available
        health_scores = analytics_data.get('health_scores', {})
        if provider in health_scores:
            provider_health = health_scores[provider]
            reliability_factor = provider_health.get('factors', {}).get('reliability', base_reliability)
            # Weighted average of config and actual performance
            reliability_score = (base_reliability * 0.3) + (reliability_factor * 0.7)
        else:
            reliability_score = base_reliability
        
        return min(100, reliability_score)
    
    async def _calculate_speed_score(self, provider: str, config: Dict) -> float:
        """Calculate processing speed score (0-100, faster is better)"""
        
        processing_time = config.get('processing_time_ms', 3000)
        
        # Score based on processing time (2s = 100, 10s = 0)
        max_time = 10000  # 10 seconds
        min_time = 2000   # 2 seconds
        
        if processing_time <= min_time:
            return 100
        elif processing_time >= max_time:
            return 0
        else:
            return 100 - ((processing_time - min_time) / (max_time - min_time) * 100)
    
    async def _calculate_volume_score(
        self,
        provider: str,
        amount: Decimal,
        monthly_volume: Decimal,
        config: Dict
    ) -> float:
        """Calculate how well this provider suits the volume"""
        
        # Check if amount exceeds limits
        max_amount = config.get('max_amount', Decimal('999999'))
        if amount > max_amount:
            return 0  # Cannot process
        
        # Volume appropriateness
        if provider == 'sumup':
            # SumUp is best for high volume
            if monthly_volume >= config['volume_threshold']:
                return 100  # Perfect fit
            else:
                # Score decreases as volume gets further from threshold
                ratio = float(monthly_volume / config['volume_threshold'])
                return min(100, ratio * 100)
        
        elif provider == 'qr_code':
            # QR code is good for any volume but better for medium amounts
            if Decimal('10') <= amount <= Decimal('500'):
                return 100
            elif amount < Decimal('10'):
                return 70  # Small amounts are ok but not ideal
            else:
                return 90  # Large amounts are fine
        
        elif provider in ['stripe', 'square']:
            # Traditional providers are good for medium volumes
            if Decimal('1000') <= monthly_volume <= Decimal('10000'):
                return 100
            elif monthly_volume < Decimal('1000'):
                return 80  # Ok for small volumes
            else:
                return 70  # Could be expensive for high volumes
        
        return 80  # Default score
    
    async def _calculate_availability_score(self, provider: str, config: Dict) -> float:
        """Calculate availability score based on geographic and time factors"""
        
        # For now, return 100 if available in UK
        availability_zones = config.get('availability_zones', [])
        if 'UK' in availability_zones or 'GLOBAL' in availability_zones:
            return 100
        elif 'EU' in availability_zones:
            return 90
        else:
            return 70
    
    def _get_strategy_weights(self, strategy: RoutingStrategy) -> Dict[str, float]:
        """Get weighting factors for different strategies"""
        
        if strategy == RoutingStrategy.COST_OPTIMAL:
            return {
                'cost': 0.5,
                'reliability': 0.2,
                'speed': 0.1,
                'volume': 0.15,
                'availability': 0.05
            }
        elif strategy == RoutingStrategy.RELIABILITY_FIRST:
            return {
                'cost': 0.15,
                'reliability': 0.5,
                'speed': 0.15,
                'volume': 0.15,
                'availability': 0.05
            }
        elif strategy == RoutingStrategy.SPEED_OPTIMAL:
            return {
                'cost': 0.2,
                'reliability': 0.25,
                'speed': 0.4,
                'volume': 0.1,
                'availability': 0.05
            }
        elif strategy == RoutingStrategy.VOLUME_AWARE:
            return {
                'cost': 0.3,
                'reliability': 0.2,
                'speed': 0.1,
                'volume': 0.35,
                'availability': 0.05
            }
        else:  # BALANCED
            return {
                'cost': 0.3,
                'reliability': 0.3,
                'speed': 0.2,
                'volume': 0.15,
                'availability': 0.05
            }
    
    async def _make_routing_decision(
        self,
        provider_scores: List[ProviderScore],
        analytics_data: Dict,
        strategy: RoutingStrategy
    ) -> RoutingDecision:
        """Make final routing decision based on scores"""
        
        if not provider_scores:
            raise ValueError("No providers available for routing")
        
        # Select top provider
        selected = provider_scores[0]
        
        # Calculate confidence based on score gap
        if len(provider_scores) > 1:
            score_gap = selected.total_score - provider_scores[1].total_score
            confidence = min(1.0, 0.5 + (score_gap / 100))
        else:
            confidence = 1.0
        
        # Generate reasoning
        reasoning = []
        reasoning.append(f"Selected {selected.provider} with score {selected.total_score:.1f}")
        
        if selected.cost_score >= 80:
            reasoning.append("Excellent cost efficiency")
        elif selected.cost_score >= 60:
            reasoning.append("Good cost efficiency")
        
        if selected.reliability_score >= 90:
            reasoning.append("High reliability")
        
        if selected.volume_score >= 90:
            reasoning.append("Well-suited for transaction volume")
        
        # Identify alternatives
        alternatives = [
            (score.provider, score.total_score) 
            for score in provider_scores[1:3]  # Top 2 alternatives
        ]
        
        # Cost analysis
        cost_analysis = {
            'selected_provider_cost_score': selected.cost_score,
            'strategy_used': strategy.value,
            'confidence_level': confidence
        }
        
        # Risk factors
        risk_factors = []
        if selected.reliability_score < 80:
            risk_factors.append("Below average reliability")
        if selected.availability_score < 90:
            risk_factors.append("Limited availability")
        if confidence < 0.7:
            risk_factors.append("Low confidence in selection")
        
        return RoutingDecision(
            selected_provider=selected.provider,
            confidence=confidence,
            reasoning=reasoning,
            alternatives=alternatives,
            cost_analysis=cost_analysis,
            risk_factors=risk_factors
        )
    
    async def _analyze_transaction_patterns(
        self,
        restaurant_id: str,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """Analyze transaction patterns for insights"""
        
        # Get hourly transaction data (mock for now)
        patterns = {
            'peak_hours': [12, 13, 18, 19, 20],  # Lunch and dinner
            'avg_transaction_size': 25.50,
            'volume_distribution': {
                '0-10': 20,
                '10-25': 40,
                '25-50': 25,
                '50-100': 12,
                '100+': 3
            },
            'preferred_methods': {
                'card': 60,
                'qr_code': 25,
                'cash': 15
            }
        }
        
        return patterns
    
    async def _recommend_routing_strategies(
        self,
        performance_data: Dict,
        cost_optimization: Dict,
        health_scores: Dict,
        transaction_patterns: Dict
    ) -> List[Dict]:
        """Generate routing strategy recommendations"""
        
        recommendations = []
        
        # Cost-based recommendation
        if cost_optimization['savings_opportunity']['savings_percentage'] > 10:
            recommendations.append({
                'strategy': RoutingStrategy.COST_OPTIMAL.value,
                'priority': 'high',
                'title': 'Switch to Cost-Optimal Routing',
                'description': f"Could save {cost_optimization['savings_opportunity']['savings_percentage']:.1f}% on fees",
                'estimated_impact': {
                    'monthly_savings': cost_optimization['savings_opportunity']['potential_savings'],
                    'implementation_effort': 'low'
                }
            })
        
        # Reliability-based recommendation
        avg_reliability = sum(
            score['overall_score'] for score in health_scores['health_scores'].values()
        ) / len(health_scores['health_scores']) if health_scores['health_scores'] else 0
        
        if avg_reliability < 80:
            recommendations.append({
                'strategy': RoutingStrategy.RELIABILITY_FIRST.value,
                'priority': 'medium',
                'title': 'Improve Payment Reliability',
                'description': f"Current reliability score is {avg_reliability:.1f}",
                'estimated_impact': {
                    'reliability_improvement': '15-20%',
                    'implementation_effort': 'medium'
                }
            })
        
        # Volume-aware recommendation
        total_volume = performance_data['overall_metrics']['total_volume']
        if total_volume > 2714:
            recommendations.append({
                'strategy': RoutingStrategy.VOLUME_AWARE.value,
                'priority': 'high',
                'title': 'Enable Volume-Aware Routing',
                'description': f"Your volume (£{total_volume:,.2f}/month) qualifies for volume discounts",
                'estimated_impact': {
                    'potential_savings': 'Up to 30%',
                    'implementation_effort': 'low'
                }
            })
        
        return recommendations
    
    async def _simulate_fees_with_strategy(
        self,
        volume: float,
        strategy: RoutingStrategy,
        restaurant_id: str
    ) -> float:
        """Simulate fees with a different routing strategy"""
        
        # This is a simplified simulation
        # In practice, you'd replay historical transactions
        
        volume_decimal = Decimal(str(volume))
        
        if strategy == RoutingStrategy.COST_OPTIMAL:
            if volume_decimal >= Decimal('2714'):
                # Use SumUp for all
                return float((volume_decimal * Decimal('0.0069')) + Decimal('19'))
            else:
                # Use QR code for all
                return float(volume_decimal * Decimal('0.012'))
        
        elif strategy == RoutingStrategy.VOLUME_AWARE:
            if volume_decimal >= Decimal('2714'):
                # Mix of SumUp (80%) and QR (20%)
                sumup_volume = volume_decimal * Decimal('0.8')
                qr_volume = volume_decimal * Decimal('0.2')
                sumup_fees = (sumup_volume * Decimal('0.0069')) + Decimal('19')
                qr_fees = qr_volume * Decimal('0.012')
                return float(sumup_fees + qr_fees)
        
        # Default to current average (1.4%)
        return float(volume_decimal * Decimal('0.014'))
    
    async def _assess_strategy_risks(
        self,
        strategy: RoutingStrategy,
        restaurant_id: str
    ) -> List[Dict]:
        """Assess risks of implementing a strategy"""
        
        risks = []
        
        if strategy == RoutingStrategy.COST_OPTIMAL:
            risks.append({
                'type': 'reliability',
                'level': 'medium',
                'description': 'May prioritize cost over payment success rate'
            })
        
        elif strategy == RoutingStrategy.SPEED_OPTIMAL:
            risks.append({
                'type': 'cost',
                'level': 'high',
                'description': 'May result in higher fees for faster processing'
            })
        
        elif strategy == RoutingStrategy.VOLUME_AWARE:
            risks.append({
                'type': 'complexity',
                'level': 'low',
                'description': 'Requires accurate volume tracking and thresholds'
            })
        
        return risks