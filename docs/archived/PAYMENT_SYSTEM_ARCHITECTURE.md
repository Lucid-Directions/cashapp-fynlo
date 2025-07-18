# 🔒 Secure Payment System Architecture for Fynlo POS

## Overview

This document outlines the secure implementation plan for the Fynlo POS payment system, designed with security, PCI compliance, and reliability as top priorities.

## Core Principles

1. **Security First**: All payment data must be handled securely
2. **No Secrets in Code**: API keys and credentials must never be in source code
3. **Defense in Depth**: Multiple layers of security validation
4. **Audit Trail**: Every payment action must be logged
5. **Fail Safe**: System should fail securely with proper error handling

## Architecture Components

### 1. Backend Payment System

#### 1.1 Payment Provider Base Class
```python
# backend/app/services/payment_providers/base_provider.py
from abc import ABC, abstractmethod
from typing import Dict, Any, Optional
from decimal import Decimal
import logging

class PaymentProvider(ABC):
    """Base class for all payment providers"""
    
    def __init__(self, config: Dict[str, Any]):
        self.config = config
        self.logger = logging.getLogger(f"{__name__}.{self.__class__.__name__}")
        self._validate_config()
    
    @abstractmethod
    def _validate_config(self) -> None:
        """Validate provider-specific configuration"""
        pass
    
    @abstractmethod
    async def process_payment(
        self,
        amount: Decimal,
        currency: str,
        payment_method: Dict[str, Any],
        metadata: Optional[Dict[str, Any]] = None
    ) -> Dict[str, Any]:
        """Process a payment"""
        pass
    
    @abstractmethod
    async def refund_payment(
        self,
        transaction_id: str,
        amount: Optional[Decimal] = None,
        reason: Optional[str] = None
    ) -> Dict[str, Any]:
        """Process a refund"""
        pass
    
    @abstractmethod
    async def get_payment_status(self, transaction_id: str) -> Dict[str, Any]:
        """Get payment status"""
        pass
```

#### 1.2 Payment Configuration Service
```python
# backend/app/services/payment_config_service.py
from typing import Dict, Any, List
import os
from cryptography.fernet import Fernet
from sqlalchemy.orm import Session

class SecurePaymentConfigService:
    """Manages payment provider configurations securely"""
    
    def __init__(self, db: Session):
        self.db = db
        self.encryption_key = os.environ.get('PAYMENT_CONFIG_ENCRYPTION_KEY')
        if not self.encryption_key:
            raise ValueError("PAYMENT_CONFIG_ENCRYPTION_KEY not set")
        self.cipher = Fernet(self.encryption_key.encode())
    
    def get_provider_config(self, provider: str, restaurant_id: str) -> Dict[str, Any]:
        """Get decrypted configuration for a payment provider"""
        # Fetch from database
        config = self.db.query(PaymentProviderConfig).filter_by(
            provider=provider,
            restaurant_id=restaurant_id
        ).first()
        
        if not config:
            raise ValueError(f"No configuration found for {provider}")
        
        # Decrypt sensitive fields
        decrypted_config = {
            'provider': config.provider,
            'enabled': config.enabled,
            'mode': config.mode,  # 'sandbox' or 'production'
        }
        
        # Decrypt credentials
        if config.encrypted_credentials:
            credentials = self.cipher.decrypt(
                config.encrypted_credentials.encode()
            ).decode()
            decrypted_config['credentials'] = json.loads(credentials)
        
        return decrypted_config
    
    def store_provider_config(
        self, 
        provider: str, 
        restaurant_id: str,
        credentials: Dict[str, Any],
        mode: str = 'sandbox'
    ) -> None:
        """Store encrypted payment provider configuration"""
        # Encrypt credentials
        encrypted_creds = self.cipher.encrypt(
            json.dumps(credentials).encode()
        ).decode()
        
        # Store in database
        config = PaymentProviderConfig(
            provider=provider,
            restaurant_id=restaurant_id,
            encrypted_credentials=encrypted_creds,
            mode=mode,
            enabled=True
        )
        self.db.add(config)
        self.db.commit()
```

