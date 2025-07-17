import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  TrendingUp, 
  PoundSterling, 
  CreditCard,
  Activity,
  RefreshCw,
  BarChart3,
  PieChart,
  Calendar
} from 'lucide-react';

export const AnalyticsDashboard = () => {
  const { isPlatformOwner } = useFeatureAccess();
  const [metrics, setMetrics] = useState<any>(null);
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
      const { data, error } = await supabase.functions.invoke('platform-metrics');
      if (error) throw error;
      setMetrics(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">Detailed platform performance and business insights</p>
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

      {/* Revenue Analytics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Platform Revenue</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `£${(metrics?.totalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : `${metrics?.growthMetrics?.revenueGrowth > 0 ? '+' : ''}${metrics?.growthMetrics?.revenueGrowth?.toFixed(1) || 0}% from last period`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Transactions</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : (metrics?.totalTransactions || 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {loading ? '...' : `${metrics?.growthMetrics?.transactionGrowth > 0 ? '+' : ''}${metrics?.growthMetrics?.transactionGrowth?.toFixed(1) || 0}% from last period`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Transaction Value</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {loading ? '...' : `£${metrics?.totalTransactions ? (metrics.totalRevenue / metrics.totalTransactions).toFixed(2) : '0.00'}`}
            </div>
            <p className="text-xs text-muted-foreground">
              Per transaction average
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <BarChart3 className="w-5 h-5 mr-2" />
              Revenue Trends
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : metrics?.totalRevenue > 0 ? (
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">Revenue trend chart</p>
                  <p className="text-sm text-gray-500">Chart visualization will be implemented here</p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <BarChart3 className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">No revenue data yet</p>
                  <p className="text-sm text-gray-500">Charts will appear when transactions start coming in</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <PieChart className="w-5 h-5 mr-2" />
              Business Distribution
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center h-64">
                <RefreshCw className="w-8 h-8 animate-spin" />
              </div>
            ) : metrics?.activeBusinesses > 0 ? (
              <div className="h-64 flex items-center justify-center border-2 border-dashed border-gray-300 rounded">
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">Business performance chart</p>
                  <p className="text-sm text-gray-500">Breakdown by business performance</p>
                </div>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center">
                <div className="text-center">
                  <PieChart className="w-12 h-12 mx-auto mb-2 text-gray-400" />
                  <p className="text-gray-600">No businesses registered yet</p>
                  <p className="text-sm text-gray-500">Business distribution will appear when restaurants join</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Platform Activity Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
              <p>Loading activity timeline...</p>
            </div>
          ) : metrics?.recentActivity?.length ? (
            <div className="space-y-4">
              {metrics.recentActivity.map((activity: any, index: number) => (
                <div key={index} className="flex items-start space-x-4 p-4 border rounded-lg">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{activity.description}</p>
                    <p className="text-sm text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {activity.status && (
                    <span className={`px-2 py-1 text-xs rounded ${
                      activity.status === 'completed' ? 'bg-green-100 text-green-700' :
                      activity.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                      'bg-gray-100 text-gray-700'
                    }`}>
                      {activity.status}
                    </span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <Activity className="w-12 h-12 mx-auto mb-4 text-gray-400" />
              <p className="text-gray-600 font-medium">Platform is ready and connected</p>
              <p className="text-sm text-gray-500">Activity timeline will populate as restaurants process orders</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};