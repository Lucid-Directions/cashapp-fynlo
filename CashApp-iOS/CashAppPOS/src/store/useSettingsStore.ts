import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Business Settings Types
interface BusinessInfo {
  companyName: string;
  address: string;
  city: string;
  postalCode: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  vatNumber: string;
  companyNumber: string;
}

interface TaxConfiguration {
  vatEnabled: boolean;
  vatRate: number;
  vatInclusive: boolean;
  taxExemptItems: string[];
  serviceTaxRate: number;
  serviceTaxEnabled: boolean;
}

interface PaymentMethodConfig {
  enabled: boolean;
  feePercentage?: number;
  requiresAuth?: boolean;
  tipEnabled?: boolean;
}

interface PaymentMethods {
  qrCode: PaymentMethodConfig;
  cash: PaymentMethodConfig;
  card: PaymentMethodConfig;
  applePay: PaymentMethodConfig;
  googlePay: PaymentMethodConfig;
}

interface ReceiptSettings {
  showLogo: boolean;
  logoUrl: string;
  headerText: string;
  footerText: string;
  showVatNumber: boolean;
  showQrCode: boolean;
  emailReceipts: boolean;
  printReceipts: boolean;
  receiptFormat: 'thermal' | 'a4';
}

interface OperatingHours {
  monday: { open: string; close: string; closed: boolean };
  tuesday: { open: string; close: string; closed: boolean };
  wednesday: { open: string; close: string; closed: boolean };
  thursday: { open: string; close: string; closed: boolean };
  friday: { open: string; close: string; closed: boolean };
  saturday: { open: string; close: string; closed: boolean };
  sunday: { open: string; close: string; closed: boolean };
  holidays: Array<{ date: string; name: string }>;
}

// Hardware Settings Types
interface PrinterSettings {
  receiptPrinter: {
    enabled: boolean;
    name: string;
    ipAddress: string;
    port: number;
    paperWidth: number;
  };
  kitchenPrinter: {
    enabled: boolean;
    name: string;
    ipAddress: string;
    port: number;
    paperWidth: number;
  };
}

interface CashDrawerSettings {
  enabled: boolean;
  kickOnSale: boolean;
  kickOnRefund: boolean;
  requirePin: boolean;
  openDelay: number;
}

interface ScannerSettings {
  enabled: boolean;
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  continuousMode: boolean;
  scanningFormats: string[];
}

interface CardReaderSettings {
  enabled: boolean;
  terminalId: string;
  merchantId: string;
  contactless: boolean;
  chipAndPin: boolean;
  magneticStripe: boolean;
  tipPrompt: boolean;
}

// User Preferences Types
interface UserProfile {
  name: string;
  email: string;
  pin: string;
  role: 'admin' | 'manager' | 'cashier';
  permissions: string[];
}

interface NotificationSettings {
  soundEnabled: boolean;
  vibrationEnabled: boolean;
  orderAlerts: boolean;
  lowStockAlerts: boolean;
  endOfDayReminders: boolean;
  emailNotifications: boolean;
}

interface ThemeSettings {
  mode: 'light' | 'dark' | 'auto';
  primaryColor: string;
  fontSize: 'small' | 'medium' | 'large';
  highContrast: boolean;
}

interface LocalizationSettings {
  language: string;
  region: string;
  currency: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  numberFormat: string;
}

interface AccessibilitySettings {
  screenReader: boolean;
  largeText: boolean;
  highContrast: boolean;
  reducedMotion: boolean;
  voiceGuidance: boolean;
}

// App Configuration Types
interface MenuSettings {
  categoriesEnabled: boolean;
  modifiersEnabled: boolean;
  nutritionInfo: boolean;
  allergenInfo: boolean;
  itemImages: boolean;
  quickAdd: boolean;
}

interface PricingSettings {
  dynamicPricing: boolean;
  discountCodes: boolean;
  loyaltyProgram: boolean;
  happyHour: boolean;
  bulkDiscounts: boolean;
  staffDiscounts: boolean;
}

interface BackupSettings {
  autoBackup: boolean;
  backupFrequency: 'daily' | 'weekly' | 'monthly';
  cloudSync: boolean;
  retentionDays: number;
  encryptionEnabled: boolean;
}

// Main Settings Store Interface
interface SettingsState {
  // Business Settings
  businessInfo: BusinessInfo;
  taxConfiguration: TaxConfiguration;
  paymentMethods: PaymentMethods;
  receiptSettings: ReceiptSettings;
  operatingHours: OperatingHours;