#### 1.3 Payment Processing Service
```python
# backend/app/services/payment_processor.py
from typing import Dict, Any, Optional, List
from decimal import Decimal
from sqlalchemy.orm import Session
import asyncio
from datetime import datetime

class SecurePaymentProcessor:
    """Handles payment processing with security and fallback logic"""
    
    def __init__(self, db: Session):
        self.db = db
        self.config_service = SecurePaymentConfigService(db)
        self.providers: Dict[str, PaymentProvider] = {}
        self._initialize_providers()
    
    def _initialize_providers(self):
        """Initialize available payment providers"""
        # This would dynamically load providers based on configuration
        pass
    
    async def process_payment(
        self,
        order_id: str,
        amount: Decimal,
        payment_method: str,
        payment_details: Dict[str, Any],
        user_id: str,
        restaurant_id: str
    ) -> Dict[str, Any]:
        """Process payment with automatic fallback"""
        
        # Validate inputs
        self._validate_payment_request(amount, payment_method)
        
        # Create payment record
        payment = Payment(
            order_id=order_id,
            amount=amount,
            payment_method=payment_method,
            status='pending',
            user_id=user_id,
            restaurant_id=restaurant_id,
            created_at=datetime.utcnow()
        )
        self.db.add(payment)
        self.db.commit()
        
        # Get provider priority list
        providers = self._get_provider_priority(payment_method, amount)
        
        # Try each provider
        last_error = None
        for provider_name in providers:
            try:
                provider = self.providers.get(provider_name)
                if not provider:
                    continue
                
                # Log attempt
                self._log_payment_attempt(payment.id, provider_name)
                
                # Process payment
                result = await provider.process_payment(
                    amount=amount,
                    currency='GBP',
                    payment_method=payment_details,
                    metadata={
                        'order_id': order_id,
                        'payment_id': str(payment.id)
                    }
                )
                
                # Update payment record
                payment.provider = provider_name
                payment.provider_transaction_id = result['transaction_id']
                payment.status = 'completed'
                payment.completed_at = datetime.utcnow()
                payment.provider_response = result
                self.db.commit()
                
                # Calculate fees
                fees = self._calculate_fees(amount, provider_name)
                
                return {
                    'success': True,
                    'payment_id': str(payment.id),
                    'transaction_id': result['transaction_id'],
                    'provider': provider_name,
                    'amount': float(amount),
                    'fees': fees,
                    'net_amount': float(amount - Decimal(str(fees['total_fee'])))
                }
                
            except Exception as e:
                last_error = e
                self._log_payment_error(payment.id, provider_name, str(e))
                continue
        
        # All providers failed
        payment.status = 'failed'
        payment.error_message = str(last_error)
        self.db.commit()
        
        raise PaymentProcessingError(
            f"Payment processing failed: {last_error}",
            payment_id=str(payment.id)
        )
    
    def _validate_payment_request(self, amount: Decimal, payment_method: str):
        """Validate payment request"""
        if amount <= 0:
            raise ValueError("Payment amount must be positive")
        
        if amount > Decimal('10000'):  # £10,000 limit
            raise ValueError("Payment amount exceeds maximum limit")
        
        valid_methods = ['card', 'cash', 'qr_code', 'apple_pay', 'google_pay']
        if payment_method not in valid_methods:
            raise ValueError(f"Invalid payment method: {payment_method}")
    
    def _get_provider_priority(self, payment_method: str, amount: Decimal) -> List[str]:
        """Get provider priority based on fees and availability"""
        if payment_method == 'card' or payment_method == 'apple_pay':
            # Priority: SumUp (0.69%) -> Square (1.75%) -> Stripe (1.4% + 20p)
            return ['sumup', 'square', 'stripe']
        elif payment_method == 'qr_code':
            return ['qr_provider']
        elif payment_method == 'cash':
            return ['cash_provider']
        else:
            return ['stripe']  # Default fallback
    
    def _calculate_fees(self, amount: Decimal, provider: str) -> Dict[str, float]:
        """Calculate payment processing fees"""
        fee_rates = {
            'sumup': {'percentage': 0.0069, 'fixed': 0},
            'square': {'percentage': 0.0175, 'fixed': 0},
            'stripe': {'percentage': 0.014, 'fixed': 0.20},
            'qr_provider': {'percentage': 0.012, 'fixed': 0},
            'cash_provider': {'percentage': 0, 'fixed': 0}
        }
        
        rates = fee_rates.get(provider, {'percentage': 0.029, 'fixed': 0})
        percentage_fee = float(amount) * rates['percentage']
        total_fee = percentage_fee + rates['fixed']
        
        return {
            'percentage_fee': round(percentage_fee, 2),
            'fixed_fee': rates['fixed'],
            'total_fee': round(total_fee, 2),
            'rate_percentage': rates['percentage'] * 100
        }
```

### 2. Frontend Payment System

#### 2.1 Secure Payment Configuration
```typescript
// src/services/SecurePaymentConfig.ts
interface PaymentConfig {
  availableMethods: PaymentMethod[];
  fees: Record<string, FeeStructure>;
}

class SecurePaymentConfigService {
  private config: PaymentConfig | null = null;
  
  async loadConfiguration(): Promise<PaymentConfig> {
    // Fetch configuration from secure backend endpoint
    const response = await authenticatedFetch('/api/v1/payments/config');
    this.config = response.data;
    return this.config;
  }
  
  getPublishableKey(provider: string): string | null {
    // Only return publishable keys, never secret keys
    if (!this.config) return null;
    return this.config.publishableKeys?.[provider] || null;
  }
}
```

