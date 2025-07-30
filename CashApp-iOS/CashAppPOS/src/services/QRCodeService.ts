/**
 * QRCodeService - Handles QR code generation, tracking, and payment monitoring
 * Provides utilities for creating QR codes and managing real-time payment status
 */

import { SumUpQRPayment } from './SumUpService';

export interface QRCodeOptions {
  size: number;
  backgroundColor: string;
  foregroundColor: string;
  errorCorrectionLevel: 'L' | 'M' | 'Q' | 'H';
  margin: number;
}

export interface QRPaymentTracking {
  id: string;
  startTime: Date;
  lastStatusCheck: Date;
  statusCheckCount: number;
  estimatedScanTime?: Date;
  completionTime?: Date;
}

class QRCodeServiceClass {
  private static instance: QRCodeServiceClass;
  private activePayments: Map<string, QRPaymentTracking> = new Map();
  private statusCallbacks: Map<string, (payment: SumUpQRPayment) => void> = new Map();

  private constructor() {}

  static getInstance(): QRCodeServiceClass {
    if (!QRCodeServiceClass.instance) {
      QRCodeServiceClass.instance = new QRCodeServiceClass();
    }
    return QRCodeServiceClass.instance;
  }

  /**
   * Get optimal QR code options based on device and lighting conditions
   */
  getOptimalQRCodeOptions(deviceType: 'phone' | 'tablet' = 'phone'): QRCodeOptions {
    const baseSize = deviceType === 'tablet' ? 300 : 200;

    return {
      size: baseSize,
      backgroundColor: '#FFFFFF',
      foregroundColor: '#000000',
      errorCorrectionLevel: 'M', // Medium error correction for good balance
      margin: 4,
    };
  }

  /**
   * Start tracking a QR payment
   */
  startPaymentTracking(
    payment: SumUpQRPayment,
    statusCallback: (payment: SumUpQRPayment) => void,
  ): void {
    const tracking: QRPaymentTracking = {
      id: payment.id,
      startTime: new Date(),
      lastStatusCheck: new Date(),
      statusCheckCount: 0,
    };

    this.activePayments.set(payment.id, tracking);
    this.statusCallbacks.set(payment.id, statusCallback);

    console.log(`Started tracking QR payment: ${payment.id}`);
  }

  /**
   * Stop tracking a QR payment
   */
  stopPaymentTracking(paymentId: string): void {
    this.activePayments.delete(paymentId);
    this.statusCallbacks.delete(paymentId);

    console.log(`Stopped tracking QR payment: ${paymentId}`);
  }

  /**
   * Update payment status and tracking info
   */
  updatePaymentStatus(payment: SumUpQRPayment): void {
    const tracking = this.activePayments.get(payment.id);
    if (!tracking) return;

    tracking.lastStatusCheck = new Date();
    tracking.statusCheckCount += 1;

    // Detect when scanning likely started (status changed to 'scanning')
    if (payment.status === 'scanning' && !tracking.estimatedScanTime) {
      tracking.estimatedScanTime = new Date();
    }

    // Detect completion
    if (payment.status === 'completed' && !tracking.completionTime) {
      tracking.completionTime = new Date();
    }

    this.activePayments.set(payment.id, tracking);

    // Notify callback
    const callback = this.statusCallbacks.get(payment.id);
    if (callback) {
      callback(payment);
    }
  }

  /**
   * Get payment tracking analytics
   */
  getPaymentAnalytics(paymentId: string): {
    duration: number;
    statusChecks: number;
    scanDuration?: number;
    isCompleted: boolean;
  } | null {
    const tracking = this.activePayments.get(paymentId);
    if (!tracking) return null;

    const now = new Date();
    const duration = now.getTime() - tracking.startTime.getTime();

    let scanDuration: number | undefined;
    if (tracking.estimatedScanTime && tracking.completionTime) {
      scanDuration = tracking.completionTime.getTime() - tracking.estimatedScanTime.getTime();
    }

    return {
      duration,
      statusChecks: tracking.statusCheckCount,
      scanDuration,
      isCompleted: !!tracking.completionTime,
    };
  }

