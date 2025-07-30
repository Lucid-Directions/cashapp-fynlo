import { Alert, Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export interface ErrorInfo {
  id: string;
  message: string;
  type: ErrorType;
  severity: ErrorSeverity;
  timestamp: Date;
  context?: string;
  userId?: string;
  deviceInfo?: any;
  stackTrace?: string;
  metadata?: Record<string, any>;
}

export enum ErrorType {
  NETWORK = 'network',
  VALIDATION = 'validation',
  PAYMENT = 'payment',
  AUTHENTICATION = 'authentication',
  STORAGE = 'storage',
  PERMISSION = 'permission',
  HARDWARE = 'hardware',
  BUSINESS_LOGIC = 'business_logic',
  SYSTEM = 'system',
  USER_INPUT = 'user_input',
}

export enum ErrorSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

export interface ErrorHandlerConfig {
  enableLogging: boolean;
  enableUserNotification: boolean;
  enableCrashReporting: boolean;
  maxStoredErrors: number;
  autoRetryAttempts: number;
  retryDelay: number;
}

class ErrorHandler {
  private config: ErrorHandlerConfig = {
    enableLogging: __DEV__,
    enableUserNotification: true,
    enableCrashReporting: !__DEV__,
    maxStoredErrors: 100,
    autoRetryAttempts: 3,
    retryDelay: 1000,
  };

  private errorQueue: ErrorInfo[] = [];
  private readonly STORAGE_KEY = 'app_errors';

  constructor(config?: Partial<ErrorHandlerConfig>) {
    if (config) {
      this.config = { ...this.config, ...config };
    }
    this.loadStoredErrors();
  }

  /**
   * Handle an error with appropriate response based on type and severity
   */
  async handleError(
    error: Error | string,
    type: ErrorType = ErrorType.SYSTEM,
    severity: ErrorSeverity = ErrorSeverity.MEDIUM,
    context?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const errorInfo = this.createErrorInfo(error, type, severity, context, metadata);

    // Log the error
    if (this.config.enableLogging) {
      this.logError(errorInfo);
    }

    // Store error for reporting
    await this.storeError(errorInfo);

    // Show user notification if needed
    if (this.config.enableUserNotification && this.shouldNotifyUser(errorInfo)) {
      await this.showUserNotification(errorInfo);
    }

    // Send to crash reporting service
    if (this.config.enableCrashReporting) {
      this.sendToCrashReporting(errorInfo);
    }

    // Handle automatic recovery if possible
    this.attemptRecovery(errorInfo);
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(error: Error, requestConfig?: any, context?: string): Promise<void> {
    const errorInfo = this.createErrorInfo(
      error,
      ErrorType.NETWORK,
      this.getNetworkErrorSeverity(error),
      context,
      { requestConfig },
    );

    await this.handleError(error, ErrorType.NETWORK, this.getNetworkErrorSeverity(error), context, {
      requestConfig,
    });

    // Automatic retry for network errors
    if (requestConfig && this.shouldRetry(errorInfo)) {
      setTimeout(() => {
        this.retryRequest(requestConfig, errorInfo);
      }, this.config.retryDelay);
    }
  }

  /**
   * Handle validation errors
   */
  async handleValidationError(
    field: string,
    message: string,
    value?: any,
    context?: string,
  ): Promise<void> {
    const error = new Error(`Validation failed for ${field}: ${message}`);
    await this.handleError(error, ErrorType.VALIDATION, ErrorSeverity.LOW, context, {
      field,
      value,
    });
  }

  /**
   * Handle payment errors
   */
  async handlePaymentError(error: Error, paymentData?: any, context?: string): Promise<void> {
    // Payment errors are always high severity
    await this.handleError(error, ErrorType.PAYMENT, ErrorSeverity.HIGH, context, {
      paymentData: this.sanitizePaymentData(paymentData),
    });
  }

  /**
   * Handle business logic errors
   */
  async handleBusinessError(
    message: string,
    code?: string,
    context?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const error = new Error(message);
    await this.handleError(error, ErrorType.BUSINESS_LOGIC, ErrorSeverity.MEDIUM, context, {
      errorCode: code,
      ...metadata,
    });
  }

  /**
   * Get stored errors for reporting
   */
  async getStoredErrors(): Promise<ErrorInfo[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      return [];
    }
  }

  /**
   * Clear stored errors
   */
  async clearStoredErrors(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      this.errorQueue = [];
    } catch (error) {
    }
  }

  /**
   * Get error statistics
   */
  getErrorStats(): {
    total: number;
    byType: Record<ErrorType, number>;
    bySeverity: Record<ErrorSeverity, number>;
    recent: number; // Errors in last 24 hours
  } {
    const now = Date.now();
    const oneDayAgo = now - 24 * 60 * 60 * 1000;

    const byType = {} as Record<ErrorType, number>;
    const bySeverity = {} as Record<ErrorSeverity, number>;
    let recent = 0;

    this.errorQueue.forEach(error => {
      // Count by type
      byType[error.type] = (byType[error.type] || 0) + 1;

      // Count by severity
      bySeverity[error.severity] = (bySeverity[error.severity] || 0) + 1;

      // Count recent errors
      if (error.timestamp.getTime() > oneDayAgo) {
        recent++;
      }
    });

    return {
      total: this.errorQueue.length,
      byType,
      bySeverity,
      recent,
    };
  }

  private createErrorInfo(
    error: Error | string,
    type: ErrorType,
    severity: ErrorSeverity,
    context?: string,
    metadata?: Record<string, any>,
  ): ErrorInfo {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const stackTrace = typeof error === 'object' ? error.stack : undefined;

    return {
      id: this.generateErrorId(),
      message: errorMessage,
      type,
      severity,
      timestamp: new Date(),
      context,
      stackTrace,
      metadata,
      deviceInfo: this.getDeviceInfo(),
    };
  }

  private logError(errorInfo: ErrorInfo): void {
    const logLevel = this.getLogLevel(errorInfo.severity);
    const logMessage = `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}`;

    switch (logLevel) {
      case 'error':
        break;
      case 'warn':
        break;
      default:
    }
  }

  private async storeError(errorInfo: ErrorInfo): Promise<void> {
    try {
      this.errorQueue.push(errorInfo);

      // Limit stored errors
      if (this.errorQueue.length > this.config.maxStoredErrors) {
        this.errorQueue = this.errorQueue.slice(-this.config.maxStoredErrors);
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.errorQueue));
    } catch (error) {
    }
  }

  private async loadStoredErrors(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        this.errorQueue = JSON.parse(stored);
      }
    } catch (error) {
    }
  }

  private shouldNotifyUser(errorInfo: ErrorInfo): boolean {
    // Don't notify for low severity errors
    if (errorInfo.severity === ErrorSeverity.LOW) {
      return false;
    }

    // Don't notify for validation errors (should be handled by UI)
    if (errorInfo.type === ErrorType.VALIDATION) {
      return false;
    }

    return true;
  }

  private async showUserNotification(errorInfo: ErrorInfo): Promise<void> {
    const userMessage = this.getUserFriendlyMessage(errorInfo);
    const title = this.getErrorTitle(errorInfo.type);

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert(
        title,
        userMessage,
        [
          { text: 'OK', style: 'default' },
          ...(this.canRetry(errorInfo)
            ? [
                {
                  text: 'Retry',
                  style: 'default',
                  onPress: () => this.attemptRecovery(errorInfo),
                },
              ]
            : []),
        ],
        { cancelable: true },
      );
    }
  }

  private getUserFriendlyMessage(errorInfo: ErrorInfo): string {
    switch (errorInfo.type) {
      case ErrorType.NETWORK:
        return 'Unable to connect to the server. Please check your internet connection.';
      case ErrorType.PAYMENT:
        return 'Payment processing failed. Please try again or use a different payment method.';
      case ErrorType.AUTHENTICATION:
        return 'Authentication failed. Please sign in again.';
      case ErrorType.STORAGE:
        return 'Unable to save data. Please try again.';
      case ErrorType.PERMISSION:
        return 'Permission required to perform this action.';
      case ErrorType.HARDWARE:
        return 'Hardware device is not responding. Please check the connection.';
      default:
        return 'An unexpected error occurred. Please try again.';
    }
  }

  private getErrorTitle(type: ErrorType): string {
    switch (type) {
      case ErrorType.NETWORK:
        return 'Connection Error';
      case ErrorType.PAYMENT:
        return 'Payment Error';
      case ErrorType.AUTHENTICATION:
        return 'Authentication Required';
      case ErrorType.STORAGE:
        return 'Storage Error';
      case ErrorType.PERMISSION:
        return 'Permission Required';
      case ErrorType.HARDWARE:
        return 'Hardware Error';
      default:
        return 'Error';
    }
  }

  private getNetworkErrorSeverity(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('network')) {
      return ErrorSeverity.MEDIUM;
    }

    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorSeverity.HIGH;
    }

    return ErrorSeverity.MEDIUM;
  }

  private getLogLevel(severity: ErrorSeverity): 'error' | 'warn' | 'log' {
    switch (severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      default:
        return 'log';
    }
  }

  private shouldRetry(errorInfo: ErrorInfo): boolean {
    return errorInfo.type === ErrorType.NETWORK && errorInfo.severity !== ErrorSeverity.CRITICAL;
  }

  private canRetry(errorInfo: ErrorInfo): boolean {
    return [ErrorType.NETWORK, ErrorType.STORAGE].includes(errorInfo.type);
  }

  private async retryRequest(requestConfig: any, errorInfo: ErrorInfo): Promise<void> {
    // This would integrate with your API layer to retry requests
  }

  private attemptRecovery(errorInfo: ErrorInfo): void {
    switch (errorInfo.type) {
      case ErrorType.STORAGE:
        // Clear cache and try again
        this.clearStoredErrors();
        break;
      case ErrorType.AUTHENTICATION:
        // Redirect to login
        break;
      default:
    }
  }

  private sendToCrashReporting(errorInfo: ErrorInfo): void {
    // This would integrate with crash reporting services like Crashlytics
    if (__DEV__) {
    }
  }

  private sanitizePaymentData(paymentData: any): any {
    if (!paymentData) {
      return null;
    }

    // Remove sensitive payment information
    const sanitized = { ...paymentData };
    delete sanitized.cardNumber;
    delete sanitized.cvv;
    delete sanitized.pin;

    return sanitized;
  }

  private generateErrorId(): string {
    return `error_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private getDeviceInfo(): any {
    return {
      platform: Platform.OS,
      version: Platform.Version,
      timestamp: Date.now(),
    };
  }
}

// Export singleton instance
export const errorHandler = new ErrorHandler();

// Convenience functions for common error scenarios
export const handleNetworkError = (error: Error, context?: string) =>
  errorHandler.handleNetworkError(error, undefined, context);

export const handleValidationError = (field: string, message: string, value?: any) =>
  errorHandler.handleValidationError(field, message, value);

export const handlePaymentError = (error: Error, paymentData?: any) =>
  errorHandler.handlePaymentError(error, paymentData);

export const handleBusinessError = (message: string, code?: string, context?: string) =>
  errorHandler.handleBusinessError(message, code, context);

export default errorHandler;
