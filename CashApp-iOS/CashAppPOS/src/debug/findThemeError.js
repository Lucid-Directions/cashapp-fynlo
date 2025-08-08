// Temporary debug file to find theme error
console.log('DEBUG: findThemeError.js loaded');

// Override console.error to catch the error with stack trace
const originalError = console.error;
console.error = function(...args) {
  if (args[0] && args[0].toString().includes('theme')) {
    console.log('DEBUG: Theme error caught\!');
    console.log('Stack trace:', new Error().stack);
  }
  originalError.apply(console, args);
};

export default {};
