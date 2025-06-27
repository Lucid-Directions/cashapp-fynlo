# Settings Audit Report

## Current Settings Analysis - Platform vs Restaurant Control

This document provides a comprehensive audit of all settings in the Fynlo POS system, identifying which settings should be moved to platform control versus remaining with restaurants.

## 1. Payment Settings Audit

### Currently Restaurant-Controlled (TO BE MOVED TO PLATFORM)

| Setting | Current Location | Current Control | Should Be | Priority | Risk |
|---------|-----------------|-----------------|-----------|----------|------|
| QR Payment Fee (1.2%) | `useSettingsStore.paymentMethods.qrCode.feePercentage` | Restaurant | Platform | CRITICAL | Revenue Loss |
| Card Payment Fee (2.9%) | `useSettingsStore.paymentMethods.card.feePercentage` | Restaurant | Platform | CRITICAL | Revenue Loss |
| Payment Provider Selection | `PaymentProviderSettingsScreen` | Restaurant | Platform | HIGH | Inconsistency |
| Provider API Credentials | Not stored in app | N/A | Platform | CRITICAL | Security |
| Smart Routing Rules | Backend only | Platform | Platform | ✅ Correct | - |
| Transaction Limits | Not implemented | N/A | Platform | MEDIUM | Fraud Risk |

### Correctly Restaurant-Controlled

| Setting | Current Location | Current Control | Should Be | Status |
|---------|-----------------|-----------------|-----------|--------|
| Payment Method Enable/Disable | `useSettingsStore.paymentMethods.[method].enabled` | Restaurant | Restaurant | ✅ Correct |
| Tip Settings | `useSettingsStore.paymentMethods.[method].tipsEnabled` | Restaurant | Restaurant | ✅ Correct |
| Auth Requirements | `useSettingsStore.paymentMethods.[method].requiresAuth` | Restaurant | Restaurant | ✅ Correct |

## 2. Tax & Financial Settings Audit

### Correctly Restaurant-Controlled

| Setting | Current Location | Current Control | Should Be | Status |
|---------|-----------------|-----------------|-----------|--------|
| VAT Rate | `useSettingsStore.taxConfiguration.vatRate` | Restaurant | Restaurant | ✅ Correct |
| VAT Enabled | `useSettingsStore.taxConfiguration.vatEnabled` | Restaurant | Restaurant | ✅ Correct |
| Service Tax Rate | `useSettingsStore.taxConfiguration.serviceTaxRate` | Restaurant | Restaurant | ✅ Correct |
| Tax Exemptions | `useSettingsStore.taxConfiguration.exemptCategories` | Restaurant | Restaurant | ✅ Correct |

### Should Add Platform Limits

| Setting | Recommendation |
|---------|----------------|
| Service Tax Maximum | Platform should set max (e.g., 20%) |
| Discount Maximum | Platform should set max (e.g., 50%) |

## 3. Business Settings Audit

### Correctly Restaurant-Controlled

| Setting | Current Location | Status |
|---------|-----------------|--------|
| Business Name | `useSettingsStore.businessInfo.companyName` | ✅ Correct |
| Business Address | `useSettingsStore.businessInfo.address` | ✅ Correct |
| Contact Information | `useSettingsStore.businessInfo.contactEmail/Phone` | ✅ Correct |
| VAT Number | `useSettingsStore.businessInfo.vatNumber` | ✅ Correct |
| Operating Hours | `useSettingsStore.operatingHours` | ✅ Correct |

## 4. System & Security Settings Audit

### Currently Missing (SHOULD BE PLATFORM-CONTROLLED)

| Setting | Required Location | Priority | Risk |
|---------|------------------|----------|------|
| API Rate Limits | Platform Config | HIGH | Service Abuse |
| Data Retention Policy | Platform Config | MEDIUM | Compliance |
| Session Timeouts | Platform Config | HIGH | Security |
| Encryption Standards | Platform Config | CRITICAL | Data Breach |
| Audit Log Settings | Platform Config | HIGH | Compliance |
| Webhook Retry Policy | Platform Config | MEDIUM | Reliability |

