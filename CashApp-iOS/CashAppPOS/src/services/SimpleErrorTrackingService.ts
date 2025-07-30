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
    } catch (error) {
    }
  }

  setUser(userId: string, email?: string, role?: string): void {
    try {
    } catch (error) {
    }
  }

  captureError(error: Error, context?: ErrorContext): void {
    try {
      const errorEntry = {
        timestamp: new Date().toISOString(),
        error: error.message,
        context,
        stack: error.stack,
      };

      this.errorLog.push(errorEntry);

      // Keep only last 100 errors to prevent memory issues
      if (this.errorLog.length > 100) {
        this.errorLog = this.errorLog.slice(-100);
      }


      // In development, also log the full error
      if (__DEV__) {
      }
    } catch (trackingError) {
    }
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext,
  ): void {
    try {
      const messageEntry = {
        timestamp: new Date().toISOString(),
        message,
        level,
        context,
      };


      if (__DEV__) {
      }
    } catch (error) {
    }
  }

  trackEvent(event: string, data?: Record<string, any>): void {
    try {
    } catch (error) {
    }
  }

  // Specific tracking methods for common issues
  trackPricingError(error: Error, itemData?: any, calculationContext?: any): void {
    this.captureError(error, {
      action: 'pricing_calculation',
      screenName: 'POS',
      additionalData: {
        itemData,
        calculationContext,
        errorType: 'pricing_nan_error',
      },
    });
  }

  trackNetworkError(error: Error, endpoint?: string, method?: string): void {
    this.captureError(error, {
      action: 'network_request',
      additionalData: {
        endpoint,
        method,
        errorType: 'network_error',
      },
    });
  }

  trackUIError(error: Error, component?: string, props?: any): void {
    this.captureError(error, {
      action: 'ui_render',
      additionalData: {
        component,
        props,
        errorType: 'ui_render_error',
      },
    });
  }

  trackBusinessLogicError(error: Error, operation?: string, data?: any): void {
    this.captureError(error, {
      action: 'business_logic',
      additionalData: {
        operation,
        data,
        errorType: 'business_logic_error',
      },
    });
  }

  // User feedback collection (placeholder)
  showUserFeedbackDialog(): void {
    try {
      // TODO: Implement native feedback dialog or custom modal
    } catch (error) {
    }
  }

  // Debug helpers
  addBreadcrumb(message: string, category = 'debug', data?: Record<string, any>): void {
    try {
    } catch (error) {
    }
  }

  setTag(key: string, value: string): void {
    try {
    } catch (error) {
    }
  }

  setContext(key: string, context: Record<string, any>): void {
    try {
    } catch (error) {
    }
  }

  // Get error log for debugging
  getErrorLog(): Array<any> {
    return [...this.errorLog];
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = [];
  }

  // Flush pending events (placeholder)
  flush(timeout = 2000): Promise<boolean> {
    try {
      return Promise.resolve(true);
    } catch (error) {
      return Promise.resolve(false);
    }
  }
}

export default SimpleErrorTrackingService;
