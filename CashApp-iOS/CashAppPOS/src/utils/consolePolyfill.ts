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
      // Fallback to original console
    }
  },
  warn: (...args: any[]) => {
    try {
      originalConsole.warn(...args);
    } catch (e) {
      // Fallback
    }
  },
  error: (...args: any[]) => {
    try {
      originalConsole.error(...args);
    } catch (e) {
      // Fallback
    }
  },
  info: (...args: any[]) => {
    try {
      originalConsole.info(...args);
    } catch (e) {
      // Fallback
    }
  },
  debug: (...args: any[]) => {
    try {
      originalConsole.debug(...args);
    } catch (e) {
      // Fallback
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