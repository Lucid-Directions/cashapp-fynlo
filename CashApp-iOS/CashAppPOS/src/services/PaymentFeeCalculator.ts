import useSettingsStore from '../store/useSettingsStore';

export class PaymentFeeCalculator {
  /**
   * Calculate platform fee based on payment method and amount
   */
  calculatePlatformFee(amount: number, paymentMethodId: string): number {
    const settings = useSettingsStore.getState();
    const platformSettings = settings.platformSettings;
    
    // Default platform fee percentage
    let feePercentage = 0.01; // 1% default
    
    // Check if platform has specific fee settings for this payment method
    if (platformSettings?.paymentProcessing) {
      const methodFees = {
        'tapToPay': platformSettings.paymentProcessing.cardPaymentFee || 0.01,
        'applePaySumUp': platformSettings.paymentProcessing.cardPaymentFee || 0.01,
        'cardEntry': platformSettings.paymentProcessing.cardPaymentFee || 0.01,
        'stripe': platformSettings.paymentProcessing.cardPaymentFee || 0.01,
        'square': platformSettings.paymentProcessing.cardPaymentFee || 0.01,
        'qrCode': platformSettings.paymentProcessing.qrPaymentFee || 0.005, // 0.5% for QR
        'cash': 0 // No platform fee for cash
      };
      
      feePercentage = methodFees[paymentMethodId] || 0.01;
    }
    
    return amount * feePercentage;
  }
  
  /**
   * Calculate total fees including processing and platform fees
   */
  calculateTotalFees(
    amount: number,
    processingFee: number,
    paymentMethodId: string
  ): {
    processingFee: number;
    platformFee: number;
    totalFee: number;
    netAmount: number;
  } {
    const platformFee = this.calculatePlatformFee(amount, paymentMethodId);
    const totalFee = processingFee + platformFee;
    const netAmount = amount - totalFee;
    
    return {
      processingFee,
      platformFee,
      totalFee,
      netAmount: Math.max(0, netAmount)
    };
  }
  
  /**
   * Format fee for display
   */
  formatFee(fee: number, currency: string = 'GBP'): string {
    const currencySymbols: { [key: string]: string } = {
      'GBP': '£',
      'USD': '$',
      'EUR': '€'
    };
    
    const symbol = currencySymbols[currency] || currency;
    return `${symbol}${fee.toFixed(2)}`;
  }
  
  /**
   * Get fee breakdown text for display
   */
  getFeeBreakdownText(
    amount: number,
    paymentMethodId: string,
    processingFeePercentage: number
  ): string {
    const platformFee = this.calculatePlatformFee(amount, paymentMethodId);
    const platformFeePercentage = amount > 0 ? (platformFee / amount) * 100 : 0;
    
    if (paymentMethodId === 'cash') {
      return 'No fees';
    }
    
    return `${processingFeePercentage.toFixed(2)}% processing + ${platformFeePercentage.toFixed(2)}% platform`;
  }
}