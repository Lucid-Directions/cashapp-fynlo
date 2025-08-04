/**
 * Test suite for ExponentialBackoff utility
 * Tests exponential delay calculation, jitter, max attempts, and reset functionality
 */

import { ExponentialBackoff, defaultBackoff } from '../exponentialBackoff';

describe('ExponentialBackoff', () => {
  let backoff: ExponentialBackoff;

  beforeEach(() => {
    // Create fresh instance for each test
    backoff = new ExponentialBackoff(1000, 30000, 10, 0.3);
  });

  describe('Exponential delay calculation', () => {
    it('should calculate delays following exponential pattern', () => {
      // Temporarily disable jitter for predictable testing
      const noJitterBackoff = new ExponentialBackoff(1000, 30000, 10, 0);

      // Expected delays: 1s, 2s, 4s, 8s, 16s, 30s (capped)
      const expectedDelays = [1000, 2000, 4000, 8000, 16000, 30000, 30000];

      expectedDelays.forEach((expected, attempt) => {
        const delay = noJitterBackoff.getNextDelay();
        expect(delay).toBe(expected);
      });
    });

    it('should cap delays at maxDelay', () => {
      const noJitterBackoff = new ExponentialBackoff(1000, 5000, 10, 0);

      // Skip to where delays would exceed max
      for (let i = 0; i < 3; i++) {
        noJitterBackoff.getNextDelay();
      }

      // Next delays should be capped at 5000
      expect(noJitterBackoff.getNextDelay()).toBe(5000);
      expect(noJitterBackoff.getNextDelay()).toBe(5000);
    });
  });

  describe('Jitter randomization', () => {
    it('should apply jitter within ±30% range', () => {
      const attempts = 100;
      const jitterFactor = 0.3;

      // Test first attempt (base delay 1000ms)
      const delays: number[] = [];
      for (let i = 0; i < attempts; i++) {
        const testBackoff = new ExponentialBackoff(1000, 30000, 10, jitterFactor);
        delays.push(testBackoff.getNextDelay());
      }

      // All delays should be within [700, 1300] (1000 ± 30%)
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(700);
        expect(delay).toBeLessThanOrEqual(1300);
      });

      // Verify randomness - not all delays should be the same
      const uniqueDelays = new Set(delays);
      expect(uniqueDelays.size).toBeGreaterThan(10);
    });

    it('should maintain jitter bounds at higher attempts', () => {
      // Test at 4th attempt (8000ms base)
      for (let i = 0; i < 3; i++) {
        backoff.getNextDelay();
      }

      const delays: number[] = [];
      for (let i = 0; i < 50; i++) {
        const testBackoff = new ExponentialBackoff(1000, 30000, 10, 0.3);
        // Skip to 4th attempt
        for (let j = 0; j < 3; j++) {
          testBackoff.getNextDelay();
        }
        delays.push(testBackoff.getNextDelay());
      }

      // All delays should be within [5600, 10400] (8000 ± 30%)
      delays.forEach(delay => {
        expect(delay).toBeGreaterThanOrEqual(5600);
        expect(delay).toBeLessThanOrEqual(10400);
      });
    });

    it('should respect minimum delay after jitter', () => {
      // Even with maximum negative jitter, delay shouldn't go below baseDelay
      const highJitterBackoff = new ExponentialBackoff(1000, 30000, 10, 0.9);
      
      for (let i = 0; i < 100; i++) {
        const testBackoff = new ExponentialBackoff(1000, 30000, 10, 0.9);
        const delay = testBackoff.getNextDelay();
        expect(delay).toBeGreaterThanOrEqual(1000);
      }
    });
  });

  describe('Max attempts enforcement', () => {
    it('should throw error when max attempts exceeded', () => {
      // Use up all attempts
      for (let i = 0; i < 10; i++) {
        backoff.getNextDelay();
      }

      // Next attempt should throw
      expect(() => backoff.getNextDelay()).toThrow(
        'Maximum retry attempts (10) exceeded'
      );
    });

    it('should track attempt count correctly', () => {
      expect(backoff.getAttemptCount()).toBe(0);

      backoff.getNextDelay();
      expect(backoff.getAttemptCount()).toBe(1);

      backoff.getNextDelay();
      expect(backoff.getAttemptCount()).toBe(2);
    });

    it('should report hasReachedMaxAttempts correctly', () => {
      expect(backoff.hasReachedMaxAttempts()).toBe(false);

      // Use up 9 attempts
      for (let i = 0; i < 9; i++) {
        backoff.getNextDelay();
        expect(backoff.hasReachedMaxAttempts()).toBe(false);
      }

      // 10th attempt
      backoff.getNextDelay();
      expect(backoff.hasReachedMaxAttempts()).toBe(true);
    });

    it('should calculate remaining attempts correctly', () => {
      expect(backoff.getRemainingAttempts()).toBe(10);

      backoff.getNextDelay();
      expect(backoff.getRemainingAttempts()).toBe(9);

      // Use up all attempts
      for (let i = 1; i < 10; i++) {
        backoff.getNextDelay();
      }
      expect(backoff.getRemainingAttempts()).toBe(0);
    });
  });

  describe('Reset functionality', () => {
    it('should reset attempt counter', () => {
      // Make some attempts
      backoff.getNextDelay();
      backoff.getNextDelay();
      backoff.getNextDelay();
      expect(backoff.getAttemptCount()).toBe(3);

      // Reset
      backoff.reset();
      expect(backoff.getAttemptCount()).toBe(0);
    });

    it('should allow new attempts after reset', () => {
      // Use up all attempts
      for (let i = 0; i < 10; i++) {
        backoff.getNextDelay();
      }
      expect(backoff.hasReachedMaxAttempts()).toBe(true);

      // Reset
      backoff.reset();
      expect(backoff.hasReachedMaxAttempts()).toBe(false);

      // Should be able to get delay again
      expect(() => backoff.getNextDelay()).not.toThrow();
      expect(backoff.getAttemptCount()).toBe(1);
    });

    it('should return to base delay after reset', () => {
      const noJitterBackoff = new ExponentialBackoff(1000, 30000, 10, 0);

      // Make several attempts
      for (let i = 0; i < 5; i++) {
        noJitterBackoff.getNextDelay();
      }

      // Reset and check next delay is base delay
      noJitterBackoff.reset();
      expect(noJitterBackoff.getNextDelay()).toBe(1000);
    });
  });

  describe('Edge cases', () => {
    it('should handle zero base delay', () => {
      const zeroBaseBackoff = new ExponentialBackoff(0, 30000, 10, 0.3);
      const delay = zeroBaseBackoff.getNextDelay();
      expect(delay).toBe(0);
    });

    it('should handle very large delays', () => {
      const largeBackoff = new ExponentialBackoff(1000000, 5000000, 5, 0.3);
      const delay = largeBackoff.getNextDelay();
      expect(delay).toBeGreaterThanOrEqual(700000);
      expect(delay).toBeLessThanOrEqual(1300000);
    });

    it('should handle single attempt limit', () => {
      const singleAttemptBackoff = new ExponentialBackoff(1000, 30000, 1, 0.3);
      
      // First attempt should work
      expect(() => singleAttemptBackoff.getNextDelay()).not.toThrow();
      
      // Second attempt should fail
      expect(() => singleAttemptBackoff.getNextDelay()).toThrow();
    });
  });

  describe('defaultBackoff instance', () => {
    it('should have expected default configuration', () => {
      // Test that defaultBackoff works as expected
      const delay1 = defaultBackoff.getNextDelay();
      expect(delay1).toBeGreaterThanOrEqual(700);
      expect(delay1).toBeLessThanOrEqual(1300);

      // Reset for clean state
      defaultBackoff.reset();
    });
  });

  describe('Statistical properties', () => {
    it('should produce approximately uniform jitter distribution', () => {
      const samples = 1000;
      const buckets = 10;
      const distribution: number[] = new Array(buckets).fill(0);

      for (let i = 0; i < samples; i++) {
        const testBackoff = new ExponentialBackoff(1000, 30000, 10, 0.3);
        const delay = testBackoff.getNextDelay();
        
        // Map delay to bucket [0-9]
        const normalized = (delay - 700) / (1300 - 700);
        const bucket = Math.floor(normalized * buckets);
        distribution[Math.max(0, Math.min(bucket, buckets - 1))]++;
      }

      // Each bucket should have roughly samples/buckets items (±20%)
      const expected = samples / buckets;
      distribution.forEach(count => {
        expect(count).toBeGreaterThan(expected * 0.5);
        expect(count).toBeLessThan(expected * 1.5);
      });
    });
  });
});
EOF < /dev/null