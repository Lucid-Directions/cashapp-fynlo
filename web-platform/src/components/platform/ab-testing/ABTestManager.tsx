import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  TestTube, 
  Play, 
  Pause, 
  Square, 
  TrendingUp, 
  Users, 
  Target,
  Settings,
  BarChart3,
  Plus,
  Eye,
  Edit
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ABTest {
  id: string;
  name: string;
  description?: string;
  program_id: string;
  test_type: string;
  status: string;
  control_settings: any;
  variant_settings: any;
  traffic_split: number;
  start_date?: string;
  end_date?: string;
  primary_metric: string;
  secondary_metrics: string[];
  created_at: string;
  programs?: { name: string };
}

interface TestResults {
  control: {
    participants: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    confidence: number;
  };
  variant: {
    participants: number;
    conversions: number;
    conversionRate: number;
    revenue: number;
    confidence: number;
  };
  improvement: number;
  significance: 'significant' | 'not_significant' | 'insufficient_data';
}

export const ABTestManager: React.FC = () => {
  const [tests, setTests] = useState<ABTest[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedTest, setSelectedTest] = useState<ABTest | null>(null);
  const [testResults, setTestResults] = useState<Record<string, TestResults>>({});
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_id: '',
    test_type: 'program_variant',
    primary_metric: 'revenue',
    secondary_metrics: [] as string[],
    traffic_split: 50,
    control_settings: {},
    variant_settings: {}
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch A/B tests
      const { data: testsData, error: testsError } = await supabase
        .from('loyalty_ab_tests')
        .select(`
          *,
          programs:loyalty_programs(name)
        `)
        .order('created_at', { ascending: false });

      if (testsError) throw testsError;

      // Fetch loyalty programs
      const { data: programsData, error: programsError } = await supabase
        .from('loyalty_programs')
        .select('id, name, restaurant_id')
        .eq('is_active', true);

      if (programsError) throw programsError;

      setTests(testsData || []);
      setPrograms(programsData || []);

      // Generate mock results for demo
      const mockResults: Record<string, TestResults> = {};
      (testsData || []).forEach(test => {
        mockResults[test.id] = {
          control: {
            participants: Math.floor(Math.random() * 500) + 200,
            conversions: Math.floor(Math.random() * 50) + 20,
            conversionRate: Math.random() * 15 + 5,
            revenue: Math.floor(Math.random() * 5000) + 2000,
            confidence: Math.random() * 20 + 80
          },
          variant: {
            participants: Math.floor(Math.random() * 500) + 200,
            conversions: Math.floor(Math.random() * 60) + 25,
            conversionRate: Math.random() * 20 + 8,
            revenue: Math.floor(Math.random() * 6000) + 2500,
            confidence: Math.random() * 20 + 80
          },
          improvement: Math.random() * 30 - 10,
          significance: Math.random() > 0.3 ? 'significant' : 'not_significant'
        };
      });
      setTestResults(mockResults);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load A/B tests",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createABTest = async () => {
    if (!formData.name.trim() || !formData.program_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('loyalty_ab_tests')
        .insert({
          name: formData.name,
          description: formData.description,
          program_id: formData.program_id,
          test_type: formData.test_type,
          primary_metric: formData.primary_metric,
          secondary_metrics: formData.secondary_metrics,
          traffic_split: formData.traffic_split,
          control_settings: formData.control_settings,
          variant_settings: formData.variant_settings,
          status: 'draft'
        });

      if (error) throw error;

      await fetchData();
      setIsCreateDialogOpen(false);
      resetForm();
      
      toast({
        title: "Success",
        description: "A/B test created successfully",
      });
    } catch (error) {
      console.error('Error creating A/B test:', error);
      toast({
        title: "Error",
        description: "Failed to create A/B test",
        variant: "destructive",
      });
    }
  };

  const updateTestStatus = async (testId: string, status: string) => {
    try {
      const updates: any = { status };
      
      if (status === 'active' && !tests.find(t => t.id === testId)?.start_date) {
        updates.start_date = new Date().toISOString();
      }
      
      if (status === 'completed') {
        updates.end_date = new Date().toISOString();
      }

      const { error } = await supabase
        .from('loyalty_ab_tests')
        .update(updates)
        .eq('id', testId);

      if (error) throw error;

      await fetchData();
      toast({
        title: "Success",
        description: `Test ${status === 'active' ? 'started' : status === 'paused' ? 'paused' : 'completed'}`,
      });
    } catch (error) {
      console.error('Error updating test status:', error);
      toast({
        title: "Error",
        description: "Failed to update test status",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      program_id: '',
      test_type: 'program_variant',
      primary_metric: 'revenue',
      secondary_metrics: [],
      traffic_split: 50,
      control_settings: {},
      variant_settings: {}
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-green-500';
      case 'paused': return 'bg-yellow-500';
      case 'completed': return 'bg-blue-500';
      default: return 'bg-gray-500';
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');

  if (loading) {
    return <div className="p-6">Loading A/B tests...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">A/B Testing</h1>
          <p className="text-muted-foreground">Test and optimize your loyalty programs</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create A/B Test
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New A/B Test</DialogTitle>
            </DialogHeader>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="name">Test Name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                    placeholder="e.g., Reward Structure Test"
                  />
                </div>

                <div>
                  <Label htmlFor="description">Description</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                    placeholder="Describe what you're testing..."
                  />
                </div>

                <div>
                  <Label htmlFor="program">Loyalty Program</Label>
                  <Select 
                    value={formData.program_id} 
                    onValueChange={(value) => setFormData(prev => ({...prev, program_id: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select program" />
                    </SelectTrigger>
                    <SelectContent>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="test_type">Test Type</Label>
                  <Select 
                    value={formData.test_type} 
                    onValueChange={(value) => setFormData(prev => ({...prev, test_type: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="program_variant">Program Structure</SelectItem>
                      <SelectItem value="reward_structure">Reward Tiers</SelectItem>
                      <SelectItem value="communication">Communication Style</SelectItem>
                      <SelectItem value="point_values">Point Values</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="primary_metric">Primary Success Metric</Label>
                  <Select 
                    value={formData.primary_metric} 
                    onValueChange={(value) => setFormData(prev => ({...prev, primary_metric: value}))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue">Revenue per Customer</SelectItem>
                      <SelectItem value="engagement">Engagement Rate</SelectItem>
                      <SelectItem value="retention">Customer Retention</SelectItem>
                      <SelectItem value="frequency">Purchase Frequency</SelectItem>
                      <SelectItem value="redemption">Redemption Rate</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Traffic Split</Label>
                  <div className="mt-2">
                    <Slider
                      value={[formData.traffic_split]}
                      onValueChange={(value) => setFormData(prev => ({...prev, traffic_split: value[0]}))}
                      max={90}
                      min={10}
                      step={5}
                      className="w-full"
                    />
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>Control: {100 - formData.traffic_split}%</span>
                      <span>Variant: {formData.traffic_split}%</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <Button onClick={createABTest} className="w-full">
                    Create Test
                  </Button>
                  <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)} className="w-full">
                    Cancel
                  </Button>
                </div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Tests List */}
      <div className="grid grid-cols-1 gap-4">
        {tests.map((test) => (
          <Card key={test.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <TestTube className="w-5 h-5" />
                    <span>{test.name}</span>
                    <Badge className={getStatusColor(test.status)}>
                      {test.status}
                    </Badge>
                  </CardTitle>
                  <p className="text-sm text-muted-foreground mt-1">
                    {test.description || 'No description'}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Program: {test.programs?.name} • Created: {formatDate(test.created_at)}
                  </p>
                </div>
                <div className="flex space-x-2">
                  {test.status === 'draft' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateTestStatus(test.id, 'active')}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Start
                    </Button>
                  )}
                  {test.status === 'active' && (
                    <>
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => updateTestStatus(test.id, 'paused')}
                      >
                        <Pause className="w-4 h-4 mr-1" />
                        Pause
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive"
                        onClick={() => updateTestStatus(test.id, 'completed')}
                      >
                        <Square className="w-4 h-4 mr-1" />
                        Stop
                      </Button>
                    </>
                  )}
                  {test.status === 'paused' && (
                    <Button 
                      size="sm" 
                      onClick={() => updateTestStatus(test.id, 'active')}
                    >
                      <Play className="w-4 h-4 mr-1" />
                      Resume
                    </Button>
                  )}
                  <Button 
                    size="sm" 
                    variant="outline"
                    onClick={() => setSelectedTest(test)}
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    View Results
                  </Button>
                </div>
              </div>
            </CardHeader>

            {test.status !== 'draft' && testResults[test.id] && (
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {testResults[test.id].control.participants}
                    </div>
                    <div className="text-sm text-muted-foreground">Control Participants</div>
                    <div className="text-sm">
                      {testResults[test.id].control.conversionRate.toFixed(1)}% conversion
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold">
                      {testResults[test.id].variant.participants}
                    </div>
                    <div className="text-sm text-muted-foreground">Variant Participants</div>
                    <div className="text-sm">
                      {testResults[test.id].variant.conversionRate.toFixed(1)}% conversion
                    </div>
                  </div>
                  <div className="text-center">
                    <div className={`text-2xl font-bold ${
                      testResults[test.id].improvement > 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {testResults[test.id].improvement > 0 ? '+' : ''}
                      {testResults[test.id].improvement.toFixed(1)}%
                    </div>
                    <div className="text-sm text-muted-foreground">Improvement</div>
                    <Badge variant={testResults[test.id].significance === 'significant' ? 'default' : 'secondary'}>
                      {testResults[test.id].significance.replace('_', ' ')}
                    </Badge>
                  </div>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {tests.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <TestTube className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No A/B tests yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first A/B test to start optimizing your loyalty programs
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Test
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Detailed Results Modal */}
      {selectedTest && (
        <Dialog open={!!selectedTest} onOpenChange={() => setSelectedTest(null)}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedTest.name} - Detailed Results</DialogTitle>
            </DialogHeader>
            <div className="mt-4">
              <Tabs defaultValue="overview">
                <TabsList>
                  <TabsTrigger value="overview">Overview</TabsTrigger>
                  <TabsTrigger value="trends">Trends</TabsTrigger>
                  <TabsTrigger value="segments">Segments</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="space-y-4">
                  {testResults[selectedTest.id] && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <Card>
                        <CardHeader>
                          <CardTitle>Control Group</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Participants</div>
                              <div className="text-2xl font-bold">
                                {testResults[selectedTest.id].control.participants}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Conversions</div>
                              <div className="text-2xl font-bold">
                                {testResults[selectedTest.id].control.conversions}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Conversion Rate</div>
                              <div className="text-xl font-bold">
                                {testResults[selectedTest.id].control.conversionRate.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Revenue</div>
                              <div className="text-xl font-bold">
                                £{testResults[selectedTest.id].control.revenue.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle>Variant Group</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <div className="text-muted-foreground">Participants</div>
                              <div className="text-2xl font-bold">
                                {testResults[selectedTest.id].variant.participants}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Conversions</div>
                              <div className="text-2xl font-bold">
                                {testResults[selectedTest.id].variant.conversions}
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Conversion Rate</div>
                              <div className="text-xl font-bold">
                                {testResults[selectedTest.id].variant.conversionRate.toFixed(2)}%
                              </div>
                            </div>
                            <div>
                              <div className="text-muted-foreground">Revenue</div>
                              <div className="text-xl font-bold">
                                £{testResults[selectedTest.id].variant.revenue.toLocaleString()}
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="trends">
                  <Card>
                    <CardHeader>
                      <CardTitle>Performance Trends</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        Trend analysis would show daily performance comparison between control and variant groups
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="segments">
                  <Card>
                    <CardHeader>
                      <CardTitle>Segment Analysis</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="text-center py-8 text-muted-foreground">
                        Segment analysis would show how different customer segments respond to each variant
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
              </Tabs>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
};