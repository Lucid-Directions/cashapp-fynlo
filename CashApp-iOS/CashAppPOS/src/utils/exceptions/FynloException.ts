/**
 * FynloException - Custom exception class for Fynlo POS
 * Replaces HTTPException for consistent error handling
 */

export interface FynloExceptionDetails {
  status_code?: number;
  error_code?: string;
  details?: Record<string, any>;
  timestamp?: string;
  requestId?: string;
}

export class FynloException extends Error {
  public status_code: number;
  public error_code: string;
  public details?: Record<string, any>;
  public timestamp: string;
  public requestId?: string;

  constructor(
    message: string,
    status_code: number = 500,
    error_code: string = 'INTERNAL_ERROR',
    details?: Record<string, any>
  ) {
    super(message);
    this.name = 'FynloException';
    this.status_code = status_code;
    this.error_code = error_code;
    this.details = details;
    this.timestamp = new Date().toISOString();
    this.requestId = this.generateRequestId();

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, FynloException);
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Factory methods for common error types
   */
  static badRequest(message: string, details?: Record<string, any>): FynloException {
    return new FynloException(message, 400, 'BAD_REQUEST', details);
  }

  static unauthorized(
    message: string = 'Unauthorized',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 401, 'UNAUTHORIZED', details);
  }

  static forbidden(message: string = 'Forbidden', details?: Record<string, any>): FynloException {
    return new FynloException(message, 403, 'FORBIDDEN', details);
  }

  static notFound(message: string = 'Not found', details?: Record<string, any>): FynloException {
    return new FynloException(message, 404, 'NOT_FOUND', details);
  }

  static conflict(message: string, details?: Record<string, any>): FynloException {
    return new FynloException(message, 409, 'CONFLICT', details);
  }

  static validationError(message: string, details?: Record<string, any>): FynloException {
    return new FynloException(message, 422, 'VALIDATION_ERROR', details);
  }

  static tooManyRequests(
    message: string = 'Too many requests',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 429, 'TOO_MANY_REQUESTS', details);
  }

  static rateLimited(
    message: string = 'Rate limit exceeded',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }

  static rateLimitExceeded(
    message: string = 'Rate limit exceeded',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 429, 'RATE_LIMIT_EXCEEDED', details);
  }

  static internalError(
    message: string = 'Internal server error',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 500, 'INTERNAL_ERROR', details);
  }

  static serviceUnavailable(
    message: string = 'Service unavailable',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 503, 'SERVICE_UNAVAILABLE', details);
  }

  static networkError(
    message: string = 'Network error',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 0, 'NETWORK_ERROR', details);
  }

  static offlineError(
    message: string = 'Device is offline',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 0, 'OFFLINE', details);
  }

  static multiTenantViolation(
    message: string = 'Multi-tenant access violation',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 403, 'MULTI_TENANT_VIOLATION', details);
  }

  static encryptionError(
    message: string = 'Encryption/decryption failed',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 500, 'ENCRYPTION_ERROR', details);
  }

  static queueOverflow(
    message: string = 'Queue size limit exceeded',
    details?: Record<string, any>
  ): FynloException {
    return new FynloException(message, 507, 'QUEUE_OVERFLOW', details);
  }

  /**
   * Create FynloException from unknown error
   */
  static fromError(error: unknown, defaultCode: string = 'UNKNOWN_ERROR'): FynloException {
    if (error instanceof FynloException) {
      return error;
    }

    if (error instanceof Error) {
      return new FynloException(error.message, 500, defaultCode, {
        originalError: error.name,
        stack: error.stack,
      });
    }

    return new FynloException('An unknown error occurred', 500, defaultCode, {
      originalError: String(error),
    });
  }

  /**
   * Convert to plain object for serialization
   */
  toJSON(): FynloExceptionDetails {
    return {
      status_code: this.status_code,
      error_code: this.error_code,
      details: this.details,
      timestamp: this.timestamp,
      requestId: this.requestId,
    };
  }

  /**
   * Format for API response
   */
  toAPIResponse(): {
    success: false;
    error: {
      message: string;
      code: string;
      status: number;
      details?: Record<string, any>;
      requestId: string;
    };
  } {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.error_code,
        status: this.status_code,
        details: this.details,
        requestId: this.requestId || '',
      },
    };
  }
}

export default FynloException;
