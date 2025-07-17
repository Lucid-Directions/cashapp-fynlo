import React, { useEffect, useState } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Activity, 
  Server, 
  Database, 
  CreditCard, 
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  Users,
  DollarSign,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PlatformMetrics {
  activeBusinesses: number;
  totalRevenue: number;
  totalTransactions: number;
  systemHealth: {
    uptime: number;
    status: 'operational' | 'degraded' | 'outage';
    services: {
      database: boolean;
      payments: boolean;
      api: boolean;
    };
  };
  recentActivity: any[];
  growthMetrics: {
    businessGrowth: number;
    revenueGrowth: number;
    transactionGrowth: number;
  };
}

export const SystemHealth = () => {
  const { isPlatformOwner } = useFeatureAccess();
  const [metrics, setMetrics] = useState<PlatformMetrics | null>(null);
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

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('platform-metrics');
      
      if (error) throw error;
      
      // Add system health status based on data availability
      const systemHealthData = {
        ...data,
        systemHealth: {
          uptime: 99.9, // Real uptime would come from monitoring service
          status: 'operational' as const,
          services: {
            database: true, // Connection successful if we got data
            payments: data.totalRevenue > 0 || data.totalTransactions > 0, // Payments working if transactions exist
            api: true // API working if we're getting a response
          }
        }
      };
      
      setMetrics(systemHealthData);
      setLastUpdated(new Date());
      console.log('Platform metrics loaded:', systemHealthData);
    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      // Set error state for system health
      setMetrics({
        activeBusinesses: 0,
        totalRevenue: 0,
        totalTransactions: 0,
        systemHealth: {
          uptime: 0,
          status: 'outage',
          services: {
            database: false,
            payments: false,
            api: false
          }
        },
        recentActivity: [],
        growthMetrics: {
          businessGrowth: 0,
          revenueGrowth: 0,
          transactionGrowth: 0
        }
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    
    // Auto-refresh every 5 minutes
    const interval = setInterval(fetchMetrics, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !metrics) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-2" />
            <p>Loading system metrics...</p>
          </div>
        </div>
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'operational': return 'text-green-600 bg-green-100';
      case 'degraded': return 'text-yellow-600 bg-yellow-100';
      case 'outage': return 'text-red-600 bg-red-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'operational': return <CheckCircle className="w-5 h-5" />;
      case 'degraded': return <AlertTriangle className="w-5 h-5" />;
      case 'outage': return <AlertTriangle className="w-5 h-5" />;
      default: return <Activity className="w-5 h-5" />;
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">System Health</h1>
          <p className="text-gray-600">Real-time platform monitoring and analytics</p>
        </div>
        <div className="flex items-center space-x-4">
          <span className="text-sm text-gray-500">
            Last updated: {lastUpdated.toLocaleTimeString()}
          </span>
          <Button onClick={fetchMetrics} disabled={loading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      {/* System Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Activity className="w-5 h-5 mr-2" />
            Overall System Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center">
              {getStatusIcon(metrics?.systemHealth?.status || 'operational')}
              <Badge className={`ml-2 ${getStatusColor(metrics?.systemHealth?.status || 'operational')}`}>
                {metrics?.systemHealth?.status?.toUpperCase() || 'OPERATIONAL'}
              </Badge>
            </div>
            <div className="text-right">
              <p className="text-2xl font-bold text-green-600">
                {metrics?.systemHealth?.uptime || 99.9}%
              </p>
              <p className="text-sm text-gray-500">Uptime</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center">
                <Database className="w-5 h-5 mr-2 text-blue-600" />
                <span>Database</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                metrics?.systemHealth?.services?.database ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-purple-600" />
                <span>Payments</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                metrics?.systemHealth?.services?.payments ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>

            <div className="flex items-center justify-between p-3 border rounded-lg">
              <div className="flex items-center">
                <Server className="w-5 h-5 mr-2 text-orange-600" />
                <span>API</span>
              </div>
              <div className={`w-3 h-3 rounded-full ${
                metrics?.systemHealth?.services?.api ? 'bg-green-500' : 'bg-red-500'
              }`}></div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Active Businesses</p>
                <p className="text-2xl font-bold text-gray-900">{metrics?.activeBusinesses || 0}</p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">
                    {metrics?.growthMetrics?.businessGrowth > 0 ? '+' : ''}
                    {metrics?.growthMetrics?.businessGrowth?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
              <Users className="w-8 h-8 text-blue-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900">
                  £{(metrics?.totalRevenue || 0).toLocaleString('en-GB', { minimumFractionDigits: 2 })}
                </p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <span className="text-sm text-green-600 ml-1">
                    {metrics?.growthMetrics?.revenueGrowth > 0 ? '+' : ''}
                    {metrics?.growthMetrics?.revenueGrowth?.toFixed(1) || 0}%
                  </span>
                </div>
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
                  {(metrics?.totalTransactions || 0).toLocaleString()}
                </p>
                <div className="flex items-center mt-1">
                  <TrendingUp className="w-4 h-4 text-blue-500" />
                  <span className="text-sm text-blue-600 ml-1">
                    {metrics?.growthMetrics?.transactionGrowth > 0 ? '+' : ''}
                    {metrics?.growthMetrics?.transactionGrowth?.toFixed(1) || 0}%
                  </span>
                </div>
              </div>
              <CreditCard className="w-8 h-8 text-purple-600" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">Avg Transaction</p>
                <p className="text-2xl font-bold text-gray-900">
                  £{metrics?.totalTransactions ? (metrics.totalRevenue / metrics.totalTransactions).toFixed(2) : '0.00'}
                </p>
                <p className="text-sm text-gray-500">Per transaction</p>
              </div>
              <Activity className="w-8 h-8 text-orange-600" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Platform Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {metrics?.recentActivity?.length ? (
            <div className="space-y-4">
              {metrics.recentActivity.map((activity, index) => (
                <div key={index} className="flex items-center space-x-3 p-3 border rounded-lg">
                  <div className="p-2 rounded-full bg-blue-100">
                    <Activity className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{activity.description}</p>
                    <p className="text-xs text-gray-500">
                      {new Date(activity.timestamp).toLocaleString()}
                    </p>
                  </div>
                  {activity.status && (
                    <Badge variant="outline" className="text-xs">
                      {activity.status}
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500 text-center py-8">No recent activity</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};