  /**
   * Get all active payments
   */
  getActivePayments(): string[] {
    return Array.from(this.activePayments.keys());
  }

  /**
   * Clean up expired payments
   */
  cleanupExpiredPayments(): void {
    const now = new Date();
    const expiredPayments: string[] = [];

    this.activePayments.forEach((tracking, paymentId) => {
      // Remove payments older than 1 hour
      const age = now.getTime() - tracking.startTime.getTime();
      if (age > 60 * 60 * 1000) {
        expiredPayments.push(paymentId);
      }
    });

    expiredPayments.forEach(paymentId => {
      this.stopPaymentTracking(paymentId);
    });

    if (expiredPayments.length > 0) {
      console.log(`Cleaned up ${expiredPayments.length} expired QR payments`);
    }
  }

  /**
   * Generate user-friendly instructions for QR scanning
   */
  getScanningInstructions(bankingApp?: string): string[] {
    const baseInstructions = [
      'Open your banking app',
      'Look for "Pay" or "QR Code" option',
      'Point your camera at the QR code',
      'Confirm the payment amount',
      'Complete the payment in your app',
    ];

    if (bankingApp) {
      return [`Open ${bankingApp}`, ...baseInstructions.slice(1)];
    }

    return baseInstructions;
  }

  /**
   * Get troubleshooting tips for scanning issues
   */
  getTroubleshootingTips(): string[] {
    return [
      'Ensure good lighting on the QR code',
      "Hold your phone steady and at arm's length",
      'Make sure the entire QR code is visible in your camera',
      'Try cleaning your camera lens',
      'Close and reopen your banking app',
      'Check your internet connection',
      'Ensure you have sufficient funds in your account',
    ];
  }

  /**
   * Validate QR code data format
   */
  validateQRCodeData(data: string): boolean {
    try {
      // Basic validation for URL format
      if (data.startsWith('http://') || data.startsWith('https://')) {
        new URL(data); // This will throw if invalid URL
        return true;
      }

      // Add other validation patterns as needed
      return false;
    } catch (error) {
      return false;
    }
  }

  /**
   * Generate fallback payment link
   */
  generateFallbackLink(payment: SumUpQRPayment): string {
    // Create a user-friendly fallback URL
    const baseUrl = payment.qrCode;
    return `${baseUrl}?fallback=true&amount=${payment.amount}&currency=${payment.currency}`;
  }

  /**
   * Calculate optimal polling interval based on payment age
   */
  getOptimalPollingInterval(payment: SumUpQRPayment): number {
    const tracking = this.activePayments.get(payment.id);
    if (!tracking) return 2000; // Default 2 seconds

    const age = new Date().getTime() - tracking.startTime.getTime();

    // More frequent polling in first 30 seconds
    if (age < 30000) {
      return 1000; // 1 second
    }

    // Standard polling for next 2 minutes
    if (age < 120000) {
      return 2000; // 2 seconds
    }

    // Slower polling after 2 minutes
    return 5000; // 5 seconds
  }

  /**
   * Get payment status display text
   */
  getStatusDisplayText(status: SumUpQRPayment['status']): string {
    switch (status) {
      case 'created':
        return 'QR code ready';
      case 'pending':
        return 'Waiting for scan';
      case 'scanning':
        return 'Customer scanning...';
      case 'completed':
        return 'Payment successful';
      case 'expired':
        return 'QR code expired';
      case 'failed':
        return 'Payment failed';
      default:
        return 'Unknown status';
    }
  }

  /**
   * Get estimated time remaining for QR code
   */
  getTimeRemaining(payment: SumUpQRPayment): number {
    try {
      const expiresAt = new Date(payment.expiresAt);
      const now = new Date();
      return Math.max(0, Math.floor((expiresAt.getTime() - now.getTime()) / 1000));
    } catch (error) {
      console.error('Failed to calculate time remaining:', error);
      return 0;
    }
  }
}

export const QRCodeService = QRCodeServiceClass.getInstance();
export default QRCodeService;
