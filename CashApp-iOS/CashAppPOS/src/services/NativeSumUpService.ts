/**
 * NativeSumUpService - Bridge to native iOS SumUp SDK
 * 
 * This service provides direct access to the native SumUp SDK implementation,
 * bypassing the problematic sumup-react-native-alpha package and using the
 * actual iOS SDK capabilities including Tap to Pay on iPhone.
 */

import { NativeModules, Platform } from 'react-native';
import { logger } from '../utils/logger';

// Type definitions for the native module
interface SumUpTapToPayModule {
  setupSDK(apiKey: string): Promise<{ success: boolean }>;
  presentLogin(): Promise<{ success: boolean }>;
  loginWithToken(token: string): Promise<{ success: boolean }>;
  logout(): Promise<{ success: boolean }>;
  checkTapToPayAvailability(): Promise<{ isAvailable: boolean; isActivated: boolean }>;
  presentTapToPayActivation(): Promise<{ success: boolean }>;
  checkout(
    amount: number,
    title: string,
    currencyCode: string,
    foreignTransactionID: string | null,
    useTapToPay: boolean
  ): Promise<TransactionResult>;
  presentCheckoutPreferences(): Promise<{ success: boolean }>;
  getCurrentMerchant(): Promise<MerchantInfo | null>;
  isLoggedIn(): Promise<{ isLoggedIn: boolean }>;
}

interface TransactionResult {
  success: boolean;
  transactionCode?: string;
  transactionInfo?: {
    amount: number;
    currency: string;
    status: string;
    paymentType?: string;
    entryMode?: string;
    installments?: number;
    cardType?: string;
    cardLastDigits?: string;
  };
  error?: string;
}

interface MerchantInfo {
  merchantCode: string;
  currencyCode: string;
  name?: string;
}

// Get the native module
const { SumUpTapToPayModule: NativeSumUp } = NativeModules as {
  SumUpTapToPayModule: SumUpTapToPayModule | undefined;
};

class NativeSumUpService {
  private static instance: NativeSumUpService;
  private isSetup: boolean = false;
  private apiKey: string | null = null;
  
  // Diagnostic data
  private diagnostics = {
    moduleAvailable: false,
    initializationAttempted: false,
    initializationSucceeded: false,
    lastError: null as string | null,
    sdkVersion: 'unknown',
    capabilities: [] as string[],
    lastCheck: null as Date | null,
  };

  private constructor() {
    logger.info('🔧 NativeSumUpService initialized');
    this.runInitialDiagnostics();
  }
  
  /**
   * Run initial diagnostics on service creation
   */
  private runInitialDiagnostics() {
    this.diagnostics.moduleAvailable = this.isAvailable();
    this.diagnostics.lastCheck = new Date();
    
    if (!this.diagnostics.moduleAvailable) {
      logger.error('🚨 CRITICAL: SumUp native module not found!');
      logger.error('Available modules:', Object.keys(NativeModules).filter(m => 
        m.toLowerCase().includes('sum') || 
        m.toLowerCase().includes('pay') ||
        m.toLowerCase().includes('tap')
      ));
      this.diagnostics.lastError = 'Native module not registered';
    } else {
      logger.info('✅ SumUp native module detected');
      this.diagnostics.capabilities.push('Module Available');
    }
  }

  static getInstance(): NativeSumUpService {
    if (!NativeSumUpService.instance) {
      NativeSumUpService.instance = new NativeSumUpService();
    }
    return NativeSumUpService.instance;
  }

  /**
   * Check if the native module is available
   */
  isAvailable(): boolean {
    const available = Platform.OS === 'ios' && NativeSumUp !== undefined;
    logger.info('📱 Native SumUp module availability:', { available, platform: Platform.OS });
    return available;
  }

  /**
   * Setup the SumUp SDK with API key
   */
  async setupSDK(apiKey: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    try {
      logger.info('🔧 Setting up SumUp SDK with API key');
      const result = await NativeSumUp!.setupSDK(apiKey);
      
      if (result.success) {
        this.isSetup = true;
        this.apiKey = apiKey;
        logger.info('✅ SumUp SDK setup successful');
      } else {
        throw new Error('SumUp SDK setup failed');
      }
    } catch (error) {
      logger.error('❌ Failed to setup SumUp SDK:', error);
      throw error;
    }
  }

  /**
   * Check if SDK is setup
   */
  isSDKSetup(): boolean {
    return this.isSetup;
  }

  /**
   * Present login screen
   */
  async presentLogin(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    if (!this.isSetup) {
      throw new Error('SumUp SDK not setup. Call setupSDK first.');
    }

    try {
      logger.info('🔐 Presenting SumUp login');
      const result = await NativeSumUp!.presentLogin();
      logger.info('🔐 Login result:', result);
      return result.success;
    } catch (error) {
      logger.error('❌ Login failed:', error);
      throw error;
    }
  }

  /**
   * Login with token
   */
  async loginWithToken(token: string): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    if (!this.isSetup) {
      throw new Error('SumUp SDK not setup. Call setupSDK first.');
    }

