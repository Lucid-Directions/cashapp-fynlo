# Removed Platform Features

## Date: January 10, 2025
## Branch: feature/phase-1-remove-platform-owner
## Reason: Platform owners will use web dashboard at fynlo.co.uk

### Files Removed:
- src/navigation/PlatformNavigator.tsx
- src/screens/platform/BulkSettingsScreen.tsx
- src/screens/platform/PlatformAuditScreen.tsx
- src/screens/platform/PlatformDashboardScreen.tsx
- src/screens/platform/PlatformSettingsScreen.tsx
- src/screens/platform/RestaurantsScreen.tsx
- src/screens/platform/SystemMonitoringScreen.tsx
- src/screens/platform/UserManagementScreen.tsx
- src/screens/platform/onboarding/BusinessHoursStep.tsx
- src/screens/platform/onboarding/PaymentSetupStep.tsx
- src/screens/platform/onboarding/RestaurantDetailsStep.tsx
- src/screens/platform/onboarding/RestaurantOnboardingScreen.tsx
- src/screens/platform/onboarding/ReviewConfirmStep.tsx
- src/screens/platform/onboarding/SubscriptionTierStep.tsx
- src/screens/platform/settings/CommissionStructureScreen.tsx
- src/screens/platform/settings/PaymentProcessingScreen.tsx
- src/components/platform/PlatformPaymentFees.tsx

### Files Modified:
- src/navigation/AppNavigator.tsx
  - Added feature flag import
  - Removed PlatformNavigator import
  - Simplified navigation to always use MainNavigator
- src/screens/auth/SignInScreen.tsx
  - Added feature flag import
  - Wrapped Quick Sign In button with feature flag check
- src/contexts/AuthContext.tsx
  - Added subscription fields to User interface
  - Added optional is_platform_owner field

### Feature Flags Created:
- PLATFORM_OWNER_ENABLED: false
- QUICK_SIGNIN_ENABLED: false
- USE_MOCK_DATA: false (for future use)

### Backup Location:
~/Desktop/platform-backup-20250710.tar.gz

### Impact:
- Platform owners can no longer access platform-specific screens in the mobile app
- Quick sign-in functionality is disabled
- All users will use the MainNavigator regardless of role
- App is prepared for subscription-based features

### Migration Path:
Platform owners should use the web dashboard at https://fynlo.co.uk for:
- Restaurant management
- Platform analytics
- User management
- Payment settings
- Commission structures
- System monitoring