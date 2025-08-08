/**
 * URLSearchParams Polyfill for React Native
 * Ensures URLSearchParams is available in all environments
 */

import logger from './logger';

export function setupURLSearchParamsPolyfill(): void {
  // Check if URLSearchParams already exists
  if (typeof globalThis.URLSearchParams !== 'undefined') {
    // Defer logger call to avoid module-level execution
    setTimeout(() => {
      logger.info('✅ URLSearchParams already available');
    }, 0);
    return;
  }

  // Defer logger call to avoid module-level execution
  setTimeout(() => {
    logger.warn('⚠️ URLSearchParams not found, installing polyfill');
  }, 0);

  // Simple URLSearchParams polyfill
  class URLSearchParamsPolyfill {
    private params: Map<string, string[]>;

    constructor(init?: string | Record<string, string> | URLSearchParams) {
      this.params = new Map();

      if (init) {
        if (typeof init === 'string') {
          // Parse query string
          const pairs = init.replace(/^\?/, '').split('&');
          for (const pair of pairs) {
            const [key, value] = pair.split('=');
            if (key) {
              this.append(decodeURIComponent(key), value ? decodeURIComponent(value) : '');
            }
          }
        } else if (init instanceof URLSearchParamsPolyfill) {
          // Copy from another URLSearchParams
          init.params.forEach((values, key) => {
            values.forEach((value) => this.append(key, value));
          });
        } else {
          // Initialize from object
          Object.entries(init).forEach(([key, value]) => {
            this.append(key, String(value));
          });
        }
      }
    }

    append(name: string, value: string): void {
      const values = this.params.get(name) || [];
      values.push(String(value));
      this.params.set(name, values);
    }

    delete(name: string): void {
      this.params.delete(name);
    }

    get(name: string): string | null {
      const values = this.params.get(name);
      return values ? values[0] : null;
    }

    getAll(name: string): string[] {
      return this.params.get(name) || [];
    }

    has(name: string): boolean {
      return this.params.has(name);
    }

    set(name: string, value: string): void {
      this.params.set(name, [String(value)]);
    }

    toString(): string {
      const pairs: string[] = [];
      this.params.forEach((values, key) => {
        values.forEach((value) => {
          pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
        });
      });
      return pairs.join('&');
    }

    forEach(
      callback: (value: string, key: string, parent: URLSearchParams) => void,
      thisArg?: unknown
    ): void {
      this.params.forEach((values, key) => {
        values.forEach((value) => {
          callback.call(thisArg, value, key, this as unknown as URLSearchParams);
        });
      });
    }

    entries(): IterableIterator<[string, string]> {
      const entries: [string, string][] = [];
      this.params.forEach((values, key) => {
        values.forEach((value) => {
          entries.push([key, value]);
        });
      });
      return entries[Symbol.iterator]();
    }

    keys(): IterableIterator<string> {
      return this.params.keys();
    }

    values(): IterableIterator<string> {
      const allValues: string[] = [];
      this.params.forEach((values) => {
        allValues.push(...values);
      });
      return allValues[Symbol.iterator]();
    }

    [Symbol.iterator](): IterableIterator<[string, string]> {
      return this.entries();
    }
  }

  // Install the polyfill globally
  (globalThis as { URLSearchParams?: typeof URLSearchParams }).URLSearchParams =
    URLSearchParamsPolyfill as unknown as typeof URLSearchParams;
  
  // Defer logger call to avoid module-level execution
  setTimeout(() => {
    logger.info('✅ URLSearchParams polyfill installed');
  }, 0);
}

// Auto-install polyfill when module is imported
setupURLSearchParamsPolyfill();

export default setupURLSearchParamsPolyfill;