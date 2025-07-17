import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  PoundSterling, 
  TrendingUp, 
  CreditCard, 
  Users, 
  Calendar,
  Download,
  AlertCircle,
  FileText,
  Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

interface PlatformMetrics {
  totalRevenue: number;
  monthlyGrowth: number;
  totalRestaurants: number;
  activeRestaurants: number;
  transactionFees: number;
  subscriptionRevenue: number;
}

interface RestaurantFinancials {
  id: string;
  name: string;
  totalRevenue: number;
  monthlyRevenue: number;
  subscriptionPlan: string;
  transactionFees: number;
  orderCount: number;
  lastActivity: string;
}

const FinancialManagement = () => {
  const [selectedRestaurant, setSelectedRestaurant] = useState<string>('all');
  const [reportType, setReportType] = useState<string>('summary');

  // Fetch platform financial metrics
  const { data: platformMetrics, isLoading: metricsLoading } = useQuery({
    queryKey: ['platform-metrics'],
    queryFn: async (): Promise<PlatformMetrics> => {
      // Get all restaurants
      const { data: restaurants, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name, is_active')
        .eq('is_active', true);

      if (restaurantsError) throw restaurantsError;

      // Get user subscriptions for revenue calculation
      const { data: subscriptions, error: subscriptionsError } = await supabase
        .from('user_subscriptions')
        .select('subscription_plan, user_id, enabled_features');

      if (subscriptionsError) throw subscriptionsError;

      // Calculate subscription revenue based on plans
      const subscriptionRevenue = subscriptions.reduce((total, sub) => {
        switch (sub.subscription_plan) {
          case 'beta': return total + 49;
          case 'omega': return total + 119;
          default: return total;
        }
      }, 0);

      // Get orders for transaction fees (1% of all orders)
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('total_amount, created_at')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      if (ordersError) throw ordersError;

      const totalOrderValue = orders.reduce((total, order) => total + (order.total_amount || 0), 0);
      const transactionFees = totalOrderValue * 0.01; // 1% transaction fee

      return {
        totalRevenue: subscriptionRevenue + transactionFees,
        monthlyGrowth: 12.5, // Calculate this based on historical data
        totalRestaurants: restaurants.length,
        activeRestaurants: restaurants.filter(r => r.is_active).length,
        transactionFees,
        subscriptionRevenue
      };
    }
  });

  // Fetch restaurant financial data
  const { data: restaurantFinancials, isLoading: financialsLoading } = useQuery({
    queryKey: ['restaurant-financials'],
    queryFn: async (): Promise<RestaurantFinancials[]> => {
      const { data: restaurants, error: restaurantsError } = await supabase
        .from('restaurants')
        .select(`
          id, 
          name, 
          owner_id,
          updated_at
        `);

      if (restaurantsError) throw restaurantsError;

      const financials = await Promise.all(
        restaurants.map(async (restaurant) => {
          // Get subscription plan for this restaurant owner
          const { data: subscription } = await supabase
            .from('user_subscriptions')
            .select('subscription_plan')
            .eq('user_id', restaurant.owner_id)
            .single();

          // Get orders for this restaurant
          const { data: orders } = await supabase
            .from('orders')
            .select('total_amount, created_at')
            .eq('restaurant_id', restaurant.id);

          const totalRevenue = orders?.reduce((total, order) => total + (order.total_amount || 0), 0) || 0;
          
          // Get monthly revenue (last 30 days)
          const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const monthlyOrders = orders?.filter(order => new Date(order.created_at) >= thirtyDaysAgo) || [];
          const monthlyRevenue = monthlyOrders.reduce((total, order) => total + (order.total_amount || 0), 0);

          const transactionFees = totalRevenue * 0.01; // 1% transaction fee
          
          return {
            id: restaurant.id,
            name: restaurant.name,
            totalRevenue: totalRevenue / 100, // Convert from pence to pounds
            monthlyRevenue: monthlyRevenue / 100,
            subscriptionPlan: subscription?.subscription_plan || 'alpha',
            transactionFees: transactionFees / 100,
            orderCount: orders?.length || 0,
            lastActivity: restaurant.updated_at
          };
        })
      );

      return financials;
    }
  });

  const handleExportReport = () => {
    if (!restaurantFinancials) return;
    
    const csvContent = [
      ['Restaurant', 'Total Revenue (£)', 'Monthly Revenue (£)', 'Subscription Plan', 'Transaction Fees (£)', 'Order Count'],
      ...restaurantFinancials.map(r => [
        r.name,
        r.totalRevenue.toFixed(2),
        r.monthlyRevenue.toFixed(2),
        r.subscriptionPlan,
        r.transactionFees.toFixed(2),
        r.orderCount.toString()
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `platform-financial-report-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    
    toast.success('Report exported successfully');
  };

  const subscriptionBreakdown = [
    { plan: 'Alpha (Free)', count: restaurantFinancials?.filter(r => r.subscriptionPlan === 'alpha').length || 0, revenue: 0, color: 'bg-gray-500' },
    { plan: 'Beta (£49)', count: restaurantFinancials?.filter(r => r.subscriptionPlan === 'beta').length || 0, revenue: (restaurantFinancials?.filter(r => r.subscriptionPlan === 'beta').length || 0) * 49, color: 'bg-blue-500' },
    { plan: 'Omega (£119)', count: restaurantFinancials?.filter(r => r.subscriptionPlan === 'omega').length || 0, revenue: (restaurantFinancials?.filter(r => r.subscriptionPlan === 'omega').length || 0) * 119, color: 'bg-purple-500' }
  ];

  const filteredRestaurants = selectedRestaurant === 'all' 
    ? restaurantFinancials || []
    : restaurantFinancials?.filter(r => r.id === selectedRestaurant) || [];

  if (metricsLoading || financialsLoading) {
    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Financial Management</h1>
            <p className="text-muted-foreground">Loading financial data...</p>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                <div className="h-8 bg-gray-200 rounded w-3/4"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Financial Management</h1>
          <p className="text-muted-foreground">Platform revenue and commission tracking</p>
        </div>
        <div className="flex space-x-2">
          <Button variant="outline" onClick={handleExportReport}>
            <Download className="mr-2 h-4 w-4" />
            Export Report
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <PoundSterling className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{platformMetrics?.totalRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              <TrendingUp className="inline h-3 w-3 mr-1 text-green-500" />
              +{platformMetrics?.monthlyGrowth || 0}% from last month
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Restaurants</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{platformMetrics?.activeRestaurants || 0}</div>
            <p className="text-xs text-muted-foreground">
              of {platformMetrics?.totalRestaurants || 0} total
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Transaction Fees</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{platformMetrics?.transactionFees.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              1% of all transactions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subscription Revenue</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{platformMetrics?.subscriptionRevenue.toFixed(2) || '0.00'}</div>
            <p className="text-xs text-muted-foreground">
              Monthly recurring revenue
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Reporting Controls */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <FileText className="h-5 w-5" />
            <span>Financial Reports</span>
          </CardTitle>
          <CardDescription>Generate detailed financial reports for restaurants</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="restaurant-filter">Restaurant</Label>
              <Select value={selectedRestaurant} onValueChange={setSelectedRestaurant}>
                <SelectTrigger>
                  <SelectValue placeholder="Select restaurant" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Restaurants</SelectItem>
                  {restaurantFinancials?.map((restaurant) => (
                    <SelectItem key={restaurant.id} value={restaurant.id}>
                      {restaurant.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="report-type">Report Type</Label>
              <Select value={reportType} onValueChange={setReportType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select report type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="summary">Financial Summary</SelectItem>
                  <SelectItem value="detailed">Detailed Breakdown</SelectItem>
                  <SelectItem value="commission">Commission Report</SelectItem>
                  <SelectItem value="subscription">Subscription Analysis</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-end">
              <Button onClick={handleExportReport} className="w-full">
                <Download className="mr-2 h-4 w-4" />
                Generate Report
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Revenue Overview</TabsTrigger>
          <TabsTrigger value="restaurants">Restaurant Breakdown</TabsTrigger>
          <TabsTrigger value="subscriptions">Subscriptions</TabsTrigger>
          <TabsTrigger value="commissions">Commissions</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Subscription Plan Breakdown</CardTitle>
                <CardDescription>Revenue distribution by plan</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {subscriptionBreakdown.map((plan, index) => (
                  <div key={index} className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <div className={`w-3 h-3 rounded-full ${plan.color}`} />
                      <span className="font-medium">{plan.plan}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">£{plan.revenue}</div>
                      <div className="text-sm text-muted-foreground">{plan.count} restaurants</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Performing Restaurants</CardTitle>
                <CardDescription>Highest revenue generators</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {restaurantFinancials?.slice(0, 5).sort((a, b) => b.totalRevenue - a.totalRevenue).map((restaurant) => (
                  <div key={restaurant.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium">{restaurant.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {restaurant.orderCount} orders • {restaurant.subscriptionPlan}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">£{restaurant.totalRevenue.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">£{restaurant.transactionFees.toFixed(2)} fees</div>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="restaurants" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Restaurant Financial Performance</CardTitle>
              <CardDescription>
                {selectedRestaurant === 'all' ? 'All restaurants' : restaurantFinancials?.find(r => r.id === selectedRestaurant)?.name || 'Selected restaurant'} financial data
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredRestaurants.map((restaurant) => (
                  <div key={restaurant.id} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center space-x-3">
                        <span className="font-medium text-lg">{restaurant.name}</span>
                        <Badge variant={restaurant.subscriptionPlan === 'omega' ? 'default' : restaurant.subscriptionPlan === 'beta' ? 'secondary' : 'outline'}>
                          {restaurant.subscriptionPlan}
                        </Badge>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">£{restaurant.totalRevenue.toFixed(2)}</div>
                        <div className="text-sm text-muted-foreground">Total Revenue</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
                      <div>
                        <div className="text-sm text-muted-foreground">Monthly Revenue</div>
                        <div className="font-semibold">£{restaurant.monthlyRevenue.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Transaction Fees</div>
                        <div className="font-semibold">£{restaurant.transactionFees.toFixed(2)}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Order Count</div>
                        <div className="font-semibold">{restaurant.orderCount}</div>
                      </div>
                      <div>
                        <div className="text-sm text-muted-foreground">Last Activity</div>
                        <div className="font-semibold">
                          {new Date(restaurant.lastActivity).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="subscriptions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Subscription Revenue Analysis</CardTitle>
              <CardDescription>Monthly recurring revenue breakdown</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {subscriptionBreakdown.map((plan, index) => (
                  <div key={index} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <div className={`w-4 h-4 rounded-full ${plan.color}`} />
                        <div>
                          <div className="font-medium">{plan.plan}</div>
                          <div className="text-sm text-muted-foreground">{plan.count} active restaurants</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-bold text-lg">£{plan.revenue}</div>
                        <div className="text-sm text-muted-foreground">Monthly revenue</div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="commissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Commission Tracking</CardTitle>
              <CardDescription>1% transaction fee breakdown by restaurant</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {restaurantFinancials?.map((restaurant) => (
                  <div key={restaurant.id} className="flex items-center justify-between border-b pb-2 last:border-0">
                    <div>
                      <div className="font-medium">{restaurant.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {restaurant.orderCount} orders • £{restaurant.totalRevenue.toFixed(2)} total revenue
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-bold">£{restaurant.transactionFees.toFixed(2)}</div>
                      <div className="text-sm text-muted-foreground">Commission earned</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default FinancialManagement;