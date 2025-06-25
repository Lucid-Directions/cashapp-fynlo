import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SumUpSDKBridge } = NativeModules;

// Create event emitter for SumUp events
const sumUpEventEmitter = Platform.OS === 'ios' ? new NativeEventEmitter(SumUpSDKBridge) : null;

export interface SumUpConfig {
  apiKey: string;
  accessToken?: string;
  environment: 'sandbox' | 'production';
}

export interface SumUpPaymentRequest {
  total: number;
  currencyCode?: string;
  title?: string;
  foreignTransactionId?: string;
}

export interface SumUpPaymentResult {
  success: boolean;
  transactionCode?: string;
  additionalInfo?: any;
  error?: string;
}

export interface SumUpMerchant {
  merchantCode: string;
  currency: string;
}

export interface SumUpSDKInfo {
  version: string;
  build: string;
}

class SumUpServiceClass {
  private initialized = false;
  private config: SumUpConfig | null = null;
  private eventListeners: { [key: string]: any } = {};

  constructor() {
    if (Platform.OS === 'ios' && sumUpEventEmitter) {
      // Set up event listeners
      this.eventListeners.paymentCompleted = sumUpEventEmitter.addListener(
        'SumUpPaymentCompleted',
        this.handlePaymentCompleted.bind(this)
      );
      
      this.eventListeners.loginCompleted = sumUpEventEmitter.addListener(
        'SumUpLoginCompleted',
        this.handleLoginCompleted.bind(this)
      );
      
      this.eventListeners.error = sumUpEventEmitter.addListener(
        'SumUpError',
        this.handleError.bind(this)
      );
    }
  }

  /**
   * Initialize SumUp SDK with API key
   */
  async initialize(config: SumUpConfig): Promise<void> {
    if (Platform.OS !== 'ios') {
      throw new Error('SumUp SDK is only supported on iOS');
    }

    if (!SumUpSDKBridge) {
      throw new Error('SumUp SDK Bridge not available');
    }

    try {
      this.config = config;
      await SumUpSDKBridge.setupWithAPIKey(config.apiKey);
      this.initialized = true;
      console.log('SumUp SDK initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SumUp SDK:', error);
      throw error;
    }
  }

  /**
   * Present login screen to user
   */
  async presentLogin(): Promise<{ success: boolean; isLoggedIn: boolean; cancelled?: boolean }> {
    this.ensureInitialized();
    
    try {
      const result = await SumUpSDKBridge.presentLogin();
      return result;
    } catch (error) {
      console.error('SumUp login failed:', error);
      throw error;
    }
  }

  /**
   * Login with access token (for silent login)
   */
  async loginWithToken(token: string): Promise<{ success: boolean; isLoggedIn: boolean }> {
    this.ensureInitialized();
    
    try {
      const result = await SumUpSDKBridge.loginWithToken(token);
      return result;
    } catch (error) {
      console.error('SumUp token login failed:', error);
      throw error;
    }
  }

  /**
   * Logout current merchant
   */
  async logout(): Promise<{ success: boolean }> {
    this.ensureInitialized();
    
    try {
      const result = await SumUpSDKBridge.logout();
      return result;
    } catch (error) {
      console.error('SumUp logout failed:', error);
      throw error;
    }
  }

  /**
   * Process payment with SumUp
   */
  async processPayment(paymentRequest: SumUpPaymentRequest): Promise<SumUpPaymentResult> {
    this.ensureInitialized();
    
    if (!(await this.isLoggedIn())) {
      throw new Error('Merchant not logged in');
    }

    try {
      const result = await SumUpSDKBridge.checkout({
        total: paymentRequest.total,
        currencyCode: paymentRequest.currencyCode || 'GBP',
        title: paymentRequest.title || 'Payment',
        foreignTransactionId: paymentRequest.foreignTransactionId,
      });
      
      return {
        success: result.success,
        transactionCode: result.transactionCode,
        additionalInfo: result.additionalInfo,
      };
    } catch (error) {
      console.error('SumUp payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment failed',
      };
    }
  }

  /**
   * Present checkout preferences (terminal settings, etc.)
   */
  async presentCheckoutPreferences(): Promise<{ success: boolean }> {
    this.ensureInitialized();
    
    try {
      const result = await SumUpSDKBridge.presentCheckoutPreferences();
      return result;
    } catch (error) {
      console.error('Failed to present checkout preferences:', error);
      throw error;
    }
  }

