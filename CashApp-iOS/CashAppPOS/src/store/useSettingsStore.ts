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

interface PaymentMethodSettings {
  cash: { enabled: boolean; requiresAuth: boolean };
  card: { enabled: boolean; requiresAuth: boolean; tipEnabled: boolean };
  applePay: { enabled: boolean; requiresAuth: boolean };
  googlePay: { enabled: boolean; requiresAuth: boolean };
  giftCard: { enabled: boolean; requiresAuth: boolean };
  customerAccount: { enabled: boolean; requiresAuth: boolean };
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
  paymentMethods: PaymentMethodSettings;
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
  updatePaymentMethods: (methods: Partial<PaymentMethodSettings>) => void;
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
  vatEnabled: true,
  vatRate: 20,
  vatInclusive: true,
  taxExemptItems: [],
  serviceTaxRate: 12.5,
  serviceTaxEnabled: true,
};

const defaultPaymentMethods: PaymentMethodSettings = {
  cash: { enabled: true, requiresAuth: false },
  card: { enabled: true, requiresAuth: false, tipEnabled: true },
  applePay: { enabled: true, requiresAuth: false },
  googlePay: { enabled: true, requiresAuth: false },
  giftCard: { enabled: true, requiresAuth: true },
  customerAccount: { enabled: false, requiresAuth: true },
};

const defaultReceiptSettings: ReceiptSettings = {
  showLogo: true,
  logoUrl: '',
  headerText: 'Thank you for dining with us!',
  footerText: 'Visit us again soon!',
  showVatNumber: true,
  showQrCode: true,
  emailReceipts: true,
  printReceipts: true,
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
    enabled: false,
    name: '',
    ipAddress: '',
    port: 9100,
    paperWidth: 80,
  },
  kitchenPrinter: {
    enabled: false,
    name: '',
    ipAddress: '',
    port: 9100,
    paperWidth: 80,
  },
};

const defaultCashDrawerSettings: CashDrawerSettings = {
  enabled: false,
  kickOnSale: true,
  kickOnRefund: false,
  requirePin: false,
  openDelay: 500,
};

const defaultScannerSettings: ScannerSettings = {
  enabled: false,
  soundEnabled: true,
  vibrationEnabled: true,
  continuousMode: false,
  scanningFormats: ['EAN13', 'CODE128', 'QR_CODE'],
};

const defaultCardReaderSettings: CardReaderSettings = {
  enabled: false,
  terminalId: '',
  merchantId: '',
  contactless: true,
  chipAndPin: true,
  magneticStripe: false,
  tipPrompt: true,
};

const defaultUserProfile: UserProfile = {
  name: 'Manager',
  email: 'manager@fynlorestaurant.co.uk',
  pin: '',
  role: 'admin',
  permissions: ['all'],
};

const defaultNotificationSettings: NotificationSettings = {
  soundEnabled: true,
  vibrationEnabled: true,
  orderAlerts: true,
  lowStockAlerts: true,
  endOfDayReminders: true,
  emailNotifications: false,
};

const defaultThemeSettings: ThemeSettings = {
  mode: 'light',
  primaryColor: '#00A651',
  fontSize: 'medium',
  highContrast: false,
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
  screenReader: false,
  largeText: false,
  highContrast: false,
  reducedMotion: false,
  voiceGuidance: false,
};

const defaultMenuSettings: MenuSettings = {
  categoriesEnabled: true,
  modifiersEnabled: true,
  nutritionInfo: false,
  allergenInfo: true,
  itemImages: true,
  quickAdd: true,
};

const defaultPricingSettings: PricingSettings = {
  dynamicPricing: false,
  discountCodes: true,
  loyaltyProgram: true,
  happyHour: false,
  bulkDiscounts: false,
  staffDiscounts: true,
};

const defaultBackupSettings: BackupSettings = {
  autoBackup: true,
  backupFrequency: 'daily',
  cloudSync: true,
  retentionDays: 30,
  encryptionEnabled: true,
};

