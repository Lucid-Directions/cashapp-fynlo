export class ExponentialBackoff {
  constructor(config) {
    this.minDelay = config?.minDelay || 1000;
    this.maxDelay = config?.maxDelay || 30000;
    this.factor = config?.factor || 2;
    this.maxRetries = config?.maxRetries || 10;
    this.attempt = 0;
  }

  reset() {
    this.attempt = 0;
  }

  getNextDelay() {
    const delay = Math.min(
      this.minDelay * Math.pow(this.factor, this.attempt),
      this.maxDelay
    );
    this.attempt++;
    return delay;
  }

  canRetry() {
    return this.attempt < this.maxRetries;
  }
}
