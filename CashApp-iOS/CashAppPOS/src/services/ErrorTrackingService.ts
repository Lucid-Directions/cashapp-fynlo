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

  setUser(userId: string, email?: string, role?: string): void {
    this.simpleTracker.setUser(userId, email, role);
  }

  captureError(error: Error, context?: ErrorContext): void {
    this.simpleTracker.captureError(error, context);
  }

  captureMessage(message: string, level: 'info' | 'warning' | 'error' = 'info', context?: ErrorContext): void {
    this.simpleTracker.captureMessage(message, level, context);
  }

  trackEvent(event: string, data?: Record<string, any>): void {
    this.simpleTracker.trackEvent(event, data);
  }

  startTransaction(context: PerformanceContext): any {
    console.log('📊 Transaction started:', context.operation);
    return { operation: context.operation, startTime: Date.now() };
  }

  finishTransaction(transaction: any, success: boolean = true): void {
    if (transaction) {
      const duration = Date.now() - transaction.startTime;
      console.log(`📊 Transaction finished: ${transaction.operation} (${duration}ms) - ${success ? 'success' : 'failed'}`);
    }
  }

  // Specific tracking methods for common issues
  trackPricingError(error: Error, itemData?: any, calculationContext?: any): void {
    this.simpleTracker.trackPricingError(error, itemData, calculationContext);
  }

  trackNetworkError(error: Error, endpoint?: string, method?: string): void {
    this.simpleTracker.trackNetworkError(error, endpoint, method);
  }

  trackUIError(error: Error, component?: string, props?: any): void {
    this.simpleTracker.trackUIError(error, component, props);
  }

  trackBusinessLogicError(error: Error, operation?: string, data?: any): void {
    this.simpleTracker.trackBusinessLogicError(error, operation, data);
  }

  // Performance monitoring
  trackScreenLoad(screenName: string): any {
    return this.startTransaction({
      operation: 'screen_load',
      description: `Loading ${screenName}`,
      data: { screenName }
    });
  }

  trackApiCall(endpoint: string, method: string): any {
    return this.startTransaction({
      operation: 'api_call',
      description: `${method} ${endpoint}`,
      data: { endpoint, method }
    });
  }

  // User feedback collection
  showUserFeedbackDialog(): void {
    this.simpleTracker.showUserFeedbackDialog();
  }

  // Debug helpers
  addBreadcrumb(message: string, category: string = 'debug', data?: Record<string, any>): void {
    this.simpleTracker.addBreadcrumb(message, category, data);
  }

  setTag(key: string, value: string): void {
    this.simpleTracker.setTag(key, value);
  }

  setContext(key: string, context: Record<string, any>): void {
    this.simpleTracker.setContext(key, context);
  }

  // Flush pending events
  flush(timeout: number = 2000): Promise<boolean> {
    return this.simpleTracker.flush(timeout);
  }
}

export default ErrorTrackingService;