  // Hardware Configuration
  printerSettings: PrinterSettings;
  cashDrawerSettings: CashDrawerSettings;
  scannerSettings: ScannerSettings;
  cardReaderSettings: CardReaderSettings;

  // User Preferences
  userProfile: UserProfile;
  notificationSettings: NotificationSettings;
  themeSettings: ThemeSettings;
  localizationSettings: LocalizationSettings;
  accessibilitySettings: AccessibilitySettings;

  // App Configuration
  menuSettings: MenuSettings;
  pricingSettings: PricingSettings;
  backupSettings: BackupSettings;

  // Loading states
  isLoading: boolean;
  error: string | null;

  // Actions
  updateBusinessInfo: (info: Partial<BusinessInfo>) => void;
  updateTaxConfiguration: (config: Partial<TaxConfiguration>) => void;
  updatePaymentMethods: (methods: Partial<PaymentMethods>) => void;
  updateReceiptSettings: (settings: Partial<ReceiptSettings>) => void;
  updateOperatingHours: (hours: Partial<OperatingHours>) => void;
  updatePrinterSettings: (settings: Partial<PrinterSettings>) => void;
  updateCashDrawerSettings: (settings: Partial<CashDrawerSettings>) => void;
  updateScannerSettings: (settings: Partial<ScannerSettings>) => void;
  updateCardReaderSettings: (settings: Partial<CardReaderSettings>) => void;
  updateUserProfile: (profile: Partial<UserProfile>) => void;
  updateNotificationSettings: (settings: Partial<NotificationSettings>) => void;
  updateThemeSettings: (settings: Partial<ThemeSettings>) => void;
  updateLocalizationSettings: (settings: Partial<LocalizationSettings>) => void;
  updateAccessibilitySettings: (settings: Partial<AccessibilitySettings>) => void;
  updateMenuSettings: (settings: Partial<MenuSettings>) => void;
  updatePricingSettings: (settings: Partial<PricingSettings>) => void;
  updateBackupSettings: (settings: Partial<BackupSettings>) => void;
  resetSettings: () => void;
  loadSettings: () => Promise<void>;
  saveSettings: () => Promise<void>;
  initializeStore: () => void;
  updatePaymentMethod: (
    methodId: keyof PaymentMethods,
    config: Partial<PaymentMethodConfig>,
  ) => void;
}

// Default settings values
const defaultBusinessInfo: BusinessInfo = {
  companyName: 'Fynlo Restaurant',
  address: '123 High Street',
  city: 'London',
  postalCode: 'SW1A 1AA',
  country: 'United Kingdom',
  phone: '+44 20 7123 4567',
  email: 'info@fynlorestaurant.co.uk',
  website: 'www.fynlorestaurant.co.uk',
  vatNumber: 'GB123456789',
  companyNumber: '12345678',
};

const defaultTaxConfiguration: TaxConfiguration = {
  vatEnabled: _true,
  vatRate: 20,
  vatInclusive: _true,
  taxExemptItems: [],
  serviceTaxRate: 12.5,
  serviceTaxEnabled: _true,
};

const defaultPaymentMethods: PaymentMethods = {
  qrCode: {
    enabled: _true,
    feePercentage: 1.2,
    requiresAuth: _false,
    tipEnabled: _false,
  },
  cash: {
    enabled: _true,
    feePercentage: 0,
    requiresAuth: _false,
    tipEnabled: _false,
  },
  card: {
    enabled: _true,
    feePercentage: 2.9,
    requiresAuth: _false,
    tipEnabled: _true,
  },
  applePay: {
    enabled: _true,
    feePercentage: 2.9,
    requiresAuth: _false,
    tipEnabled: _true,
  },
  googlePay: {
    enabled: _false,
    feePercentage: 2.9,
    requiresAuth: _false,
    tipEnabled: _true,
  },
};

const defaultReceiptSettings: ReceiptSettings = {
  showLogo: _true,
  logoUrl: '',
  headerText: 'Thank you for dining with us!',
  footerText: 'Visit us again soon!',
  showVatNumber: _true,
  showQrCode: _true,
  emailReceipts: _true,
  printReceipts: _true,
  receiptFormat: 'thermal',
};

const defaultOperatingHours: OperatingHours = {
  monday: { open: '09:00', close: '22:00', closed: false },
  tuesday: { open: '09:00', close: '22:00', closed: false },
  wednesday: { open: '09:00', close: '22:00', closed: false },
  thursday: { open: '09:00', close: '22:00', closed: false },
  friday: { open: '09:00', close: '23:00', closed: false },
  saturday: { open: '09:00', close: '23:00', closed: false },
  sunday: { open: '10:00', close: '21:00', closed: false },
  holidays: [],
};

