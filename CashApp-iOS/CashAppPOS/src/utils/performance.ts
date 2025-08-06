/**
 * Performance utilities for monitoring and optimization
 */

export const performanceUtils = {
  mark: (name: string) => {
    if (global.performance && global.performance.mark) {
      global.performance.mark(name);
    }
  },
  
  measure: (name: string, startMark: string, endMark: string) => {
    if (global.performance && global.performance.measure) {
      global.performance.measure(name, startMark, endMark);
    }
  },
  
  getEntriesByName: (name: string) => {
    if (global.performance && global.performance.getEntriesByName) {
      return global.performance.getEntriesByName(name);
    }
    return [];
  },
  
  clearMarks: () => {
    if (global.performance && global.performance.clearMarks) {
      global.performance.clearMarks();
    }
  },
  
  clearMeasures: () => {
    if (global.performance && global.performance.clearMeasures) {
      global.performance.clearMeasures();
    }
  },
};

export default performanceUtils;