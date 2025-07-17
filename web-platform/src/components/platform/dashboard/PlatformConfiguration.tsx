import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { 
  Settings, 
  PoundSterling, 
  Users, 
  Shield, 
  Bell,
  Save,
  AlertCircle,
  CheckCircle,
  Flag,
  CreditCard
} from "lucide-react";
import { toast } from "sonner";
import { PlatformPaymentSettings } from '../settings/PlatformPaymentSettings';

const PlatformConfiguration = () => {
  const [subscriptionPlans, setSubscriptionPlans] = useState([
    {
      id: 'alpha',
      name: 'Alpha',
      price: 0,
      features: ['Basic POS', 'Order Management', 'Basic Reports'],
      maxStaff: 5,
      transactionFee: 1,
      enabled: true
    },
    {
      id: 'beta',
      name: 'Beta',
      price: 49,
      features: ['All Alpha features', 'Inventory Management', 'Staff Management', 'Customer Database', 'Advanced Analytics'],
      maxStaff: 15,
      transactionFee: 1,
      enabled: true
    },
    {
      id: 'omega',
      name: 'Omega',
      price: 119,
      features: ['All Beta features', 'Multi-location', 'API Access', 'Priority Support', 'Custom Integrations'],
      maxStaff: -1, // unlimited
      transactionFee: 1,
      enabled: true
    }
  ]);

  const [featureFlags, setFeatureFlags] = useState([
    { key: 'inventory_management', name: 'Inventory Management', description: 'Track stock levels and suppliers', enabledForPlans: ['beta', 'omega'], globalEnabled: true },
    { key: 'staff_management', name: 'Staff Management', description: 'Employee scheduling and time tracking', enabledForPlans: ['beta', 'omega'], globalEnabled: true },
    { key: 'customer_database', name: 'Customer Database', description: 'Customer profiles and loyalty', enabledForPlans: ['beta', 'omega'], globalEnabled: true },
    { key: 'advanced_analytics', name: 'Advanced Analytics', description: 'Detailed reporting and insights', enabledForPlans: ['beta', 'omega'], globalEnabled: true },
    { key: 'api_access', name: 'API Access', description: 'Third-party integrations', enabledForPlans: ['omega'], globalEnabled: true },
    { key: 'multi_location', name: 'Multi-location', description: 'Manage multiple restaurant locations', enabledForPlans: ['omega'], globalEnabled: true }
  ]);

  const [platformSettings, setPlatformSettings] = useState({
    maintenanceMode: false,
    newSignupsEnabled: true,
    supportEmail: 'support@fynlo.co.uk',
    maxRestaurantsPerOwner: 5,
    defaultTrialDays: 14,
    autoUpgradeEnabled: true
  });

  const handleSaveSettings = () => {
    toast.success('Settings saved successfully');
  };

  const handleToggleFeature = (key: string) => {
    setFeatureFlags(prev => prev.map(feature => 
      feature.key === key 
        ? { ...feature, globalEnabled: !feature.globalEnabled }
        : feature
    ));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Platform Configuration</h1>
          <p className="text-muted-foreground">Manage subscription plans, features, and platform settings</p>
        </div>
        <Button onClick={handleSaveSettings}>
          <Save className="mr-2 h-4 w-4" />
          Save All Changes
        </Button>
      </div>

      <Tabs defaultValue="subscriptions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions">Subscription Plans</TabsTrigger>
          <TabsTrigger value="features">Feature Flags</TabsTrigger>
          <TabsTrigger value="payments">Payment Settings</TabsTrigger>
          <TabsTrigger value="platform">Platform Settings</TabsTrigger>
          <TabsTrigger value="notifications">Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {subscriptionPlans.map((plan) => (
              <Card key={plan.id} className={`relative ${plan.id === 'beta' ? 'border-primary' : ''}`}>
                {plan.id === 'beta' && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge variant="default">Most Popular</Badge>
                  </div>
                )}
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="capitalize">{plan.name}</CardTitle>
                    <Switch 
                      checked={plan.enabled}
                      onCheckedChange={(checked) => 
                        setSubscriptionPlans(prev => prev.map(p => 
                          p.id === plan.id ? { ...p, enabled: checked } : p
                        ))
                      }
                    />
                  </div>
                  <CardDescription>
                    <div className="text-3xl font-bold">
                      {plan.price === 0 ? 'Free' : `£${plan.price}`}
                      {plan.price > 0 && <span className="text-sm font-normal">/month</span>}
                    </div>
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label htmlFor={`price-${plan.id}`}>Monthly Price (£)</Label>
                    <Input
                      id={`price-${plan.id}`}
                      type="number"
                      value={plan.price}
                      onChange={(e) => 
                        setSubscriptionPlans(prev => prev.map(p => 
                          p.id === plan.id ? { ...p, price: Number(e.target.value) } : p
                        ))
                      }
                      disabled={plan.id === 'alpha'} // Keep free plan free
                    />
                  </div>
                  
                  <div>
                    <Label htmlFor={`transaction-fee-${plan.id}`}>Transaction Fee (%)</Label>
                    <Input
                      id={`transaction-fee-${plan.id}`}
                      type="number"
                      step="0.1"
                      value={plan.transactionFee}
                      onChange={(e) => 
                        setSubscriptionPlans(prev => prev.map(p => 
                          p.id === plan.id ? { ...p, transactionFee: Number(e.target.value) } : p
                        ))
                      }
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Currently set to 1% for all plans
                    </p>
                  </div>

                  <div>
                    <Label htmlFor={`max-staff-${plan.id}`}>Max Staff Members</Label>
                    <Input
                      id={`max-staff-${plan.id}`}
                      type="number"
                      value={plan.maxStaff === -1 ? 'Unlimited' : plan.maxStaff}
                      onChange={(e) => 
                        setSubscriptionPlans(prev => prev.map(p => 
                          p.id === plan.id ? { ...p, maxStaff: e.target.value === 'Unlimited' ? -1 : Number(e.target.value) } : p
                        ))
                      }
                    />
                  </div>

                  <div>
                    <Label>Included Features</Label>
                    <div className="space-y-2 mt-2">
                      {plan.features.map((feature, index) => (
                        <div key={index} className="flex items-center space-x-2">
                          <CheckCircle className="h-4 w-4 text-green-500" />
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Flag className="h-5 w-5" />
                <span>Feature Flag Management</span>
              </CardTitle>
              <CardDescription>
                Control feature rollout and availability across subscription plans
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {featureFlags.map((feature) => (
                  <div key={feature.key} className="border rounded-lg p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <h4 className="font-medium">{feature.name}</h4>
                        <p className="text-sm text-muted-foreground">{feature.description}</p>
                      </div>
                      <Switch
                        checked={feature.globalEnabled}
                        onCheckedChange={() => handleToggleFeature(feature.key)}
                      />
                    </div>
                    <div className="flex items-center space-x-2 mt-3">
                      <span className="text-sm font-medium">Available in:</span>
                      {feature.enabledForPlans.map((plan) => (
                        <Badge key={plan} variant="secondary" className="capitalize">
                          {plan}
                        </Badge>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="payments">
          <PlatformPaymentSettings />
        </TabsContent>

        <TabsContent value="platform" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>General Settings</CardTitle>
                <CardDescription>Core platform configuration</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <Label>Maintenance Mode</Label>
                    <p className="text-sm text-muted-foreground">Temporarily disable platform access</p>
                  </div>
                  <Switch
                    checked={platformSettings.maintenanceMode}
                    onCheckedChange={(checked) => 
                      setPlatformSettings(prev => ({ ...prev, maintenanceMode: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>New Signups Enabled</Label>
                    <p className="text-sm text-muted-foreground">Allow new restaurant registrations</p>
                  </div>
                  <Switch
                    checked={platformSettings.newSignupsEnabled}
                    onCheckedChange={(checked) => 
                      setPlatformSettings(prev => ({ ...prev, newSignupsEnabled: checked }))
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div>
                    <Label>Auto-upgrade Enabled</Label>
                    <p className="text-sm text-muted-foreground">Automatically upgrade plans when limits are reached</p>
                  </div>
                  <Switch
                    checked={platformSettings.autoUpgradeEnabled}
                    onCheckedChange={(checked) => 
                      setPlatformSettings(prev => ({ ...prev, autoUpgradeEnabled: checked }))
                    }
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Limits & Restrictions</CardTitle>
                <CardDescription>Platform-wide limits and defaults</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="support-email">Support Email</Label>
                  <Input
                    id="support-email"
                    type="email"
                    value={platformSettings.supportEmail}
                    onChange={(e) => 
                      setPlatformSettings(prev => ({ ...prev, supportEmail: e.target.value }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="max-restaurants">Max Restaurants per Owner</Label>
                  <Input
                    id="max-restaurants"
                    type="number"
                    value={platformSettings.maxRestaurantsPerOwner}
                    onChange={(e) => 
                      setPlatformSettings(prev => ({ ...prev, maxRestaurantsPerOwner: Number(e.target.value) }))
                    }
                  />
                </div>

                <div>
                  <Label htmlFor="trial-days">Default Trial Days</Label>
                  <Input
                    id="trial-days"
                    type="number"
                    value={platformSettings.defaultTrialDays}
                    onChange={(e) => 
                      setPlatformSettings(prev => ({ ...prev, defaultTrialDays: Number(e.target.value) }))
                    }
                  />
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Bell className="h-5 w-5" />
                <span>Platform Notifications</span>
              </CardTitle>
              <CardDescription>
                Manage system-wide notifications and announcements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Bell className="h-5 w-5 text-blue-600" />
                    <span className="font-medium text-blue-800">Announcement System</span>
                  </div>
                  <p className="text-sm text-blue-700 mt-1">
                    Notification and announcement features will be available in the Support section.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default PlatformConfiguration;