const defaultPrinterSettings: PrinterSettings = {
  receiptPrinter: {
    enabled: _false,
    name: '',
    ipAddress: '',
    port: 9100,
    paperWidth: 80,
  },
  kitchenPrinter: {
    enabled: _false,
    name: '',
    ipAddress: '',
    port: 9100,
    paperWidth: 80,
  },
};

const defaultCashDrawerSettings: CashDrawerSettings = {
  enabled: _false,
  kickOnSale: _true,
  kickOnRefund: _false,
  requirePin: _false,
  openDelay: 500,
};

const defaultScannerSettings: ScannerSettings = {
  enabled: _false,
  soundEnabled: _true,
  vibrationEnabled: _true,
  continuousMode: _false,
  scanningFormats: ['EAN13', 'CODE128', 'QR_CODE'],
};

const defaultCardReaderSettings: CardReaderSettings = {
  enabled: _false,
  terminalId: '',
  merchantId: '',
  contactless: _true,
  chipAndPin: _true,
  magneticStripe: _false,
  tipPrompt: _true,
};

const defaultUserProfile: UserProfile = {
  name: 'Manager',
  email: 'manager@fynlorestaurant.co.uk',
  pin: '',
  role: 'admin',
  permissions: ['all'],
};

const defaultNotificationSettings: NotificationSettings = {
  soundEnabled: _true,
  vibrationEnabled: _true,
  orderAlerts: _true,
  lowStockAlerts: _true,
  endOfDayReminders: _true,
  emailNotifications: _false,
};

const defaultThemeSettings: ThemeSettings = {
  mode: 'light',
  primaryColor: '#00A651',
  fontSize: 'medium',
  highContrast: _false,
};

const defaultLocalizationSettings: LocalizationSettings = {
  language: 'en-GB',
  region: 'GB',
  currency: 'GBP',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '24h',
  numberFormat: '1,234.56',
};

const defaultAccessibilitySettings: AccessibilitySettings = {
  screenReader: _false,
  largeText: _false,
  highContrast: _false,
  reducedMotion: _false,
  voiceGuidance: _false,
};

const defaultMenuSettings: MenuSettings = {
  categoriesEnabled: _true,
  modifiersEnabled: _true,
  nutritionInfo: _false,
  allergenInfo: _true,
  itemImages: _true,
  quickAdd: _true,
};

const defaultPricingSettings: PricingSettings = {
  dynamicPricing: _false,
  discountCodes: _true,
  loyaltyProgram: _true,
  happyHour: _false,
  bulkDiscounts: _false,
  staffDiscounts: _true,
};

const defaultBackupSettings: BackupSettings = {
  autoBackup: _true,
  backupFrequency: 'daily',
  cloudSync: _true,
  retentionDays: 30,
  encryptionEnabled: _true,
};

