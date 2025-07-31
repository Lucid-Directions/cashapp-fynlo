// src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  PLATFORM_OWNER_ENABLED: false, // Disabled in mobile app
  QUICK_SIGNIN_ENABLED: false, // Remove quick sign-in
  USE_MOCK_DATA: false, // Will be used in Phase 6
};

export const isFeatureEnabled = (feature: keyof typeof FEATURE_FLAGS): boolean => {
  return FEATURE_FLAGS[feature];
};
