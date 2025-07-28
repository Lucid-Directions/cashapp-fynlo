# Square Payment Integration Guide

## Overview

This document provides comprehensive guidance for integrating Square as a secondary payment method in the Finlow POS system. Square offers competitive processing rates and robust payment capabilities that complement our primary SumUp integration.

## Square Developer Account Setup

### Prerequisites
- Square developer account already created
- Square application configured for Finlow POS
- Access to both sandbox and production credentials

### Required Credentials

#### Sandbox Environment
- **Sandbox Application ID**: `sandbox-sq0idb-[YOUR_SANDBOX_APP_ID]`
- **Sandbox Access Token**: For API calls in testing
- **OAuth Credentials**: For PKCE flow authentication

#### Production Environment  
- **Production Application ID**: `sq0idb-[YOUR_PRODUCTION_APP_ID]`
- **Production OAuth Credentials**: For live payment processing
- **Webhook Endpoints**: For real-time payment confirmations

## Square Fee Structure (UK - 2024)

### Transaction Fees
- **In-Person Payments**: 1.75% per transaction
  - Contactless, chip & PIN, swiped card-present transactions
  - Includes all UK and international cards (Visa, Mastercard, Amex)

- **Online Payments**: 
  - UK cards: 1.4% + 25p per transaction
  - Non-UK cards: 2.5% + 25p per transaction
  - Applies to eCommerce API, Online Checkout, subscriptions

- **Manual Keyed-In**: 2.5% per transaction
  - Manually entered in POS app
  - Square Invoices and Virtual Terminal

### No Additional Fees
- ✅ No monthly fees
- ✅ No setup fees  
- ✅ No minimum transaction requirements
- ✅ No contracts or lock-in periods
- ✅ PCI compliance included
- ✅ Same rate for all card types

## Technical Architecture

### SDK Integration
- **React Native Plugin**: `react-native-square-in-app-payments`
- **Version**: Latest (1.7.6+)
- **Native SDK**: Square In-App Payments SDK for iOS/Android

### Authentication Flow
- **OAuth 2.0 PKCE Flow**: Recommended for React Native (public clients)
- **Token Management**: 30-day access token expiry
- **Refresh Tokens**: 90-day expiry for PKCE flow
- **Security**: AES encryption for production tokens

### Supported Payment Methods
1. **Card Payments**
   - Chip & PIN
   - Contactless cards
   - Magnetic stripe (fallback)

2. **Digital Wallets**
   - Apple Pay (iOS)
   - Google Pay (Android)
   - Samsung Pay (Android)

3. **Additional Features**
   - Partial payments
   - Refunds (via API)
   - Gift cards
   - Recurring payments

## System Requirements

### iOS Requirements
- **iOS Version**: 13.0 or greater
- **Xcode**: 15.0 or greater
- **Deployment Target**: iOS 13.0+
- **Framework**: SquareInAppPaymentsSDK.framework

### Android Requirements  
- **minSdkVersion**: API 24 (Android 7.0) or higher
- **Target SDK**: API 33 (Android 13)
- **Gradle Plugin**: 4.0.0 or greater

### React Native Requirements
- **React Native**: 0.70+
- **Node.js**: 18.18.0+
- **npm**: 9.0.0+

## Implementation Strategy

### Phase 1: Core Service Implementation
```typescript
// SquareService.ts - Core payment processing
class SquareService {
  // Card payment processing
  async processCardPayment(amount: number): Promise<SquarePaymentResult>
  
  // Contactless payments (Apple Pay / Google Pay)
  async processContactlessPayment(amount: number): Promise<SquarePaymentResult>
  
  // Fee calculations
  calculateFee(amount: number, isInPerson: boolean): number
  
  // OAuth token management
  async refreshAccessToken(): Promise<string>
}
```

### Phase 2: UI Components
```typescript
// Payment screens matching SumUp implementation
- SquareCardPaymentScreen.tsx
- SquareContactlessPaymentScreen.tsx  
- SquarePaymentMethodSelector.tsx
```

