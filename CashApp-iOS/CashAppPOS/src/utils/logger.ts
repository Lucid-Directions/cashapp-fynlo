/**
 * Centralized logging utility for Fynlo POS
 * Replaces console statements for better control and monitoring
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: Date;
  context?: any;
}

class Logger {
  private isDevelopment = __DEV__;
  private logHistory: LogEntry[] = [];
  private maxHistorySize = 100;

  private log(level: LogLevel, message: string, ...args: any[]) {
    // Store in history for debugging
    this.logHistory.push({
      level,
      message,
      timestamp: new Date(),
      context: args.length > 0 ? args : undefined,
    });

    // Trim history if too large
    if (this.logHistory.length > this.maxHistorySize) {
      this.logHistory = this.logHistory.slice(-this.maxHistorySize);
    }

    // Only log in development or for warnings/errors
    if (this.isDevelopment || level === 'warn' || level === 'error') {
      const timestamp = new Date().toISOString();
      const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

      switch (level) {
        case 'debug':
          if (this.isDevelopment) {
            console.log(prefix, message, ...args);
          }
          break;
        case 'info':
          if (this.isDevelopment) {
            console.log(prefix, message, ...args);
          }
          break;
        case 'warn':
          console.warn(prefix, message, ...args);
          break;
        case 'error':
          console.error(prefix, message, ...args);
          // In production, could send to error tracking service
          if (!this.isDevelopment) {
            // TODO: Send to Sentry or similar service
          }
          break;
      }
    }
  }

  debug(message: string, ...args: any[]) {
    this.log('debug', message, ...args);
  }

  info(message: string, ...args: any[]) {
    this.log('info', message, ...args);
  }

  warn(message: string, ...args: any[]) {
    this.log('warn', message, ...args);
  }

  error(message: string, ...args: any[]) {
    this.log('error', message, ...args);
  }

  // Get recent log entries for debugging
  getHistory(level?: LogLevel): LogEntry[] {
    if (level) {
      return this.logHistory.filter((entry) => entry.level === level);
    }
    return [...this.logHistory];
  }

  // Clear log history
  clearHistory() {
    this.logHistory = [];
  }
}

// Export singleton instance
export const logger = new Logger();

// Export type for testing
export type { Logger, LogEntry, LogLevel };