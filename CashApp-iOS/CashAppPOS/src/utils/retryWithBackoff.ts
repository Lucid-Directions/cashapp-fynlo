/**
 * Retry logic with exponential backoff
 * Provides robust retry mechanism for network requests
 */

import { logger } from './logger';

export interface RetryConfig {
  maxAttempts: number;
  baseDelay: number;
  maxDelay: number;
  backoffFactor: number;
  shouldRetry?: (error: any, attempt: number) => boolean;
  onRetry?: (error: any, attempt: number, nextDelay: number) => void;
}

const DEFAULT_CONFIG: RetryConfig = {
  maxAttempts: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 10000, // 10 seconds
  backoffFactor: 2,
};

/**
 * Default retry predicate - retry on network errors and 5xx status codes
 */
function defaultShouldRetry(error: any, _attempt: number): boolean {
  // Network errors
  if (error.message?.includes('Network') || 
      error.message?.includes('fetch') ||
      error.message?.includes('timeout')) {
    return true;
  }
  
  // Server errors (5xx)
  if (error.status >= 500 && error.status < 600) {
    return true;
  }
  
  // 429 Too Many Requests
  if (error.status === 429) {
    return true;
  }
  
  // Don't retry client errors (4xx except 429)
  if (error.status >= 400 && error.status < 500) {
    return false;
  }
  
  // Retry other errors by default
  return true;
}

/**
 * Calculate delay with jitter to prevent thundering herd
 */
function calculateDelay(
  attempt: number,
  baseDelay: number,
  maxDelay: number,
  backoffFactor: number
): number {
  // Exponential backoff
  const exponentialDelay = baseDelay * Math.pow(backoffFactor, attempt - 1);
  
  // Cap at max delay
  const cappedDelay = Math.min(exponentialDelay, maxDelay);
  
  // Add jitter (±25%)
  const jitter = cappedDelay * 0.25;
  const jitteredDelay = cappedDelay + (Math.random() * 2 - 1) * jitter;
  
  return Math.max(0, Math.round(jitteredDelay));
}

/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param config Retry configuration
 * @returns Result of the function or throws the last error
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  config?: Partial<RetryConfig>
): Promise<T> {
  const finalConfig = { ...DEFAULT_CONFIG, ...config };
  const { 
    maxAttempts, 
    baseDelay, 
    maxDelay, 
    backoffFactor,
    shouldRetry = defaultShouldRetry,
    onRetry,
  } = finalConfig;
  
  let lastError: any = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      logger.debug(`Retry attempt ${attempt}/${maxAttempts}`);
      return await fn();
    } catch (error) {
      lastError = error;
      logger.warn(`Attempt ${attempt} failed:`, error);
      
      // Check if we should retry
      if (attempt >= maxAttempts || !shouldRetry(error, attempt)) {
        logger.error(`Giving up after ${attempt} attempts:`, error);
        throw error;
      }
      
      // Calculate delay for next attempt
      const delay = calculateDelay(attempt, baseDelay, maxDelay, backoffFactor);
      logger.info(`Retrying in ${delay}ms...`);
      
      // Call retry callback if provided
      if (onRetry) {
        onRetry(error, attempt, delay);
      }
      
      // Wait before next attempt
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All retry attempts failed');
}

/**
 * Retry configuration for different scenarios
 */
export const RetryProfiles = {
  // Quick retry for fast failures
  QUICK: {
    maxAttempts: 3,
    baseDelay: 500,
    maxDelay: 2000,
    backoffFactor: 2,
  },
  
  // Standard retry for API calls
  STANDARD: {
    maxAttempts: 3,
    baseDelay: 1000,
    maxDelay: 10000,
    backoffFactor: 2,
  },
  
  // Aggressive retry for critical operations
  AGGRESSIVE: {
    maxAttempts: 5,
    baseDelay: 1000,
    maxDelay: 30000,
    backoffFactor: 2,
  },
  
  // Gentle retry for rate-limited endpoints
  GENTLE: {
    maxAttempts: 3,
    baseDelay: 5000,
    maxDelay: 60000,
    backoffFactor: 1.5,
  },
  
  // No retry
  NONE: {
    maxAttempts: 1,
    baseDelay: 0,
    maxDelay: 0,
    backoffFactor: 1,
  },
};

/**
 * Create a retryable fetch function
 */
export function createRetryableFetch(
  config?: Partial<RetryConfig>
): typeof fetch {
  return async (input: RequestInfo, init?: RequestInit) => {
    return retryWithBackoff(
      async () => {
        const response = await fetch(input, init);
        
        // Throw error for non-OK responses so retry logic can handle them
        if (!response.ok) {
          const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`);
          error.status = response.status;
          error.response = response;
          throw error;
        }
        
        return response;
      },
      config
    );
  };
}