### Phase 3: Platform Integration
```typescript
// PlatformService.ts updates
const paymentProviders = {
  sumup: { rate: 0.69, priority: 1 },    // Primary
  square: { rate: 1.75, priority: 2 },   // Secondary
  stripe: { rate: 1.4, priority: 3 }     // Fallback
}
```

## Security Considerations

### Token Storage
- **Development**: Plain text in secure environment variables
- **Production**: AES-256 encryption with secure key management
- **Client-Side**: Never store OAuth tokens in React Native app

### API Security
- **HTTPS Only**: All API calls use TLS 1.2+
- **Token Validation**: Check token age before API calls
- **Rate Limiting**: Respect Square API rate limits
- **Error Handling**: Secure error messages (no sensitive data exposure)

### PCI Compliance
- **Tokenization**: Card data tokenized by Square SDK
- **No Storage**: Never store card data in Finlow systems
- **Secure Transmission**: Card data goes directly to Square servers

## Testing Strategy

### Sandbox Testing
1. **Test Card Numbers**:
   - `4532 1488 0343 6467` (Visa)
   - `5105 1051 0510 5100` (Mastercard)
   - `3782 8224 6310 005` (American Express)

2. **Test Scenarios**:
   - Successful payments
   - Declined cards
   - Network timeouts
   - Invalid amounts
   - Refund processing

### Integration Testing
- Payment flow testing with existing POS system
- Fallback testing (SumUp → Square)
- Error handling and recovery
- Performance under load
- Cross-platform compatibility (iOS/Android)

## Deployment Checklist

### Pre-Production
- [ ] All sandbox tests passing
- [ ] Production credentials configured
- [ ] OAuth flow tested end-to-end  
- [ ] Webhook endpoints validated
- [ ] Security audit completed
- [ ] Performance testing completed

### Go-Live
- [ ] Production Application ID configured
- [ ] Real payment testing (small amounts)
- [ ] Monitoring and alerting configured
- [ ] Rollback plan prepared
- [ ] Team training completed

## Monitoring & Analytics

### Key Metrics
- **Payment Success Rate**: Target >99%
- **Processing Time**: Target <3 seconds
- **Error Rate**: Target <1%
- **Fallback Usage**: Monitor SumUp → Square switching

### Alerting
- Payment failures
- OAuth token expiry
- API rate limiting
- High error rates
- Service downtime

## Troubleshooting

### Common Issues
1. **"Application ID not found"**
   - Verify sandbox vs production environment
   - Check Application ID format

2. **"OAuth token expired"**
   - Implement automatic token refresh
   - Check token expiry logic

3. **"Card declined"**
   - Implement retry logic
   - Offer alternative payment methods

4. **"Network timeout"**
   - Implement exponential backoff
   - Show user-friendly error messages

### Support Resources
- Square Developer Documentation: https://developer.squareup.com/docs
- React Native Plugin: https://github.com/square/in-app-payments-react-native-plugin
- Square Developer Support: developer@squareup.com
- Finlow Internal Documentation: See CLAUDE.md

## Comparison: SumUp vs Square

| Feature | SumUp | Square |
|---------|--------|--------|
| **In-Person Rate** | 0.69% (high volume) | 1.75% |
| **Online Rate** | 1.69% (standard) | 1.4% + 25p |
| **Setup Cost** | Hardware required | £19 reader |
| **Monthly Fee** | £19 (high volume) | None |
| **Contract** | None | None |
| **Priority** | Primary | Secondary |

## Integration Benefits

### For Merchants
- **Redundancy**: Backup payment method ensures no lost sales
- **Competitive Rates**: 1.75% in-person rate competitive with industry
- **No Monthly Fees**: Cost-effective for smaller merchants
- **Trusted Brand**: Square is well-known and trusted by customers

### For Platform
- **Revenue Diversification**: Reduce dependency on single provider
- **Better Negotiation**: Multiple providers improve negotiating position
- **Market Coverage**: Serve merchants with different payment preferences
- **Risk Management**: Reduce operational risk from single point of failure

---

**Last Updated**: January 2025  
**Version**: 1.0  
**Next Review**: March 2025