  /**
   * Check if merchant is logged in
   */
  async isLoggedIn(): Promise<boolean> {
    if (!this.initialized || !SumUpSDKBridge) {
      return false;
    }
    
    try {
      return await SumUpSDKBridge.isLoggedIn();
    } catch (error) {
      console.error('Failed to check login status:', error);
      return false;
    }
  }

  /**
   * Get current merchant information
   */
  async getCurrentMerchant(): Promise<SumUpMerchant | null> {
    this.ensureInitialized();
    
    try {
      const merchant = await SumUpSDKBridge.getCurrentMerchant();
      return merchant;
    } catch (error) {
      console.error('Failed to get current merchant:', error);
      return null;
    }
  }

  /**
   * Check if checkout is in progress
   */
  async checkoutInProgress(): Promise<boolean> {
    if (!this.initialized || !SumUpSDKBridge) {
      return false;
    }
    
    try {
      return await SumUpSDKBridge.checkoutInProgress();
    } catch (error) {
      console.error('Failed to check checkout status:', error);
      return false;
    }
  }

  /**
   * Check if tip on card reader is available
   */
  async isTipOnCardReaderAvailable(): Promise<boolean> {
    if (!this.initialized || !SumUpSDKBridge) {
      return false;
    }
    
    try {
      return await SumUpSDKBridge.isTipOnCardReaderAvailable();
    } catch (error) {
      console.error('Failed to check tip on card reader availability:', error);
      return false;
    }
  }

  /**
   * Get SDK version information
   */
  async getSDKVersion(): Promise<SumUpSDKInfo> {
    if (!SumUpSDKBridge) {
      throw new Error('SumUp SDK Bridge not available');
    }
    
    try {
      return await SumUpSDKBridge.getSDKVersion();
    } catch (error) {
      console.error('Failed to get SDK version:', error);
      throw error;
    }
  }

  /**
   * Test SDK integration (for debugging)
   */
  async testSDKIntegration(): Promise<boolean> {
    if (!SumUpSDKBridge) {
      return false;
    }
    
    try {
      return await SumUpSDKBridge.testSDKIntegration();
    } catch (error) {
      console.error('SDK integration test failed:', error);
      return false;
    }
  }

  /**
   * Calculate SumUp fees based on volume
   */
  calculateFee(amount: number, monthlyVolume: number = 0): number {
    const volumeThreshold = 2714; // £2,714/month for optimal rates
    
    if (monthlyVolume >= volumeThreshold) {
      // High volume: 0.69% + £19/month
      return amount * 0.0069; // 0.69%
    } else {
      // Standard rates: varies by card type, using average
      return amount * 0.0175; // ~1.75% average
    }
  }

  /**
   * Get monthly fee for high volume customers
   */
  getMonthlyFee(monthlyVolume: number): number {
    const volumeThreshold = 2714; // £2,714/month
    return monthlyVolume >= volumeThreshold ? 19.00 : 0; // £19/month
  }

  /**
   * Check if SumUp is available and properly configured
   */
  isAvailable(): boolean {
    return this.initialized && Platform.OS === 'ios' && !!SumUpSDKBridge;
  }

  /**
   * Get provider information
   */
  getProviderInfo() {
    return {
      name: 'SumUp',
      feeStructure: '0.69% + £19/month (volume ≥£2,714) or standard rates',
      supportedMethods: ['card', 'contactless', 'chip_and_pin'],
      processingTime: 'Instant',
      volumeThreshold: '£2,714/month for optimal rates',
      available: this.isAvailable(),
      sdkVersion: this.initialized ? 'Available' : 'Not initialized',
    };
  }

  /**
   * Clean up event listeners
   */
  destroy(): void {
    Object.values(this.eventListeners).forEach(listener => {
      if (listener && typeof listener.remove === 'function') {
        listener.remove();
      }
    });
    this.eventListeners = {};
  }

  // Private helper methods
  private ensureInitialized(): void {
    if (!this.initialized) {
      throw new Error('SumUp SDK not initialized. Call initialize() first.');
    }
    
    if (!SumUpSDKBridge) {
      throw new Error('SumUp SDK Bridge not available');
    }
  }

  private handlePaymentCompleted(event: any): void {
    console.log('SumUp payment completed:', event);
  }

  private handleLoginCompleted(event: any): void {
    console.log('SumUp login completed:', event);
  }

  private handleError(event: any): void {
    console.error('SumUp error:', event);
  }
}

export const SumUpService = new SumUpServiceClass();
export default SumUpService;