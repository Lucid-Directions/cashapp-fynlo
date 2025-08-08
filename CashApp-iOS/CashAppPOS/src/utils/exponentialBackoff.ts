/**
 * Exponential backoff utility for WebSocket reconnection attempts
 * Implements exponential backoff with jitter for network resilience
 */
export class ExponentialBackoff {
  private attemptCount: number = 0;
  private readonly baseDelay: number;
  private readonly maxDelay: number;
  private readonly maxAttempts: number;
  private readonly jitterFactor: number;

  constructor(
    baseDelay: number = 1000,
    maxDelay: number = 30000,
    maxAttempts: number = 10,
    jitterFactor: number = 0.3
  ) {
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.maxAttempts = maxAttempts;
    this.jitterFactor = jitterFactor;
  }

  /**
   * Calculate the next delay with exponential backoff and jitter
   * @returns The delay in milliseconds for the next attempt
   */
  getNextDelay(): number {
    if (this.attemptCount >= this.maxAttempts) {
      throw new Error(`Maximum retry attempts (${this.maxAttempts}) exceeded`);
    }

    // Calculate exponential delay: baseDelay * 2^attemptCount
    const exponentialDelay = Math.min(
      this.baseDelay * Math.pow(2, this.attemptCount),
      this.maxDelay
    );

    // Apply jitter: ±jitterFactor * exponentialDelay
    const jitter = exponentialDelay * this.jitterFactor;
    const randomJitter = (Math.random() * 2 - 1) * jitter;
    const delayWithJitter = exponentialDelay + randomJitter;

    // Ensure delay is within bounds
    const finalDelay = Math.max(
      this.baseDelay,
      Math.min(delayWithJitter, this.maxDelay)
    );

    this.attemptCount++;
    return Math.round(finalDelay);
  }

  /**
   * Reset the attempt counter on successful connection
   */
  reset(): void {
    this.attemptCount = 0;
  }

  /**
   * Get the current attempt count
   * @returns The number of attempts made
   */
  getAttemptCount(): number {
    return this.attemptCount;
  }

  /**
   * Check if maximum attempts have been reached
   * @returns True if max attempts reached, false otherwise
   */
  hasReachedMaxAttempts(): boolean {
    return this.attemptCount >= this.maxAttempts;
  }

  /**
   * Get remaining attempts
   * @returns The number of attempts remaining
   */
  getRemainingAttempts(): number {
    return Math.max(0, this.maxAttempts - this.attemptCount);
  }
}

/**
 * Default exponential backoff instance with standard WebSocket parameters
 * Base: 1s, Max: 30s, Max attempts: 10, Jitter: ±30%
 */
export const defaultBackoff = new ExponentialBackoff(1000, 30000, 10, 0.3);
