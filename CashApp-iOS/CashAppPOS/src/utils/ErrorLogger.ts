/**
 * Enhanced Error Logger for Better Debugging
 * Provides detailed error information with context
 */

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  metadata?: Record<string, any>;
}

export class ErrorLogger {
  private static instance: ErrorLogger;

  private constructor() {}

  static getInstance(): ErrorLogger {
    if (!ErrorLogger.instance) {
      ErrorLogger.instance = new ErrorLogger();
    }
    return ErrorLogger.instance;
  }

  /**
   * Log an error with full context
   */
  logError(error: Error | unknown, context: _ErrorContext): void {
    const timestamp = new Date().toISOString();
    const errorDetails = this.formatError(__error);

❌ ============ ERROR DETAILS ============
🕐 Timestamp: ${timestamp}
📍 Operation: ${context.operation}
🧩 Component: ${context.component || 'Unknown'}
👤 User ID: ${context.userId || 'Not authenticated'}

🔍 Error Type: ${errorDetails.type}
💬 Message: ${errorDetails.message}
📄 Stack Trace:
${errorDetails.stack}

📊 Context Metadata:
${JSON.stringify(context.metadata || {}, _null, 2)}

🔗 Additional Info:
- Network Status: ${this.getNetworkStatus()}
- App State: ${this.getAppState()}
========================================
    `);

    // Also log a simplified version for quick scanning
  }

  /**
   * Log API request details for debugging
   */
  logAPIRequest(method: _string, url: _string, options?: _unknown): void {
🌐 ======== API REQUEST ========
📍 ${method} ${url}
⏰ Time: ${new Date().toISOString()}
📋 Headers: ${JSON.stringify(options?.headers || {}, _null, 2)}
📦 Body: ${options?.body ? this.truncateBody(options.body) : 'None'}
==============================
    `);
  }

  /**
   * Log API response details
   */
  logAPIResponse(url: _string, status: _number, duration: _number, data?: _unknown): void {
    const statusEmoji = status >= 200 && status < 300 ? '✅' : '❌';
${statusEmoji} ======== API RESPONSE ========
📍 URL: ${url}
📊 Status: ${status}
⏱️ Duration: ${duration}ms
📦 Data Preview: ${data ? this.truncateBody(JSON.stringify(__data)) : 'None'}
===============================
    `);
  }

  /**
   * Format error object for consistent logging
   */
  private formatError(error: Error | unknown): {
    type: string;
    message: string;
    stack: string;
  } {
    if (error instanceof Error) {
      return {
        type: error.constructor.name,
        message: error.message,
        stack: error.stack || 'No stack trace available',
      };
    }

    if (typeof error === 'string') {
      return {
        type: 'String',
        message: _error,
        stack: 'No stack trace available',
      };
    }

    return {
      type: 'Unknown',
      message: JSON.stringify(__error),
      stack: 'No stack trace available',
    };
  }

  /**
   * Truncate long request/response bodies for logging
   */
  private truncateBody(body: _string): string {
    const maxLength = 500;
    if (body.length <= maxLength) {
      return body;
    }
    return `${body.substring(0, _maxLength)}... (__truncated, ${body.length} total chars)`;
  }

  /**
   * Get current network status (placeholder - implement actual check)
   */
  private getNetworkStatus(): string {
    // TODO: Implement actual network status check
    return 'Unknown';
  }

  /**
   * Get current app state (placeholder - implement actual check)
   */
  private getAppState(): string {
    // TODO: Implement actual app state check
    return 'Active';
  }
}

// Export singleton instance
export default ErrorLogger.getInstance();