// Create the Zustand store
const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      // Default state
      businessInfo: defaultBusinessInfo,
      taxConfiguration: defaultTaxConfiguration,
      paymentMethods: defaultPaymentMethods,
      receiptSettings: defaultReceiptSettings,
      operatingHours: defaultOperatingHours,
      printerSettings: defaultPrinterSettings,
      cashDrawerSettings: defaultCashDrawerSettings,
      scannerSettings: defaultScannerSettings,
      cardReaderSettings: defaultCardReaderSettings,
      userProfile: defaultUserProfile,
      notificationSettings: defaultNotificationSettings,
      themeSettings: defaultThemeSettings,
      localizationSettings: defaultLocalizationSettings,
      accessibilitySettings: defaultAccessibilitySettings,
      menuSettings: defaultMenuSettings,
      pricingSettings: defaultPricingSettings,
      backupSettings: defaultBackupSettings,
      isLoading: false,
      error: null,

      // Actions
      updateBusinessInfo: (info) =>
        set((state) => ({
          businessInfo: { ...state.businessInfo, ...info },
        })),

      updateTaxConfiguration: (config) =>
        set((state) => ({
          taxConfiguration: { ...state.taxConfiguration, ...config },
        })),

      updatePaymentMethods: (methods) =>
        set((state) => ({
          paymentMethods: { ...state.paymentMethods, ...methods },
        })),

      updateReceiptSettings: (settings) =>
        set((state) => ({
          receiptSettings: { ...state.receiptSettings, ...settings },
        })),

      updateOperatingHours: (hours) =>
        set((state) => ({
          operatingHours: { ...state.operatingHours, ...hours },
        })),

      updatePrinterSettings: (settings) =>
        set((state) => ({
          printerSettings: { ...state.printerSettings, ...settings },
        })),

      updateCashDrawerSettings: (settings) =>
        set((state) => ({
          cashDrawerSettings: { ...state.cashDrawerSettings, ...settings },
        })),

      updateScannerSettings: (settings) =>
        set((state) => ({
          scannerSettings: { ...state.scannerSettings, ...settings },
        })),

      updateCardReaderSettings: (settings) =>
        set((state) => ({
          cardReaderSettings: { ...state.cardReaderSettings, ...settings },
        })),

      updateUserProfile: (profile) =>
        set((state) => ({
          userProfile: { ...state.userProfile, ...profile },
        })),

      updateNotificationSettings: (settings) =>
        set((state) => ({
          notificationSettings: { ...state.notificationSettings, ...settings },
        })),

      updateThemeSettings: (settings) =>
        set((state) => ({
          themeSettings: { ...state.themeSettings, ...settings },
        })),

      updateLocalizationSettings: (settings) =>
        set((state) => ({
          localizationSettings: { ...state.localizationSettings, ...settings },
        })),

      updateAccessibilitySettings: (settings) =>
        set((state) => ({
          accessibilitySettings: { ...state.accessibilitySettings, ...settings },
        })),

      updateMenuSettings: (settings) =>
        set((state) => ({
          menuSettings: { ...state.menuSettings, ...settings },
        })),

      updatePricingSettings: (settings) =>
        set((state) => ({
          pricingSettings: { ...state.pricingSettings, ...settings },
        })),

      updateBackupSettings: (settings) =>
        set((state) => ({
          backupSettings: { ...state.backupSettings, ...settings },
        })),

      resetSettings: () =>
        set({
          businessInfo: defaultBusinessInfo,
          taxConfiguration: defaultTaxConfiguration,
          paymentMethods: defaultPaymentMethods,
          receiptSettings: defaultReceiptSettings,
          operatingHours: defaultOperatingHours,
          printerSettings: defaultPrinterSettings,
          cashDrawerSettings: defaultCashDrawerSettings,
          scannerSettings: defaultScannerSettings,
          cardReaderSettings: defaultCardReaderSettings,
          userProfile: defaultUserProfile,
          notificationSettings: defaultNotificationSettings,
          themeSettings: defaultThemeSettings,
          localizationSettings: defaultLocalizationSettings,
          accessibilitySettings: defaultAccessibilitySettings,
          menuSettings: defaultMenuSettings,
          pricingSettings: defaultPricingSettings,
          backupSettings: defaultBackupSettings,
          isLoading: false,
          error: null,
        }),

      loadSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          // Settings are automatically loaded by Zustand persist middleware
          set({ isLoading: false });
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Failed to load settings' 
          });
        }
      },

      saveSettings: async () => {
        set({ isLoading: true, error: null });
        try {
          // Settings are automatically saved by Zustand persist middleware
          set({ isLoading: false });
        } catch (error) {
          set({ 
            isLoading: false, 
            error: error instanceof Error ? error.message : 'Failed to save settings' 
          });
        }
      },
    }),
    {
      name: 'fynlo-settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
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
    }
  )
);

export default useSettingsStore;