    try {
      logger.info('🔐 Logging in with token');
      const result = await NativeSumUp!.loginWithToken(token);
      return result.success;
    } catch (error) {
      logger.error('❌ Token login failed:', error);
      throw error;
    }
  }

  /**
   * Check if user is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await NativeSumUp!.isLoggedIn();
      return result.isLoggedIn;
    } catch (error) {
      logger.error('❌ Failed to check login status:', error);
      return false;
    }
  }

  /**
   * Logout
   */
  async logout(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    try {
      logger.info('🔐 Logging out');
      const result = await NativeSumUp!.logout();
      return result.success;
    } catch (error) {
      logger.error('❌ Logout failed:', error);
      throw error;
    }
  }

  /**
   * Check Tap to Pay availability
   */
  async checkTapToPayAvailability(): Promise<{ isAvailable: boolean; isActivated: boolean }> {
    if (!this.isAvailable()) {
      return { isAvailable: false, isActivated: false };
    }

    try {
      logger.info('📱 Checking Tap to Pay availability');
      const result = await NativeSumUp!.checkTapToPayAvailability();
      logger.info('📱 Tap to Pay status:', result);
      return result;
    } catch (error) {
      logger.error('❌ Failed to check Tap to Pay availability:', error);
      return { isAvailable: false, isActivated: false };
    }
  }

  /**
   * Present Tap to Pay activation
   */
  async presentTapToPayActivation(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    try {
      logger.info('📱 Presenting Tap to Pay activation');
      const result = await NativeSumUp!.presentTapToPayActivation();
      return result.success;
    } catch (error) {
      logger.error('❌ Tap to Pay activation failed:', error);
      throw error;
    }
  }

  /**
   * Perform checkout (card reader or Tap to Pay)
   * @param useTapToPay - IMPORTANT: Set to true for iPhone Tap to Pay, false for card reader
   * According to SumUp SDK v6.0+, the paymentMethod property on SMPCheckoutRequest
   * defaults to cardReader but should be set to tapToPay for contactless payments
   */
  async performCheckout(
    amount: number,
    currency: string = 'GBP',
    title: string = 'Payment',
    useTapToPay: boolean = true, // DEFAULT TO TAP TO PAY as per user requirements
    foreignTransactionID?: string
  ): Promise<TransactionResult> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    if (!this.isSetup) {
      throw new Error('SumUp SDK not setup. Call setupSDK first.');
    }

    try {
      logger.info('💳 Starting checkout:', {
        amount,
        currency,
        title,
        useTapToPay,
        foreignTransactionID,
      });

      const result = await NativeSumUp!.checkout(
        amount,
        title,
        currency,
        foreignTransactionID || null,
        useTapToPay
      );

      logger.info('💳 Checkout result:', result);
      return result;
    } catch (error) {
      logger.error('❌ Checkout failed:', error);
      throw error;
    }
  }

  /**
   * Present checkout preferences
   */
  async presentCheckoutPreferences(): Promise<boolean> {
    if (!this.isAvailable()) {
      throw new Error('Native SumUp module is not available');
    }

    try {
      logger.info('⚙️ Presenting checkout preferences');
      const result = await NativeSumUp!.presentCheckoutPreferences();
      return result.success;
    } catch (error) {
      logger.error('❌ Failed to present checkout preferences:', error);
      throw error;
    }
  }

  /**
   * Get current merchant info
   */
  async getCurrentMerchant(): Promise<MerchantInfo | null> {
    if (!this.isAvailable()) {
      return null;
    }

    try {
      const merchant = await NativeSumUp!.getCurrentMerchant();
      logger.info('🏪 Current merchant:', merchant);
      return merchant;
    } catch (error) {
      logger.error('❌ Failed to get merchant info:', error);
      return null;
    }
  }

  /**
   * Get diagnostic information
   */
  async getDiagnostics(): Promise<{
    moduleAvailable: boolean;
    initializationAttempted: boolean;
    initializationSucceeded: boolean;
    lastError: string | null;
    sdkVersion: string;
    capabilities: string[];
    timestamp: string;
    platform: string;
    platformVersion: string | number;
    isLoggedIn?: boolean;
    tapToPayAvailable?: boolean;
    tapToPayActivated?: boolean;
    merchantInfo?: MerchantInfo | null;
  }> {
    // Update diagnostics
    this.diagnostics.moduleAvailable = this.isAvailable();
    this.diagnostics.lastCheck = new Date();
    
    const result = {
      ...this.diagnostics,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      platformVersion: Platform.Version,
      isLoggedIn: undefined as boolean | undefined,
      tapToPayAvailable: undefined as boolean | undefined,
      tapToPayActivated: undefined as boolean | undefined,
      merchantInfo: undefined as MerchantInfo | null | undefined,
    };
    
    // Try to get additional info if module is available
    if (this.diagnostics.moduleAvailable) {
      try {
        result.isLoggedIn = await this.isLoggedIn();
      } catch (error) {
        logger.warn('Could not check login status:', error);
      }
      
      try {
        const tapToPayStatus = await this.checkTapToPayAvailability();
        result.tapToPayAvailable = tapToPayStatus.isAvailable;
        result.tapToPayActivated = tapToPayStatus.isActivated;
      } catch (error) {
        logger.warn('Could not check Tap to Pay status:', error);
      }
      
      try {
        result.merchantInfo = await this.getCurrentMerchant();
      } catch (error) {
        logger.warn('Could not get merchant info:', error);
      }
    }
    
    return result;
  }

  /**
   * Initialize and prepare for payments
   */
  async initialize(apiKey?: string): Promise<boolean> {
    try {
      // Check availability
      if (!this.isAvailable()) {
        logger.warn('⚠️ Native SumUp module not available');
        return false;
      }

      // Setup SDK if API key provided
      if (apiKey && !this.isSetup) {
        await this.setupSDK(apiKey);
      }

      // Check if logged in
      const loggedIn = await this.isLoggedIn();
      if (!loggedIn) {
        logger.info('🔐 User not logged in, will need to login');
        return false;
      }

      // Check Tap to Pay availability
      const tapToPay = await this.checkTapToPayAvailability();
      logger.info('📱 Tap to Pay status:', tapToPay);

      return true;
    } catch (error) {
      logger.error('❌ Failed to initialize SumUp:', error);
      return false;
    }
  }
}

export default NativeSumUpService.getInstance();
export { NativeSumUpService, TransactionResult, MerchantInfo };