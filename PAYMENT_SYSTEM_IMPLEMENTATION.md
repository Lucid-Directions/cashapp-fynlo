# Payment System Implementation

## Overview

This document details the complete payment system implementation for the Fynlo POS platform, featuring SumUp Tap to Pay as the primary payment method with automatic fallback to Square and Stripe.

## Payment Methods

### Primary: SumUp (0.69% + £19/month for high volume)
- **Tap to Pay on iPhone**: NFC contactless payments
- **Apple Pay**: Via SumUp SDK
- **Manual Card Entry**: Fallback for non-contactless cards
- **Status**: ✅ Frontend SDK integrated, Backend API ready

### Backup 1: Square (1.75%)
- **Card Payments**: Via Square Web Payments SDK
- **Status**: ✅ Backend implementation complete, Frontend placeholder

### Backup 2: Stripe (1.4% + 20p)
- **Card Payments**: Via Stripe React Native SDK
- **Status**: ✅ Both frontend and backend implemented

### Additional Methods
- **QR Code Payments** (1.2%): Platform-managed
- **Cash**: No fees, local tracking

## Architecture

### Frontend Components

#### 1. PaymentOrchestrator (`src/services/PaymentOrchestrator.ts`)
- Manages payment method selection and routing
- Implements automatic fallback logic
- Calculates fees dynamically
- Initializes all payment providers

#### 2. Payment Providers
- **SumUpPaymentProvider**: Hook-based React Native integration
- **SquarePaymentProvider**: Placeholder (needs SDK integration)
- **StripePaymentProvider**: Fully implemented with React Native SDK

#### 3. Payment Components
- **PaymentScreen**: Main payment interface
- **SumUpPaymentComponent**: React hook-based SumUp integration
- **QRCodePayment**: QR code generation and display

### Backend Services

#### 1. PaymentRouter (`backend/app/services/payment_router.py`)
- Unified payment processing API
- Automatic provider fallback
- Smart routing based on fees and availability
- Payment analytics tracking

#### 2. Payment Providers
- **SumUpProvider**: Full API integration with refunds
- **SquareProvider**: Complete implementation with Square SDK
- **StripeProvider**: Payment intents and checkout sessions

#### 3. Supporting Services
- **PaymentAnalyticsService**: Tracks success rates and fees
- **SmartRoutingService**: Optimizes provider selection
- **PaymentFeeCalculator**: Calculates platform and processing fees

## Implementation Status

### ✅ Completed
1. **Frontend Architecture**
   - PaymentOrchestrator service
   - PaymentFeeCalculator
   - SumUp React Native integration
   - Stripe SDK integration
   - Payment screen UI updates

2. **Backend Architecture**
   - PaymentRouter with fallback logic
   - All three payment providers
   - Refund support
   - Fee calculation
   - Analytics tracking

3. **Integration Points**
   - Unified payment API
   - Automatic fallback mechanism
   - Fee transparency
   - Error handling

### 🔄 In Progress
1. **Square Frontend Integration**
   - Replace placeholder with actual SDK
   - Implement card entry UI

2. **Testing**
   - End-to-end payment flows
   - Fallback scenarios
   - Error conditions

### 📋 TODO
1. **Production Configuration**
   - Update API keys and credentials
   - Configure webhook endpoints
   - Set up SSL certificates

2. **Enhanced Features**
   - Saved payment methods
   - Recurring payments
   - Split payments

## Payment Flow

### Primary Flow (SumUp)
1. User selects payment method (Tap to Pay/Apple Pay/Card)
2. PaymentOrchestrator checks SumUp availability
3. SumUpPaymentComponent presents native payment UI
4. Payment processed through SumUp SDK
5. Success/failure handled with appropriate UI feedback

### Fallback Flow
1. If SumUp fails or unavailable
2. PaymentOrchestrator automatically tries Square
3. If Square fails, tries Stripe
4. User notified of provider switch
5. Payment processed through backup provider

### Backend Processing
1. Frontend sends payment request to `/api/v1/payments/process`
2. PaymentRouter determines optimal provider
3. Attempts payment with primary provider
4. Automatic fallback if primary fails
5. Returns standardized response

## Fee Structure

### Processing Fees
- **SumUp**: 0.69% (high volume) + £19/month
- **Square**: 1.75%
- **Stripe**: 1.4% + 20p
- **QR Code**: 1.2%
- **Cash**: No fees

### Platform Fees
- Configurable per payment method
- Default: 1% for card payments
- QR payments: 0.5%
- Cash: 0%

## API Endpoints

### Process Payment
```
POST /api/v1/payments/process
{
  "amount": 10.50,
  "payment_method": "tapToPay",
  "currency": "GBP",
  "order_id": "ORDER-123",
  "metadata": {...}
}
```

### Get Payment Methods
```
GET /api/v1/payments/methods
```

### Process Refund
```
POST /api/v1/payments/refund
{
  "provider": "sumup",
  "transaction_id": "tx_123",
  "amount": 5.00,
  "reason": "Customer request"
}
```

## Error Handling

### Frontend
- User-friendly error messages
- Automatic retry with fallback provider
- Clear indication of provider switches
- Fallback to manual entry if all else fails

### Backend
- Comprehensive error logging
- Analytics tracking for failures
- Graceful degradation
- Detailed error responses

## Security Considerations

1. **No sensitive data in frontend**
   - All API keys stored server-side
   - Payment processing through secure SDKs
   - Token-based authentication

2. **PCI Compliance**
   - Card data never touches our servers
   - Direct SDK-to-provider communication
   - Secure tokenization

3. **SSL/TLS**
   - All API communications encrypted
   - Certificate pinning for production

## Testing

### Unit Tests
- Payment provider mocks
- Fee calculation tests
- Fallback logic tests

### Integration Tests
- End-to-end payment flows
- Provider switching
- Error scenarios

### Manual Testing
1. Test each payment method
2. Force failures to test fallback
3. Verify fee calculations
4. Check refund processing

## Deployment Checklist

- [ ] Update production API keys
- [ ] Configure webhook URLs
- [ ] Test payment flows in staging
- [ ] Verify SSL certificates
- [ ] Enable monitoring and alerts
- [ ] Update fee configurations
- [ ] Train support staff
- [ ] Document troubleshooting steps

## Monitoring

### Key Metrics
- Payment success rate by provider
- Average processing time
- Fallback frequency
- Fee collection accuracy

### Alerts
- Provider availability issues
- High failure rates
- Unusual transaction patterns
- Fee discrepancies