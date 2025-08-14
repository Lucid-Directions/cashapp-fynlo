import { Platform, NativeModules } from 'react-native';

import { logger } from '../utils/logger';

// Get the native iOS module - exact name must match RCT_EXTERN_MODULE
const { SumUpTapToPayModule } = NativeModules;

// This service provides a direct bridge to the native iOS SumUp module
// No more mock data - all calls go directly to the Swift implementation

export interface SumUpCheckoutRequest {
  amount: number;
  title: string;
  currencyCode?: string;
  foreignTransactionID?: string;
  useTapToPay?: boolean;
}

export interface SumUpCheckoutResult {
  success: boolean;
  transactionCode?: string;
  additionalInfo?: unknown;
  error?: string;
}

export interface SumUpMerchant {
  currencyCode: string;
  merchantCode: string;
  companyName: string;
}

export class SumUpNativeService {
  private static instance: SumUpNativeService;
  private isInitialized = false;

  private constructor() {}

  static getInstance(): SumUpNativeService {
    if (!SumUpNativeService.instance) {
      SumUpNativeService.instance = new SumUpNativeService();
    }
    return SumUpNativeService.instance;
  }

  /**
   * Initialize the SumUp SDK with credentials from backend
   */
  async initialize(): Promise<boolean> {
    try {
      if (Platform.OS !== 'ios') {
        logger.warn('SumUp Tap to Pay is only available on iOS');
        return false;
      }

      if (!SumUpTapToPayModule) {
        logger.error('❌ SumUp native module not found. Make sure the iOS project is properly linked.');
        return false;
      }

      logger.info('🔧 Initializing SumUp native SDK...');
      
      // Fetch configuration from backend
      const { SumUpConfigService } = await import('./SumUpConfigService');
      const configService = SumUpConfigService.getInstance();
      const config = await configService.initializeAndGetConfig();
      
      if (!config.apiKey) {
        logger.error('❌ No SumUp API key available from backend');
        return false;
      }

      // Call native module setupSDK with affiliate key (not API key)
      const result = await SumUpTapToPayModule.setupSDK(config.affiliateKey || config.apiKey);
      
      if (result.success) {
        logger.info('✅ SumUp SDK initialized successfully');
        this.isInitialized = true;
        return true;
      } else {
        logger.error('❌ SumUp SDK initialization failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ SumUp service initialization error:', error);
      return false;
    }
  }

  /**
   * Present SumUp login screen
   */
  async presentLogin(): Promise<boolean> {
    try {
      if (!this.checkInitialized()) return false;
      
      logger.info('🔐 Presenting SumUp login screen...');
      const result = await SumUpTapToPayModule.presentLogin();
      
      if (result.success) {
        logger.info('✅ SumUp login successful');
        return true;
      } else {
        logger.error('❌ SumUp login failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ SumUp login error:', error);
      return false;
    }
  }

  /**
   * Login with access token
   */
  async loginWithToken(token: string): Promise<boolean> {
    try {
      if (!this.checkInitialized()) return false;
      
      logger.info('🔑 Logging in with SumUp token...');
      const result = await SumUpTapToPayModule.loginWithToken(token);
      
      if (result.success) {
        logger.info('✅ SumUp token login successful');
        return true;
      } else {
        logger.error('❌ SumUp token login failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ SumUp token login error:', error);
      return false;
    }
  }

  /**
   * Logout from SumUp
   */
  async logout(): Promise<boolean> {
    try {
      logger.info('🚪 Logging out from SumUp...');
      const result = await SumUpTapToPayModule.logout();
      
      if (result.success) {
        logger.info('✅ SumUp logout successful');
        return true;
      } else {
        logger.error('❌ SumUp logout failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ SumUp logout error:', error);
      return false;
    }
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    try {
      logger.info('🔍 Checking SumUp login status...');
      const result = await SumUpTapToPayModule.isLoggedIn();
      logger.info(`SumUp logged in: ${result.isLoggedIn}`);
      return result.isLoggedIn;
    } catch (error) {
      logger.error('❌ SumUp login check error:', error);
      return false;
    }
  }

  /**
   * Check Tap to Pay on iPhone availability and activation status
   */
  async checkTapToPayAvailability(): Promise<{ isAvailable: boolean; isActivated: boolean }> {
    try {
      if (!this.checkInitialized()) {
        return { isAvailable: false, isActivated: false };
      }
      
      logger.info('📱 Checking Tap to Pay availability...');
      const result = await SumUpTapToPayModule.checkTapToPayAvailability();
      
      logger.info(`Tap to Pay - Available: ${result.isAvailable}, Activated: ${result.isActivated}`);
      return {
        isAvailable: result.isAvailable || false,
        isActivated: result.isActivated || false
      };
    } catch (error) {
      logger.error('❌ Tap to Pay availability check error:', error);
      return { isAvailable: false, isActivated: false };
    }
  }

  /**
   * Present Tap to Pay activation screen
   */
  async presentTapToPayActivation(): Promise<boolean> {
    try {
      if (!this.checkInitialized()) return false;
      
      logger.info('🚀 Presenting Tap to Pay activation...');
      const result = await SumUpTapToPayModule.presentTapToPayActivation();
      
      if (result.success) {
        logger.info('✅ Tap to Pay activation successful');
        return true;
      } else {
        logger.error('❌ Tap to Pay activation failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ Tap to Pay activation error:', error);
      return false;
    }
  }

  /**
   * Process a payment using native SumUp SDK
   */
  async checkout(request: SumUpCheckoutRequest): Promise<SumUpCheckoutResult> {
    try {
      if (!this.checkInitialized()) {
        return { success: false, error: 'SumUp service not initialized' };
      }

      logger.info('💳 Processing SumUp payment:', {
        amount: request.amount,
        title: request.title,
        currencyCode: request.currencyCode || 'GBP',
        useTapToPay: request.useTapToPay || false,
      });

      // Call native module checkout
      const result = await SumUpTapToPayModule.checkout(
        request.amount,
        request.title || 'Payment',
        request.currencyCode || 'GBP',
        request.foreignTransactionID || null,
        request.useTapToPay || false
      );

      if (result.success) {
        logger.info('✅ SumUp payment successful:', {
          transactionCode: result.transactionCode,
          amount: request.amount
        });
        
        return {
          success: true,
          transactionCode: result.transactionCode,
          additionalInfo: result.additionalInfo
        };
      } else {
        logger.error('❌ SumUp payment failed:', result.error);
        return {
          success: false,
          error: result.error || 'Payment failed'
        };
      }
    } catch (error) {
      logger.error('❌ SumUp checkout error:', error);
      return { success: false, error: error.message || 'Payment processing error' };
    }
  }

  /**
   * Present checkout preferences (card reader setup)
   */
  async presentCheckoutPreferences(): Promise<boolean> {
    try {
      if (!this.checkInitialized()) return false;
      
      logger.info('⚙️ Presenting SumUp preferences...');
      const result = await SumUpTapToPayModule.presentCheckoutPreferences();
      
      if (result.success) {
        logger.info('✅ SumUp preferences updated');
        return true;
      } else {
        logger.error('❌ SumUp preferences failed:', result.error);
        return false;
      }
    } catch (error) {
      logger.error('❌ SumUp preferences error:', error);
      return false;
    }
  }

  /**
   * Get current merchant information from native SDK
   */
  async getCurrentMerchant(): Promise<SumUpMerchant | null> {
    try {
      if (!this.checkInitialized()) return null;
      
      logger.info('🏪 Getting merchant information...');
      const merchant = await SumUpTapToPayModule.getCurrentMerchant();
      
      if (merchant && merchant.merchantCode) {
        logger.info('✅ Merchant info retrieved:', merchant.companyName);
        return {
          currencyCode: merchant.currencyCode || 'GBP',
          merchantCode: merchant.merchantCode || '',
          companyName: merchant.companyName || 'Unknown Merchant',
        };
      } else {
        logger.warn('⚠️ No merchant information available');
        return null;
      }
    } catch (error) {
      logger.error('❌ Get merchant error:', error);
      return null;
    }
  }

  /**
   * Check if service is initialized
   */
  private checkInitialized(): boolean {
    if (!this.isInitialized) {
      logger.error('❌ SumUp service not initialized. Call initialize() first.');
      return false;
    }

    return true;
  }

  /**
   * Get availability status for React Native components
   */
  isAvailable(): boolean {
    return Platform.OS === 'ios' && this.isInitialized;
  }
}

export default SumUpNativeService;
