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

// Track if we've already warned about console issues to avoid spam
let hasWarnedAboutConsoleIssue = false;

// Export for use in other files
export const safeConsole = {
  log: (...args: any[]) => {
    try {
      originalConsole.log(...args);
    } catch (e) {
      // Silently fail - the polyfill's job is to prevent crashes
      // Store error info for debugging if needed
      if (!hasWarnedAboutConsoleIssue && __DEV__) {
        hasWarnedAboutConsoleIssue = true;
        // Try to notify about the issue in a safe way
        try {
          originalConsole.error('[Console Polyfill] Console.log is failing. Suppressing further warnings.');
        } catch {}
      }
    }
  },
  warn: (...args: any[]) => {
    try {
      originalConsole.warn(...args);
    } catch (e) {
      // Silently fail for safety
      if (!hasWarnedAboutConsoleIssue && __DEV__) {
        hasWarnedAboutConsoleIssue = true;
        try {
          originalConsole.error('[Console Polyfill] Console methods are failing. Suppressing further warnings.');
        } catch {}
      }
    }
  },
  error: (...args: any[]) => {
    try {
      originalConsole.error(...args);
    } catch (e) {
      // Even error must fail safely to prevent app crashes
      // In production, we absolutely cannot let logging crash the app
    }
  },
  info: (...args: any[]) => {
    try {
      originalConsole.info(...args);
    } catch (e) {
      // Silently fail
    }
  },
  debug: (...args: any[]) => {
    try {
      originalConsole.debug(...args);
    } catch (e) {
      // Silently fail - debug is lowest priority
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