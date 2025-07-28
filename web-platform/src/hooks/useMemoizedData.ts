import { useMemo, useCallback } from 'react';

/**
 * Hook for memoizing expensive data transformations
 */
export const useMemoizedData = <T, R>(
  data: T[],
  transformFn: (data: T[]) => R,
  dependencies: unknown[] = []
): R => {
  return useMemo(() => {
    if (!data || data.length === 0) return transformFn([]);
    return transformFn(data);
  }, [data, ...dependencies]);
};

/**
 * Hook for memoizing callback functions
 */
export const useMemoizedCallback = <T extends (...args: any[]) => any>(
  callback: T,
  dependencies: unknown[]
): T => {
  return useCallback(callback, dependencies);
};

/**
 * Hook for memoizing filtered and sorted data
 */
export const useMemoizedFilteredData = <T>(
  data: T[],
  filterFn: (item: T) => boolean,
  sortFn?: (a: T, b: T) => number,
  dependencies: unknown[] = []
) => {
  return useMemo(() => {
    if (!data || data.length === 0) return [];
    
    let result = data.filter(filterFn);
    
    if (sortFn) {
      result = result.sort(sortFn);
    }
    
    return result;
  }, [data, filterFn, sortFn, ...dependencies]);
};

/**
 * Hook for memoizing aggregated statistics
 */
export const useMemoizedStats = <T>(
  data: T[],
  statsFn: (data: T[]) => Record<string, number>,
  dependencies: unknown[] = []
): Record<string, number> => {
  return useMemo(() => {
    if (!data || data.length === 0) return {};
    return statsFn(data);
  }, [data, statsFn, ...dependencies]);
};