/**
 * Professional Logging Service
 * 
 * Features:
 * - Different log levels (DEBUG, INFO, WARN, ERROR)
 * - Automatic sanitization of sensitive data
 * - Production vs development mode handling
 * - Integration with crash reporting services
 * - Structured logging with metadata
 */

import Config from 'react-native-config';
import * as Sentry from '@sentry/react-native';

// Log levels
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

// Sensitive patterns to sanitize
const SENSITIVE_PATTERNS = [
  // Authentication tokens
  { pattern: /Bearer\s+[A-Za-z0-9\-._~+\/]+=*/gi, replacement: 'Bearer [REDACTED]' },
  { pattern: /"token"\s*:\s*"[^"]+"/gi, replacement: '"token":"[REDACTED]"' },
  { pattern: /"access_token"\s*:\s*"[^"]+"/gi, replacement: '"access_token":"[REDACTED]"' },
  { pattern: /"refresh_token"\s*:\s*"[^"]+"/gi, replacement: '"refresh_token":"[REDACTED]"' },
  
  // API keys
  { pattern: /api[_-]?key["\s]*[:=]\s*["']?[A-Za-z0-9\-._]+["']?/gi, replacement: 'api_key=[REDACTED]' },
  { pattern: /pk_[a-zA-Z0-9]{24,}/g, replacement: 'pk_[REDACTED]' },
  { pattern: /sk_[a-zA-Z0-9]{24,}/g, replacement: 'sk_[REDACTED]' },
  
  // Passwords
  { pattern: /"password"\s*:\s*"[^"]+"/gi, replacement: '"password":"[REDACTED]"' },
  { pattern: /password["\s]*[:=]\s*["']?[^"'\s]+["']?/gi, replacement: 'password=[REDACTED]' },
  
  // Email addresses (partial redaction)
  { pattern: /([a-zA-Z0-9._%+-]+)@([a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g, 
    replacement: (match: string, user: string, domain: string) => {
      const redactedUser = user.length > 3 ? user.substring(0, 3) + '***' : '***';
      return `${redactedUser}@${domain}`;
    }
  },
  
  // Credit card numbers
  { pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g, replacement: '****-****-****-****' },
  { pattern: /\b\d{13,19}\b/g, replacement: '[CARD_NUMBER_REDACTED]' },
  
  // Phone numbers
  { pattern: /\+?[\d\s\-().]{10,}/g, replacement: '[PHONE_REDACTED]' },
];

// Metadata interface
interface LogMetadata {
  userId?: string;
  restaurantId?: string;
  action?: string;
  context?: Record<string, any>;
  tags?: string[];
}

class LoggingService {
  private isDevelopment: boolean;
  private logLevel: LogLevel;
  private enableConsole: boolean;
  private enableSentry: boolean;

  constructor() {
    this.isDevelopment = __DEV__ || Config.NODE_ENV === 'development';
    this.logLevel = this.isDevelopment ? LogLevel.DEBUG : LogLevel.INFO;
    this.enableConsole = this.isDevelopment || Config.ENABLE_DEBUG_LOGGING === 'true';
    this.enableSentry = !this.isDevelopment && !!Config.SENTRY_DSN;

    // Initialize Sentry in production
    if (this.enableSentry) {
      Sentry.init({
        dsn: Config.SENTRY_DSN,
        environment: Config.NODE_ENV || 'production',
        beforeSend: (event) => this.sanitizeSentryEvent(event),
      });
    }
  }

  /**
   * Sanitize sensitive data from any input
   */
  private sanitize(data: any): any {
    if (typeof data === 'string') {
      let sanitized = data;
      SENSITIVE_PATTERNS.forEach(({ pattern, replacement }) => {
        if (typeof replacement === 'function') {
          sanitized = sanitized.replace(pattern, replacement as any);
        } else {
          sanitized = sanitized.replace(pattern, replacement);
        }
      });
      return sanitized;
    }

    if (Array.isArray(data)) {
      return data.map(item => this.sanitize(item));
    }

    if (data && typeof data === 'object') {
      const sanitized: any = {};
      for (const key in data) {
        // Skip sensitive keys entirely
        if (['password', 'token', 'secret', 'api_key', 'apiKey'].includes(key.toLowerCase())) {
          sanitized[key] = '[REDACTED]';
        } else {
          sanitized[key] = this.sanitize(data[key]);
        }
      }
      return sanitized;
    }

    return data;
  }

  /**
   * Sanitize Sentry events before sending
   */
  private sanitizeSentryEvent(event: any): any {
    // Sanitize request data
    if (event.request) {
      event.request = this.sanitize(event.request);
    }

    // Sanitize breadcrumbs
    if (event.breadcrumbs) {
      event.breadcrumbs = event.breadcrumbs.map((breadcrumb: any) => ({
        ...breadcrumb,
        data: this.sanitize(breadcrumb.data),
        message: this.sanitize(breadcrumb.message),
      }));
    }

    // Sanitize extra context
    if (event.extra) {
      event.extra = this.sanitize(event.extra);
    }

    // Sanitize contexts
    if (event.contexts) {
      event.contexts = this.sanitize(event.contexts);
    }

    return event;
  }

  /**
   * Format log message with metadata
   */
  private formatMessage(level: string, message: string, metadata?: LogMetadata): string {
    const timestamp = new Date().toISOString();
    const baseMessage = `[${timestamp}] [${level}] ${message}`;
    
    if (metadata) {
      const metaStr = JSON.stringify(this.sanitize(metadata), null, 2);
      return `${baseMessage}\n${metaStr}`;
    }
    
    return baseMessage;
  }

  /**
   * Core logging method
   */
  private log(level: LogLevel, message: string, metadata?: LogMetadata, error?: Error): void {
    // Check if we should log this level
    if (level < this.logLevel) {
      return;
    }

    // Sanitize the message
    const sanitizedMessage = this.sanitize(message);
    const levelStr = LogLevel[level];

    // Console logging (development only)
    if (this.enableConsole) {
      const formattedMessage = this.formatMessage(levelStr, sanitizedMessage, metadata);
      
      switch (level) {
        case LogLevel.DEBUG:
          console.log(formattedMessage);
          break;
        case LogLevel.INFO:
          console.info(formattedMessage);
          break;
        case LogLevel.WARN:
          console.warn(formattedMessage);
          break;
        case LogLevel.ERROR:
          console.error(formattedMessage, error);
          break;
      }
    }

    // Sentry logging (production only)
    if (this.enableSentry) {
      // Add breadcrumb for all logs
      Sentry.addBreadcrumb({
        message: sanitizedMessage,
        level: levelStr.toLowerCase() as any,
        category: 'log',
        data: this.sanitize(metadata),
      });

      // Send errors to Sentry
      if (level === LogLevel.ERROR && error) {
        Sentry.captureException(error, {
          contexts: {
            metadata: this.sanitize(metadata),
          },
          level: 'error',
        });
      } else if (level === LogLevel.ERROR) {
        Sentry.captureMessage(sanitizedMessage, 'error');
      } else if (level === LogLevel.WARN) {
        Sentry.captureMessage(sanitizedMessage, 'warning');
      }
    }

    // You can add additional logging destinations here (e.g., remote logging service)
  }

  /**
   * Public logging methods
   */
  debug(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.DEBUG, message, metadata);
  }

  info(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.INFO, message, metadata);
  }

  warn(message: string, metadata?: LogMetadata): void {
    this.log(LogLevel.WARN, message, metadata);
  }

  error(message: string, error?: Error, metadata?: LogMetadata): void {
    this.log(LogLevel.ERROR, message, metadata, error);
  }

  /**
   * Set user context for logging
   */
  setUserContext(userId: string | null, email?: string, username?: string): void {
    if (this.enableSentry) {
      if (userId) {
        Sentry.setUser({
          id: userId,
          email: email ? this.sanitize(email) : undefined,
          username,
        });
      } else {
        Sentry.setUser(null);
      }
    }
  }

  /**
   * Add custom tags
   */
  setTags(tags: Record<string, string>): void {
    if (this.enableSentry) {
      Object.entries(tags).forEach(([key, value]) => {
        Sentry.setTag(key, this.sanitize(value));
      });
    }
  }

  /**
   * Track performance
   */
  startTransaction(name: string, op: string): any {
    if (this.enableSentry) {
      return Sentry.startTransaction({ name, op });
    }
    return null;
  }

  /**
   * Clear sensitive data before logging out
   */
  clearContext(): void {
    if (this.enableSentry) {
      Sentry.configureScope(scope => scope.clear());
    }
  }
}

// Export singleton instance
const loggingService = new LoggingService();

// Export convenience methods
export const { debug, info, warn, error } = loggingService;
export const setUserContext = loggingService.setUserContext.bind(loggingService);
export const setTags = loggingService.setTags.bind(loggingService);
export const startTransaction = loggingService.startTransaction.bind(loggingService);
export const clearContext = loggingService.clearContext.bind(loggingService);

export default loggingService;