import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Settings,
  Save, 
  AlertTriangle,
  CheckCircle,
  PoundSterling,
  Users
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  features: string[];
  sumup_product_id?: string;
}

interface PlatformPaymentConfig {
  sumup_app_id: string;
  sumup_app_secret: string;
  merchant_code?: string;
  subscription_plans: SubscriptionPlan[];
  platform_commission_rate: number;
}

export const PlatformPaymentSettings: React.FC = () => {
  const [config, setConfig] = useState<PlatformPaymentConfig>({
    sumup_app_id: '',
    sumup_app_secret: '',
    platform_commission_rate: 0.01, // 1%
    subscription_plans: [
      {
        id: 'alpha',
        name: 'Alpha (FREE)',
        price: 0,
        features: ['Basic POS', 'Order Management', 'Basic Reports'],
        sumup_product_id: ''
      },
      {
        id: 'beta',
        name: 'Beta',
        price: 49,
        features: ['Everything in Alpha', 'Inventory Management', 'Staff Management', 'Advanced Analytics'],
        sumup_product_id: ''
      },
      {
        id: 'omega',
        name: 'Omega',
        price: 119,
        features: ['Everything in Beta', 'Multi-location', 'API Access', 'Custom Integrations', 'Priority Support'],
        sumup_product_id: ''
      }
    ]
  });
  
  const [sumupConnected, setSumupConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPlatformSettings();
  }, []);

  const loadPlatformSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_config')
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw error;
      }

      if (data?.setting_value) {
        const loadedConfig = data.setting_value as unknown as PlatformPaymentConfig;
        setConfig(loadedConfig);
        setSumupConnected(!!loadedConfig.sumup_app_id && !!loadedConfig.sumup_app_secret);
      }
    } catch (error) {
      console.error('Error loading platform settings:', error);
      toast({
        title: "Error",
        description: "Failed to load platform settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveConfiguration = async () => {
    setSaving(true);
    try {
      console.log('Saving configuration:', config);
      
      const { data, error } = await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'payment_config',
          setting_value: config as any
        }, {
          onConflict: 'setting_key'
        })
        .select();

      if (error) {
        console.error('Database error:', error);
        throw error;
      }
      
      console.log('Save successful:', data);
      
      toast({
        title: "Success",
        description: "Platform payment configuration saved to database",
      });
      
      // Reload to confirm the save
      await loadPlatformSettings();
    } catch (error) {
      console.error('Error saving configuration:', error);
      toast({
        title: "Error",
        description: `Failed to save configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const testSumUpConnection = async () => {
    setTestingConnection(true);
    try {
      if (!config.sumup_app_id || !config.sumup_app_secret) {
        throw new Error('SumUp credentials are required');
      }

      const response = await fetch('/functions/v1/sumup-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'test_connection'
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Connection test failed');
      }
      
      setSumupConnected(true);
      toast({
        title: "Success",
        description: `SumUp connection successful. Merchant: ${result.merchant_code}`,
      });
    } catch (error) {
      setSumupConnected(false);
      toast({
        title: "Connection Failed",
        description: `Unable to connect to SumUp: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setTestingConnection(false);
    }
  };

  const updatePlanPrice = (planId: string, price: number) => {
    setConfig(prev => ({
      ...prev,
      subscription_plans: prev.subscription_plans.map(plan =>
        plan.id === planId ? { ...plan, price } : plan
      )
    }));
  };

  const updatePlanSumUpId = (planId: string, sumup_product_id: string) => {
    setConfig(prev => ({
      ...prev,
      subscription_plans: prev.subscription_plans.map(plan =>
        plan.id === planId ? { ...plan, sumup_product_id } : plan
      )
    }));
  };

  if (loading) {
    return <div className="p-6">Loading platform payment settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Platform Payment Settings</h2>
        <p className="text-gray-600">Configure SumUp integration and subscription plan pricing</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SumUp Configuration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>SumUp Platform Integration</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">SumUp Payment Platform</h3>
                  <p className="text-sm text-gray-500">
                    Process subscription payments and restaurant transactions
                  </p>
                </div>
              </div>
              <Badge variant={sumupConnected ? "default" : "secondary"}>
                {sumupConnected ? (
                  <div className="flex items-center space-x-1">
                    <CheckCircle className="w-3 h-3" />
                    <span>Connected</span>
                  </div>
                ) : (
                  'Not Connected'
                )}
              </Badge>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="sumup_app_id">SumUp Application ID</Label>
                <Input
                  id="sumup_app_id"
                  type="password"
                  value={config.sumup_app_id}
                  onChange={(e) => setConfig(prev => ({ ...prev, sumup_app_id: e.target.value }))}
                  placeholder="Enter your SumUp App ID"
                />
              </div>

              <div>
                <Label htmlFor="sumup_app_secret">SumUp Application Secret</Label>
                <Input
                  id="sumup_app_secret"
                  type="password"
                  value={config.sumup_app_secret}
                  onChange={(e) => setConfig(prev => ({ ...prev, sumup_app_secret: e.target.value }))}
                  placeholder="Enter your SumUp App Secret"
                />
              </div>

              <div>
                <Label htmlFor="merchant_code">SumUp Merchant Code (Optional)</Label>
                <Input
                  id="merchant_code"
                  value={config.merchant_code || ''}
                  onChange={(e) => setConfig(prev => ({ ...prev, merchant_code: e.target.value }))}
                  placeholder="Your SumUp Merchant Code (will be auto-detected)"
                />
              </div>

              <Button 
                onClick={testSumUpConnection} 
                disabled={testingConnection || !config.sumup_app_id || !config.sumup_app_secret}
                className="w-full"
              >
                {testingConnection ? 'Testing Connection...' : 'Test SumUp Connection'}
              </Button>
            </div>

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">SumUp Integration Benefits</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Unified payment processing for all restaurants</li>
                <li>• Automated subscription billing</li>
                <li>• Real-time transaction monitoring</li>
                <li>• Competitive processing rates</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Platform Commission */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <PoundSterling className="w-5 h-5" />
              <span>Platform Commission</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="commission_rate">Platform Commission Rate (%)</Label>
              <Input
                id="commission_rate"
                type="number"
                step="0.01"
                min="0"
                max="10"
                value={config.platform_commission_rate * 100}
                onChange={(e) => setConfig(prev => ({ 
                  ...prev, 
                  platform_commission_rate: parseFloat(e.target.value) / 100 || 0 
                }))}
              />
              <p className="text-sm text-gray-500 mt-1">
                Current: {(config.platform_commission_rate * 100).toFixed(2)}% of each transaction
              </p>
            </div>

            <div className="bg-gray-50 p-4 rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Commission Structure</h4>
              <div className="text-sm text-gray-600 space-y-1">
                <p>• Applied to all restaurant transactions</p>
                <p>• Automatically deducted during payout</p>
                <p>• Monthly subscription fees are separate</p>
                <p>• Standard rate across all plan tiers</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subscription Plans Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Users className="w-5 h-5" />
            <span>Subscription Plans Configuration</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {config.subscription_plans.map((plan) => (
              <div key={plan.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-medium text-lg">{plan.name}</h3>
                    <p className="text-sm text-gray-500">
                      {plan.features.length} features included
                    </p>
                  </div>
                  <Badge variant={plan.price === 0 ? "secondary" : "default"}>
                    £{plan.price}/month
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <Label htmlFor={`price_${plan.id}`}>Monthly Price (£)</Label>
                    <Input
                      id={`price_${plan.id}`}
                      type="number"
                      min="0"
                      value={plan.price}
                      onChange={(e) => updatePlanPrice(plan.id, parseFloat(e.target.value) || 0)}
                      disabled={plan.id === 'alpha'} // Free plan price is fixed
                    />
                  </div>

                  <div>
                    <Label htmlFor={`sumup_id_${plan.id}`}>SumUp Product ID</Label>
                    <Input
                      id={`sumup_id_${plan.id}`}
                      value={plan.sumup_product_id || ''}
                      onChange={(e) => updatePlanSumUpId(plan.id, e.target.value)}
                      placeholder={plan.price === 0 ? 'N/A (Free Plan)' : 'SumUp Product ID'}
                      disabled={plan.price === 0}
                    />
                  </div>

                  <div className="flex items-end">
                    <Button 
                      variant="outline" 
                      size="sm"
                      disabled={plan.price === 0 || !plan.sumup_product_id}
                    >
                      Test Payment
                    </Button>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1">
                  {plan.features.map((feature, index) => (
                    <Badge key={index} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Save Configuration */}
      <div className="flex justify-end space-x-4">
        <Button variant="outline" onClick={loadPlatformSettings}>
          Reset Changes
        </Button>
        <Button onClick={saveConfiguration} disabled={saving}>
          <Save className="w-4 h-4 mr-2" />
          Save Configuration
        </Button>
      </div>

      {/* Warning Notice */}
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="p-4">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
            <div>
              <h4 className="font-medium text-amber-900">Production Configuration Notice</h4>
              <p className="text-sm text-amber-800 mt-1">
                In a production environment, SumUp credentials and platform settings should be stored 
                securely using proper encryption and secret management. The current implementation 
                is for demonstration purposes only.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};