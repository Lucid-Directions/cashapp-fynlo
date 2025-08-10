export class ExponentialBackoff {
  private currentAttempt = 0;
  private maxAttempts: number;
  private baseDelay: number;
  private maxDelay: number;

  constructor(baseDelay = 1000, maxDelay = 30000, maxAttempts = 10, jitterFactor = 0.3) {
    this.baseDelay = baseDelay;
    this.maxDelay = maxDelay;
    this.maxAttempts = maxAttempts;
  }

  async execute(fn: () => Promise<any>) {
    return await fn();
  }

  reset() {
    this.currentAttempt = 0;
  }

  getCurrentAttempt() {
    return this.currentAttempt;
  }

  getAttemptCount() {
    return this.currentAttempt;
  }

  getDelay() {
    return this.baseDelay;
  }

  getNextDelay() {
    this.currentAttempt++;
    return Math.min(this.baseDelay * Math.pow(2, this.currentAttempt - 1), this.maxDelay);
  }

  hasReachedMaxAttempts() {
    return this.currentAttempt >= this.maxAttempts;
  }

  getRemainingAttempts() {
    return Math.max(0, this.maxAttempts - this.currentAttempt);
  }
}
