import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import NetInfo from '@react-native-community/netinfo';

export interface ErrorContext {
  userId?: string;
  restaurantId?: string;
  restaurantName?: string;
  userRole?: string;
  sessionId: string;
  timestamp: string;
  platform: string;
  version: string;
  networkStatus: 'connected' | 'disconnected' | 'unknown';
  userAgent: string;
  deviceInfo: any;
  location?: {
    country?: string;
    city?: string;
  };
}

export interface PaymentError {
  id: string;
  type: 'sumup_init' | 'sumup_login' | 'sumup_payment' | 'network' | 'validation' | 'unknown';
  stage: 'initialization' | 'authentication' | 'processing' | 'completion';
  message: string;
  technicalDetails: any;
  userFriendlyMessage: string;
  context: ErrorContext;
  severity: 'low' | 'medium' | 'high' | 'critical';
  retryable: boolean;
  suggestedAction: string;
}

export interface PaymentAttempt {
  id: string;
  amount: number;
  currency: string;
  paymentMethod: string;
  startTime: string;
  endTime?: string;
  status: 'started' | 'authenticating' | 'processing' | 'completed' | 'failed' | 'cancelled';
  error?: PaymentError;
  transactionId?: string;
  context: ErrorContext;
  steps: PaymentStep[];
}

export interface PaymentStep {
  step: string;
  timestamp: string;
  status: 'started' | 'completed' | 'failed';
  duration?: number;
  details?: any;
  error?: string;
}

class ErrorMonitoringServiceClass {
  private sessionId: string;
  private currentPaymentAttempt: PaymentAttempt | null = null;
  private errorQueue: PaymentError[] = [];
  private isReporting = false;
  private restaurantContext: {
    restaurantId?: string;
    restaurantName?: string;
    userId?: string;
    userRole?: string;
  } = {};

  constructor() {
    this.sessionId = this.generateSessionId();
    this.setupErrorReporting();
  }

  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Set restaurant context for error reporting
   */
  setRestaurantContext(context: {
    restaurantId?: string;
    restaurantName?: string;
    userId?: string;
    userRole?: string;
  }): void {
    this.restaurantContext = context;
    console.log('📊 Restaurant context set:', context);
  }

  private async getContext(): Promise<ErrorContext> {
    const networkState = await NetInfo.fetch();
    
    return {
      ...this.restaurantContext,
      sessionId: this.sessionId,
      timestamp: new Date().toISOString(),
      platform: Platform.OS,
      version: '1.0.0', // TODO: Get from package.json
      networkStatus: networkState.isConnected ? 'connected' : 'disconnected',
      userAgent: Platform.OS === 'ios' ? 'iOS App' : 'Android App',
      deviceInfo: {
        os: Platform.OS,
        version: Platform.Version,
      }
    };
  }

  /**
   * Start tracking a payment attempt
   */
  async startPaymentAttempt(amount: number, currency: string, paymentMethod: string): Promise<string> {
    const context = await this.getContext();
    const attemptId = `payment_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    this.currentPaymentAttempt = {
      id: attemptId,
      amount,
      currency,
      paymentMethod,
      startTime: new Date().toISOString(),
      status: 'started',
      context,
      steps: []
    };

    this.addPaymentStep('payment_started', 'started', { amount, currency, paymentMethod });
    
    console.log('📊 Payment attempt started:', attemptId);
    await this.savePaymentAttempt();
    
    return attemptId;
  }

  /**
   * Add a step to the current payment attempt
   */
  addPaymentStep(step: string, status: 'started' | 'completed' | 'failed', details?: any, error?: string): void {
    if (!this.currentPaymentAttempt) return;

    const timestamp = new Date().toISOString();
    const lastStep = this.currentPaymentAttempt.steps[this.currentPaymentAttempt.steps.length - 1];
    const duration = lastStep ? Date.parse(timestamp) - Date.parse(lastStep.timestamp) : 0;

    this.currentPaymentAttempt.steps.push({
      step,
      timestamp,
      status,
      duration,
      details,
      error
    });

    console.log(`📊 Payment step: ${step} - ${status}`, details);
    this.savePaymentAttempt();
  }

  /**
   * Update payment status
   */
  updatePaymentStatus(status: PaymentAttempt['status']): void {
    if (!this.currentPaymentAttempt) return;

    this.currentPaymentAttempt.status = status;
    
    if (status === 'completed' || status === 'failed' || status === 'cancelled') {
      this.currentPaymentAttempt.endTime = new Date().toISOString();
    }

    console.log('📊 Payment status updated:', status);
    this.savePaymentAttempt();
  }

  /**
   * Record a payment error
   */
  async recordError(
    type: PaymentError['type'],
    stage: PaymentError['stage'], 
    message: string,
    technicalDetails: any,
    severity: PaymentError['severity'] = 'medium'
  ): Promise<PaymentError> {
    const context = await this.getContext();
    const errorId = `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const userFriendlyMessage = this.getUserFriendlyMessage(type, stage, message);
    const suggestedAction = this.getSuggestedAction(type, stage);
    const retryable = this.isRetryable(type, stage);

    const error: PaymentError = {
      id: errorId,
      type,
      stage,
      message,
      technicalDetails,
      userFriendlyMessage,
      context,
      severity,
      retryable,
      suggestedAction
    };

    // Add error to current payment attempt
    if (this.currentPaymentAttempt) {
      this.currentPaymentAttempt.error = error;
      this.updatePaymentStatus('failed');
      this.addPaymentStep('error_occurred', 'failed', { errorType: type, errorMessage: message }, message);
    }

    // Queue error for reporting
    this.errorQueue.push(error);
    this.reportErrors();

    console.error('📊 Error recorded:', {
      id: errorId,
      type,
      stage,
      message,
      userFriendlyMessage,
      suggestedAction
    });

    return error;
  }

