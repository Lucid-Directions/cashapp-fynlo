import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  DollarSign, 
  TrendingUp, 
  RefreshCw,
  Activity,
  CheckCircle,
  AlertTriangle
} from 'lucide-react';
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

export const PaymentSettings = () => {
  const { isPlatformOwner } = useFeatureAccess();
  const [analytics, setAnalytics] = useState<PaymentAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  if (!isPlatformOwner()) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
          <p className="text-gray-600">This page is only available to platform administrators.</p>
        </div>
      </div>
    );
  }

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('payment-analytics');
      
      if (error) throw error;
      
      setAnalytics(data);
      setLastUpdated(new Date());
      console.log('Payment analytics loaded:', data);
    } catch (error) {
      console.error('Error fetching payment analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const getProviderStatus = (providerData: any, providerName: string) => {
    if (providerData && (providerData.charges > 0 || providerData.transactions > 0 || providerData.payments > 0)) {
      return { status: 'active', label: 'Connected & Active' };
    }
    return { status: 'inactive', label: 'Connected but No Data' };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Payment Settings</h1>
          <p className="text-gray-600">Payment provider connections and transaction analytics</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button onClick={fetchAnalytics} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Payment Analytics Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  £{loading ? '...' : (analytics?.totalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
                <p className="text-xs text-gray-500">All payment providers</p>
              </div>
              <DollarSign className="w-8 h-8 text-green-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Transactions</p>
                <p className="text-2xl font-bold text-gray-900">
                  {loading ? '...' : (analytics?.totalTransactions || 0).toLocaleString()}
                </p>
                <p className="text-xs text-gray-500">Last 30 days</p>
              </div>
              <CreditCard className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Average Transaction</p>
                <p className="text-2xl font-bold text-gray-900">
                  £{loading ? '...' : (analytics?.avgTransactionValue || 0).toFixed(2)}
                </p>
                <p className="text-xs text-gray-500">Per transaction</p>
              </div>
              <TrendingUp className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Providers Status */}
      <Card>
        <CardHeader>
          <CardTitle>Connected Payment Providers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Stripe */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-purple-100">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                </div>
                <div>
                  <h3 className="font-medium">Stripe</h3>
                  <p className="text-sm text-gray-500">
                    {analytics?.stripeData ? 
                      `${analytics.stripeData.charges || 0} charges • £${(analytics.stripeData.revenue || 0).toFixed(2)}` : 
                      'No data available'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={analytics?.stripeData ? "default" : "secondary"}>
                {analytics?.stripeData ? getProviderStatus(analytics.stripeData, 'Stripe').label : 'Not Connected'}
              </Badge>
            </div>

            {/* SumUp */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">SumUp</h3>
                  <p className="text-sm text-gray-500">
                    {analytics?.sumupData ? 
                      `${analytics.sumupData.transactions || 0} transactions • £${(analytics.sumupData.revenue || 0).toFixed(2)}` : 
                      'No data available'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={analytics?.sumupData ? "default" : "secondary"}>
                {analytics?.sumupData ? getProviderStatus(analytics.sumupData, 'SumUp').label : 'Not Connected'}
              </Badge>
            </div>

            {/* Square */}
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-orange-100">
                  <CreditCard className="w-5 h-5 text-orange-600" />
                </div>
                <div>
                  <h3 className="font-medium">Square</h3>
                  <p className="text-sm text-gray-500">
                    {analytics?.squareData ? 
                      `${analytics.squareData.payments || 0} payments • £${(analytics.squareData.revenue || 0).toFixed(2)}` : 
                      'No data available'
                    }
                  </p>
                </div>
              </div>
              <Badge variant={analytics?.squareData ? "default" : "secondary"}>
                {analytics?.squareData ? getProviderStatus(analytics.squareData, 'Square').label : 'Not Connected'}
              </Badge>
            </div>
          </div>

          {!analytics?.totalTransactions && !loading && (
            <div className="text-center py-8 border-t mt-6">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 font-medium">Payment system ready</p>
              <p className="text-sm text-gray-500">Transaction data will appear when orders are processed</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Transactions */}
      {analytics?.recentTransactions?.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analytics.recentTransactions.slice(0, 5).map((transaction, index) => (
                <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center space-x-3">
                    <div className="p-2 rounded-full bg-green-100">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">£{parseFloat(transaction.amount).toFixed(2)}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(transaction.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">
                    {transaction.payment_method || 'Unknown'}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};