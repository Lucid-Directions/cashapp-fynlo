export class ExponentialBackoff {
  constructor() {}
  async execute(fn) { return await fn(); }
  reset() {}
  getCurrentAttempt() { return 0; }
  getDelay() { return 1000; }
}
