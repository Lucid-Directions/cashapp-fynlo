/**
 * NativeSumUpService - Bridge to native iOS SumUp SDK
 * 
 * This service provides direct access to the native SumUp SDK implementation,
 * bypassing the problematic sumup-react-native-alpha package and using the
 * actual iOS SDK capabilities including Tap to Pay on iPhone.
 */

import { NativeModules, Platform } from 'react-native';
import { logger } from '../utils/logger';
import TapToPayDiagnostics from './TapToPayDiagnostics';

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
  isSDKInitialized(): Promise<{ isInitialized: boolean }>;
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

  private constructor() {
    logger.info('🔧 NativeSumUpService initialized');
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
      const error = 'Native SumUp module is not available';
      TapToPayDiagnostics.logEvent('SDK setup failed - module not available', { error }, 'error');
      throw new Error(error);
    }

    // Check if already setup locally
    if (this.isSetup) {
      logger.info('[TAP_TO_PAY] SDK already setup locally, skipping re-initialization');
      return;
    }

    // Check if SDK was initialized early in AppDelegate
    try {
      const wasEarlyInit = await this.wasInitializedEarly();
      if (wasEarlyInit) {
        logger.info('[TAP_TO_PAY] SDK was initialized early in AppDelegate, marking as setup');
        TapToPayDiagnostics.logEvent('SDK already initialized early in AppDelegate');
        this.isSetup = true;
        this.apiKey = apiKey;
        // Still save the API key for future launches if not already saved
        await NativeSumUp!.setupSDK(apiKey);
        return;
      }
    } catch (error) {
      logger.warn('[TAP_TO_PAY] Could not check early initialization, proceeding with setup');
    }

    try {
      logger.info('[TAP_TO_PAY] Setting up SumUp SDK with API key');
      TapToPayDiagnostics.logEvent('SDK setup starting');
      
      const result = await NativeSumUp!.setupSDK(apiKey);
      
      if (result.success) {
        this.isSetup = true;
        this.apiKey = apiKey;
        logger.info('[TAP_TO_PAY] ✅ SumUp SDK setup successful');
        TapToPayDiagnostics.logEvent('SDK setup successful');
        // API key is saved to UserDefaults by the native module for early initialization
      } else {
        throw new Error('SumUp SDK setup failed');
      }
    } catch (error) {
      logger.error('[TAP_TO_PAY] ❌ Failed to setup SumUp SDK:', error);
      TapToPayDiagnostics.logEvent('SDK setup failed', { error }, 'error');
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
   * Check if SDK was initialized early in AppDelegate
   */
  async wasInitializedEarly(): Promise<boolean> {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      const result = await NativeSumUp!.isSDKInitialized();
      logger.info('[TAP_TO_PAY] Early initialization status:', result.isInitialized);
      return result.isInitialized;
    } catch (error) {
      logger.warn('[TAP_TO_PAY] Could not check early initialization status:', error);
      return false;
    }
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

      // Log payment attempt for diagnostics
      TapToPayDiagnostics.logPaymentAttempt(amount, currency, useTapToPay);

      const result = await NativeSumUp!.checkout(
        amount,
        title,
        currency,
        foreignTransactionID || null,
        useTapToPay
      );

      logger.info('💳 Checkout result:', result);
      
      // Log successful payment
      TapToPayDiagnostics.logPaymentResult(
        result.success,
        result.transactionCode,
        undefined
      );
      
      return result;
    } catch (error) {
      logger.error('❌ Checkout failed:', error);
      
      // Log failed payment
      TapToPayDiagnostics.logPaymentResult(false, undefined, error);
      
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
   * Run comprehensive diagnostics
   */
  async runDiagnostics(): Promise<any> {
    logger.info('🔍 Running tap to pay diagnostics');
    const report = await TapToPayDiagnostics.generateReport();
    const formatted = TapToPayDiagnostics.formatReportForDisplay(report);
    logger.info('\n' + formatted);
    return report;
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