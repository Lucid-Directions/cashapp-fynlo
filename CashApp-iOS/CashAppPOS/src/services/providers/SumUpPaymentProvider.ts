import SumUpService, { type SumUpConfig, type SumUpPaymentResult } from '../SumUpService';

export interface SumUpPaymentProviderConfig {
  apiKey: string;
  accessToken?: string;
  environment: 'sandbox' | 'production';
}

class SumUpPaymentProviderClass {
  private initialized = false;
  private config: SumUpPaymentProviderConfig | null = null;

  async initialize(config: SumUpPaymentProviderConfig): Promise<void> {
    try {
      this.config = config;
      
      // Initialize the SumUp SDK through our service
      await SumUpService.initialize({
        apiKey: config.apiKey,
        accessToken: config.accessToken,
        environment: config.environment,
      });
      
      this.initialized = true;
      console.log('SumUp payment provider initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SumUp:', error);
      throw error;
    }
  }

  async login(): Promise<boolean> {
    try {
      if (!this.initialized) {
        throw new Error('SumUp not initialized');
      }

      // If we have an access token, use silent login
      if (this.config?.accessToken) {
        const result = await SumUpService.loginWithToken(this.config.accessToken);
        return result.success && result.isLoggedIn;
      } else {
        // Present login UI
        const result = await SumUpService.presentLogin();
        return result.success && result.isLoggedIn;
      }
    } catch (error) {
      console.error('SumUp login failed:', error);
      return false;
    }
  }

  async processPayment(
    amount: number,
    currency: string = 'GBP',
    title?: string,
    foreignTransactionId?: string
  ): Promise<SumUpPaymentResult> {
    try {
      if (!this.initialized) {
        throw new Error('SumUp not initialized');
      }

      // Ensure merchant is logged in
      if (!(await SumUpService.isLoggedIn())) {
        const loginSuccess = await this.login();
        if (!loginSuccess) {
          return {
            success: false,
            error: 'Failed to login to SumUp',
          };
        }
      }

      // Process payment through SumUp SDK
      const result = await SumUpService.processPayment({
        total: amount,
        currencyCode: currency,
        title: title || 'Payment',
        foreignTransactionId,
      });
      
      return result;
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'SumUp payment failed',
      };
    }
  }

  async getCardReaderSettings(): Promise<any> {
    try {
      if (!this.initialized) {
        throw new Error('SumUp not initialized');
      }

      // Present checkout preferences which includes card reader settings
      await SumUpService.presentCheckoutPreferences();
      
      // Return current merchant and settings info
      const merchant = await SumUpService.getCurrentMerchant();
      const tipOnCardAvailable = await SumUpService.isTipOnCardReaderAvailable();
      
      return {
        merchant,
        tipOnCardReaderAvailable,
      };
    } catch (error) {
      console.error('Failed to get SumUp card reader settings:', error);
      return null;
    }
  }

  async logout(): Promise<boolean> {
    try {
      if (!this.initialized) {
        return true; // Already logged out
      }

      const result = await SumUpService.logout();
      return result.success;
    } catch (error) {
      console.error('SumUp logout failed:', error);
      return false;
    }
  }

  async isLoggedIn(): Promise<boolean> {
    if (!this.initialized) {
      return false;
    }

    try {
      return await SumUpService.isLoggedIn();
    } catch (error) {
      console.error('Failed to check SumUp login status:', error);
      return false;
    }
  }

  async getCurrentMerchant(): Promise<any> {
    if (!this.initialized) {
      return null;
    }

    try {
      return await SumUpService.getCurrentMerchant();
    } catch (error) {
      console.error('Failed to get current merchant:', error);
      return null;
    }
  }

  /**
   * Calculate SumUp fees (0.69% + £19/month for high volume)
   */
  calculateFee(amount: number, monthlyVolume: number = 0): number {
    const volumeThreshold = 2714; // £2,714/month
    
    if (monthlyVolume >= volumeThreshold) {
      // High volume: 0.69% + £19/month
      const percentage = 0.0069; // 0.69%
      return amount * percentage; // Monthly fee handled separately
    } else {
      // Standard rates (would need to be obtained from SumUp)
      const percentage = 0.0175; // Placeholder - actual rates vary
      return amount * percentage;
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
   * Check if SumUp is available and configured
   */
  isAvailable(): boolean {
    return this.initialized && SumUpService.isAvailable();
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
      initialized: this.initialized,
      sdkInfo: SumUpService.getProviderInfo(),
    };
  }
}

export const SumUpPaymentProvider = new SumUpPaymentProviderClass();
export default SumUpPaymentProvider;