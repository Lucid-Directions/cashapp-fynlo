import { useCallback, useRef, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook for optimized database queries with caching and debouncing
 */
export const useQueryOptimization = () => {
  const queryCache = useRef(new Map<string, { data: any; timestamp: number }>());
  const abortControllers = useRef(new Map<string, AbortController>());
  
  const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Execute a query with caching and abort control
   */
  const executeQuery = useCallback(async (
    queryKey: string,
    queryFn: () => Promise<any>,
    cacheTTL: number = CACHE_TTL
  ) => {
    // Check cache first
    const cached = queryCache.current.get(queryKey);
    if (cached && Date.now() - cached.timestamp < cacheTTL) {
      return cached.data;
    }

    // Abort previous query if it exists
    const existingController = abortControllers.current.get(queryKey);
    if (existingController) {
      existingController.abort();
    }

    // Create new abort controller
    const controller = new AbortController();
    abortControllers.current.set(queryKey, controller);

    try {
      const data = await queryFn();
      
      // Cache the result
      queryCache.current.set(queryKey, {
        data,
        timestamp: Date.now()
      });

      return data;
    } finally {
      abortControllers.current.delete(queryKey);
    }
  }, [CACHE_TTL]);

  /**
   * Optimized query builder for common patterns
   */
  const createOptimizedQuery = useCallback((
    table: string,
    select: string = '*',
    filters: Record<string, any> = {}
  ) => {
    let query = supabase.from(table as any).select(select);

    // Apply filters efficiently
    Object.entries(filters).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        if (Array.isArray(value)) {
          query = query.in(key, value);
        } else if (typeof value === 'string' && value.includes('%')) {
          query = query.ilike(key, value);
        } else {
          query = query.eq(key, value);
        }
      }
    });

    return query;
  }, []);

  /**
   * Batch multiple queries for efficiency
   */
  const batchQueries = useCallback(async (queries: Array<{
    key: string;
    queryFn: () => Promise<any>;
  }>) => {
    const results = await Promise.allSettled(
      queries.map(({ key, queryFn }) => 
        executeQuery(key, queryFn)
      )
    );

    return results.reduce((acc, result, index) => {
      const key = queries[index].key;
      acc[key] = result.status === 'fulfilled' ? result.value : null;
      return acc;
    }, {} as Record<string, any>);
  }, [executeQuery]);

  /**
   * Clear cache for specific keys or all
   */
  const clearCache = useCallback((keys?: string[]) => {
    if (keys) {
      keys.forEach(key => queryCache.current.delete(key));
    } else {
      queryCache.current.clear();
    }
  }, []);

  /**
   * Debounced search query
   */
  const debouncedSearch = useMemo(() => {
    let timeoutId: NodeJS.Timeout;
    
    return (
      searchTerm: string,
      searchFn: (term: string) => Promise<any>,
      delay: number = 300
    ) => {
      return new Promise((resolve) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(async () => {
          try {
            const result = await searchFn(searchTerm);
            resolve(result);
          } catch (error) {
            console.error('Search error:', error);
            resolve([]);
          }
        }, delay);
      });
    };
  }, []);

  /**
   * Optimized pagination query
   */
  const createPaginatedQuery = useCallback((
    table: string,
    page: number,
    pageSize: number = 20,
    select: string = '*',
    filters: Record<string, any> = {},
    orderBy: string = 'created_at',
    ascending: boolean = false
  ) => {
    const from = page * pageSize;
    const to = from + pageSize - 1;

    const query = createOptimizedQuery(table, select, filters);
    return query.order(orderBy, { ascending }).range(from, to);
  }, [createOptimizedQuery]);

  return {
    executeQuery,
    createOptimizedQuery,
    batchQueries,
    clearCache,
    debouncedSearch,
    createPaginatedQuery
  };
};