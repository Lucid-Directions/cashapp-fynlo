import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LoyaltyAnalyticsDashboard } from '../analytics/LoyaltyAnalyticsDashboard';
import { ABTestManager } from '../ab-testing/ABTestManager';
import { IntegrationManager } from '../integrations/IntegrationManager';
import { QRCampaignManager } from '../loyalty/QRCampaignManager';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Heart, 
  Plus, 
  Search, 
  Settings,
  Users,
  Building2,
  Gift,
  TrendingUp,
  Calendar,
  Award,
  Eye,
  Edit,
  Trash2,
  Sparkles,
  Target,
  BarChart3
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { TemplateSelector } from '../loyalty/TemplateSelector';
import { RuleBuilder } from '../loyalty/RuleBuilder';
import { LoyaltyTemplate, LoyaltyRule, RewardTier } from '../loyalty/LoyaltyTemplates';
import { Restaurant } from '../../types';

interface LoyaltyProgram {
  id: string;
  name: string;
  description?: string;
  program_type: string;
  is_active: boolean;
  restaurant_id: string;
  settings?: any;
  created_at: string;
  updated_at: string;
}

export const PlatformLoyaltyPrograms: React.FC = () => {
  const [programs, setPrograms] = useState<LoyaltyProgram[]>([]);
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRestaurants, setSelectedRestaurants] = useState<string[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();
  const { isPlatformOwner } = useFeatureAccess();

  // Enhanced form state
  const [currentStep, setCurrentStep] = useState<'template' | 'configure' | 'rules' | 'rewards'>('template');
  const [selectedTemplate, setSelectedTemplate] = useState<LoyaltyTemplate | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    program_type: 'points',
    rules: [] as LoyaltyRule[],
    rewards: [] as RewardTier[],
    settings: {
      points_per_purchase: 1,
      redemption_threshold: 100,
      reward_value: 10,
      notifications: {
        welcomeMessage: true,
        pointsEarned: true,
        rewardAvailable: true,
        tierUpgrade: false,
        expiryReminder: true
      },
      advanced: {
        pointExpiry: { enabled: false, days: 365, warningDays: 30 },
        tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
        referralBonus: { enabled: false, referrerPoints: 50, refereePoints: 25 },
        socialSharing: { enabled: false, platforms: [], bonusPoints: 10 }
      }
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // SECURITY: Only platform owners should access this data
      if (!isPlatformOwner()) {
        throw new Error('Unauthorized: Only platform owners can view loyalty programs');
      }

      // Fetch loyalty programs
      const { data: programsData, error: programsError } = await supabase
        .from('loyalty_programs')
        .select('*')
        .order('created_at', { ascending: false });

      if (programsError) throw programsError;

      // Fetch restaurants
      const { data: restaurantsData, error: restaurantsError } = await supabase
        .from('restaurants')
        .select('id, name, slug, is_active')
        .order('name');

      if (restaurantsError) throw restaurantsError;

      setPrograms(programsData || []);
      setRestaurants(restaurantsData || []);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to load data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleTemplateSelect = (template: LoyaltyTemplate) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      program_type: template.programType,
      rules: template.defaultSettings.rules,
      rewards: template.defaultSettings.rewards,
      settings: {
        ...prev.settings,
        ...template.defaultSettings.advanced,
        notifications: template.defaultSettings.notifications
      }
    }));
    setCurrentStep('configure');
  };

  const createLoyaltyProgram = async () => {
    if (!formData.name.trim()) {
      toast({
        title: "Error",
        description: "Program name is required",
        variant: "destructive",
      });
      return;
    }

    if (selectedRestaurants.length === 0) {
      toast({
        title: "Error",
        description: "Please select at least one restaurant",
        variant: "destructive",
      });
      return;
    }

    try {
      const enhancedSettings = {
        ...formData.settings,
        rules: JSON.parse(JSON.stringify(formData.rules)),
        rewards: JSON.parse(JSON.stringify(formData.rewards)),
        template_id: selectedTemplate?.id || null,
        created_with_builder: true
      } as any;

      const programPromises = selectedRestaurants.map(restaurantId => 
        supabase
          .from('loyalty_programs')
          .insert({
            name: formData.name,
            description: formData.description,
            program_type: formData.program_type,
            restaurant_id: restaurantId,
            settings: enhancedSettings,
            is_active: true
          })
      );

      const results = await Promise.all(programPromises);
      
      // Check for errors
      const errors = results.filter(result => result.error);
      if (errors.length > 0) {
        throw errors[0].error;
      }

      await fetchData();
      setIsCreateDialogOpen(false);
      resetForm();
      
      toast({
        title: "Success",
        description: `Professional loyalty program created for ${selectedRestaurants.length} restaurant(s)`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to create loyalty program",
        variant: "destructive",
      });
    }
  };

  const toggleProgramStatus = async (programId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('loyalty_programs')
        .update({ is_active: !currentStatus })
        .eq('id', programId);

      if (error) throw error;

      await fetchData();
      toast({
        title: "Success",
        description: `Program ${!currentStatus ? 'activated' : 'deactivated'}`,
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update program status",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setCurrentStep('template');
    setSelectedTemplate(null);
    setFormData({
      name: '',
      description: '',
      program_type: 'points',
      rules: [],
      rewards: [],
      settings: {
        points_per_purchase: 1,
        redemption_threshold: 100,
        reward_value: 10,
        notifications: {
          welcomeMessage: true,
          pointsEarned: true,
          rewardAvailable: true,
          tierUpgrade: false,
          expiryReminder: true
        },
        advanced: {
          pointExpiry: { enabled: false, days: 365, warningDays: 30 },
          tierMaintenance: { enabled: false, period: 'yearly', requirements: '' },
          referralBonus: { enabled: false, referrerPoints: 50, refereePoints: 25 },
          socialSharing: { enabled: false, platforms: [], bonusPoints: 10 }
        }
      }
    });
    setSelectedRestaurants([]);
  };

  const nextStep = () => {
    const steps = ['template', 'configure', 'rules', 'rewards'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1] as any);
    }
  };

  const prevStep = () => {
    const steps = ['template', 'configure', 'rules', 'rewards'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1] as any);
    }
  };

  const filteredPrograms = programs.filter(program =>
    program.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getRestaurantName = (restaurantId: string) => {
    const restaurant = restaurants.find(r => r.id === restaurantId);
    return restaurant?.name || 'Unknown Restaurant';
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');

  if (loading) {
    return <div className="p-6">Loading loyalty programs...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Tabs for different views */}
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
          <TabsTrigger value="ab-testing">A/B Testing</TabsTrigger>
          <TabsTrigger value="integrations">Integrations</TabsTrigger>
          <TabsTrigger value="qr-campaigns">QR Campaigns</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Header */}
          <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Loyalty Programs</h1>
          <p className="text-gray-600">Create and manage loyalty programs across all restaurants</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Sparkles className="w-4 h-4 mr-2" />
              Create Professional Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <Target className="w-5 h-5" />
                <span>Professional Loyalty Program Builder</span>
              </DialogTitle>
              
              {/* Progress Steps */}
              <div className="flex items-center justify-center space-x-4 mt-4">
                {[
                  { key: 'template', label: 'Template', icon: Sparkles },
                  { key: 'configure', label: 'Configure', icon: Settings },
                  { key: 'rules', label: 'Rules', icon: Target },
                  { key: 'rewards', label: 'Rewards', icon: Gift }
                ].map((step, index) => {
                  const StepIcon = step.icon;
                  const isActive = currentStep === step.key;
                  const isCompleted = ['template', 'configure', 'rules', 'rewards'].indexOf(currentStep) > index;
                  
                  return (
                    <div key={step.key} className="flex items-center">
                      <div className={`flex items-center space-x-2 px-3 py-2 rounded-lg ${
                        isActive ? 'bg-primary text-white' : 
                        isCompleted ? 'bg-green-100 text-green-800' : 
                        'bg-muted text-muted-foreground'
                      }`}>
                        <StepIcon className="w-4 h-4" />
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      {index < 3 && (
                        <div className={`w-8 h-0.5 mx-2 ${
                          isCompleted ? 'bg-green-300' : 'bg-muted'
                        }`} />
                      )}
                    </div>
                  );
                })}
              </div>
            </DialogHeader>

            <div className="mt-6">
              {currentStep === 'template' && (
                <TemplateSelector
                  onSelectTemplate={handleTemplateSelect}
                  selectedTemplate={selectedTemplate}
                />
              )}

              {currentStep === 'configure' && selectedTemplate && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Configure Your Program</h3>
                    <p className="text-sm text-muted-foreground">
                      Customize the basic settings for your {selectedTemplate.name} program
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <Label htmlFor="name">Campaign Name</Label>
                        <Input
                          id="name"
                          value={formData.name}
                          onChange={(e) => setFormData(prev => ({...prev, name: e.target.value}))}
                          placeholder="e.g., Summer Rewards Campaign"
                        />
                      </div>
                      
                      <div>
                        <Label htmlFor="description">Description</Label>
                        <Textarea
                          id="description"
                          value={formData.description}
                          onChange={(e) => setFormData(prev => ({...prev, description: e.target.value}))}
                          placeholder="Describe your loyalty program..."
                        />
                      </div>

                      <div>
                        <Label htmlFor="program_type">Program Type</Label>
                        <Select 
                          value={formData.program_type} 
                          onValueChange={(value) => setFormData(prev => ({...prev, program_type: value}))}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="points">Points-Based</SelectItem>
                            <SelectItem value="cashback">Cashback</SelectItem>
                            <SelectItem value="visit">Visit-Based</SelectItem>
                            <SelectItem value="tiered">Tiered Program</SelectItem>
                            <SelectItem value="referral">Referral-Focused</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <Label>Assign to Restaurants</Label>
                        <div className="border rounded-lg p-4 max-h-48 overflow-y-auto">
                          {restaurants.map((restaurant) => (
                            <div key={restaurant.id} className="flex items-center space-x-2 py-2">
                              <Checkbox
                                id={restaurant.id}
                                checked={selectedRestaurants.includes(restaurant.id)}
                                onCheckedChange={(checked) => {
                                  if (checked) {
                                    setSelectedRestaurants(prev => [...prev, restaurant.id]);
                                  } else {
                                    setSelectedRestaurants(prev => prev.filter(id => id !== restaurant.id));
                                  }
                                }}
                              />
                              <Label htmlFor={restaurant.id} className="flex-1 cursor-pointer">
                                {restaurant.name}
                                <Badge 
                                  variant={restaurant.is_active ? 'default' : 'secondary'}
                                  className="ml-2"
                                >
                                  {restaurant.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </Label>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {currentStep === 'rules' && (
                <div className="space-y-4">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Configure Loyalty Rules</h3>
                    <p className="text-sm text-muted-foreground">
                      Define how customers earn points and rewards
                    </p>
                  </div>
                  <RuleBuilder
                    rules={formData.rules}
                    onChange={(rules) => setFormData(prev => ({...prev, rules}))}
                  />
                </div>
              )}

              {currentStep === 'rewards' && (
                <div className="space-y-6">
                  <div className="text-center space-y-2">
                    <h3 className="text-lg font-semibold">Configure Rewards</h3>
                    <p className="text-sm text-muted-foreground">
                      Set up the rewards customers can earn
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <Gift className="w-5 h-5 mr-2" />
                          Reward Tiers
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        {formData.rewards.map((reward, index) => (
                          <div key={reward.id} className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between mb-2">
                              <h4 className="font-medium">{reward.name}</h4>
                              <Badge variant="outline">{reward.pointsRequired} pts</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{reward.description}</p>
                          </div>
                        ))}
                      </CardContent>
                    </Card>

                    <Card>
                      <CardHeader>
                        <CardTitle className="text-lg flex items-center">
                          <BarChart3 className="w-5 h-5 mr-2" />
                          Program Summary
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold text-primary">{formData.rules.length}</div>
                            <div className="text-sm text-muted-foreground">Active Rules</div>
                          </div>
                          <div className="text-center p-3 bg-muted rounded-lg">
                            <div className="text-2xl font-bold text-primary">{formData.rewards.length}</div>
                            <div className="text-sm text-muted-foreground">Reward Tiers</div>
                          </div>
                        </div>
                        
                        <div className="space-y-2">
                          <h5 className="font-medium">Selected Restaurants:</h5>
                          {selectedRestaurants.map(id => {
                            const restaurant = restaurants.find(r => r.id === id);
                            return restaurant ? (
                              <Badge key={id} variant="secondary" className="mr-2 mb-2">
                                {restaurant.name}
                              </Badge>
                            ) : null;
                          })}
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex justify-between items-center pt-6 border-t">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    if (currentStep === 'template') {
                      setIsCreateDialogOpen(false);
                    } else {
                      prevStep();
                    }
                  }}
                >
                  {currentStep === 'template' ? 'Cancel' : 'Previous'}
                </Button>

                {currentStep === 'rewards' ? (
                  <Button onClick={createLoyaltyProgram} disabled={selectedRestaurants.length === 0}>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Create Professional Campaign
                  </Button>
                ) : (
                  <Button 
                    onClick={nextStep}
                    disabled={
                      (currentStep === 'template' && !selectedTemplate) ||
                      (currentStep === 'configure' && (!formData.name.trim() || selectedRestaurants.length === 0))
                    }
                  >
                    Next Step
                  </Button>
                )}
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Programs</p>
                <p className="text-2xl font-bold">{programs.length}</p>
              </div>
              <Heart className="w-8 h-8 text-red-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Programs</p>
                <p className="text-2xl font-bold text-green-600">
                  {programs.filter(p => p.is_active).length}
                </p>
              </div>
              <Award className="w-8 h-8 text-green-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Restaurants</p>
                <p className="text-2xl font-bold">{restaurants.length}</p>
              </div>
              <Building2 className="w-8 h-8 text-blue-400" />
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Program Types</p>
                <p className="text-2xl font-bold">
                  {new Set(programs.map(p => p.program_type)).size}
                </p>
              </div>
              <Gift className="w-8 h-8 text-purple-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search */}
      <Card>
        <CardContent className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <Input
              placeholder="Search loyalty programs..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardContent>
      </Card>

      {/* Programs List */}
      <Card>
        <CardHeader>
          <CardTitle>Loyalty Programs ({filteredPrograms.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filteredPrograms.length === 0 ? (
            <div className="text-center py-8">
              <Heart className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p className="text-gray-500 mb-4">No loyalty programs found</p>
              <Button onClick={() => setIsCreateDialogOpen(true)}>
                <Plus className="w-4 h-4 mr-2" />
                Create Your First Campaign
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {filteredPrograms.map((program) => (
                <div key={program.id} className="border rounded-lg p-4 hover:bg-gray-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h3 className="font-semibold text-lg">{program.name}</h3>
                        <Badge 
                          variant={program.is_active ? 'default' : 'secondary'}
                          className={program.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}
                        >
                          {program.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                        <Badge variant="outline">
                          {program.program_type}
                        </Badge>
                      </div>
                      
                      <p className="text-gray-600 mb-2">{program.description}</p>
                      
                      <div className="flex items-center space-x-4 text-sm text-gray-500">
                        <span className="flex items-center">
                          <Building2 className="w-3 h-3 mr-1" />
                          {getRestaurantName(program.restaurant_id)}
                        </span>
                        <span className="flex items-center">
                          <Calendar className="w-3 h-3 mr-1" />
                          Created {formatDate(program.created_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => toggleProgramStatus(program.id, program.is_active)}
                      >
                        {program.is_active ? 'Deactivate' : 'Activate'}
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="w-4 h-4 mr-1" />
                        View
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          <LoyaltyAnalyticsDashboard />
        </TabsContent>

        <TabsContent value="ab-testing" className="space-y-6">
          <ABTestManager />
        </TabsContent>

        <TabsContent value="integrations" className="space-y-6">
          <IntegrationManager />
        </TabsContent>

        <TabsContent value="qr-campaigns" className="space-y-6">
          <QRCampaignManager restaurants={restaurants} programs={programs} />
        </TabsContent>
      </Tabs>
    </div>
  );
};