  /**
   * Complete current payment attempt successfully
   */
  completePaymentAttempt(transactionId: string): void {
    if (!this.currentPaymentAttempt) return;

    this.currentPaymentAttempt.transactionId = transactionId;
    this.updatePaymentStatus('completed');
    this.addPaymentStep('payment_completed', 'completed', { transactionId });

    console.log('📊 Payment completed successfully:', transactionId);
    this.savePaymentAttempt();
    this.currentPaymentAttempt = null;
  }

  /**
   * Cancel current payment attempt
   */
  cancelPaymentAttempt(reason: string): void {
    if (!this.currentPaymentAttempt) return;

    this.updatePaymentStatus('cancelled');
    this.addPaymentStep('payment_cancelled', 'completed', { reason });

    console.log('📊 Payment cancelled:', reason);
    this.savePaymentAttempt();
    this.currentPaymentAttempt = null;
  }

  /**
   * Get current payment attempt details
   */
  getCurrentPaymentAttempt(): PaymentAttempt | null {
    return this.currentPaymentAttempt;
  }

  /**
   * Get recent errors for debugging
   */
  async getRecentErrors(limit: number = 10): Promise<PaymentError[]> {
    try {
      const stored = await AsyncStorage.getItem('payment_errors');
      if (!stored) return [];
      
      const errors: PaymentError[] = JSON.parse(stored);
      return errors.slice(-limit);
    } catch (error) {
      console.error('Failed to get recent errors:', error);
      return [];
    }
  }

  /**
   * Get recent payment attempts for analytics
   */
  async getRecentPaymentAttempts(limit: number = 20): Promise<PaymentAttempt[]> {
    try {
      const stored = await AsyncStorage.getItem('payment_attempts');
      if (!stored) return [];
      
      const attempts: PaymentAttempt[] = JSON.parse(stored);
      return attempts.slice(-limit);
    } catch (error) {
      console.error('Failed to get recent payment attempts:', error);
      return [];
    }
  }

