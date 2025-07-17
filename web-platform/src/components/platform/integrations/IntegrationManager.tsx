import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { 
  Zap, 
  Plus, 
  Settings,
  CheckCircle,
  XCircle,
  Clock,
  Webhook,
  Database,
  Mail,
  MessageSquare,
  ShoppingCart,
  CreditCard,
  ExternalLink,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface Integration {
  id: string;
  program_id: string;
  restaurant_id: string;
  integration_type: string;
  provider: string;
  webhook_url?: string;
  api_key?: string;
  settings: any;
  is_active: boolean;
  last_sync?: string;
  sync_status: string;
  error_log?: string;
  created_at: string;
  programs?: { name: string };
}

interface IntegrationType {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  category: string;
  providers: Array<{
    id: string;
    name: string;
    description: string;
    fields: Array<{
      name: string;
      label: string;
      type: 'text' | 'password' | 'url' | 'select';
      required: boolean;
      placeholder?: string;
      options?: string[];
    }>;
  }>;
}

const INTEGRATION_TYPES: IntegrationType[] = [
  {
    id: 'pos',
    name: 'SumUp Payment Integration',
    description: 'Connect with SumUp to automatically track payments and award loyalty points',
    icon: <CreditCard className="w-6 h-6" />,
    category: 'Payment Processing',
    providers: [
      {
        id: 'sumup',
        name: 'SumUp',
        description: 'Connect with SumUp payment system for automated loyalty tracking',
        fields: [
          { name: 'client_id', label: 'SumUp Client ID', type: 'text', required: true, placeholder: 'Your SumUp Client ID' },
          { name: 'client_secret', label: 'SumUp Client Secret', type: 'password', required: true, placeholder: 'Your SumUp Client Secret' },
          { name: 'merchant_code', label: 'Merchant Code', type: 'text', required: true, placeholder: 'Your merchant code' },
          { name: 'webhook_url', label: 'Webhook URL', type: 'url', required: false, placeholder: 'https://your-domain.com/webhook' }
        ]
      }
    ]
  }
];

export const IntegrationManager: React.FC = () => {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [programs, setPrograms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<IntegrationType | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<any>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    program_id: '',
    integration_type: '',
    provider: '',
    webhook_url: '',
    api_key: '',
    settings: {} as any
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch integrations
      const { data: integrationsData, error: integrationsError } = await supabase
        .from('loyalty_integrations')
        .select(`
          *,
          programs:loyalty_programs(name)
        `)
        .order('created_at', { ascending: false });

      if (integrationsError) throw integrationsError;

      // Fetch loyalty programs
      const { data: programsData, error: programsError } = await supabase
        .from('loyalty_programs')
        .select('id, name, restaurant_id')
        .eq('is_active', true);

      if (programsError) throw programsError;

      setIntegrations(integrationsData || []);
      setPrograms(programsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load integrations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createIntegration = async () => {
    if (!formData.program_id || !formData.integration_type || !formData.provider) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const program = programs.find(p => p.id === formData.program_id);
      if (!program) throw new Error('Program not found');

      // For SumUp, save credentials to platform settings
      if (formData.provider === 'sumup') {
        const { client_id, client_secret, merchant_code } = formData.settings;
        
        if (!client_id || !client_secret || !merchant_code) {
          toast({
            title: "Error",
            description: "Please fill in all required SumUp credentials",
            variant: "destructive",
          });
          return;
        }

        // Save SumUp config to platform settings
        const { error: configError } = await supabase
          .from('platform_settings')
          .upsert({
            setting_key: 'payment_config',
            setting_value: {
              sumup_app_id: client_id,
              sumup_app_secret: client_secret,
              merchant_code: merchant_code
            }
          });

        if (configError) throw configError;
      }

      const { error } = await supabase
        .from('loyalty_integrations')
        .insert({
          program_id: formData.program_id,
          restaurant_id: program.restaurant_id,
          integration_type: formData.integration_type,
          provider: formData.provider,
          webhook_url: formData.webhook_url,
          api_key: formData.api_key,
          settings: formData.settings,
          is_active: true,
          sync_status: 'pending'
        });

      if (error) throw error;

      await fetchData();
      setIsCreateDialogOpen(false);
      resetForm();
      
      toast({
        title: "Success",
        description: "SumUp integration created successfully",
      });
    } catch (error) {
      console.error('Error creating integration:', error);
      toast({
        title: "Error",
        description: "Failed to create integration",
        variant: "destructive",
      });
    }
  };

  const toggleIntegration = async (integrationId: string, isActive: boolean) => {
    try {
      const { error } = await supabase
        .from('loyalty_integrations')
        .update({ is_active: !isActive })
        .eq('id', integrationId);

      if (error) throw error;

      await fetchData();
      toast({
        title: "Success",
        description: `Integration ${!isActive ? 'enabled' : 'disabled'}`,
      });
    } catch (error) {
      console.error('Error toggling integration:', error);
      toast({
        title: "Error",
        description: "Failed to update integration",
        variant: "destructive",
      });
    }
  };

  const testIntegration = async (integrationId: string) => {
    const integration = integrations.find(i => i.id === integrationId);
    if (!integration) return;

    toast({
      title: "Testing Integration",
      description: "Connecting to SumUp...",
    });

    try {
      if (integration.provider === 'sumup') {
        // Test SumUp connection
        const response = await supabase.functions.invoke('sumup-payments', {
          body: { action: 'test_connection' }
        });

        if (response.error) throw response.error;

        toast({
          title: "Test Successful",
          description: "SumUp integration is working correctly",
        });

        // Update sync status
        await supabase
          .from('loyalty_integrations')
          .update({ sync_status: 'success', error_log: null })
          .eq('id', integrationId);

        await fetchData();
      }
    } catch (error) {
      console.error('Integration test failed:', error);
      toast({
        title: "Test Failed",
        description: "Failed to connect to SumUp. Please check your credentials.",
        variant: "destructive",
      });

      // Update sync status
      await supabase
        .from('loyalty_integrations')
        .update({ sync_status: 'error', error_log: error.message })
        .eq('id', integrationId);

      await fetchData();
    }
  };

  const resetForm = () => {
    setFormData({
      program_id: '',
      integration_type: '',
      provider: '',
      webhook_url: '',
      api_key: '',
      settings: {}
    });
    setSelectedType(null);
    setSelectedProvider(null);
  };

  const handleTypeSelect = (type: IntegrationType) => {
    setSelectedType(type);
    setFormData(prev => ({
      ...prev,
      integration_type: type.id,
      provider: '',
      settings: {}
    }));
    setSelectedProvider(null);
  };

  const handleProviderSelect = (provider: any) => {
    setSelectedProvider(provider);
    setFormData(prev => ({
      ...prev,
      provider: provider.id,
      settings: {}
    }));
  };

  const getStatusIcon = (status: string, isActive: boolean) => {
    if (!isActive) return <XCircle className="w-4 h-4 text-gray-400" />;
    
    switch (status) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-500" />;
      default: return <Clock className="w-4 h-4 text-yellow-500" />;
    }
  };

  const formatDate = (dateString: string) => new Date(dateString).toLocaleDateString('en-GB');

  if (loading) {
    return <div className="p-6">Loading integrations...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-muted-foreground">Connect your loyalty programs with external systems</p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={(open) => {
          setIsCreateDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Add Integration
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Integration</DialogTitle>
            </DialogHeader>

            <div className="space-y-6">
              {!selectedType && (
                <div>
                  <h3 className="text-lg font-medium mb-4">Choose Integration Type</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {INTEGRATION_TYPES.map((type) => (
                      <Card 
                        key={type.id} 
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleTypeSelect(type)}
                      >
                        <CardHeader>
                          <CardTitle className="flex items-center space-x-3">
                            {type.icon}
                            <span>{type.name}</span>
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{type.description}</p>
                          <Badge variant="secondary" className="mt-2">{type.category}</Badge>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {selectedType && !selectedProvider && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Choose Provider for {selectedType.name}</h3>
                    <Button variant="ghost" onClick={() => setSelectedType(null)}>
                      Back
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedType.providers.map((provider) => (
                      <Card 
                        key={provider.id} 
                        className="cursor-pointer hover:border-primary transition-colors"
                        onClick={() => handleProviderSelect(provider)}
                      >
                        <CardHeader>
                          <CardTitle>{provider.name}</CardTitle>
                        </CardHeader>
                        <CardContent>
                          <p className="text-sm text-muted-foreground">{provider.description}</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}

              {selectedType && selectedProvider && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-medium">Configure {selectedProvider.name} Integration</h3>
                    <Button variant="ghost" onClick={() => setSelectedProvider(null)}>
                      Back
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
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

                      {selectedProvider.fields.map((field) => (
                        <div key={field.name}>
                          <Label htmlFor={field.name}>
                            {field.label}
                            {field.required && <span className="text-red-500 ml-1">*</span>}
                          </Label>
                          {field.type === 'select' ? (
                            <Select 
                              value={formData.settings[field.name] || ''}
                              onValueChange={(value) => setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, [field.name]: value }
                              }))}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder={field.placeholder} />
                              </SelectTrigger>
                              <SelectContent>
                                {field.options?.map((option) => (
                                  <SelectItem key={option} value={option}>
                                    {option}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          ) : (
                            <Input
                              id={field.name}
                              type={field.type}
                              placeholder={field.placeholder}
                              value={formData.settings[field.name] || ''}
                              onChange={(e) => setFormData(prev => ({
                                ...prev,
                                settings: { ...prev.settings, [field.name]: e.target.value }
                              }))}
                            />
                          )}
                        </div>
                      ))}
                    </div>

                    <div className="space-y-4">
                      <Card>
                        <CardHeader>
                          <CardTitle className="text-sm">Integration Details</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2 text-sm">
                          <div>
                            <span className="text-muted-foreground">Type:</span> {selectedType.name}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Provider:</span> {selectedProvider.name}
                          </div>
                          <div>
                            <span className="text-muted-foreground">Category:</span> {selectedType.category}
                          </div>
                        </CardContent>
                      </Card>

                      <div className="flex space-x-2">
                        <Button onClick={createIntegration} className="flex-1">
                          Create Integration
                        </Button>
                        <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Integrations List */}
      <div className="grid grid-cols-1 gap-4">
        {integrations.map((integration) => (
          <Card key={integration.id}>
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-start space-x-4">
                  <div className="p-2 bg-muted rounded-lg">
                    {INTEGRATION_TYPES.find(t => t.id === integration.integration_type)?.icon || <Zap className="w-6 h-6" />}
                  </div>
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <span>{integration.provider.charAt(0).toUpperCase() + integration.provider.slice(1)}</span>
                      {getStatusIcon(integration.sync_status, integration.is_active)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground">
                      {INTEGRATION_TYPES.find(t => t.id === integration.integration_type)?.name || integration.integration_type}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Program: {integration.programs?.name} • Created: {formatDate(integration.created_at)}
                    </p>
                    {integration.last_sync && (
                      <p className="text-xs text-muted-foreground">
                        Last sync: {formatDate(integration.last_sync)}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <Switch
                      checked={integration.is_active}
                      onCheckedChange={() => toggleIntegration(integration.id, integration.is_active)}
                    />
                    <span className="text-sm text-muted-foreground">
                      {integration.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => testIntegration(integration.id)}
                    disabled={!integration.is_active}
                  >
                    <RefreshCw className="w-4 h-4 mr-1" />
                    Test
                  </Button>
                </div>
              </div>
            </CardHeader>

            {integration.error_log && (
              <CardContent>
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-center space-x-2 text-red-800">
                    <XCircle className="w-4 h-4" />
                    <span className="font-medium">Error</span>
                  </div>
                  <p className="text-sm text-red-700 mt-1">{integration.error_log}</p>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>

      {integrations.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Zap className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No integrations yet</h3>
            <p className="text-muted-foreground mb-4">
              Connect your loyalty programs with external systems to automate point tracking and customer engagement
            </p>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Integration
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
};