## 5. Feature Flags Audit

### Currently in Backend (CORRECT BUT NEEDS FRONTEND SYNC)

| Feature | Backend Location | Frontend Status | Priority |
|---------|-----------------|-----------------|----------|
| Smart Routing | `config_manager.features.smart_routing_enabled` | Not synced | HIGH |
| Analytics | `config_manager.features.analytics_enabled` | Not synced | MEDIUM |
| QR Payments | `config_manager.features.qr_payments_enabled` | Always enabled | HIGH |
| Cash Payments | `config_manager.features.cash_payments_enabled` | Always enabled | MEDIUM |

## 6. Hardware Settings Audit

### Correctly Restaurant-Controlled

| Setting | Current Location | Status |
|---------|-----------------|--------|
| Printer Configuration | `HardwareConfigScreen` | ✅ Correct |
| Cash Drawer | `HardwareConfigScreen` | ✅ Correct |
| Barcode Scanner | `HardwareConfigScreen` | ✅ Correct |
| Card Reader | Local to device | ✅ Correct |

## 7. User & Staff Settings Audit

### Correctly Restaurant-Controlled

| Setting | Current Location | Status |
|---------|-----------------|--------|
| User Profiles | `useUserStore` | ✅ Correct |
| Staff Permissions | `StaffManagementScreen` | ✅ Correct |
| PIN/Biometric Settings | Device-specific | ✅ Correct |

### Should Add Platform Controls

| Setting | Recommendation |
|---------|----------------|
| Maximum Staff Accounts | Platform limit based on subscription |
| Permission Templates | Platform-defined role templates |

## 8. Critical Issues Found

### 🚨 HIGH PRIORITY ISSUES

1. **Payment Fees Locally Controlled**
   - Risk: Restaurants could modify their own processing fees
   - Impact: Direct revenue loss
   - Solution: Move to platform control immediately

2. **No Platform Settings Sync**
   - Risk: No way to update platform settings remotely
   - Impact: Cannot change fees or features without app update
   - Solution: Implement platform settings API and sync

3. **Missing Security Settings**
   - Risk: No centralized security policy
   - Impact: Compliance and security vulnerabilities
   - Solution: Implement platform security configuration

### ⚠️ MEDIUM PRIORITY ISSUES

1. **No Transaction Limits**
   - Risk: Potential for fraud or misuse
   - Impact: Financial exposure
   - Solution: Add platform-controlled limits

2. **Feature Flags Not Synced**
   - Risk: Cannot control feature availability
   - Impact: Unable to manage rollouts
   - Solution: Sync feature flags from backend

3. **No Audit Trail**
   - Risk: Cannot track configuration changes
   - Impact: Compliance issues
   - Solution: Implement configuration audit logging

## 9. Recommendations Summary

### Immediate Actions (Week 1)
1. Move payment fee configuration to platform control
2. Implement platform settings sync mechanism
3. Add security configuration framework

### Short-term Actions (Weeks 2-3)
1. Add transaction limit controls
2. Implement feature flag synchronization
3. Create audit logging system
4. Add platform admin interface

### Medium-term Actions (Weeks 4-6)
1. Implement A/B testing framework
2. Add regional settings support
3. Create automated compliance checks
4. Build analytics dashboard

## 10. Expected Outcomes

### After Implementation
- **Revenue Protection**: 100% control over payment fees
- **Consistency**: Uniform settings across all restaurants
- **Compliance**: Centralized security and audit controls
- **Flexibility**: Easy feature rollouts and A/B testing
- **Scalability**: Simple onboarding for new restaurants

### Success Metrics
- Zero unauthorized fee modifications
- 99.9% settings sync success rate
- < 100ms settings retrieval time
- 100% compliance with platform policies

## Conclusion

The audit reveals that while many settings are correctly placed at the restaurant level, critical revenue and security settings need immediate migration to platform control. The highest priority is moving payment fee configuration to prevent revenue leakage and ensure consistent pricing across the platform.