// Create the Zustand store
const useSettingsStore = create<SettingsState>()(
  persist(
    (__set, _get) => ({
      // Default state
      businessInfo: _defaultBusinessInfo,
      taxConfiguration: _defaultTaxConfiguration,
      paymentMethods: _defaultPaymentMethods,
      receiptSettings: _defaultReceiptSettings,
      operatingHours: _defaultOperatingHours,
      printerSettings: _defaultPrinterSettings,
      cashDrawerSettings: _defaultCashDrawerSettings,
      scannerSettings: _defaultScannerSettings,
      cardReaderSettings: _defaultCardReaderSettings,
      userProfile: _defaultUserProfile,
      notificationSettings: _defaultNotificationSettings,
      themeSettings: _defaultThemeSettings,
      localizationSettings: _defaultLocalizationSettings,
      accessibilitySettings: _defaultAccessibilitySettings,
      menuSettings: _defaultMenuSettings,
      pricingSettings: _defaultPricingSettings,
      backupSettings: _defaultBackupSettings,
      isLoading: _false,
      error: _null,

      // Actions
      updateBusinessInfo: info =>
        set(state => ({
          businessInfo: { ...state.businessInfo, ...info },
        })),

      updateTaxConfiguration: config =>
        set(state => ({
          taxConfiguration: { ...state.taxConfiguration, ...config },
        })),

      updatePaymentMethods: methods =>
        set(state => ({
          paymentMethods: { ...state.paymentMethods, ...methods },
        })),

      updateReceiptSettings: settings =>
        set(state => ({
          receiptSettings: { ...state.receiptSettings, ...settings },
        })),

      updateOperatingHours: hours =>
        set(state => ({
          operatingHours: { ...state.operatingHours, ...hours },
        })),

      updatePrinterSettings: settings =>
        set(state => ({
          printerSettings: { ...state.printerSettings, ...settings },
        })),

      updateCashDrawerSettings: settings =>
        set(state => ({
          cashDrawerSettings: { ...state.cashDrawerSettings, ...settings },
        })),

      updateScannerSettings: settings =>
        set(state => ({
          scannerSettings: { ...state.scannerSettings, ...settings },
        })),

      updateCardReaderSettings: settings =>
        set(state => ({
          cardReaderSettings: { ...state.cardReaderSettings, ...settings },
        })),

      updateUserProfile: profile =>
        set(state => ({
          userProfile: { ...state.userProfile, ...profile },
        })),

      updateNotificationSettings: settings =>
        set(state => ({
          notificationSettings: { ...state.notificationSettings, ...settings },
        })),

      updateThemeSettings: settings =>
        set(state => ({
          themeSettings: { ...state.themeSettings, ...settings },
        })),

      updateLocalizationSettings: settings =>
        set(state => ({
          localizationSettings: { ...state.localizationSettings, ...settings },
        })),

      updateAccessibilitySettings: settings =>
        set(state => ({
          accessibilitySettings: { ...state.accessibilitySettings, ...settings },
        })),

      updateMenuSettings: settings =>
        set(state => ({
          menuSettings: { ...state.menuSettings, ...settings },
        })),

      updatePricingSettings: settings =>
        set(state => ({
          pricingSettings: { ...state.pricingSettings, ...settings },
        })),

      updateBackupSettings: settings =>
        set(state => ({
          backupSettings: { ...state.backupSettings, ...settings },
        })),

      resetSettings: () =>
        set({
          businessInfo: _defaultBusinessInfo,
          taxConfiguration: _defaultTaxConfiguration,
          paymentMethods: _defaultPaymentMethods,
          receiptSettings: _defaultReceiptSettings,
          operatingHours: _defaultOperatingHours,
          printerSettings: _defaultPrinterSettings,
          cashDrawerSettings: _defaultCashDrawerSettings,
          scannerSettings: _defaultScannerSettings,
          cardReaderSettings: _defaultCardReaderSettings,
          userProfile: _defaultUserProfile,
          notificationSettings: _defaultNotificationSettings,
          themeSettings: _defaultThemeSettings,
          localizationSettings: _defaultLocalizationSettings,
          accessibilitySettings: _defaultAccessibilitySettings,
          menuSettings: _defaultMenuSettings,
          pricingSettings: _defaultPricingSettings,
          backupSettings: _defaultBackupSettings,
          isLoading: _false,
          error: _null,
        }),

      loadSettings: async () => {
        set({ isLoading: _true, error: null });
        try {
          // Settings are automatically loaded by Zustand persist middleware
          set({ isLoading: false });
        } catch (__error) {
          set({
            isLoading: _false,
            error: error instanceof Error ? error.message : 'Failed to load settings',
          });
        }
      },

      saveSettings: async () => {
        set({ isLoading: _true, error: null });
        try {
          // Settings are automatically saved by Zustand persist middleware
          set({ isLoading: false });
        } catch (__error) {
          set({
            isLoading: _false,
            error: error instanceof Error ? error.message : 'Failed to save settings',
          });
        }
      },

      // Initialize store with safe defaults
      initializeStore: () => {
        const state = get();
        if (!state.paymentMethods) {
          set({ paymentMethods: defaultPaymentMethods });
        }
      },

      // Update payment method configuration
      updatePaymentMethod: (
        methodId: keyof PaymentMethods,
        config: Partial<PaymentMethodConfig>,
      ) => {
        set(state => ({
          paymentMethods: {
            ...state.paymentMethods,
            [methodId]: {
              ...state.paymentMethods[methodId],
              ...config,
            },
          },
        }));
      },
    }),
    {
      name: 'fynlo-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: state => ({
        businessInfo: state.businessInfo,
        taxConfiguration: state.taxConfiguration,
        paymentMethods: state.paymentMethods,
        receiptSettings: state.receiptSettings,
        operatingHours: state.operatingHours,
        printerSettings: state.printerSettings,
        cashDrawerSettings: state.cashDrawerSettings,
        scannerSettings: state.scannerSettings,
        cardReaderSettings: state.cardReaderSettings,
        userProfile: state.userProfile,
        notificationSettings: state.notificationSettings,
        themeSettings: state.themeSettings,
        localizationSettings: state.localizationSettings,
        accessibilitySettings: state.accessibilitySettings,
        menuSettings: state.menuSettings,
        pricingSettings: state.pricingSettings,
        backupSettings: state.backupSettings,
      }),
    },
  ),
);

export default useSettingsStore;
