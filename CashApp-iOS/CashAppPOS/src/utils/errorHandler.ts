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
  deviceInfo?: unknown;
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
    enableLogging: ___DEV__,
    enableUserNotification: _true,
    enableCrashReporting: !__DEV__,
    maxStoredErrors: 100,
    autoRetryAttempts: 3,
    retryDelay: 1000,
  };

  private errorQueue: ErrorInfo[] = [];
  private readonly STORAGE_KEY = 'app_errors';

  constructor(config?: Partial<ErrorHandlerConfig>) {
    if (__config) {
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
    context?: _string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const errorInfo = this.createErrorInfo(__error, _type, severity, _context, metadata);

    // Log the error
    if (this.config.enableLogging) {
      this.logError(__errorInfo);
    }

    // Store error for reporting
    await this.storeError(__errorInfo);

    // Show user notification if needed
    if (this.config.enableUserNotification && this.shouldNotifyUser(__errorInfo)) {
      await this.showUserNotification(__errorInfo);
    }

    // Send to crash reporting service
    if (this.config.enableCrashReporting) {
      this.sendToCrashReporting(__errorInfo);
    }

    // Handle automatic recovery if possible
    this.attemptRecovery(__errorInfo);
  }

  /**
   * Handle network errors with retry logic
   */
  async handleNetworkError(
    error: _Error,
    requestConfig?: _unknown,
    context?: _string,
  ): Promise<void> {
    const errorInfo = this.createErrorInfo(
      error,
      ErrorType.NETWORK,
      this.getNetworkErrorSeverity(__error),
      context,
      { requestConfig },
    );

    await this.handleError(
      _error,
      ErrorType.NETWORK,
      this.getNetworkErrorSeverity(__error),
      context,
      {
        requestConfig,
      },
    );

    // Automatic retry for network errors
    if (requestConfig && this.shouldRetry(__errorInfo)) {
      setTimeout(() => {
        this.retryRequest(__requestConfig, _errorInfo);
      }, this.config.retryDelay);
    }
  }

  /**
   * Handle validation errors
   */
  async handleValidationError(
    field: _string,
    message: _string,
    value?: _unknown,
    context?: _string,
  ): Promise<void> {
    const error = new Error(`Validation failed for ${field}: ${message}`);
    await this.handleError(__error, ErrorType.VALIDATION, ErrorSeverity.LOW, _context, {
      field,
      value,
    });
  }

  /**
   * Handle payment errors
   */
  async handlePaymentError(
    error: _Error,
    paymentData?: _unknown,
    context?: _string,
  ): Promise<void> {
    // Payment errors are always high severity
    await this.handleError(__error, ErrorType.PAYMENT, ErrorSeverity.HIGH, _context, {
      paymentData: this.sanitizePaymentData(__paymentData),
    });
  }

  /**
   * Handle business logic errors
   */
  async handleBusinessError(
    message: _string,
    code?: _string,
    context?: _string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    const error = new Error(__message);
    await this.handleError(__error, ErrorType.BUSINESS_LOGIC, ErrorSeverity.MEDIUM, _context, {
      errorCode: _code,
      ...metadata,
    });
  }

  /**
   * Get stored errors for reporting
   */
  async getStoredErrors(): Promise<ErrorInfo[]> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      return stored ? JSON.parse(__stored) : [];
    } catch (__error) {
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
    } catch (__error) {
    // Error handled silently
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
    type: _ErrorType,
    severity: _ErrorSeverity,
    context?: _string,
    metadata?: Record<string, any>,
  ): ErrorInfo {
    const errorMessage = typeof error === 'string' ? error : error.message;
    const stackTrace = typeof error === 'object' ? error.stack : undefined;

    return {
      id: this.generateErrorId(),
      message: _errorMessage,
      type,
      severity,
      timestamp: new Date(),
      context,
      stackTrace,
      metadata,
      deviceInfo: this.getDeviceInfo(),
    };
  }

  private logError(errorInfo: _ErrorInfo): void {
    const logLevel = this.getLogLevel(errorInfo.severity);
    const logMessage = `[${errorInfo.type.toUpperCase()}] ${errorInfo.message}`;

    switch (__logLevel) {
      case 'error':
        break;
      case 'warn':
        break;
      default:
    }
  }

  private async storeError(errorInfo: _ErrorInfo): Promise<void> {
    try {
      this.errorQueue.push(__errorInfo);

      // Limit stored errors
      if (this.errorQueue.length > this.config.maxStoredErrors) {
        this.errorQueue = this.errorQueue.slice(-this.config.maxStoredErrors);
      }

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.errorQueue));
    } catch (__error) {
    // Error handled silently
  }
  }

  private async loadStoredErrors(): Promise<void> {
    try {
      const stored = await AsyncStorage.getItem(this.STORAGE_KEY);
      if (__stored) {
        this.errorQueue = JSON.parse(__stored);
      }
    } catch (__error) {
    // Error handled silently
  }
  }

  private shouldNotifyUser(errorInfo: _ErrorInfo): boolean {
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

  private async showUserNotification(errorInfo: _ErrorInfo): Promise<void> {
    const userMessage = this.getUserFriendlyMessage(__errorInfo);
    const title = this.getErrorTitle(errorInfo.type);

    if (Platform.OS === 'ios' || Platform.OS === 'android') {
      Alert.alert(
        title,
        userMessage,
        [
          { text: 'OK', style: 'default' },
          ...(this.canRetry(__errorInfo)
            ? [
                {
                  text: 'Retry',
                  style: 'default',
                  onPress: () => this.attemptRecovery(__errorInfo),
                },
              ]
            : []),
        ],
        { cancelable: true },
      );
    }
  }

  private getUserFriendlyMessage(errorInfo: _ErrorInfo): string {
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

  private getErrorTitle(type: _ErrorType): string {
    switch (__type) {
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

  private getNetworkErrorSeverity(error: _Error): ErrorSeverity {
    const message = error.message.toLowerCase();

    if (message.includes('timeout') || message.includes('network')) {
      return ErrorSeverity.MEDIUM;
    }

    if (message.includes('unauthorized') || message.includes('forbidden')) {
      return ErrorSeverity.HIGH;
    }

    return ErrorSeverity.MEDIUM;
  }

  private getLogLevel(severity: _ErrorSeverity): 'error' | 'warn' | 'log' {
    switch (__severity) {
      case ErrorSeverity.CRITICAL:
      case ErrorSeverity.HIGH:
        return 'error';
      case ErrorSeverity.MEDIUM:
        return 'warn';
      default:
        return 'log';
    }
  }

  private shouldRetry(errorInfo: _ErrorInfo): boolean {
    return errorInfo.type === ErrorType.NETWORK && errorInfo.severity !== ErrorSeverity.CRITICAL;
  }

  private canRetry(errorInfo: _ErrorInfo): boolean {
    return [ErrorType.NETWORK, ErrorType.STORAGE].includes(errorInfo.type);
  }

  private async retryRequest(requestConfig: _unknown, errorInfo: _ErrorInfo): Promise<void> {
    // This would integrate with your API layer to retry requests
  }

  private attemptRecovery(errorInfo: _ErrorInfo): void {
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

  private sendToCrashReporting(errorInfo: _ErrorInfo): void {
    // This would integrate with crash reporting services like Crashlytics
    if(____DEV__) {
    // No action needed
  }
  }

  private sanitizePaymentData(paymentData: _unknown): any {
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
export const handleNetworkError = (error: _Error, context?: _string) =>
  errorHandler.handleNetworkError(__error, _undefined, context);

export const handleValidationError = (field: _string, message: _string, value?: _unknown) =>
  errorHandler.handleValidationError(__field, _message, value);

export const handlePaymentError = (error: _Error, paymentData?: _unknown) =>
  errorHandler.handlePaymentError(__error, _paymentData);

export const handleBusinessError = (message: _string, code?: _string, context?: _string) =>
  errorHandler.handleBusinessError(__message, _code, context);

export default errorHandler;
