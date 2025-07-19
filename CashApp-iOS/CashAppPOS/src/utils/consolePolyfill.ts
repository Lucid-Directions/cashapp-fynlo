/**
 * Console Polyfill
 * Temporary fix to ensure console methods work during migration
 */

// Store original console methods
const originalConsole = {
  log: console.log,
  warn: console.warn,
  error: console.error,
  info: console.info,
  debug: console.debug,
};

// Export for use in other files
export const safeConsole = {
  log: (...args: any[]) => {
    try {
      originalConsole.log(...args);
    } catch (e) {
      // If console.log fails, try to at least output to stderr
      if (originalConsole.error) {
        originalConsole.error('[Console Polyfill] Failed to log:', e);
      }
      // Re-throw to help with debugging
      throw e;
    }
  },
  warn: (...args: any[]) => {
    try {
      originalConsole.warn(...args);
    } catch (e) {
      // Fallback to error if warn fails
      if (originalConsole.error) {
        originalConsole.error('[Console Polyfill] Failed to warn:', e);
      }
      throw e;
    }
  },
  error: (...args: any[]) => {
    try {
      originalConsole.error(...args);
    } catch (e) {
      // Error is critical - always re-throw
      throw e;
    }
  },
  info: (...args: any[]) => {
    try {
      originalConsole.info(...args);
    } catch (e) {
      // Fallback to log if info fails
      if (originalConsole.log) {
        originalConsole.log('[Console Polyfill] Failed to info:', e);
      }
      throw e;
    }
  },
  debug: (...args: any[]) => {
    try {
      originalConsole.debug(...args);
    } catch (e) {
      // Debug is least critical, but still throw for debugging
      if (originalConsole.log) {
        originalConsole.log('[Console Polyfill] Failed to debug:', e);
      }
      throw e;
    }
  },
};

// Ensure console methods are available globally
if (typeof global !== 'undefined') {
  global.console = {
    ...global.console,
    ...safeConsole,
  };
}