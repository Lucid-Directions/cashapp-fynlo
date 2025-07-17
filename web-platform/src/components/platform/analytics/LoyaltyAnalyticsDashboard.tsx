import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  Gift, 
  Target,
  Calendar,
  DollarSign,
  Activity,
  Award,
  RefreshCw
} from 'lucide-react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AnalyticsData {
  overview: {
    totalMembers: number;
    activeMembers: number;
    totalRevenue: number;
    avgOrderValue: number;
    pointsEarned: number;
    pointsRedeemed: number;
    rewardsClaimed: number;
    repeatPurchaseRate: number;
  };
  trends: Array<{
    date: string;
    members: number;
    revenue: number;
    transactions: number;
    pointsEarned: number;
  }>;
  segmentation: Array<{
    segment: string;
    members: number;
    revenue: number;
    avgSpend: number;
  }>;
  performance: Array<{
    programName: string;
    restaurant: string;
    members: number;
    revenue: number;
    conversionRate: number;
  }>;
}

interface LoyaltyProgram {
  id: string;
  name: string;
  restaurant_id: string;
  restaurants?: { name: string };
}

export const LoyaltyAnalyticsDashboard: React.FC = () => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [selectedProgram, setSelectedProgram] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('30');
  const [analyticsData, setAnalyticsData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchPrograms();
  }, []);

  useEffect(() => {
    if (programs.length > 0) {
      fetchAnalytics();
    }
  }, [programs, selectedProgram, dateRange]);

  const fetchPrograms = async () => {
    try {
      const { data, error } = await supabase
        .from('loyalty_programs')
        .select(`
          id,
          name,
          restaurant_id,
          restaurants(name)
        `)
        .eq('is_active', true);

      if (error) throw error;
      setPrograms(data || []);
    } catch (error) {
      console.error('Error fetching programs:', error);
      toast({
        title: "Error",
        description: "Failed to load loyalty programs",
        variant: "destructive",
      });
    }
  };

  const fetchAnalytics = async () => {
    setLoading(true);
    try {
      // Mock data for demonstration - replace with actual API calls
      const mockData: AnalyticsData = {
        overview: {
          totalMembers: 2847,
          activeMembers: 1923,
          totalRevenue: 45890.50,
          avgOrderValue: 23.85,
          pointsEarned: 125340,
          pointsRedeemed: 89670,
          rewardsClaimed: 892,
          repeatPurchaseRate: 68.5
        },
        trends: Array.from({ length: 30 }, (_, i) => ({
          date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          members: Math.floor(Math.random() * 50) + 20,
          revenue: Math.floor(Math.random() * 2000) + 500,
          transactions: Math.floor(Math.random() * 150) + 50,
          pointsEarned: Math.floor(Math.random() * 5000) + 1000
        })),
        segmentation: [
          { segment: 'VIP (Gold)', members: 127, revenue: 18450, avgSpend: 145.28 },
          { segment: 'Regular (Silver)', members: 543, revenue: 19230, avgSpend: 35.42 },
          { segment: 'New (Bronze)', members: 1253, revenue: 8210, avgSpend: 6.55 },
          { segment: 'Inactive', members: 924, revenue: 0, avgSpend: 0 }
        ],
        performance: programs.slice(0, 5).map(program => ({
          programName: program.name,
          restaurant: program.restaurants?.name || 'Unknown',
          members: Math.floor(Math.random() * 500) + 100,
          revenue: Math.floor(Math.random() * 10000) + 2000,
          conversionRate: Math.floor(Math.random() * 40) + 20
        }))
      };

      setAnalyticsData(mockData);
    } catch (error) {
      console.error('Error fetching analytics:', error);
      toast({
        title: "Error",
        description: "Failed to load analytics data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => `£${amount.toLocaleString()}`;
  const formatNumber = (num: number) => num.toLocaleString();

  const COLORS = ['#8884d8', '#82ca9d', '#ffc658', '#ff7c7c'];

  if (loading || !analyticsData) {
    return <div className="p-6">Loading analytics...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header & Controls */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Loyalty Analytics</h1>
          <p className="text-muted-foreground">Track performance and customer engagement</p>
        </div>
        <div className="flex space-x-4">
          <Select value={selectedProgram} onValueChange={setSelectedProgram}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder="Select program" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Programs</SelectItem>
              {programs.map(program => (
                <SelectItem key={program.id} value={program.id}>
                  {program.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="7">Last 7 days</SelectItem>
              <SelectItem value="30">Last 30 days</SelectItem>
              <SelectItem value="90">Last 90 days</SelectItem>
              <SelectItem value="365">Last year</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={fetchAnalytics} variant="outline" size="sm">
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Members</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analyticsData.overview.totalMembers)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analyticsData.overview.activeMembers)} active
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(analyticsData.overview.totalRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Avg: {formatCurrency(analyticsData.overview.avgOrderValue)}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Points Activity</CardTitle>
            <Gift className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(analyticsData.overview.pointsEarned)}</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analyticsData.overview.pointsRedeemed)} redeemed
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Engagement</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{analyticsData.overview.repeatPurchaseRate}%</div>
            <p className="text-xs text-muted-foreground">
              {formatNumber(analyticsData.overview.rewardsClaimed)} rewards claimed
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Analytics Tabs */}
      <Tabs defaultValue="trends" className="space-y-4">
        <TabsList>
          <TabsTrigger value="trends">Trends</TabsTrigger>
          <TabsTrigger value="segmentation">Customer Segments</TabsTrigger>
          <TabsTrigger value="performance">Program Performance</TabsTrigger>
          <TabsTrigger value="cohorts">Cohort Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="trends" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Revenue Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={analyticsData.trends}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="revenue" stroke="#8884d8" strokeWidth={2} />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Member Growth</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={analyticsData.trends.slice(-7)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="members" fill="#82ca9d" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="segmentation" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Customer Segments</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={analyticsData.segmentation}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ segment, percent }) => `${segment} (${(percent * 100).toFixed(0)}%)`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="members"
                    >
                      {analyticsData.segmentation.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Segment Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {analyticsData.segmentation.map((segment, index) => (
                    <div key={segment.segment} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: COLORS[index % COLORS.length] }}
                        />
                        <div>
                          <div className="font-medium">{segment.segment}</div>
                          <div className="text-sm text-muted-foreground">
                            {formatNumber(segment.members)} members
                          </div>
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-medium">{formatCurrency(segment.revenue)}</div>
                        <div className="text-sm text-muted-foreground">
                          Avg: {formatCurrency(segment.avgSpend)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Program Performance Comparison</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {analyticsData.performance.map((program) => (
                  <div key={program.programName} className="p-4 border rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h3 className="font-medium">{program.programName}</h3>
                        <p className="text-sm text-muted-foreground">{program.restaurant}</p>
                      </div>
                      <Badge variant="secondary">{program.conversionRate}% conversion</Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <div className="text-muted-foreground">Members</div>
                        <div className="font-medium">{formatNumber(program.members)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Revenue</div>
                        <div className="font-medium">{formatCurrency(program.revenue)}</div>
                      </div>
                      <div>
                        <div className="text-muted-foreground">Avg per Member</div>
                        <div className="font-medium">
                          {formatCurrency(program.revenue / program.members)}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cohorts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cohort Analysis</CardTitle>
              <p className="text-sm text-muted-foreground">
                Track customer retention over time by signup cohort
              </p>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                Cohort analysis coming soon. This will show customer retention rates
                by signup month and help identify the most valuable customer segments.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};