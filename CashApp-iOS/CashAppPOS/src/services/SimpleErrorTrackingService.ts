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
  additionalData?: Record<string, unknown>;
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
      logger.info('🔍 Simple Error Tracking initialized');
      this.isInitialized = true;

      // Track successful initialization
      this.trackEvent('error_tracking_initialized', {
        timestamp: new Date().toISOString(),
        environment: __DEV__ ? 'development' : 'production',
      });
    } catch (error) {
      logger.error('Failed to initialize Simple Error Tracking:', error);
    }
  }

  setUser(userId: string, email?: string, role?: string): void {
    try {
      logger.info('📝 User set in error tracking:', { userId, email, role });
    } catch (error) {
      logger.error('Failed to set user:', error);
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

      logger.error('🚨 Error captured:', error.message, context);

      // In development, also log the full error
      if (__DEV__) {
        logger.error('Full error details:', errorEntry);
      }
    } catch (trackingError) {
      logger.error('Failed to capture error:', trackingError);
      logger.error('Original error:', error);
    }
  }

  captureMessage(
    message: string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: ErrorContext
  ): void {
    try {
      const messageEntry = {
        timestamp: new Date().toISOString(),
        message,
        level,
        context,
      };

      logger.info(`📝 Message captured [${level}]:`, message, context);

      if (__DEV__) {
        logger.info('Full message details:', messageEntry);
      }
    } catch (error) {
      logger.error('Failed to capture message:', error);
    }
  }

  trackEvent(event: string, data?: Record<string, unknown>): void {
    try {
      logger.info('📊 Event tracked:', event, data);
    } catch (error) {
      logger.error('Failed to track event:', error);
    }
  }

  // Specific tracking methods for common issues
  trackPricingError(error: Error, itemData?: unknown, calculationContext?: unknown): void {
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

  trackUIError(error: Error, component?: string, props?: unknown): void {
    this.captureError(error, {
      action: 'ui_render',
      additionalData: {
        component,
        props,
        errorType: 'ui_render_error',
      },
    });
  }

  trackBusinessLogicError(error: Error, operation?: string, data?: unknown): void {
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
      logger.info('📝 User feedback dialog would be shown here');
      // TODO: Implement native feedback dialog or custom modal
    } catch (error) {
      logger.error('Failed to show feedback dialog:', error);
    }
  }

  // Debug helpers
  addBreadcrumb(message: string, category: string = 'debug', data?: Record<string, unknown>): void {
    try {
      logger.info(`🍞 Breadcrumb [${category}]:`, message, data);
    } catch (error) {
      logger.error('Failed to add breadcrumb:', error);
    }
  }

  setTag(key: string, value: string): void {
    try {
      logger.info(`🏷️ Tag set: ${key} = ${value}`);
    } catch (error) {
      logger.error('Failed to set tag:', error);
    }
  }

  setContext(key: string, context: Record<string, unknown>): void {
    try {
      logger.info(`📝 Context set: ${key}`, context);
    } catch (error) {
      logger.error('Failed to set context:', error);
    }
  }

  // Get error log for debugging
  getErrorLog(): Array<unknown> {
    return [...this.errorLog];
  }

  // Clear error log
  clearErrorLog(): void {
    this.errorLog = [];
    logger.info('🧹 Error log cleared');
  }

  // Flush pending events (placeholder)
  flush(_timeout: number = 2000): Promise<boolean> {
    try {
      logger.info('🚽 Flushing error events...');
      return Promise.resolve(true);
    } catch (error) {
      logger.error('Failed to flush events:', error);
      return Promise.resolve(false);
    }
  }
}

export default SimpleErrorTrackingService;
