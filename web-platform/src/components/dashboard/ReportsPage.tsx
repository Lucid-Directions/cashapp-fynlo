import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar, Download, FileText, TrendingUp, Users, Store } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ReportData {
  totalRevenue: number;
  totalOrders: number;
  totalRestaurants: number;
  totalStaff: number;
  averageOrderValue: number;
  topPerformingRestaurants: Array<{
    name: string;
    revenue: number;
    orders: number;
  }>;
}

export const ReportsPage = () => {
  const { toast } = useToast();
  const [reportData, setReportData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeRange, setTimeRange] = useState('all');

  useEffect(() => {
    fetchReportData();
  }, [timeRange]);

  const fetchReportData = async () => {
    try {
      setLoading(true);

      // Fetch restaurants
      const { data: restaurants, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name, is_active');

      if (restaurantsError) throw restaurantsError;

      // Fetch orders with revenue
      let ordersQuery = supabase
        .from('orders')
        .select('total_amount, restaurant_id, created_at')
        .order('created_at', { ascending: false });

      // Apply time filter if needed
      if (timeRange !== 'all') {
        const now = new Date();
        let startDate = new Date();
        
        switch (timeRange) {
          case '7d':
            startDate.setDate(now.getDate() - 7);
            break;
          case '30d':
            startDate.setDate(now.getDate() - 30);
            break;
          case '90d':
            startDate.setDate(now.getDate() - 90);
            break;
        }
        
        ordersQuery = ordersQuery.gte('created_at', startDate.toISOString());
      }

      const { data: orders, error: ordersError } = await ordersQuery;
      if (ordersError) throw ordersError;

      // Fetch staff
      const { data: staff, error: staffError } = await supabase
        .from('staff_members')
        .select('id, is_active');

      if (staffError) throw staffError;

      // Calculate metrics
      const totalRevenue = orders?.reduce((sum, order) => sum + Number(order.total_amount), 0) || 0;
      const totalOrders = orders?.length || 0;
      const averageOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;

      // Calculate top performing restaurants
      const restaurantRevenue: Record<string, { revenue: number; orders: number; name: string }> = {};
      
      orders?.forEach(order => {
        if (!restaurantRevenue[order.restaurant_id]) {
          const restaurant = restaurants?.find(r => r.id === order.restaurant_id);
          restaurantRevenue[order.restaurant_id] = {
            revenue: 0,
            orders: 0,
            name: restaurant?.name || 'Unknown Restaurant'
          };
        }
        restaurantRevenue[order.restaurant_id].revenue += Number(order.total_amount);
        restaurantRevenue[order.restaurant_id].orders += 1;
      });

      const topPerformingRestaurants = Object.values(restaurantRevenue)
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setReportData({
        totalRevenue,
        totalOrders,
        totalRestaurants: restaurants?.length || 0,
        totalStaff: staff?.filter(s => s.is_active).length || 0,
        averageOrderValue,
        topPerformingRestaurants,
      });
    } catch (error) {
      console.error('Error fetching report data:', error);
      toast({
        title: "Error",
        description: "Failed to load report data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const exportReport = () => {
    toast({
      title: "Export Started",
      description: "Your report is being generated and will be downloaded shortly.",
    });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Reports</h1>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Generate and view detailed platform reports</p>
        </div>
        <div className="flex space-x-2">
          <Select value={timeRange} onValueChange={setTimeRange}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="Time range" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Time</SelectItem>
              <SelectItem value="7d">Last 7 Days</SelectItem>
              <SelectItem value="30d">Last 30 Days</SelectItem>
              <SelectItem value="90d">Last 90 Days</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={exportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{reportData?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              {timeRange === 'all' ? 'All time' : `Last ${timeRange}`}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Orders</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.totalOrders || 0}</div>
            <p className="text-xs text-muted-foreground">
              Avg: £{reportData?.averageOrderValue.toFixed(2) || '0.00'} per order
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Restaurants</CardTitle>
            <Store className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.totalRestaurants || 0}</div>
            <p className="text-xs text-muted-foreground">
              Registered locations
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Staff</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{reportData?.totalStaff || 0}</div>
            <p className="text-xs text-muted-foreground">
              Platform-wide staff
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Top Performing Restaurants */}
      <Card>
        <CardHeader>
          <CardTitle>Top Performing Restaurants</CardTitle>
          <CardDescription>
            {reportData?.topPerformingRestaurants.length || 0 > 0 
              ? `Highest revenue generating locations ${timeRange === 'all' ? 'all time' : `in the last ${timeRange}`}`
              : "No restaurant performance data available yet. Data will appear here once orders are placed."
            }
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!reportData?.topPerformingRestaurants.length ? (
            <div className="text-center py-8">
              <TrendingUp className="mx-auto h-12 w-12 text-muted-foreground" />
              <h3 className="mt-2 text-sm font-semibold">No performance data</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Restaurant performance metrics will appear here once orders start coming in.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {reportData.topPerformingRestaurants.map((restaurant, index) => (
                <div key={restaurant.name} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center w-8 h-8 bg-primary/10 rounded-full">
                      <span className="text-sm font-bold text-primary">#{index + 1}</span>
                    </div>
                    <div>
                      <h4 className="font-medium">{restaurant.name}</h4>
                      <p className="text-sm text-muted-foreground">
                        {restaurant.orders} orders
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-bold">£{restaurant.revenue.toFixed(2)}</div>
                    <div className="text-sm text-muted-foreground">
                      £{(restaurant.revenue / restaurant.orders).toFixed(2)} avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Additional Report Sections */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
            <CardDescription>Generate specific reports</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="outline" className="w-full justify-start">
              <Calendar className="mr-2 h-4 w-4" />
              Financial Summary Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Users className="mr-2 h-4 w-4" />
              Staff Performance Report
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Store className="mr-2 h-4 w-4" />
              Location Analysis Report
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Data Status</CardTitle>
            <CardDescription>Platform data availability</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between">
              <span className="text-sm">Orders Data</span>
              <span className={`text-sm ${reportData?.totalOrders ? 'text-green-600' : 'text-muted-foreground'}`}>
                {reportData?.totalOrders ? `${reportData.totalOrders} records` : 'No data'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Restaurant Data</span>
              <span className={`text-sm ${reportData?.totalRestaurants ? 'text-green-600' : 'text-muted-foreground'}`}>
                {reportData?.totalRestaurants ? `${reportData.totalRestaurants} records` : 'No data'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-sm">Staff Data</span>
              <span className={`text-sm ${reportData?.totalStaff ? 'text-green-600' : 'text-muted-foreground'}`}>
                {reportData?.totalStaff ? `${reportData.totalStaff} records` : 'No data'}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};