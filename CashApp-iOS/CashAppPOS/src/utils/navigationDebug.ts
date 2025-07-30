/**
 * Navigation Debug Utility
 * Helps identify navigation issues and validate route names
 */

import { NavigationState } from '@react-navigation/native';

// All valid routes in the app
export const VALID_ROUTES = {
  // Main Navigator Routes
  MAIN: {
    HOME: 'Home',
    ORDERS: 'Orders',
    MAIN_TABS: 'MainTabs',
    REPORTS: 'Reports',
    EMPLOYEES: 'Employees',
    CUSTOMERS: 'Customers',
    INVENTORY: 'Inventory',
    MENU_MANAGEMENT: 'MenuManagement',
    DASHBOARD: 'Dashboard',
    PROFILE: 'Profile',
    HELP: 'Help',
    SETTINGS: 'Settings',
  },

  // Settings Navigator Routes
  SETTINGS: {
    MAIN: 'Settings',
    BUSINESS_SETTINGS: 'BusinessSettings',
    BUSINESS_INFORMATION: 'BusinessInformation',
    TAX_CONFIGURATION: 'TaxConfiguration',
    PAYMENT_METHODS: 'PaymentMethods',
    RECEIPT_CUSTOMIZATION: 'ReceiptCustomization',
    OPERATING_HOURS: 'OperatingHours',
    HARDWARE_SETTINGS: 'HardwareSettings',
    PRINTER_SETUP: 'PrinterSetup',
    CASH_DRAWER: 'CashDrawer',
    BARCODE_SCANNER: 'BarcodeScanner',
    CARD_READER: 'CardReader',
    HARDWARE_DIAGNOSTICS: 'HardwareDiagnostics',
    USER_SETTINGS: 'UserSettings',
    USER_PROFILE: 'UserProfile',
    NOTIFICATION_SETTINGS: 'NotificationSettings',
    THEME_OPTIONS: 'ThemeOptions',
    LOCALIZATION: 'Localization',
    ACCESSIBILITY: 'Accessibility',
    APP_SETTINGS: 'AppSettings',
    SETTINGS_MENU_MANAGEMENT: 'SettingsMenuManagement',
    PRICING_DISCOUNTS: 'PricingDiscounts',
    BACKUP_RESTORE: 'BackupRestore',
    DATA_EXPORT: 'DataExport',
    SYSTEM_DIAGNOSTICS: 'SystemDiagnostics',
    DEVELOPER_SETTINGS: 'DeveloperSettings',
    XERO_SETTINGS: 'XeroSettings',
    XERO_SYNC_DASHBOARD: 'XeroSyncDashboard',
    RESTAURANT_SETUP: 'RestaurantSetup',
    RESTAURANT_PROFILE: 'RestaurantProfile',
  },

  // Platform Navigator Routes
  PLATFORM: {
    DASHBOARD: 'PlatformDashboard',
    RESTAURANTS: 'Restaurants',
    ANALYTICS: 'Analytics',
    MONITORING: 'Monitoring',
    MANAGEMENT: 'Management',
    RESTAURANTS_LIST: 'RestaurantsList',
    RESTAURANT_ONBOARDING: 'RestaurantOnboarding',
    PLATFORM_ANALYTICS: 'PlatformAnalytics',
    SYSTEM_MONITORING: 'SystemMonitoring',
    USER_MANAGEMENT: 'UserManagement',
  },

  // Auth Navigator Routes
  AUTH: {
    LOGIN: 'Login',
    FORGOT_PASSWORD: 'ForgotPassword',
  },
};

/**
 * Validates if a navigation action is valid
 */
export function validateNavigation(
  currentScreen: string,
  targetScreen: string,
  params?: any,
): { valid: boolean; error?: string } {
  // Check if target screen exists in any navigator
  const allRoutes = [
    ...Object.values(VALID_ROUTES.MAIN),
    ...Object.values(VALID_ROUTES.SETTINGS),
    ...Object.values(VALID_ROUTES.PLATFORM),
    ...Object.values(VALID_ROUTES.AUTH),
  ];

  if (!allRoutes.includes(targetScreen)) {
    return {
      valid: false,
      error: `Invalid route: "${targetScreen}" does not exist in any navigator`,
    };
  }

  // Special case: Navigating from Main screens to Settings screens
  if (Object.values(VALID_ROUTES.MAIN).includes(currentScreen)) {
    if (Object.values(VALID_ROUTES.SETTINGS).includes(targetScreen)) {
      // Must navigate through Settings screen first
      if (targetScreen !== 'Settings' && !params?.screen) {
        return {
          valid: false,
          error: `Cannot navigate directly to "${targetScreen}" from "${currentScreen}". Navigate to "Settings" first with screen param.`,
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Debug helper to log navigation state
 */
export function logNavigationState(state: NavigationState | undefined, depth = 0) {
  if (!state) {
    return;
  }

  const indent = '  '.repeat(depth);

  state.routes.forEach((route, index) => {
    const active = index === state.index ? '(ACTIVE)' : '';

    if (route.state) {
      logNavigationState(route.state as NavigationState, depth + 2);
    }
  });
}

/**
 * Get the correct navigation params for nested navigation
 */
export function getNestedNavigationParams(
  fromNavigator: 'MAIN' | 'SETTINGS' | 'PLATFORM',
  toScreen: string,
): { screen?: string; params?: any } | null {
  // From Main to Settings screens
  if (fromNavigator === 'MAIN' && Object.values(VALID_ROUTES.SETTINGS).includes(toScreen)) {
    if (toScreen === 'Settings') {
      return null; // Direct navigation
    }
    return {
      screen: toScreen,
    };
  }

  return null;
}

/**
 * Safe navigation helper
 */
export function safeNavigate(navigation: any, targetScreen: string, params?: any) {
  try {
    const validation = validateNavigation(
      navigation.getState()?.routes[navigation.getState()?.index]?.name || '',
      targetScreen,
      params,
    );

    if (!validation.valid) {
      return false;
    }

    navigation.navigate(targetScreen, params);
    return true;
  } catch (error) {
    return false;
  }
}
