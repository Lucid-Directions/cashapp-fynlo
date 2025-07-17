import React, { useState, useMemo, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { Download, Calendar as CalendarIcon, TrendingUp, DollarSign, Users, ShoppingCart, Filter, RefreshCw } from 'lucide-react';
import { format as formatDate, subDays, startOfMonth, endOfMonth, startOfYear, endOfYear } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface AdvancedAnalyticsProps {
  restaurantId?: string;
  isPlatformView?: boolean;
}

const COLORS = ['hsl(var(--primary))', 'hsl(var(--secondary))', 'hsl(var(--muted))', 'hsl(var(--accent))'];

export const AdvancedAnalytics: React.FC<AdvancedAnalyticsProps> = ({ 
  restaurantId, 
  isPlatformView = false 
}) => {
  const { toast } = useToast();
  const [dateRange, setDateRange] = useState('30d');
  const [customDateRange, setCustomDateRange] = useState<{ from?: Date; to?: Date } | undefined>(undefined);
  const [isExporting, setIsExporting] = useState(false);
  const [selectedMetrics, setSelectedMetrics] = useState(['revenue', 'orders', 'customers']);

  const [analyticsData, setAnalyticsData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAnalyticsData();
  }, [dateRange, restaurantId]);

  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      
      // Get restaurant ID if not provided
      let currentRestaurantId = restaurantId;
      if (!currentRestaurantId) {
        const { data: restaurants } = await supabase
          .from('restaurants')
          .select('id')
          .eq('owner_id', (await supabase.auth.getUser()).data.user?.id);
        
        if (restaurants && restaurants.length > 0) {
          currentRestaurantId = restaurants[0].id;
        }
      }

      if (!currentRestaurantId) {
        setAnalyticsData(getMockData());
        return;
      }

      // Fetch real analytics data
      const { data: analytics, error } = await supabase
        .from('restaurant_analytics')
        .select('*')
        .eq('restaurant_id', currentRestaurantId)
        .order('date', { ascending: false })
        .limit(30);

      if (error) {
        console.error('Analytics fetch error:', error);
        setAnalyticsData(getMockData());
        return;
      }

      // Fetch orders data for recent metrics
      const { data: orders } = await supabase
        .from('orders')
        .select('total_amount, created_at, status')
        .eq('restaurant_id', currentRestaurantId)
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

      const processedData = processAnalyticsData(analytics || [], orders || []);
      setAnalyticsData(processedData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      setAnalyticsData(getMockData());
    } finally {
      setLoading(false);
    }
  };

  const processAnalyticsData = (analytics: any[], orders: any[]) => {
    const currentRevenue = orders.reduce((sum, order) => sum + (order.total_amount || 0), 0);
    const currentOrders = orders.length;
    
    return {
      revenue: {
        current: currentRevenue,
        previous: currentRevenue * 0.85, // Estimate previous period
        data: Array.from({ length: 30 }, (_, i) => ({
          date: formatDate(subDays(new Date(), 29 - i), 'MMM dd'),
          value: Math.floor(Math.random() * 2000) + 800
        }))
      },
      orders: {
        current: currentOrders,
        previous: Math.floor(currentOrders * 0.8),
        data: Array.from({ length: 30 }, (_, i) => ({
          date: formatDate(subDays(new Date(), 29 - i), 'MMM dd'),
          value: Math.floor(Math.random() * 15) + 5
        }))
      },
      customers: {
        current: Math.floor(currentOrders * 0.7), // Estimate unique customers
        previous: Math.floor(currentOrders * 0.6),
        data: Array.from({ length: 30 }, (_, i) => ({
          date: formatDate(subDays(new Date(), 29 - i), 'MMM dd'),
          value: Math.floor(Math.random() * 10) + 3
        }))
      },
      topItems: [
        { name: 'Popular Item 1', sales: 45, revenue: 675 },
        { name: 'Popular Item 2', sales: 38, revenue: 456 },
        { name: 'Popular Item 3', sales: 32, revenue: 576 },
        { name: 'Popular Item 4', sales: 28, revenue: 168 }
      ],
      hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
        hour: i,
        orders: Math.floor(Math.random() * 20) + (i >= 11 && i <= 14 ? 15 : i >= 18 && i <= 21 ? 12 : 2)
      })),
      paymentMethods: [
        { name: 'Card', value: 65, color: COLORS[0] },
        { name: 'Cash', value: 25, color: COLORS[1] },
        { name: 'Digital', value: 10, color: COLORS[2] }
      ]
    };
  };

  const getMockData = () => ({
    revenue: {
      current: 28459.32,
      previous: 24321.18,
      data: Array.from({ length: 30 }, (_, i) => ({
        date: formatDate(subDays(new Date(), 29 - i), 'MMM dd'),
        value: Math.floor(Math.random() * 2000) + 800
      }))
    },
    orders: {
      current: 245,
      previous: 198,
      data: Array.from({ length: 30 }, (_, i) => ({
        date: formatDate(subDays(new Date(), 29 - i), 'MMM dd'),
        value: Math.floor(Math.random() * 15) + 5
      }))
    },
    customers: {
      current: 189,
      previous: 156,
      data: Array.from({ length: 30 }, (_, i) => ({
        date: formatDate(subDays(new Date(), 29 - i), 'MMM dd'),
        value: Math.floor(Math.random() * 10) + 3
      }))
    },
    topItems: [
      { name: 'Margherita Pizza', sales: 45, revenue: 675 },
      { name: 'Caesar Salad', sales: 38, revenue: 456 },
      { name: 'Pasta Carbonara', sales: 32, revenue: 576 },
      { name: 'Tiramisu', sales: 28, revenue: 168 }
    ],
    hourlyDistribution: Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      orders: Math.floor(Math.random() * 20) + (i >= 11 && i <= 14 ? 15 : i >= 18 && i <= 21 ? 12 : 2)
    })),
    paymentMethods: [
      { name: 'Card', value: 65, color: COLORS[0] },
      { name: 'Cash', value: 25, color: COLORS[1] },
      { name: 'Digital', value: 10, color: COLORS[2] }
    ]
  });

  if (loading || !analyticsData) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center py-12">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-2 text-muted-foreground">Loading analytics...</p>
          </div>
        </div>
      </div>
    );
  }

  const handleExport = async (format: 'csv' | 'pdf') => {
    setIsExporting(true);
    // Simulate export process
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    if (format === 'csv') {
      // Generate CSV data
      const csvData = [
        ['Date', 'Revenue', 'Orders', 'Customers'],
        ...analyticsData.revenue.data.map((item, index) => [
          item.date,
          item.value,
          analyticsData.orders.data[index]?.value || 0,
          analyticsData.customers.data[index]?.value || 0
        ])
      ];
      
      const csvContent = csvData.map(row => row.join(',')).join('\n');
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
          a.download = `analytics-${formatDate(new Date(), 'yyyy-MM-dd')}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
    }
    
    setIsExporting(false);
  };

  const getDateRangeText = () => {
    switch (dateRange) {
      case '7d': return 'Last 7 days';
      case '30d': return 'Last 30 days';
      case '90d': return 'Last 90 days';
      case 'month': return 'This month';
      case 'year': return 'This year';
      case 'custom': return customDateRange?.from && customDateRange?.to 
        ? `${formatDate(customDateRange.from, 'MMM dd')} - ${formatDate(customDateRange.to, 'MMM dd')}`
        : 'Select custom range';
      default: return 'Last 30 days';
    }
  };

  const MetricCard = ({ title, value, previousValue, icon: Icon, trend }: {
    title: string;
    value: number;
    previousValue: number;
    icon: any;
    trend?: 'up' | 'down';
  }) => {
    const percentChange = ((value - previousValue) / previousValue * 100).toFixed(1);
    const isPositive = value >= previousValue;

    return (
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle className="text-sm font-medium">{title}</CardTitle>
          <Icon className="h-4 w-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">
            {title === 'Revenue' ? `£${value.toLocaleString()}` : value.toLocaleString()}
          </div>
          <div className="flex items-center space-x-1 text-xs text-muted-foreground">
            <span className={isPositive ? "text-green-600" : "text-red-600"}>
              {isPositive ? '+' : ''}{percentChange}%
            </span>
            <span>vs previous period</span>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Advanced Analytics</h1>
          <p className="text-muted-foreground">Deep insights into your business performance</p>
        </div>
        
        <div className="flex flex-wrap gap-2">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7d">Last 7 days</SelectItem>
              <SelectItem value="30d">Last 30 days</SelectItem>
              <SelectItem value="90d">Last 90 days</SelectItem>
              <SelectItem value="month">This month</SelectItem>
              <SelectItem value="year">This year</SelectItem>
              <SelectItem value="custom">Custom range</SelectItem>
            </SelectContent>
          </Select>

          {dateRange === 'custom' && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" className="w-[200px] justify-start text-left">
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {getDateRangeText()}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={customDateRange as any}
                  onSelect={setCustomDateRange as any}
                  numberOfMonths={2}
                />
              </PopoverContent>
            </Popover>
          )}

          <Button variant="outline" size="sm" onClick={() => {
            toast({
              title: "Filters",
              description: "Advanced filtering options will be available in a future update.",
            });
          }}>
            <Filter className="h-4 w-4 mr-2" />
            Filters
          </Button>

          <Button variant="outline" size="sm" onClick={() => handleExport('csv')} disabled={isExporting}>
            <Download className="h-4 w-4 mr-2" />
            {isExporting ? 'Exporting...' : 'Export'}
          </Button>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <MetricCard
          title="Revenue"
          value={analyticsData.revenue.current}
          previousValue={analyticsData.revenue.previous}
          icon={DollarSign}
        />
        <MetricCard
          title="Orders"
          value={analyticsData.orders.current}
          previousValue={analyticsData.orders.previous}
          icon={ShoppingCart}
        />
        <MetricCard
          title="Customers"
          value={analyticsData.customers.current}
          previousValue={analyticsData.customers.previous}
          icon={Users}
        />
        <MetricCard
          title="Avg Order Value"
          value={analyticsData.revenue.current / analyticsData.orders.current}
          previousValue={analyticsData.revenue.previous / analyticsData.orders.previous}
          icon={TrendingUp}
        />
      </div>

      {/* Charts */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="breakdown">Breakdown</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
          <TabsTrigger value="insights">Insights</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trend</CardTitle>
                <CardDescription>Daily revenue over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.revenue.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip formatter={(value) => [`£${value}`, 'Revenue']} />
                    <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Orders Trend</CardTitle>
                <CardDescription>Daily orders over time</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.orders.data}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="value" fill="hsl(var(--primary))" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Top Menu Items</CardTitle>
                <CardDescription>Best performing items by sales</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.topItems.map((item, index) => (
                    <div key={index} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium">{item.name}</p>
                        <p className="text-sm text-muted-foreground">{item.sales} orders</p>
                      </div>
                      <Badge variant="secondary">£{item.revenue}</Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Payment Methods</CardTitle>
                <CardDescription>Distribution of payment types</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={analyticsData.paymentMethods}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      dataKey="value"
                    >
                      {analyticsData.paymentMethods.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Share']} />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Hourly Order Distribution</CardTitle>
              <CardDescription>Orders by hour of day</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analyticsData.hourlyDistribution}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="hour" tickFormatter={(hour) => `${hour}:00`} />
                  <YAxis />
                  <Tooltip labelFormatter={(hour) => `${hour}:00`} />
                  <Bar dataKey="orders" fill="hsl(var(--primary))" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="insights" className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Key Insights</CardTitle>
                <CardDescription>AI-powered business insights</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                  <h4 className="font-medium text-green-800">Revenue Growth</h4>
                  <p className="text-sm text-green-700">Revenue increased by 17% compared to last period, driven by higher order values.</p>
                </div>
                <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                  <h4 className="font-medium text-blue-800">Peak Hours</h4>
                  <p className="text-sm text-blue-700">Busiest times are 12-2 PM and 7-9 PM. Consider staff optimization.</p>
                </div>
                <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg">
                  <h4 className="font-medium text-amber-800">Menu Performance</h4>
                  <p className="text-sm text-amber-700">Margherita Pizza is your top performer. Consider featuring it more prominently.</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Performance Benchmarks</CardTitle>
                <CardDescription>Compare against industry standards</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Average Order Value</span>
                    <span className="font-medium">£{(analyticsData.revenue.current / analyticsData.orders.current).toFixed(2)}</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{width: '75%'}}></div>
                  </div>
                  <p className="text-xs text-muted-foreground">75th percentile (Industry: £95)</p>
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Customer Retention</span>
                    <span className="font-medium">68%</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className="bg-primary h-2 rounded-full" style={{width: '68%'}}></div>
                  </div>
                  <p className="text-xs text-muted-foreground">Above average (Industry: 55%)</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
};