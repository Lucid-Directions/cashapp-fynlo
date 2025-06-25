import { PricingTier, PricingConfiguration, VolumeDiscountTier, RestaurantPricingAssignment } from '../types';

export class PricingTierService {
  private static instance: PricingTierService;
  private pricingConfiguration: PricingConfiguration;

  private constructor() {
    // Initialize with default configuration
    this.pricingConfiguration = this.getDefaultConfiguration();
  }

  public static getInstance(): PricingTierService {
    if (!PricingTierService.instance) {
      PricingTierService.instance = new PricingTierService();
    }
    return PricingTierService.instance;
  }

  /**
   * Get default pricing configuration
   */
  private getDefaultConfiguration(): PricingConfiguration {
    return {
      tiers: [
        {
          id: 'basic',
          name: 'Basic Tier',
          description: 'Standard plan for new restaurants',
          commissionRate: 8.0,
          monthlyFee: 29.99,
          features: [
            'Basic POS functionality',
            'Standard reporting',
            'Email support',
            'Payment processing'
          ],
          isActive: true,
          sortOrder: 1,
          created: new Date(),
          updated: new Date(),
        },
        {
          id: 'premium',
          name: 'Premium Tier',
          description: 'Enhanced features and lower commission',
          commissionRate: 6.0,
          monthlyFee: 79.99,
          features: [
            'Advanced analytics',
            'Priority support',
            'Custom branding',
            'Advanced integrations',
            'Reduced commission rate'
          ],
          isActive: true,
          sortOrder: 2,
          created: new Date(),
          updated: new Date(),
        },
        {
          id: 'enterprise',
          name: 'Enterprise Tier',
          description: 'Lowest commission for high-volume restaurants',
          commissionRate: 4.0,
          monthlyFee: 149.99,
          features: [
            'Dedicated account manager',
            'Custom development',
            'White-label options',
            'API access',
            'Lowest commission rate'
          ],
          isActive: true,
          sortOrder: 3,
          created: new Date(),
          updated: new Date(),
        },
      ],
      serviceCharge: {
        enabled: true,
        rate: 12.5,
        appliedTo: 'all_transactions'
      },
      minimumMonthlyFee: 29.99,
      freeTrialDays: 30,
      volumeDiscounts: {
        enabled: true,
        thresholds: [
          {
            minimumMonthlyVolume: 5000,
            discountRate: 0.5,
            name: 'Volume Tier 1'
          },
          {
            minimumMonthlyVolume: 10000,
            discountRate: 1.0,
            name: 'Volume Tier 2'
          },
          {
            minimumMonthlyVolume: 25000,
            discountRate: 1.5,
            name: 'Volume Tier 3'
          }
        ]
      },
      earlyPaymentDiscount: {
        enabled: true,
        rate: 2.0,
        daysRequired: 7
      },
      referralBonus: 50.00
    };
  }

  /**
   * Get all pricing tiers
   */
  public getPricingTiers(): PricingTier[] {
    return this.pricingConfiguration.tiers.filter(tier => tier.isActive);
  }

  /**
   * Get a specific pricing tier by ID
   */
  public getPricingTier(tierId: string): PricingTier | null {
    return this.pricingConfiguration.tiers.find(tier => tier.id === tierId) || null;
  }

  /**
   * Get the complete pricing configuration
   */
  public getPricingConfiguration(): PricingConfiguration {
    return { ...this.pricingConfiguration };
  }

  /**
   * Update pricing configuration
   */
  public updatePricingConfiguration(config: Partial<PricingConfiguration>): void {
    this.pricingConfiguration = {
      ...this.pricingConfiguration,
      ...config
    };
    
    // Update timestamps for modified tiers
    if (config.tiers) {
      this.pricingConfiguration.tiers = config.tiers.map(tier => ({
        ...tier,
        updated: new Date()
      }));
    }
  }

  /**
   * Create a new pricing tier
   */
  public createPricingTier(tier: Omit<PricingTier, 'id' | 'created' | 'updated'>): PricingTier {
    const newTier: PricingTier = {
      id: this.generateTierId(),
      ...tier,
      created: new Date(),
      updated: new Date(),
    };

    this.pricingConfiguration.tiers.push(newTier);
    this.sortTiers();
    
    return newTier;
  }

  /**
   * Update an existing pricing tier
   */
  public updatePricingTier(tierId: string, updates: Partial<PricingTier>): PricingTier | null {
    const tierIndex = this.pricingConfiguration.tiers.findIndex(tier => tier.id === tierId);
    
    if (tierIndex === -1) {
      return null;
    }

    this.pricingConfiguration.tiers[tierIndex] = {
      ...this.pricingConfiguration.tiers[tierIndex],
      ...updates,
      updated: new Date()
    };

    this.sortTiers();
    return this.pricingConfiguration.tiers[tierIndex];
  }

  /**
   * Delete a pricing tier (soft delete by setting isActive to false)
   */
  public deletePricingTier(tierId: string): boolean {
    const tierIndex = this.pricingConfiguration.tiers.findIndex(tier => tier.id === tierId);
    
    if (tierIndex === -1) {
      return false;
    }

    this.pricingConfiguration.tiers[tierIndex].isActive = false;
    this.pricingConfiguration.tiers[tierIndex].updated = new Date();
    
    return true;
  }

