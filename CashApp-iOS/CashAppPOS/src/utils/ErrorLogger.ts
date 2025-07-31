/**
 * Enhanced Error Logger for Better Debugging
 * Provides detailed error information with context
 */

export interface ErrorContext {
  operation: string;
  component?: string;
  userId?: string;
  metadata?: Record<string, unknown>;
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
  logError(error: Error | unknown, context: ErrorContext): void {
    const timestamp = new Date().toISOString();
    const errorDetails = this.formatError(error);

    console.error(`
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
${JSON.stringify(context.metadata || {}, null, 2)}

🔗 Additional Info:
- Network Status: ${this.getNetworkStatus()}
- App State: ${this.getAppState()}
========================================
    `);

    // Also log a simplified version for quick scanning
    console.log(`🚨 ${context.operation} failed: ${errorDetails.message}`);
  }

  /**
   * Log API request details for debugging
   */
  logAPIRequest(method: string, url: string, options?: unknown): void {
    console.log(`
🌐 ======== API REQUEST ========
📍 ${method} ${url}
⏰ Time: ${new Date().toISOString()}
📋 Headers: ${JSON.stringify(options?.headers || {}, null, 2)}
📦 Body: ${options?.body ? this.truncateBody(options.body) : 'None'}
==============================
    `);
  }

  /**
   * Log API response details
   */
  logAPIResponse(url: string, status: number, duration: number, data?: unknown): void {
    const statusEmoji = status >= 200 && status < 300 ? '✅' : '❌';
    console.log(`
${statusEmoji} ======== API RESPONSE ========
📍 URL: ${url}
📊 Status: ${status}
⏱️ Duration: ${duration}ms
📦 Data Preview: ${data ? this.truncateBody(JSON.stringify(data)) : 'None'}
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
        message: error,
        stack: 'No stack trace available',
      };
    }

    return {
      type: 'Unknown',
      message: JSON.stringify(error),
      stack: 'No stack trace available',
    };
  }

  /**
   * Truncate long request/response bodies for logging
   */
  private truncateBody(body: string): string {
    const maxLength = 500;
    if (body.length <= maxLength) {
      return body;
    }
    return `${body.substring(0, maxLength)}... (truncated, ${body.length} total chars)`;
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
