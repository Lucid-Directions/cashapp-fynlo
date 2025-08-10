# Fynlo POS Testing Guide

## SumUp Tap-to-Pay Testing

### Overview
As of the latest update, the "Card" payment option in the Enhanced Payment Screen now triggers the SumUp modal interface for contactless payments instead of showing an alert.

### Prerequisites

#### Device Requirements
- **iPhone XS or later** (required for NFC tap-to-pay functionality)
- **iOS 16.4 or later** (iOS 16.7+ recommended for stability)
- Physical device testing required (simulator does not support NFC)

#### Account Requirements
- Active SumUp merchant account
- Apple Developer account with Tap-to-Pay entitlements (provided by Apple)
- Backend configured with SumUp API credentials

### Testing Card Payments

#### 1. Standard Payment Flow
1. Launch the Fynlo POS app
2. Add items to cart
3. Navigate to payment screen
4. **Enter customer information** (required):
   - Customer name
   - Valid email address
5. Select "Card" as payment method
6. **Expected behavior**: SumUp payment modal appears
7. Process test payment through SumUp interface
8. Verify order completion and receipt generation

#### 2. Manager Authorization Flow
1. Follow steps 1-4 above
2. Select "Card" when manager authorization is required
3. Manager enters PIN
4. **Expected behavior**: After authorization, SumUp modal appears
5. Complete payment through SumUp

### Validation Checks

The app now validates customer information BEFORE initiating payment to prevent:
- Payment collection without order recording
- Orphaned transactions where payment succeeds but order fails

**Test scenarios**:
1. ✅ Valid customer info → SumUp modal appears
2. ❌ Missing customer name → Alert shown, no payment initiated
3. ❌ Invalid email → Alert shown, no payment initiated
4. ✅ SumUp modal active → Process Payment button disabled

### Fallback Behavior

If SumUp is unavailable (e.g., missing entitlements, no merchant account):
- The app should detect this and offer alternative payment methods
- QR code payments (1.2% fee)
- Cash payments (0% fee)

### Environment Configuration

#### Backend Requirements
The following environment variables must be set in DigitalOcean:
```bash
SUMUP_API_KEY=<your-api-key>
SUMUP_MERCHANT_CODE=<your-merchant-code>
SUMUP_ENVIRONMENT=production
SUMUP_APP_ID=com.anonymous.cashapppos
```

#### iOS Entitlements
After receiving Apple's Tap-to-Pay approval, update:
```xml
<!-- CashAppPOS.entitlements -->
<key>com.apple.developer.proximity-reader.payment.acceptance</key>
<array>
    <string>ACTUAL_APPLE_PROVIDED_STRING</string>
</array>
```

### Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| SumUp modal doesn't appear | Check backend configuration and API keys |
| "Missing entitlements" error | Ensure Apple Tap-to-Pay approval is complete |
| Payment succeeds but order fails | Verify customer info validation is working |
| Double payment attempts | Check that Process Payment button is disabled during modal |

### Testing Checklist

- [ ] Customer validation prevents payment without valid info
- [ ] SumUp modal appears for card payments
- [ ] Process Payment button disabled while modal is active
- [ ] Successful payment records order correctly
- [ ] Failed payment shows appropriate error
- [ ] Payment cancellation handled gracefully
- [ ] Receipt sent to customer email
- [ ] Manager authorization flow works correctly

### Debug Mode

To test SumUp integration without processing real payments:
1. Use SumUp test mode (if available in merchant dashboard)
2. Set `SUMUP_ENVIRONMENT=test` in backend
3. Use test card numbers provided by SumUp

### Logging

Monitor logs for SumUp-related events:
```bash
# iOS Console
xcrun simctl spawn booted log stream --predicate 'process == "CashAppPOS"' | grep -i sumup

# Backend logs
doctl apps logs <app-id> | grep -i sumup
```

### Contact Support

- **SumUp Technical Support**: For merchant account and API issues
- **Apple Developer Support**: For Tap-to-Pay entitlement questions
- **Internal Team**: For app-specific implementation issues

---

*Last updated: 2025-08-10*
*Version: 1.0.0*