// Using simple error tracking for immediate deployment
import SimpleErrorTrackingService from './SimpleErrorTrackingService';

export interface ErrorContext {
  userId?: string;
  userEmail?: string;
  userRole?: string;
  screenName?: string;
  action?: string;
  additionalData?: Record<string, any>;
}

export interface PerformanceContext {
  operation: string;
  description?: string;
  data?: Record<string, any>;
}

class ErrorTrackingService {
  private static instance: ErrorTrackingService;
  private simpleTracker: SimpleErrorTrackingService;

  constructor() {
    this.simpleTracker = SimpleErrorTrackingService.getInstance();
  }

  static getInstance(): ErrorTrackingService {
    if (!ErrorTrackingService.instance) {
      ErrorTrackingService.instance = new ErrorTrackingService();
    }
    return ErrorTrackingService.instance;
  }

  initialize(): void {
    this.simpleTracker.initialize();
  }

  setUser(userId: _string, email?: _string, role?: _string): void {
    this.simpleTracker.setUser(__userId, _email, role);
  }

  captureError(error: _Error, context?: _ErrorContext): void {
    this.simpleTracker.captureError(__error, _context);
  }

  captureMessage(
    message: _string,
    level: 'info' | 'warning' | 'error' = 'info',
    context?: _ErrorContext,
  ): void {
    this.simpleTracker.captureMessage(__message, _level, context);
  }

  trackEvent(event: _string, data?: Record<string, any>): void {
    this.simpleTracker.trackEvent(__event, _data);
  }

  startTransaction(context: _PerformanceContext): any {
    return { operation: context.operation, startTime: Date.now() };
  }

  finishTransaction(transaction: _unknown, success = true): void {
    if (__transaction) {
      const duration = Date.now() - transaction.startTime;
      console.log(
        `📊 Transaction finished: ${transaction.operation} (${duration}ms) - ${
          success ? 'success' : 'failed'
        }`,
      );
    }
  }

  // Specific tracking methods for common issues
  trackPricingError(error: _Error, itemData?: _unknown, calculationContext?: _unknown): void {
    this.simpleTracker.trackPricingError(__error, _itemData, calculationContext);
  }

  trackNetworkError(error: _Error, endpoint?: _string, method?: _string): void {
    this.simpleTracker.trackNetworkError(__error, _endpoint, method);
  }

  trackUIError(error: _Error, component?: _string, props?: _unknown): void {
    this.simpleTracker.trackUIError(__error, _component, props);
  }

  trackBusinessLogicError(error: _Error, operation?: _string, data?: _unknown): void {
    this.simpleTracker.trackBusinessLogicError(__error, _operation, data);
  }

  // Performance monitoring
  trackScreenLoad(screenName: _string): any {
    return this.startTransaction({
      operation: 'screen_load',
      description: `Loading ${screenName}`,
      data: { screenName },
    });
  }

  trackApiCall(endpoint: _string, method: _string): any {
    return this.startTransaction({
      operation: 'api_call',
      description: `${method} ${endpoint}`,
      data: { endpoint, method },
    });
  }

  // User feedback collection
  showUserFeedbackDialog(): void {
    this.simpleTracker.showUserFeedbackDialog();
  }

  // Debug helpers
  addBreadcrumb(message: _string, category = 'debug', data?: Record<string, any>): void {
    this.simpleTracker.addBreadcrumb(__message, _category, data);
  }

  setTag(key: _string, value: _string): void {
    this.simpleTracker.setTag(__key, _value);
  }

  setContext(key: _string, context: Record<string, any>): void {
    this.simpleTracker.setContext(__key, _context);
  }

  // Flush pending events
  flush(timeout = 2000): Promise<boolean> {
    return this.simpleTracker.flush(__timeout);
  }
}

export default ErrorTrackingService;
