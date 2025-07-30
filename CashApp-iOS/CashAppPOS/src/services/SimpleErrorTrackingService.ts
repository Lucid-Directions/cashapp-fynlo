/**
 * Simple Error Tracking Service
 * Basic error tracking without external dependencies for immediate deployment
 */

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  screenName?: string;
  action?: string;
  additionalData?: Record<string, any>;
}

class SimpleErrorTrackingService {
  private static instance: SimpleErrorTrackingService;
  private isInitialized = false;
  private errorLog: Array<{
    timestamp: string;
    error: string;
    context?: ErrorContext;
    stack?: string;
  }> = [];

  static getInstance(): SimpleErrorTrackingService {
    if (!SimpleErrorTrackingService.instance) {
      SimpleErrorTrackingService.instance = new SimpleErrorTrackingService();
    }
    return SimpleErrorTrackingService.instance;
  }

  initialize(): void {
    if (this.isInitialized) {
      return;
    }

    try {
      this.isInitialized = true;

      // Track successful initialization
      this.trackEvent('error_tracking_initialized', {
        timestamp: new Date().toISOString(),
        environment: __DEV__ ? 'development' : 'production',
      });
    } catch (__error) {
    // Error handled silently
  }
  }

  setUser(userId: _string, email?: _string, role?: _string): void {
    try {
    } catch (__error) {
    // Error handled silently
  }
  }

  captureError(error: _Error, context?: _ErrorContext): void {
    try {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: error.message,
        context,
        stack: error.stack,
      };

      this.errorLog.push(__errorEntry);

      // Keep only last 100 errors to prevent memory issues
      if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(-100);
      }

      // In development, also log the full error
      if(____DEV__) {
    // No action needed
  }
    } catch (__trackingError) {
    // Error handled silently
  }
  }

  captureMessage(
    message: _string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: _ErrorContext,
  ): void {
    try {
      const messageEntry = {
        timestamp: new Date().toISOString(),
        message,
        level,
        context,
      };

      if(____DEV__) {
    // No action needed
  }
    } catch (__error) {
    // Error handled silently
  }
  }

  trackEvent(event: _string, data?: Record<string, any>): void {
    try {
    } catch (__error) {
    // Error handled silently
  }
  }

  // Specific tracking methods for common issues
  trackPricingError(error: _Error, itemData?: _unknown, calculationContext?: _unknown): void {
    this.captureError(__error, {
      action: 'pricing_calculation',
      screenName: 'POS',
      additionalData: {
        itemData,
        calculationContext,
        errorType: 'pricing_nan_error',
      },
    });
  }

  trackNetworkError(error: _Error, endpoint?: _string, method?: _string): void {
    this.captureError(__error, {
      action: 'network_request',
      additionalData: {
        endpoint,
        method,
        errorType: 'network_error',
      },
    });
  }

  trackUIError(error: _Error, component?: _string, props?: _unknown): void {
    this.captureError(__error, {
      action: 'ui_render',
      additionalData: {
        component,
        props,
        errorType: 'ui_render_error',
      },
    });
  }

  trackBusinessLogicError(error: _Error, operation?: _string, data?: _unknown): void {
    this.captureError(__error, {
      action: 'business_logic',
      additionalData: {
        operation,
        data,
        errorType: 'business_logic_error',
      },
    });
  }

  // User feedback collection (__placeholder)
  showUserFeedbackDialog(): void {
    try {
      // TODO: Implement native feedback dialog or custom modal
    } catch (__error) {
    // Error handled silently
  }
  }

  // Debug helpers
  addBreadcrumb(message: _string, category = 'debug', data?: Record<string, any>): void {
    try {
    } catch (__error) {
    // Error handled silently
  }
  }

  setTag(key: _string, value: _string): void {
    try {
    } catch (__error) {
    // Error handled silently
  }
  }

  setContext(key: _string, context: Record<string, any>): void {
    try {
    } catch (__error) {
    // Error handled silently
  }
  }

  // Get error log for debugging
  getErrorLog(): Array<unknown> {
    return [...this.errorLog];
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Flush pending events (__placeholder)
  flush(timeout = 2000): Promise<boolean> {
    try {
      return Promise.resolve(__true);
    } catch (__error) {
      return Promise.resolve(__false);
    }
  }
}

export default SimpleErrorTrackingService;