  /**
   * Generate diagnostic report
   */
  async generateDiagnosticReport(): Promise<{
    summary: any;
    recentErrors: PaymentError[];
    recentAttempts: PaymentAttempt[];
    systemInfo: any;
  }> {
    const recentErrors = await this.getRecentErrors(20);
    const recentAttempts = await this.getRecentPaymentAttempts(50);
    
    const summary = {
      totalAttempts: recentAttempts.length,
      successfulAttempts: recentAttempts.filter(a => a.status === 'completed').length,
      failedAttempts: recentAttempts.filter(a => a.status === 'failed').length,
      cancelledAttempts: recentAttempts.filter(a => a.status === 'cancelled').length,
      totalErrors: recentErrors.length,
      errorsByType: recentErrors.reduce((acc, err) => {
        acc[err.type] = (acc[err.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      averagePaymentTime: this.calculateAveragePaymentTime(recentAttempts),
      currentSession: this.sessionId,
      currentPayment: this.currentPaymentAttempt?.id || null
    };

    const context = await this.getContext();

    return {
      summary,
      recentErrors,
      recentAttempts,
      systemInfo: context
    };
  }

  // Private helper methods
  private getUserFriendlyMessage(type: PaymentError['type'], stage: PaymentError['stage'], message: string): string {
    const messages = {
      sumup_init: {
        initialization: 'Payment system is starting up. Please wait a moment.',
      },
      sumup_login: {
        authentication: 'Having trouble logging into your payment account. Please check your credentials.',
      },
      sumup_payment: {
        processing: 'Payment processing encountered an issue. Please try again.',
      },
      network: {
        initialization: 'No internet connection. Please check your network.',
        authentication: 'No internet connection. Please check your network.',
        processing: 'Network issue during payment. Please check your connection.',
      },
      validation: {
        processing: 'Please check the payment details and try again.',
      }
    };

    return messages[type]?.[stage] || 'An unexpected error occurred. Please try again or contact support.';
  }

  private getSuggestedAction(type: PaymentError['type'], stage: PaymentError['stage']): string {
    const actions = {
      sumup_init: 'Restart the app and ensure you\'re on a physical device',
      sumup_login: 'Check your SumUp merchant account credentials',
      sumup_payment: 'Try the payment again or use a different payment method',
      network: 'Check your internet connection and try again',
      validation: 'Verify payment amount and details'
    };

    return actions[type] || 'Contact technical support if the issue persists';
  }

  private isRetryable(type: PaymentError['type'], stage: PaymentError['stage']): boolean {
    const retryableTypes = ['sumup_payment', 'network'];
    return retryableTypes.includes(type);
  }

  private async savePaymentAttempt(): Promise<void> {
    if (!this.currentPaymentAttempt) return;

    try {
      const stored = await AsyncStorage.getItem('payment_attempts');
      const attempts: PaymentAttempt[] = stored ? JSON.parse(stored) : [];
      
      // Update existing attempt or add new one
      const existingIndex = attempts.findIndex(a => a.id === this.currentPaymentAttempt!.id);
      if (existingIndex >= 0) {
        attempts[existingIndex] = this.currentPaymentAttempt;
      } else {
        attempts.push(this.currentPaymentAttempt);
      }

      // Keep only last 100 attempts
      if (attempts.length > 100) {
        attempts.splice(0, attempts.length - 100);
      }

      await AsyncStorage.setItem('payment_attempts', JSON.stringify(attempts));

      // Send to backend for platform monitoring
      if (this.currentPaymentAttempt.status === 'completed' || this.currentPaymentAttempt.status === 'failed') {
        await this.sendPaymentAttemptToBackend(this.currentPaymentAttempt);
      }
    } catch (error) {
      console.error('Failed to save payment attempt:', error);
    }
  }

  private async reportErrors(): Promise<void> {
    if (this.isReporting || this.errorQueue.length === 0) return;

    this.isReporting = true;

    try {
      // Store errors locally first
      const stored = await AsyncStorage.getItem('payment_errors');
      const existingErrors: PaymentError[] = stored ? JSON.parse(stored) : [];
      existingErrors.push(...this.errorQueue);

      // Keep only last 500 errors
      if (existingErrors.length > 500) {
        existingErrors.splice(0, existingErrors.length - 500);
      }

      await AsyncStorage.setItem('payment_errors', JSON.stringify(existingErrors));

      // Send to backend monitoring service
      await this.sendErrorsToBackend(this.errorQueue);

      this.errorQueue = [];
    } catch (error) {
      console.error('Failed to report errors:', error);
    } finally {
      this.isReporting = false;
    }
  }

  /**
   * Send errors to backend monitoring service
   */
  private async sendErrorsToBackend(errors: PaymentError[]): Promise<void> {
    try {
      const response = await fetch('http://localhost:8000/api/monitoring/payment-errors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          errors,
          reportedAt: new Date().toISOString(),
          sessionId: this.sessionId,
          source: 'pos_app'
        })
      });

      if (!response.ok) {
        console.warn('Failed to send errors to backend:', response.status);
      } else {
        console.log('✅ Errors reported to backend successfully');
      }
    } catch (error) {
      console.warn('⚠️ Backend error reporting failed (offline?):', error);
      // Don't throw - we want local storage to work even if backend is down
    }
  }

  /**
   * Send payment attempt to backend for analytics
   */
  private async sendPaymentAttemptToBackend(attempt: PaymentAttempt): Promise<void> {
    try {
      const response = await fetch('http://localhost:8000/api/monitoring/payment-attempts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          attempt,
          reportedAt: new Date().toISOString(),
          sessionId: this.sessionId,
          source: 'pos_app'
        })
      });

      if (!response.ok) {
        console.warn('Failed to send payment attempt to backend:', response.status);
      }
    } catch (error) {
      console.warn('⚠️ Backend payment attempt reporting failed (offline?):', error);
    }
  }

  private calculateAveragePaymentTime(attempts: PaymentAttempt[]): number {
    const completedAttempts = attempts.filter(a => a.status === 'completed' && a.endTime);
    if (completedAttempts.length === 0) return 0;

    const totalTime = completedAttempts.reduce((sum, attempt) => {
      const duration = Date.parse(attempt.endTime!) - Date.parse(attempt.startTime);
      return sum + duration;
    }, 0);

    return totalTime / completedAttempts.length / 1000; // Convert to seconds
  }

  private setupErrorReporting(): void {
    // Set up global error handlers
    const originalConsoleError = console.error;
    console.error = (...args) => {
      // Call original first
      originalConsoleError(...args);
      
      // Check if this looks like a payment-related error
      const message = args.join(' ');
      if (message.includes('SumUp') || message.includes('payment') || message.includes('Payment')) {
        this.recordError('unknown', 'processing', message, { args }, 'medium');
      }
    };
  }
}

export const ErrorMonitoringService = new ErrorMonitoringServiceClass();
export default ErrorMonitoringService;