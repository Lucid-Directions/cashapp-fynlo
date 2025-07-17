import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Building2, 
  TrendingUp, 
  Users, 
  PoundSterling,
  Activity,
  AlertCircle,
  Bell,
  Settings,
  BarChart3,
  Wifi,
  WifiOff
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { AdvancedAnalytics } from '../../dashboard/AdvancedAnalytics';

interface PlatformMetrics {
  totalRestaurants: number;
  activeRestaurants: number;
  totalRevenue: number;
  totalOrders: number;
  newSignupsThisMonth: number;
  activeOrdersCount: number;
  platformHealth: {
    apiUptime: number;
    averageResponseTime: number;
    errorRate: number;
  };
}

// 👤 PLATFORM OWNER DASHBOARD - Overview of ALL restaurants
export const PlatformOverview = () => {
  const [metrics, setMetrics] = useState<PlatformMetrics>({
    totalRestaurants: 0,
    activeRestaurants: 0,
    totalRevenue: 0,
    totalOrders: 0,
    newSignupsThisMonth: 0,
    activeOrdersCount: 0,
    platformHealth: {
      apiUptime: 99.9,
      averageResponseTime: 120,
      errorRate: 0.1
    }
  });
  const [loading, setLoading] = useState(true);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected' | 'connecting'>('connecting');
  const { toast } = useToast();

  useEffect(() => {
    fetchPlatformMetrics();
    fetchRecentActivity();
    
    // Set up real-time subscription for platform updates
    const channel = supabase
      .channel('platform-overview')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'restaurants'
        },
        (payload) => {
          console.log('Platform restaurant update:', payload);
          fetchPlatformMetrics();
          fetchRecentActivity();
          
          if (payload.eventType === 'INSERT') {
            toast({
              title: "New Restaurant Joined!",
              description: `${payload.new.name} has joined the platform`,
            });
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orders'
        },
        (payload) => {
          console.log('Platform order update:', payload);
          fetchPlatformMetrics();
          fetchRecentActivity();
        }
      )
      .subscribe((status) => {
        console.log('Platform subscription status:', status);
        setConnectionStatus(status === 'SUBSCRIBED' ? 'connected' : 'disconnected');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPlatformMetrics = async () => {
    try {
      // Get restaurant metrics
      const { data: restaurants } = await supabase
        .from('restaurants')
        .select('id, is_active, created_at');

      // Get order metrics
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, status, created_at');

      // Get this month's signups
      const startOfMonth = new Date();
      startOfMonth.setDate(1);
      startOfMonth.setHours(0, 0, 0, 0);

      const newSignups = restaurants?.filter(r => 
        new Date(r.created_at) >= startOfMonth
      ).length || 0;

      // Calculate metrics
      const totalRestaurants = restaurants?.length || 0;
      const activeRestaurants = restaurants?.filter(r => r.is_active).length || 0;
      const totalRevenue = orders?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
      const totalOrders = orders?.length || 0;
      const activeOrdersCount = orders?.filter(order => 
        !['completed', 'cancelled', 'delivered'].includes(order.status)
      ).length || 0;

      setMetrics({
        totalRestaurants,
        activeRestaurants,
        totalRevenue,
        totalOrders,
        newSignupsThisMonth: newSignups,
        activeOrdersCount,
        platformHealth: {
          apiUptime: 99.9, // Mock data - in real app would come from monitoring
          averageResponseTime: 120,
          errorRate: 0.1
        }
      });

    } catch (error) {
      console.error('Error fetching platform metrics:', error);
      toast({
        title: "Error",
        description: "Failed to load platform metrics",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchRecentActivity = async () => {
    try {
      // Get recent restaurant signups
      const { data: recentRestaurants } = await supabase
        .from('restaurants')
        .select('name, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

      // Get recent orders
      const { data: recentOrders } = await supabase
        .from('orders')
        .select(`
          order_number,
          total_amount,
          created_at,
          restaurants (name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Combine and format activity
      const activity = [
        ...(recentRestaurants?.map(r => ({
          type: 'signup',
          description: `${r.name} joined the platform`,
          timestamp: r.created_at
        })) || []),
        ...(recentOrders?.map(o => ({
          type: 'order',
          description: `New order #${o.order_number} (£${o.total_amount?.toFixed(2)}) at ${o.restaurants?.name}`,
          timestamp: o.created_at
        })) || [])
      ].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
       .slice(0, 10);

      setRecentActivity(activity);
    } catch (error) {
      console.error('Error fetching recent activity:', error);
    }
  };

  const formatCurrency = (amount: number) => `£${amount.toLocaleString()}`;
  const formatTimeAgo = (dateString: string) => {
    const now = new Date();
    const date = new Date(dateString);
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${Math.floor(diffHours / 24)}d ago`;
  };

  if (loading) {
    return <div className="p-6">Loading platform overview...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold">Platform Overview</h1>
            <p className="text-muted-foreground">
              Real-time monitoring of all restaurants and platform performance
            </p>
          </div>
          <Badge 
            variant={connectionStatus === 'connected' ? 'default' : 'destructive'} 
            className="flex items-center gap-1"
          >
            {connectionStatus === 'connected' ? (
              <><Wifi className="w-3 h-3" /> Live Updates</>
            ) : (
              <><WifiOff className="w-3 h-3" /> Disconnected</>
            )}
          </Badge>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline">
            <BarChart3 className="mr-2 h-4 w-4" />
            View Analytics
          </Button>
          <Button>
            <Activity className="mr-2 h-4 w-4" />
            System Health
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Restaurants</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.totalRestaurants}</div>
            <p className="text-xs text-muted-foreground">
              {metrics.activeRestaurants} active ({((metrics.activeRestaurants / metrics.totalRestaurants) * 100).toFixed(1)}%)
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Platform Revenue</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {formatCurrency(metrics.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              {metrics.totalOrders} orders total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Orders</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {metrics.activeOrdersCount}
            </div>
            <p className="text-xs text-muted-foreground">
              Across all restaurants
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">New Signups</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{metrics.newSignupsThisMonth}</div>
            <p className="text-xs text-muted-foreground">
              This month
            </p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Platform Health */}
        <Card>
          <CardHeader>
            <CardTitle>Platform Health</CardTitle>
            <CardDescription>
              Real-time system performance metrics
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">API Uptime</p>
                  <p className="text-2xl font-bold text-green-600">
                    {metrics.platformHealth.apiUptime}%
                  </p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Excellent
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Avg Response Time</p>
                  <p className="text-2xl font-bold">
                    {metrics.platformHealth.averageResponseTime}ms
                  </p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  Good
                </Badge>
              </div>
              
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <p className="text-sm font-medium">Error Rate</p>
                  <p className="text-2xl font-bold">
                    {metrics.platformHealth.errorRate}%
                  </p>
                </div>
                <Badge variant="secondary" className="bg-green-100 text-green-800">
                  Low
                </Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4" />
              Recent Activity
            </CardTitle>
            <CardDescription>
              Latest platform events and updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {recentActivity.length > 0 ? (
                recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start space-x-3 p-2 hover:bg-gray-50 rounded-lg">
                    <div className={`w-2 h-2 rounded-full mt-2 ${
                      activity.type === 'signup' ? 'bg-blue-500' : 'bg-green-500'
                    }`} />
                    <div className="flex-1">
                      <p className="text-sm">{activity.description}</p>
                      <p className="text-xs text-gray-500">{formatTimeAgo(activity.timestamp)}</p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-sm text-gray-500">No recent activity</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
          <CardDescription>
            Common platform management tasks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Building2 className="h-6 w-6" />
              <span>Restaurant Management</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <TrendingUp className="h-6 w-6" />
              <span>Platform Analytics</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Users className="h-6 w-6" />
              <span>User Management</span>
            </Button>
            <Button variant="outline" className="h-auto p-4 flex flex-col items-center gap-2">
              <Settings className="h-6 w-6" />
              <span>Platform Settings</span>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};