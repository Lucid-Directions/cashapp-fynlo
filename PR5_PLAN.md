# PR#5: Payment Flow Orchestration Update

## Problem
Multiple payment methods (SumUp, Apple Pay, QR) are not properly orchestrated:
- Confusing flow when switching between payment methods
- No clear availability indicators
- Error handling is inconsistent across payment types
- Modal states conflict with each other

## Current Issues
1. SumUp modal state conflicts with QR modal
2. Apple Pay shows alert instead of native payment sheet
3. No unified payment result handling
4. Processing states are not properly managed

## Solution
Create a unified payment orchestrator that:
1. Manages all payment method states centrally
2. Ensures only one payment modal is active at a time
3. Provides consistent error handling
4. Shows clear availability for each payment method

## Architecture
```typescript
interface PaymentOrchestrator {
  availableMethods: PaymentMethod[];
  activeMethod: PaymentMethod | null;
  processPayment(method: PaymentMethod, amount: number): Promise<PaymentResult>;
  checkAvailability(): Promise<void>;
}
```

## Files to Change
- Create `src/services/PaymentOrchestrator.ts` - Central payment coordinator
- Update `src/screens/payment/EnhancedPaymentScreen.tsx` - Use orchestrator
- Create `src/hooks/usePaymentMethods.ts` - React hook for payment methods
- Update `src/types/payment.ts` - Unified payment types

## Benefits
- Single source of truth for payment state
- Prevents multiple modals opening simultaneously
- Consistent user experience across payment methods
- Easier to add new payment methods in future