#### 2.2 Payment Orchestrator
```typescript
// src/services/PaymentOrchestrator.ts
import { SecurePaymentConfigService } from './SecurePaymentConfig';

interface PaymentRequest {
  amount: number;
  orderId: string;
  paymentMethod: string;
  customerDetails?: any;
}

class PaymentOrchestrator {
  private configService: SecurePaymentConfigService;
  
  constructor() {
    this.configService = new SecurePaymentConfigService();
  }
  
  async initialize(): Promise<void> {
    await this.configService.loadConfiguration();
  }
  
  async processPayment(request: PaymentRequest): Promise<PaymentResult> {
    // Validate request
    this.validatePaymentRequest(request);
    
    // Get payment token from provider SDK (never handle raw card data)
    const paymentToken = await this.getPaymentToken(request);
    
    // Send to backend for processing
    const response = await authenticatedFetch('/api/v1/payments/process', {
      method: 'POST',
      body: JSON.stringify({
        amount: request.amount,
        order_id: request.orderId,
        payment_method: request.paymentMethod,
        payment_token: paymentToken,
      }),
    });
    
    return response.data;
  }
  
  private validatePaymentRequest(request: PaymentRequest): void {
    if (request.amount <= 0) {
      throw new Error('Invalid payment amount');
    }
    
    if (request.amount > 10000) {
      throw new Error('Payment amount exceeds maximum limit');
    }
  }
}
```

## Security Measures

### 1. API Security
- All payment endpoints require authentication
- Rate limiting: 10 requests per minute per user
- Request signing for payment operations
- IP whitelist for production environment

### 2. Data Security
- No card data stored in our database
- All sensitive config encrypted at rest
- TLS 1.3 for all API communications
- PCI DSS compliance through tokenization

### 3. Audit Logging
```python
# Every payment action logged
class PaymentAuditLog(Base):
    __tablename__ = 'payment_audit_logs'
    
    id = Column(UUID, primary_key=True)
    payment_id = Column(UUID, ForeignKey('payments.id'))
    action = Column(String)  # 'attempt', 'success', 'failure', 'refund'
    provider = Column(String)
    user_id = Column(UUID)
    ip_address = Column(String)
    user_agent = Column(String)
    request_data = Column(JSONB)  # Sanitized, no sensitive data
    response_data = Column(JSONB)  # Sanitized
    created_at = Column(DateTime)
```

### 4. Error Handling
- Generic error messages to users
- Detailed errors only in secure logs
- Automatic alerting for payment failures
- Circuit breaker for provider failures

## Implementation Phases

### Phase 1: Foundation (Week 1)
1. Create payment database schema
2. Implement base provider class
3. Add configuration encryption service
4. Set up audit logging

### Phase 2: Provider Integration (Week 2)
1. Implement Cash provider (simplest)
2. Add Stripe provider with tokenization
3. Implement SumUp provider
4. Add Square provider

### Phase 3: Frontend Integration (Week 3)
1. Create secure config service
2. Implement payment orchestrator
3. Update payment screen with security
4. Add comprehensive error handling

### Phase 4: Testing & Security (Week 4)
1. Unit tests for all components
2. Integration tests with mock providers
3. Security penetration testing
4. Load testing for payment endpoints

## Testing Strategy

### 1. Unit Tests
```python
# Example test for fee calculation
def test_fee_calculation():
    processor = PaymentProcessor(mock_db)
    fees = processor._calculate_fees(Decimal('100.00'), 'stripe')
    assert fees['total_fee'] == 1.60  # 1.4% + 20p
```

### 2. Integration Tests
- Mock provider responses
- Test fallback scenarios
- Verify audit logging
- Check error handling

### 3. Security Tests
- SQL injection attempts
- Rate limiting verification
- Authentication bypass attempts
- Encryption validation

## Monitoring & Alerts

### Key Metrics
1. Payment success rate by provider
2. Average processing time
3. Fee optimization (lowest fee provider usage)
4. Error rates and types

### Alerts
- Payment failure rate > 5%
- Provider downtime detected
- Unusual payment patterns
- Security violations

## Compliance Checklist

- [ ] PCI DSS Level 1 compliance
- [ ] GDPR compliance for customer data
- [ ] Strong Customer Authentication (SCA)
- [ ] Regular security audits
- [ ] Incident response plan
- [ ] Data retention policies

## Environment Variables Required

```bash
# Backend
PAYMENT_CONFIG_ENCRYPTION_KEY=<32-byte-key>
STRIPE_WEBHOOK_SECRET=<webhook-secret>
SUMUP_WEBHOOK_SECRET=<webhook-secret>
SQUARE_WEBHOOK_SECRET=<webhook-secret>

# Database
DATABASE_URL=<connection-string>
REDIS_URL=<redis-connection>

# Monitoring
SENTRY_DSN=<sentry-dsn>
PAYMENT_ALERT_WEBHOOK=<slack-webhook>
```

## Next Steps

1. Review and approve architecture
2. Set up development environment
3. Create database migrations
4. Begin Phase 1 implementation
5. Schedule security review

This architecture ensures secure, reliable payment processing while maintaining flexibility for future payment methods and providers.