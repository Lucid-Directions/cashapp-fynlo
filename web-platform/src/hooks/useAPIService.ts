import { useState, useCallback } from 'react';
import { apiService } from '@/services/api/enhancedApi';
import { useToast } from '@/hooks/use-toast';

interface UseAPIOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  showToast?: boolean;
}

interface APIState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

export function useAPI<T = any>(options: UseAPIOptions = {}) {
  const [state, setState] = useState<APIState<T>>({
    data: null,
    loading: false,
    error: null
  });
  
  const { toast } = useToast();
  const { onSuccess, onError, showToast = true } = options;

  const execute = useCallback(async (
    apiCall: () => Promise<{ data: T | null; error: string | null; success: boolean }>
  ) => {
    setState(prev => ({ ...prev, loading: true, error: null }));

    try {
      const response = await apiCall();
      
      if (response.success && response.data) {
        setState({
          data: response.data,
          loading: false,
          error: null
        });
        
        onSuccess?.(response.data);
        
        if (showToast) {
          toast({
            title: "Success",
            description: "Operation completed successfully",
          });
        }
      } else {
        setState({
          data: null,
          loading: false,
          error: response.error || 'Unknown error occurred'
        });
        
        onError?.(response.error || 'Unknown error occurred');
        
        if (showToast) {
          toast({
            title: "Error",
            description: response.error || 'Unknown error occurred',
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Network error occurred';
      
      setState({
        data: null,
        loading: false,
        error: errorMessage
      });
      
      onError?.(errorMessage);
      
      if (showToast) {
        toast({
          title: "Network Error",
          description: errorMessage,
          variant: "destructive",
        });
      }
    }
  }, [onSuccess, onError, showToast, toast]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null
    });
  }, []);

  return {
    ...state,
    execute,
    reset
  };
}

// Specific hooks for common API operations
export function useRestaurants() {
  return useAPI({
    showToast: false // Usually don't need toast for list operations
  });
}

export function useOrders() {
  return useAPI({
    showToast: false
  });
}

export function useMenuItems() {
  return useAPI({
    showToast: false
  });
}

export function useCreateOrder() {
  return useAPI({
    onSuccess: () => {
      // Invalidate orders cache
      apiService.invalidateCache('orders_');
    }
  });
}

export function useUpdateOrderStatus() {
  return useAPI({
    onSuccess: () => {
      // Invalidate orders cache
      apiService.invalidateCache('orders_');
      apiService.invalidateCache('order_');
    }
  });
}