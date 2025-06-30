/**
 * Customer Fees Service - Frontend integration for customer-pays-fees business model
 * Handles service charges, platform fees, and staff tip distribution
 */

import API_CONFIG from '../config/api';

const BASE_URL = API_CONFIG.FULL_API_URL;

export interface CustomerPaymentCalculation {
  subtotal: number;
  vat_amount: number;
  payment_method: 'stripe' | 'sumup' | 'cash' | 'card_manual' | 'other';
  restaurant_id: string;
  customer_pays_processor_fees: boolean;
  monthly_volume_for_restaurant?: number;
}

export interface CustomerTotalBreakdown {
  subtotal: number;
  vat_amount: number;
  service_charge_calculated: number;
  platform_fee: number;
  processor_fee: number;
  customer_pays_processor_fees: boolean;
  final_total: number;
  notes?: string;
}

export interface ServiceChargeBreakdown {
  original_service_charge_on_subtotal: number;
  processor_fee_added_to_service_charge: number;
  final_service_charge_amount: number;
  service_charge_rate_applied: number;
  include_transaction_fees_in_service_charge: boolean;
}

export interface StaffTipDistribution {
  staff_member: {
    id: string;
    name: string;
  };
  tip_amount_allocated: number;
  notes?: string;
}

export interface BusinessModelSummary {
  model: string;
  platform_revenue_percentage: number;
  service_charge_to_staff_percentage: number;
  transaction_fees_handled_by: string;
  service_charge_includes_processor_fees: boolean;
  total_platform_revenue: number;
  total_staff_tips: number;
  effective_customer_fee_rate: number;
}

export interface CustomerPaymentResponse {
  customer_total: CustomerTotalBreakdown;
  service_charge_breakdown: ServiceChargeBreakdown;
  staff_tip_distributions: StaffTipDistribution[];
  business_model_summary: BusinessModelSummary;
}

class CustomerFeesService {
  private static instance: CustomerFeesService;

  static getInstance(): CustomerFeesService {
    if (!CustomerFeesService.instance) {
      CustomerFeesService.instance = new CustomerFeesService();
    }
    return CustomerFeesService.instance;
  }

