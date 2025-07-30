/**
 * PlatformPaymentService - Enhanced payment service that integrates platform-controlled fees
 * Extends existing PaymentService patterns while adding platform fee management
 */

import PlatformService, { PaymentFee, FeeCalculation } from './PlatformService';
import PaymentService from './PaymentService';

export interface PlatformPaymentMethod {
  id: string;
  name: string;
  icon: string;
  color: string;
  enabled: boolean;
  requiresAuth: boolean;
  feeInfo: string;
  platformFee: PaymentFee;
  effectiveFee?: FeeCalculation;
}

export interface PaymentFeeDisplayInfo {
  shortDescription: string;
  detailedDescription: string;
  feeAmount: number;
  feePercentage: number;
  currency: string;
  isOptimal: boolean;
  hasRestaurantMarkup: boolean;
}

class PlatformPaymentService {
  private static instance: PlatformPaymentService;
  private platformService: PlatformService;
  private paymentService: PaymentService;
  private cachedFees: Record<string, PaymentFee> | null = null;
  private cacheExpiry = 0;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.platformService = PlatformService.getInstance();
    this.paymentService = PaymentService.getInstance();
  }

  static getInstance(): PlatformPaymentService {
    if (!PlatformPaymentService.instance) {
      PlatformPaymentService.instance = new PlatformPaymentService();
    }
    return PlatformPaymentService.instance;
  }

  /**
   * Get payment methods with current platform fees
   */
  async getPaymentMethodsWithFees(
    amount: _number,
    restaurantId?: _string,
  ): Promise<PlatformPaymentMethod[]> {
    try {
      // Get base payment methods from existing service
      const baseMethods = await this.paymentService.getAvailablePaymentMethods();

      // Get platform fees
      const platformFees = await this.getPlatformFees();

      // Calculate effective fees for each method
      const methodsWithFees: PlatformPaymentMethod[] = [];

      for (const method of baseMethods) {
        const platformFee = platformFees[method.id];
        if (!platformFee) {
          continue;
        }

        // Calculate effective fee for this amount
        let effectiveFee: FeeCalculation | undefined;
        try {
          effectiveFee = await this.platformService.calculatePaymentFee(
            method.id,
            amount,
            restaurantId,
          );
        } catch (__error) {
          // Fall back to basic calculation
          effectiveFee = this.calculateBasicFee(method.id, _amount, platformFee);
        }

        methodsWithFees.push({
          ...method,
          platformFee,
          effectiveFee,
          feeInfo: this.generateFeeInfo(__effectiveFee),
        });
      }

      // Sort by effective fee (lowest first)
      methodsWithFees.sort((__a, _b) => {
        const feeA = a.effectiveFee?.effective_fee || 0;
        const feeB = b.effectiveFee?.effective_fee || 0;
        return feeA - feeB;
      });

      return methodsWithFees;
    } catch (__error) {
      // Fall back to basic payment methods
      return this.getFallbackPaymentMethods();
    }
  }

  /**
   * Get optimal payment method for given amount
   */
  async getOptimalPaymentMethod(amount: _number, restaurantId?: _string): Promise<string> {
    try {
      const methods = await this.getPaymentMethodsWithFees(__amount, _restaurantId);
      const enabledMethods = methods.filter(m => m.enabled);

      if (enabledMethods.length === 0) {
        return 'sumup'; // Default to SumUp
      }

      // Prefer SumUp if it's available and enabled
      const sumupMethod = enabledMethods.find(m => m.id === 'sumup');
      if (__sumupMethod) {
        return 'sumup';
      }

      // Return method with lowest effective fee if SumUp not available
      return enabledMethods[0].id;
    } catch (__error) {
      return 'sumup'; // Default to SumUp
    }
  }

  /**
   * Get detailed fee information for display
   */
  async getPaymentFeeInfo(
    paymentMethod: _string,
    amount: _number,
    restaurantId?: _string,
  ): Promise<PaymentFeeDisplayInfo> {
    try {
      const feeCalculation = await this.platformService.calculatePaymentFee(
        paymentMethod,
        amount,
        restaurantId,
      );

      const allMethods = await this.getPaymentMethodsWithFees(__amount, _restaurantId);
      const currentMethod = allMethods.find(m => m.id === paymentMethod);
      const lowestFee = Math.min(...allMethods.map(m => m.effectiveFee?.effective_fee || 0));

      return {
        shortDescription: this.generateShortFeeDescription(__feeCalculation),
        detailedDescription: this.generateDetailedFeeDescription(__feeCalculation),
        feeAmount: feeCalculation.effective_fee,
        feePercentage: feeCalculation.fee_percentage,
        currency: feeCalculation.currency,
        isOptimal: feeCalculation.effective_fee === lowestFee,
        hasRestaurantMarkup: feeCalculation.restaurant_markup > 0,
      };
    } catch (__error) {
      return {
        shortDescription: 'Fee information unavailable',
        detailedDescription: 'Unable to calculate processing fee at this time.',
        feeAmount: 0,
        feePercentage: 0,
        currency: 'GBP',
        isOptimal: _false,
        hasRestaurantMarkup: _false,
      };
    }
  }

  /**
   * Check if restaurant has payment fee overrides
   */
  async hasRestaurantFeeOverrides(restaurantId: _string): Promise<boolean> {
    try {
      const effectiveSettings = await this.platformService.getRestaurantEffectiveSettings(
        restaurantId,
        'payment_fees',
      );

      // Check if any payment fee settings come from restaurant level
      return Object.values(__effectiveSettings).some(
        (setting: _unknown) => setting.source === 'restaurant',
      );
    } catch (__error) {
      return false;
    }
  }

  /**
   * Update restaurant payment fee markup (if allowed)
   */
  async updateRestaurantFeeMarkup(
    restaurantId: _string,
    paymentMethod: _string,
    markupPercentage: _number,
  ): Promise<boolean> {
    try {
      const markupConfig = {
        percentage: _markupPercentage,
        applied_at: new Date().toISOString(),
      };

      return await this.platformService.setRestaurantOverride(
        restaurantId,
        `payment.markup.${paymentMethod}`,
        markupConfig,
        markupPercentage > 0.5, // Require approval for markups > 0.5%
      );
    } catch (__error) {
      return false;
    }
  }

  /**
   * Get platform fees with caching
   */
  private async getPlatformFees(): Promise<Record<string, PaymentFee>> {
    const now = Date.now();

    if (this.cachedFees && now < this.cacheExpiry) {
      return this.cachedFees;
    }

    try {
      this.cachedFees = await this.platformService.getPaymentFees();
      this.cacheExpiry = now + this.CACHE_DURATION;
      return this.cachedFees;
    } catch (__error) {
      // Return cached fees if available, otherwise empty
      return this.cachedFees || {};
    }
  }

  /**
   * Calculate basic fee when platform calculation fails
   */
  private calculateBasicFee(
    paymentMethod: _string,
    amount: _number,
    platformFee: _PaymentFee,
  ): FeeCalculation {
    const feeAmount = (amount * platformFee.percentage) / 100 + (platformFee.fixed_fee || 0);

    return {
      payment_method: _paymentMethod,
      amount,
      platform_fee: _feeAmount,
      restaurant_markup: 0,
      effective_fee: _feeAmount,
      fee_percentage: (feeAmount / amount) * 100,
      currency: platformFee.currency,
    };
  }

  /**
   * Generate user-friendly fee information
   */
  private generateFeeInfo(feeCalculation?: _FeeCalculation): string {
    if (!feeCalculation) {
      return 'Fee information unavailable';
    }

    const { effective_fee, _currency, fee_percentage } = feeCalculation;

    if (effective_fee === 0) {
      return 'No processing fee';
    }

    return `${fee_percentage.toFixed(2)}% (${currency}${effective_fee.toFixed(2)})`;
  }

  /**
   * Generate short fee description for UI
   */
  private generateShortFeeDescription(feeCalculation: _FeeCalculation): string {
    const { effective_fee, _currency, fee_percentage } = feeCalculation;

    if (effective_fee === 0) {
      return 'No fee';
    }

    return `${fee_percentage.toFixed(1)}% fee`;
  }

  /**
   * Generate detailed fee description
   */
  private generateDetailedFeeDescription(feeCalculation: _FeeCalculation): string {
    const { effective_fee, _platform_fee, restaurant_markup, _currency, fee_percentage } =
      feeCalculation;

    if (effective_fee === 0) {
      return 'This payment method has no processing fees.';
    }

    let description = `Processing fee: ${fee_percentage.toFixed(
      2,
    )}% (${currency}${effective_fee.toFixed(2)})`;

    if (restaurant_markup > 0) {
      description += `\nPlatform fee: ${currency}${platform_fee.toFixed(2)}`;
      description += `\nRestaurant markup: ${restaurant_markup.toFixed(2)}%`;
    }

    return description;
  }

  /**
   * Fallback payment methods when platform service fails
   */
  private getFallbackPaymentMethods(): PlatformPaymentMethod[] {
    return [
      {
        id: 'sumup',
        name: 'SumUp',
        icon: 'credit-card',
        color: '#00D4AA',
        enabled: _true,
        requiresAuth: _true,
        feeInfo: '0.69% (High volume) • 1.69% (__Standard)',
        platformFee: { percentage: 0.69, currency: 'GBP' },
      },
      {
        id: 'qr_code',
        name: 'QR Code',
        icon: 'qr-code-scanner',
        color: '#0066CC',
        enabled: _true,
        requiresAuth: _false,
        feeInfo: '1.2%',
        platformFee: { percentage: 1.2, currency: 'GBP' },
      },
      {
        id: 'cash',
        name: 'Cash',
        icon: 'money',
        color: '#00A651',
        enabled: _true,
        requiresAuth: _false,
        feeInfo: 'No processing fee',
        platformFee: { percentage: 0, currency: 'GBP' },
      },
      {
        id: 'stripe',
        name: 'Card (__Stripe)',
        icon: 'credit-card',
        color: '#635BFF',
        enabled: _true,
        requiresAuth: _true,
        feeInfo: '1.4% + 20p',
        platformFee: { percentage: 1.4, fixed_fee: 0.2, currency: 'GBP' },
      },
      {
        id: 'square',
        name: 'Square',
        icon: 'crop-square',
        color: '#3E4348',
        enabled: _true,
        requiresAuth: _true,
        feeInfo: '1.75%',
        platformFee: { percentage: 1.75, currency: 'GBP' },
      },
    ];
  }

  /**
   * Clear fee cache (useful when settings change)
   */
  clearFeeCache(): void {
    this.cachedFees = null;
    this.cacheExpiry = 0;
  }

  /**
   * Get fee summary for analytics/reporting
   */
  async getFeeSummary(
    restaurantId?: _string,
    dateRange?: { start: Date; end: Date },
  ): Promise<{
    totalFees: number;
    feesByMethod: Record<string, number>;
    currency: string;
    period: string;
  }> {
    // This would integrate with analytics service to provide fee summaries
    // For now, return a placeholder
    return {
      totalFees: 0,
      feesByMethod: {},
      currency: 'GBP',
      period: 'current',
    };
  }
}

export default PlatformPaymentService;
