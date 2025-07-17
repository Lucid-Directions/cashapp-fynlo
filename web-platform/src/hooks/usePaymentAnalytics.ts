import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentAnalytics {
  totalRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
  recentTransactions: any[];
  stripeData?: any;
  sumupData?: any;
  squareData?: any;
}

export const usePaymentAnalytics = (restaurantId?: string) => {
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = async (dateFrom?: string, dateTo?: string) => {
    if (!restaurantId) return;
    
    setLoading(true);
    setError(null);

    try {
      const { data, error: functionError } = await supabase.functions.invoke('payment-analytics', {
        body: {
          restaurant_id: restaurantId,
          date_from: dateFrom,
          date_to: dateTo,
        },
      });

      if (functionError) throw functionError;

      setAnalytics(data);
      console.log('Payment analytics loaded:', data);
    } catch (err) {
      console.error('Error fetching payment analytics:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch analytics');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (restaurantId) {
      fetchAnalytics();
    }
  }, [restaurantId]);

  return {
    analytics,
    loading,
    error,
    refetch: fetchAnalytics,
  };
};