  /**
   * Calculate complete customer payment with fees and tip distribution
   */
  async calculateCustomerPayment(request: CustomerPaymentCalculation): Promise<CustomerPaymentResponse> {
    try {
      console.log('🧮 Calculating customer payment with fees:', request);
      
      const response = await fetch(`${BASE_URL}/customer-fees/calculate-customer-payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Customer payment calculated successfully:', result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to calculate customer payment');
      }
    } catch (error) {
      console.error('❌ Error calculating customer payment:', error);
      // Return fallback calculation
      return this.getFallbackCalculation(request);
    }
  }

  /**
   * Get business model demo scenarios
   */
  async getBusinessModelDemo(): Promise<any> {
    try {
      const response = await fetch(`${BASE_URL}/customer-fees/business-model-demo`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Business model demo retrieved:', result.data);
        return result.data;
      } else {
        throw new Error(result.message || 'Failed to get business model demo');
      }
    } catch (error) {
      console.error('❌ Error getting business model demo:', error);
      throw error;
    }
  }

  /**
   * Update service charge configuration
   */
  async updateServiceChargeConfig(
    enabled: boolean, 
    rate: number, 
    restaurantId?: string
  ): Promise<boolean> {
    try {
      console.log('⚙️ Updating service charge config:', { enabled, rate, restaurantId });
      
      const response = await fetch(`${BASE_URL}/customer-fees/service-charge-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          enabled,
          rate,
          restaurant_id: restaurantId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Service charge config updated successfully');
        return true;
      } else {
        console.error('❌ Failed to update service charge config:', result.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating service charge config:', error);
      return false;
    }
  }

  /**
   * Update payment method fee inclusion settings
   */
  async updatePaymentMethodFeeConfig(
    paymentMethod: string,
    includeInServiceCharge: boolean,
    restaurantId?: string
  ): Promise<boolean> {
    try {
      console.log('⚙️ Updating payment method fee config:', { 
        paymentMethod, 
        includeInServiceCharge, 
        restaurantId 
      });
      
      const response = await fetch(`${BASE_URL}/customer-fees/payment-method-fee-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          payment_method: paymentMethod,
          include_in_service_charge: includeInServiceCharge,
          restaurant_id: restaurantId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Payment method fee config updated successfully');
        return true;
      } else {
        console.error('❌ Failed to update payment method fee config:', result.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating payment method fee config:', error);
      return false;
    }
  }

  /**
   * Update tip distribution settings
   */
  async updateTipDistributionConfig(
    distributionPercentage: number,
    deductTransactionFees: boolean,
    restaurantId?: string
  ): Promise<boolean> {
    try {
      console.log('⚙️ Updating tip distribution config:', { 
        distributionPercentage, 
        deductTransactionFees, 
        restaurantId 
      });
      
      const response = await fetch(`${BASE_URL}/customer-fees/tip-distribution-config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          distribution_percentage: distributionPercentage,
          deduct_transaction_fees: deductTransactionFees,
          restaurant_id: restaurantId,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      
      if (result.success) {
        console.log('✅ Tip distribution config updated successfully');
        return true;
      } else {
        console.error('❌ Failed to update tip distribution config:', result.message);
        return false;
      }
    } catch (error) {
      console.error('❌ Error updating tip distribution config:', error);
      return false;
    }
  }

  /**
   * Fallback calculation when backend is unavailable
   */
  private getFallbackCalculation(request: CustomerPaymentCalculation): CustomerPaymentResponse {
    console.log('⚠️ Using fallback calculation');
    
    const subtotal = request.subtotal;
    const vatAmount = request.vat_amount;
    
    // Basic service charge calculation (12.5%)
    const serviceChargeRate = 0.125;
    const baseServiceCharge = subtotal * serviceChargeRate;
    
    // Estimate processor fee based on payment method
    let processorFee = 0;
    if (request.payment_method !== 'cash') {
      const baseAmount = subtotal + vatAmount + baseServiceCharge;
      switch (request.payment_method) {
        case 'stripe':
          processorFee = baseAmount * 0.014 + 0.20;
          break;
        case 'sumup':
          processorFee = baseAmount * 0.0195;
          break;
        default:
          processorFee = baseAmount * 0.015;
      }
    }
    
    // Service charge includes processor fee if not cash
    const serviceChargeTotal = request.payment_method === 'cash' 
      ? baseServiceCharge 
      : baseServiceCharge + processorFee;
    
    // Platform fee (1% of total before platform fee)
    const platformFeeBase = subtotal + vatAmount + serviceChargeTotal + 
                           (request.customer_pays_processor_fees ? processorFee : 0);
    const platformFee = platformFeeBase * 0.01;
    
    // Final total
    const finalTotal = platformFeeBase + platformFee;
    
    // Staff tips (80% of service charge)
    const totalStaffTips = serviceChargeTotal * 0.8;
    const tipPerPerson = totalStaffTips / 2; // Assume 2 staff members
    
    return {
      customer_total: {
        subtotal,
        vat_amount: vatAmount,
        service_charge_calculated: serviceChargeTotal,
        platform_fee: Math.round(platformFee * 100) / 100,
        processor_fee: Math.round(processorFee * 100) / 100,
        customer_pays_processor_fees: request.customer_pays_processor_fees,
        final_total: Math.round(finalTotal * 100) / 100,
        notes: 'Fallback calculation - backend unavailable'
      },
      service_charge_breakdown: {
        original_service_charge_on_subtotal: Math.round(baseServiceCharge * 100) / 100,
        processor_fee_added_to_service_charge: request.payment_method === 'cash' ? 0 : Math.round(processorFee * 100) / 100,
        final_service_charge_amount: Math.round(serviceChargeTotal * 100) / 100,
        service_charge_rate_applied: serviceChargeRate,
        include_transaction_fees_in_service_charge: request.payment_method !== 'cash'
      },
      staff_tip_distributions: [
        {
          staff_member: { id: 'staff_1', name: 'Alice Johnson' },
          tip_amount_allocated: Math.round(tipPerPerson * 100) / 100,
          notes: 'Equal distribution (fallback)'
        },
        {
          staff_member: { id: 'staff_2', name: 'Bob Smith' },
          tip_amount_allocated: Math.round(tipPerPerson * 100) / 100,
          notes: 'Equal distribution (fallback)'
        }
      ],
      business_model_summary: {
        model: 'customer_pays_fees',
        platform_revenue_percentage: 1.0,
        service_charge_to_staff_percentage: 80.0,
        transaction_fees_handled_by: request.customer_pays_processor_fees ? 'customer' : 'restaurant',
        service_charge_includes_processor_fees: request.payment_method !== 'cash',
        total_platform_revenue: Math.round(platformFee * 100) / 100,
        total_staff_tips: Math.round(totalStaffTips * 100) / 100,
        effective_customer_fee_rate: Math.round(((finalTotal - subtotal - vatAmount) / subtotal) * 100 * 100) / 100
      }
    };
  }

  /**
   * Quick fee calculation for display purposes
   */
  calculateQuickFees(subtotal: number, paymentMethod: string): {
    serviceCharge: number;
    platformFee: number;
    processorFee: number;
    total: number;
  } {
    const vatAmount = subtotal * 0.20; // Assume 20% VAT
    const serviceChargeRate = 0.125; // 12.5%
    const baseServiceCharge = subtotal * serviceChargeRate;
    
    let processorFee = 0;
    if (paymentMethod !== 'cash') {
      const baseAmount = subtotal + vatAmount + baseServiceCharge;
      switch (paymentMethod) {
        case 'stripe':
          processorFee = baseAmount * 0.014 + 0.20;
          break;
        case 'sumup':
          processorFee = baseAmount * 0.0195;
          break;
        default:
          processorFee = baseAmount * 0.015;
      }
    }
    
    const serviceCharge = paymentMethod === 'cash' ? baseServiceCharge : baseServiceCharge + processorFee;
    const platformFeeBase = subtotal + vatAmount + serviceCharge;
    const platformFee = platformFeeBase * 0.01;
    const total = platformFeeBase + platformFee;
    
    return {
      serviceCharge: Math.round(serviceCharge * 100) / 100,
      platformFee: Math.round(platformFee * 100) / 100,
      processorFee: Math.round(processorFee * 100) / 100,
      total: Math.round(total * 100) / 100
    };
  }
}

export default CustomerFeesService;