  /**
   * Calculate effective commission rate for a restaurant
   */
  public calculateEffectiveCommissionRate(
    tierId: string, 
    monthlyVolume: number, 
    customRate?: number
  ): number {
    const tier = this.getPricingTier(tierId);
    if (!tier) {
      throw new Error(`Pricing tier ${tierId} not found`);
    }

    let effectiveRate = customRate || tier.commissionRate;

    // Apply volume discounts if enabled
    if (this.pricingConfiguration.volumeDiscounts.enabled) {
      const applicableDiscount = this.getApplicableVolumeDiscount(monthlyVolume);
      if (applicableDiscount) {
        effectiveRate = Math.max(0, effectiveRate - applicableDiscount.discountRate);
      }
    }

    return effectiveRate;
  }

  /**
   * Calculate monthly fees and commissions for a restaurant
   */
  public calculateMonthlyFees(
    tierId: string,
    monthlyVolume: number,
    isEarlyPayment: boolean = false,
    customCommissionRate?: number
  ): {
    commissionFee: number;
    serviceFee: number;
    monthlyFee: number;
    earlyPaymentDiscount: number;
    totalFee: number;
    effectiveCommissionRate: number;
  } {
    const tier = this.getPricingTier(tierId);
    if (!tier) {
      throw new Error(`Pricing tier ${tierId} not found`);
    }

    const effectiveCommissionRate = this.calculateEffectiveCommissionRate(
      tierId, 
      monthlyVolume, 
      customCommissionRate
    );

    let commissionFee = (monthlyVolume * effectiveCommissionRate) / 100;
    let serviceFee = 0;
    
    if (this.pricingConfiguration.serviceCharge.enabled) {
      serviceFee = (monthlyVolume * this.pricingConfiguration.serviceCharge.rate) / 100;
    }

    const monthlyFee = tier.monthlyFee || 0;
    let earlyPaymentDiscount = 0;

    if (isEarlyPayment && this.pricingConfiguration.earlyPaymentDiscount.enabled) {
      const totalBeforeDiscount = commissionFee + serviceFee + monthlyFee;
      earlyPaymentDiscount = (totalBeforeDiscount * this.pricingConfiguration.earlyPaymentDiscount.rate) / 100;
    }

    const totalFee = Math.max(
      commissionFee + serviceFee + monthlyFee - earlyPaymentDiscount,
      this.pricingConfiguration.minimumMonthlyFee
    );

    return {
      commissionFee,
      serviceFee,
      monthlyFee,
      earlyPaymentDiscount,
      totalFee,
      effectiveCommissionRate
    };
  }

  /**
   * Get applicable volume discount for a given monthly volume
   */
  private getApplicableVolumeDiscount(monthlyVolume: number): VolumeDiscountTier | null {
    if (!this.pricingConfiguration.volumeDiscounts.enabled) {
      return null;
    }

    const applicableDiscounts = this.pricingConfiguration.volumeDiscounts.thresholds
      .filter(threshold => monthlyVolume >= threshold.minimumMonthlyVolume)
      .sort((a, b) => b.minimumMonthlyVolume - a.minimumMonthlyVolume);

    return applicableDiscounts.length > 0 ? applicableDiscounts[0] : null;
  }

  /**
   * Sort tiers by sortOrder
   */
  private sortTiers(): void {
    this.pricingConfiguration.tiers.sort((a, b) => a.sortOrder - b.sortOrder);
  }

  /**
   * Generate a unique tier ID
   */
  private generateTierId(): string {
    return `tier_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Validate pricing configuration
   */
  public validateConfiguration(config: PricingConfiguration): string[] {
    const errors: string[] = [];

    // Validate tiers
    if (!config.tiers || config.tiers.length === 0) {
      errors.push('At least one pricing tier is required');
    }

    config.tiers?.forEach((tier, index) => {
      if (!tier.name.trim()) {
        errors.push(`Tier ${index + 1}: Name is required`);
      }
      if (tier.commissionRate < 0 || tier.commissionRate > 100) {
        errors.push(`Tier ${index + 1}: Commission rate must be between 0 and 100%`);
      }
      if (tier.monthlyFee && tier.monthlyFee < 0) {
        errors.push(`Tier ${index + 1}: Monthly fee cannot be negative`);
      }
    });

    // Validate service charge
    if (config.serviceCharge.enabled && 
        (config.serviceCharge.rate < 0 || config.serviceCharge.rate > 100)) {
      errors.push('Service charge rate must be between 0 and 100%');
    }

    // Validate minimum monthly fee
    if (config.minimumMonthlyFee < 0) {
      errors.push('Minimum monthly fee cannot be negative');
    }

    // Validate free trial days
    if (config.freeTrialDays < 0) {
      errors.push('Free trial days cannot be negative');
    }

    // Validate early payment discount
    if (config.earlyPaymentDiscount.enabled) {
      if (config.earlyPaymentDiscount.rate < 0 || config.earlyPaymentDiscount.rate > 100) {
        errors.push('Early payment discount rate must be between 0 and 100%');
      }
      if (config.earlyPaymentDiscount.daysRequired < 1) {
        errors.push('Early payment discount days required must be at least 1');
      }
    }

    // Validate referral bonus
    if (config.referralBonus < 0) {
      errors.push('Referral bonus cannot be negative');
    }

    return errors;
  }

  /**
   * Export configuration for backup/migration
   */
  public exportConfiguration(): string {
    return JSON.stringify(this.pricingConfiguration, null, 2);
  }

  /**
   * Import configuration from backup/migration
   */
  public importConfiguration(configJson: string): boolean {
    try {
      const config = JSON.parse(configJson) as PricingConfiguration;
      const errors = this.validateConfiguration(config);
      
      if (errors.length > 0) {
        console.error('Configuration validation failed:', errors);
        return false;
      }

      this.pricingConfiguration = config;
      return true;
    } catch (error) {
      console.error('Failed to import configuration:', error);
      return false;
    }
  }
}

export default PricingTierService;