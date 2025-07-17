import React, { useState, useEffect } from 'react';
import { useFeatureAccess } from '@/hooks/useFeatureAccess';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Check, ArrowRight, Crown, Settings, CreditCard, Shield, Bell, Users, Building, BarChart3, Key, Globe, AlertCircle, CheckCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';

interface PlatformStats {
  totalUsers: number;
  activeRestaurants: number;
  totalTransactions: number;
  monthlyRevenue: number;
  systemHealth: 'healthy' | 'warning' | 'error';
}

interface PlatformSettings {
  sumupPlatformApiKey?: string;
  sumupRestaurantApiKey?: string;
  paymentMethods: {
    sumup: boolean;
    stripe: boolean;
    cash: boolean;
    card: boolean;
  };
  systemSettings: {
    maintenanceMode: boolean;
    registrationEnabled: boolean;
    emailVerificationRequired: boolean;
    multiLocationEnabled: boolean;
  };
}

export const DashboardSettings = () => {
  const { getSubscriptionPlan, isPlatformOwner } = useFeatureAccess();
  const { toast } = useToast();
  const currentPlan = getSubscriptionPlan();
  const [selectedPlan, setSelectedPlan] = useState<'alpha' | 'beta' | 'omega'>(currentPlan);
  const [showPlans, setShowPlans] = useState(false);
  const [loading, setLoading] = useState(true);
  const [platformStats, setPlatformStats] = useState<PlatformStats>({
    totalUsers: 0,
    activeRestaurants: 0,
    totalTransactions: 0,
    monthlyRevenue: 0,
    systemHealth: 'healthy'
  });

  // Platform admin settings state - now persistent and auto-populated
  const [sumupPlatformApiKey, setSumupPlatformApiKey] = useState('sup_sk_Eeh3NQTbrGWjwXCe3Xmz8AgI8MiVA65N7');
  const [sumupRestaurantApiKey, setSumupRestaurantApiKey] = useState('');
  const [stripeSecretKey, setStripeSecretKey] = useState('sk_test_development_key_placeholder');
  const [squareAccessToken, setSquareAccessToken] = useState('EAAAlw3Uvq6PutIC6j87XYtwYe3zeSbHuPbmHy7-D0S1rI7s3ORmKg-JUFbtdgMD');
  const [databaseUrl, setDatabaseUrl] = useState('postgresql://doadmin:AVNS_DKOJkLvWZuR3j-QO1zW@fynlo-pos-db-do-user-23457625-0.i.db.ondigitalocean.com:25060/defaultdb?sslmode=require');
  const [redisUrl, setRedisUrl] = useState('rediss://default:AVNS_ZSfCiU1eo6lTVbr410O@fynlo-pos-cache-do-user-23457625-0.i.db.ondigitalocean.com:25061');
  const [spacesAccessKey, setSpacesAccessKey] = useState('DO00UFYJDGXBQ7WJ8MZX');
  const [spacesSecretKey, setSpacesSecretKey] = useState('15ElFvalC1hmLXjQExmbmnQIWE09FU1eMhxbyjq9ULo');
  const [supabaseServiceRole, setSupabaseServiceRole] = useState('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MDc4MjIxNywiZXhwIjoyMDY2MzU4MjE3fQ.3MZGwVJXzzeI4pRgN2amPnBrL6LuAKJLiAPmUBucFZE');
  const [paymentMethods, setPaymentMethods] = useState({
    sumup: true,
    stripe: true,
    cash: true,
    card: true
  });
  const [systemSettings, setSystemSettings] = useState({
    maintenanceMode: false,
    registrationEnabled: true,
    emailVerificationRequired: true,
    multiLocationEnabled: true
  });
  const [settingsSaved, setSettingsSaved] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load platform data and settings on mount
  useEffect(() => {
    if (isPlatformOwner()) {
      loadPlatformData();
      loadPlatformSettings();
    }
  }, []);

  const loadPlatformData = async () => {
    try {
      // Get total users
      const { count: userCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true });

      // Get active restaurants
      const { count: restaurantCount } = await supabase
        .from('restaurants')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

      // Get total transactions from payments table
      const { count: transactionCount } = await supabase
        .from('payments')
        .select('*', { count: 'exact', head: true });

      // Get monthly revenue (sum of payments this month)
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();
      const { data: revenueData } = await supabase
        .from('payments')
        .select('amount')
        .eq('payment_status', 'paid')
        .gte('created_at', startOfMonth);

      const monthlyRevenue = revenueData?.reduce((sum, payment) => sum + (payment.amount || 0), 0) || 0;

      // Check system health (simplified)
      const systemHealth = userCount !== null && restaurantCount !== null ? 'healthy' : 'warning';

      setPlatformStats({
        totalUsers: userCount || 0,
        activeRestaurants: restaurantCount || 0,
        totalTransactions: transactionCount || 0,
        monthlyRevenue: monthlyRevenue / 100, // Convert from cents
        systemHealth: systemHealth as 'healthy' | 'warning' | 'error'
      });

      setLoading(false);
    } catch (error) {
      console.error('Error loading platform data:', error);
      setLoading(false);
    }
  };

  const loadPlatformSettings = async () => {
    try {
      // Load API keys
      const { data: apiKeysData } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'api_keys')
        .single();

      if (apiKeysData?.setting_value) {
        const apiKeys = apiKeysData.setting_value as any;
        setSumupPlatformApiKey(apiKeys.sumupPlatformApiKey || '');
        setSumupRestaurantApiKey(apiKeys.sumupRestaurantApiKey || '');
      }

      // Load payment methods
      const { data: paymentData } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'payment_methods')
        .single();

      if (paymentData?.setting_value) {
        setPaymentMethods(paymentData.setting_value as any);
      }

      // Load system settings
      const { data: systemData } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'system_settings')
        .single();

      if (systemData?.setting_value) {
        setSystemSettings(systemData.setting_value as any);
      }

      setSettingsSaved(true);
    } catch (error) {
      console.error('Error loading platform settings:', error);
    }
  };

  const savePlatformSettings = async () => {
    try {
      // Save API keys
      await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'api_keys',
          setting_value: {
            sumupPlatformApiKey: sumupPlatformApiKey,
            sumupRestaurantApiKey: sumupRestaurantApiKey
          } as any
        });

      // Save payment methods
      await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'payment_methods',
          setting_value: paymentMethods as any
        });

      // Save system settings
      await supabase
        .from('platform_settings')
        .upsert({
          setting_key: 'system_settings',
          setting_value: systemSettings as any
        });

      setSettingsSaved(true);
      setHasUnsavedChanges(false);
      
      toast({
        title: "Settings Saved",
        description: "Platform settings have been saved to database successfully.",
      });
    } catch (error) {
      console.error('Error saving platform settings:', error);
      toast({
        title: "Save Failed",
        description: "Failed to save platform settings to database.",
        variant: "destructive"
      });
    }
  };

  const handleUpgrade = (targetPlan: 'beta' | 'omega') => {
    setShowPlans(true);
    // Scroll to plans section
    document.getElementById('pricing-plans')?.scrollIntoView({ behavior: 'smooth' });
  };

  const handlePlanClick = (planKey: 'alpha' | 'beta' | 'omega') => {
    setSelectedPlan(planKey);
  };

  const handleSumUpConnect = async () => {
    if (!sumupPlatformApiKey.trim()) {
      toast({
        title: "API Key Required",
        description: "Please enter your SumUp API key to connect your account.",
        variant: "destructive"
      });
      return;
    }
    
    await savePlatformSettings();
    
    toast({
      title: "SumUp Connected",
      description: "Your SumUp API key has been saved and connected successfully.",
    });
  };

  const handleSumUpApiKeyChange = (value: string) => {
    setSumupPlatformApiKey(value);
    setSettingsSaved(false);
    setHasUnsavedChanges(true);
  };

  // Additional credential change handlers
  const handleCredentialChange = (setter: React.Dispatch<React.SetStateAction<string>>) => (value: string) => {
    setter(value);
    setSettingsSaved(false);
    setHasUnsavedChanges(true);
  };

  const togglePaymentMethod = (method: keyof typeof paymentMethods) => {
    setPaymentMethods(prev => ({
      ...prev,
      [method]: !prev[method]
    }));
    setSettingsSaved(false);
    setHasUnsavedChanges(true);
  };

  const toggleSystemSetting = (setting: keyof typeof systemSettings) => {
    setSystemSettings(prev => ({
      ...prev,
      [setting]: !prev[setting]
    }));
    setSettingsSaved(false);
    setHasUnsavedChanges(true);
  };

  const pricingPlans = [
    {
      name: "Alpha",
      symbol: "α",
      price: "£0",
      period: "per month + 1%",
      description: "Perfect for new restaurants & food trucks",
      features: [
        "All transactions at 1% (paid by customer)",
        "Up to 500 transactions/month",
        "Basic POS functions",
        "Digital receipts",
        "QR code ordering",
        "Single location",
        "Single user account",
        "Email support",
        "Basic sales reports"
      ],
      highlighted: false,
      buttonText: "Get Started Free",
      planKey: 'alpha' as const
    },
    {
      name: "Beta",
      symbol: "β", 
      price: "£49",
      period: "per month + 1%",
      description: "For growing restaurants (Competitors: £69-89/month)",
      features: [
        "All transactions at 1% (paid by customer)",
        "Unlimited transactions",
        "Everything in Alpha PLUS:",
        "Full kitchen display system",
        "Station-based order routing",
        "Up to 5 staff accounts",
        "Staff scheduling & time tracking",
        "Inventory management with alerts",
        "Xero accounting integration",
        "Real-time analytics",
        "Waste tracking",
        "Priority email & chat support",
        "2 locations included"
      ],
      highlighted: true,
      buttonText: "Most Popular",
      planKey: 'beta' as const
    },
    {
      name: "Omega",
      symbol: "Ω",
      price: "£119",
      period: "per month + 1%",
      description: "For restaurant groups & franchises (Competitors: £165-399/month)",
      features: [
        "All transactions at 1% (paid by customer)",
        "Unlimited everything",
        "Everything in Beta PLUS:",
        "Unlimited staff accounts",
        "Unlimited locations",
        "White-label options",
        "Advanced analytics & forecasting",
        "Custom integrations",
        "Dedicated account manager",
        "24/7 phone support",
        "Staff performance analytics",
        "Payroll integration",
        "Bulk menu management",
        "Custom training"
      ],
      highlighted: false,
      buttonText: "Contact Sales",
      planKey: 'omega' as const
    }
  ];

  // Platform owner sees admin controls, regular users see plan selection
  if (isPlatformOwner()) {
    return (
      <div className="py-8 bg-gradient-to-br from-orange-50 to-gray-100 min-h-screen">
        <div className="max-w-7xl mx-auto px-6">
          {/* Header */}
          <div className="text-center mb-12">
            <div className="flex items-center justify-center gap-4 mb-6">
              <img 
                src="/lovable-uploads/ae344ce5-1c9f-41c8-b990-94ddff083a5a.png" 
                alt="Fynlo Logo" 
                className="h-16 w-auto"
              />
              <h1 className="text-4xl md:text-5xl font-bold text-brand-black">Platform Settings</h1>
            </div>
            <Badge variant="secondary" className="mb-4 bg-purple-100 text-purple-700">Platform Administrator</Badge>
            <p className="text-xl text-brand-gray max-w-3xl mx-auto leading-relaxed">
              Complete control over your Fynlo platform. Configure payment methods, system settings, and manage global platform features.
            </p>
          </div>

          {/* Current Status - Real Data */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-12">
            <Card className="bg-white border-l-4 border-l-brand-orange">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Crown className="w-8 h-8 text-brand-orange" />
                  <div>
                    <h3 className="font-bold text-lg text-brand-black">Omega Plan</h3>
                    <p className="text-brand-gray">Platform Owner</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-green-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  {platformStats.systemHealth === 'healthy' ? (
                    <CheckCircle className="w-8 h-8 text-green-600" />
                  ) : platformStats.systemHealth === 'warning' ? (
                    <AlertCircle className="w-8 h-8 text-yellow-600" />
                  ) : (
                    <AlertCircle className="w-8 h-8 text-red-600" />
                  )}
                  <div>
                    <h3 className="font-bold text-lg text-brand-black">System Status</h3>
                    <p className={`${
                      platformStats.systemHealth === 'healthy' ? 'text-green-600' :
                      platformStats.systemHealth === 'warning' ? 'text-yellow-600' : 'text-red-600'
                    }`}>
                      {platformStats.systemHealth === 'healthy' ? 'All Systems Operational' :
                       platformStats.systemHealth === 'warning' ? 'System Warning' : 'System Error'}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-blue-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Users className="w-8 h-8 text-blue-600" />
                  <div>
                    <h3 className="font-bold text-lg text-brand-black">Total Users</h3>
                    <p className="text-blue-600">
                      {loading ? 'Loading...' : `${platformStats.totalUsers.toLocaleString()} Registered`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-white border-l-4 border-l-purple-500">
              <CardContent className="p-6">
                <div className="flex items-center gap-3">
                  <Building className="w-8 h-8 text-purple-600" />
                  <div>
                    <h3 className="font-bold text-lg text-brand-black">Active Restaurants</h3>
                    <p className="text-purple-600">
                      {loading ? 'Loading...' : `${platformStats.activeRestaurants.toLocaleString()} Businesses`}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue and Transaction Stats */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <BarChart3 className="w-8 h-8 text-brand-orange" />
                  <div>
                    <h3 className="font-bold text-lg text-brand-black">Monthly Revenue</h3>
                    <p className="text-brand-gray">This month's platform revenue</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-brand-orange">
                  {loading ? 'Loading...' : `£${platformStats.monthlyRevenue.toLocaleString('en-GB', { minimumFractionDigits: 2 })}`}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-white shadow-lg">
              <CardContent className="p-6">
                <div className="flex items-center gap-3 mb-4">
                  <CreditCard className="w-8 h-8 text-green-600" />
                  <div>
                    <h3 className="font-bold text-lg text-brand-black">Total Transactions</h3>
                    <p className="text-brand-gray">All-time platform transactions</p>
                  </div>
                </div>
                <p className="text-3xl font-bold text-green-600">
                  {loading ? 'Loading...' : platformStats.totalTransactions.toLocaleString()}
                </p>
              </CardContent>
            </Card>
          </div>

          {/* Payment Methods Configuration */}
          <Card className="mb-8 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl text-brand-black">
                <CreditCard className="w-6 h-6 text-brand-orange" />
                Payment Methods Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* SumUp Platform Integration */}
              <div className="p-6 bg-orange-50 rounded-xl border border-orange-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-brand-orange" />
                  SumUp Platform Integration (Client Subscriptions)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sumup-platform-api-key" className="text-brand-black font-medium">SumUp Platform API Key</Label>
                      <Input
                        id="sumup-platform-api-key"
                        type="password"
                        placeholder="Enter your SumUp platform API key"
                        value={sumupPlatformApiKey}
                        onChange={(e) => handleCredentialChange(setSumupPlatformApiKey)(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-brand-black">Integration Status</h4>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        sumupPlatformApiKey && settingsSaved ? 'bg-green-500' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm text-brand-gray">
                        {sumupPlatformApiKey && settingsSaved ? 'Connected & Saved' : sumupPlatformApiKey ? 'Key Entered - Click Save' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-sm text-brand-gray">
                      {sumupPlatformApiKey && settingsSaved 
                        ? 'Your SumUp platform API key is ready for client subscription processing.'
                        : 'Platform admin uses this for processing client subscription payments.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* SumUp Restaurant Integration */}
              <div className="p-6 bg-green-50 rounded-xl border border-green-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-green-600" />
                  SumUp Restaurant Integration (Restaurant Sales)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="sumup-restaurant-api-key" className="text-brand-black font-medium">SumUp Restaurant API Key</Label>
                      <Input
                        id="sumup-restaurant-api-key"
                        type="password"
                        placeholder="Enter your SumUp restaurant API key"
                        value={sumupRestaurantApiKey}
                        onChange={(e) => handleCredentialChange(setSumupRestaurantApiKey)(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-brand-black">Integration Status</h4>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        sumupRestaurantApiKey && settingsSaved ? 'bg-green-500' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm text-brand-gray">
                        {sumupRestaurantApiKey && settingsSaved ? 'Connected & Saved' : sumupRestaurantApiKey ? 'Key Entered - Click Save' : 'Not Connected'}
                      </span>
                    </div>
                    <p className="text-sm text-brand-gray">
                      {sumupRestaurantApiKey && settingsSaved 
                        ? 'Your SumUp restaurant API key is ready for restaurant sales processing.'
                        : 'Restaurants use this for processing customer payments and sales.'
                      }
                    </p>
                  </div>
                </div>
              </div>

              {/* Stripe Integration */}
              <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                  Stripe Integration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="stripe-secret-key" className="text-brand-black font-medium">Stripe Secret Key</Label>
                      <Input
                        id="stripe-secret-key"
                        type="password"
                        placeholder="Enter your Stripe secret key"
                        value={stripeSecretKey}
                        onChange={(e) => handleCredentialChange(setStripeSecretKey)(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-brand-black">Integration Status</h4>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        stripeSecretKey && settingsSaved ? 'bg-green-500' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm text-brand-gray">
                        {stripeSecretKey && settingsSaved ? 'Connected & Saved' : stripeSecretKey ? 'Key Entered - Click Save' : 'Not Connected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Square Integration */}
              <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-purple-600" />
                  Square Integration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="square-access-token" className="text-brand-black font-medium">Square Access Token</Label>
                      <Input
                        id="square-access-token"
                        type="password"
                        placeholder="Enter your Square access token"
                        value={squareAccessToken}
                        onChange={(e) => handleCredentialChange(setSquareAccessToken)(e.target.value)}
                        className="mt-1"
                      />
                    </div>
                  </div>
                  <div className="space-y-3">
                    <h4 className="font-semibold text-brand-black">Integration Status</h4>
                    <div className="flex items-center gap-2">
                      <div className={`w-3 h-3 rounded-full ${
                        squareAccessToken && settingsSaved ? 'bg-green-500' : 'bg-yellow-400'
                      }`}></div>
                      <span className="text-sm text-brand-gray">
                        {squareAccessToken && settingsSaved ? 'Connected & Saved' : squareAccessToken ? 'Key Entered - Click Save' : 'Not Connected'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Payment Methods Toggle */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-brand-black">Available Payment Methods</h3>
                  {Object.entries(paymentMethods).map(([method, enabled]) => (
                    <div key={method} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <CreditCard className="w-5 h-5 text-brand-gray" />
                        <span className="capitalize font-medium text-brand-black">{method}</span>
                      </div>
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => togglePaymentMethod(method as keyof typeof paymentMethods)}
                      />
                    </div>
                  ))}
                </div>
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold text-brand-black">Transaction Fees</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-brand-black">SumUp</span>
                      <span className="font-semibold text-brand-orange">1.69%</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-brand-black">Stripe</span>
                      <span className="font-semibold text-brand-orange">1.4% + 20p</span>
                    </div>
                    <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                      <span className="text-brand-black">Cash</span>
                      <span className="font-semibold text-green-600">Free</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* System Configuration */}
          <Card className="mb-8 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl text-brand-black">
                <Settings className="w-6 h-6 text-brand-orange" />
                System Configuration
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {Object.entries(systemSettings).map(([setting, enabled]) => (
                  <div key={setting} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
                    <div>
                      <span className="font-medium text-brand-black capitalize">
                        {setting.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                      </span>
                      <p className="text-sm text-brand-gray mt-1">
                        {setting === 'maintenanceMode' && 'Put the platform in maintenance mode'}
                        {setting === 'registrationEnabled' && 'Allow new restaurant registrations'}
                        {setting === 'emailVerificationRequired' && 'Require email verification for new users'}
                        {setting === 'multiLocationEnabled' && 'Enable multi-location features'}
                      </p>
                    </div>
                    <Switch
                      checked={enabled}
                      onCheckedChange={() => toggleSystemSetting(setting as keyof typeof systemSettings)}
                    />
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Infrastructure Configuration */}
          <Card className="mb-8 bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl text-brand-black">
                <Building className="w-6 h-6 text-brand-orange" />
                Infrastructure Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* DigitalOcean Configuration */}
              <div className="p-6 bg-blue-50 rounded-xl border border-blue-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  DigitalOcean Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="do-api-token" className="text-brand-black font-medium">DigitalOcean API Token</Label>
                    <Input
                      id="do-api-token"
                      type="password"
                      placeholder="Enter your DO API token"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="do-database-url" className="text-brand-black font-medium">Database Connection URL</Label>
                    <Input
                      id="do-database-url"
                      type="password"
                      placeholder="postgres://user:pass@host:port/db"
                      value={databaseUrl}
                      onChange={(e) => setDatabaseUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="do-app-platform-id" className="text-brand-black font-medium">App Platform ID</Label>
                    <Input
                      id="do-app-platform-id"
                      placeholder="Enter your App Platform ID"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="do-cache-url" className="text-brand-black font-medium">Cache URL (Redis)</Label>
                    <Input
                      id="do-cache-url"
                      type="password"
                      placeholder="redis://user:pass@host:port"
                      value={redisUrl}
                      onChange={(e) => setRedisUrl(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="valkyrie-config" className="text-brand-black font-medium">Valkyrie Configuration</Label>
                    <Input
                      id="valkyrie-config"
                      type="password"
                      placeholder="Valkyrie service configuration"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="deployment-webhook" className="text-brand-black font-medium">Deployment Webhook URL</Label>
                    <Input
                      id="deployment-webhook"
                      type="password"
                      placeholder="Webhook URL for deployments"
                    />
                  </div>
                </div>
              </div>

              {/* Supabase Configuration */}
              <div className="p-6 bg-green-50 rounded-xl border border-green-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <Key className="w-5 h-5 text-green-600" />
                  Supabase Configuration
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="supabase-url" className="text-brand-black font-medium">Supabase URL</Label>
                    <Input
                      id="supabase-url"
                      placeholder="https://xxx.supabase.co"
                      defaultValue="https://eweggzpvuqczrrrwszyy.supabase.co"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabase-anon-key" className="text-brand-black font-medium">Supabase Anon Key</Label>
                    <Input
                      id="supabase-anon-key"
                      type="password"
                      placeholder="Enter your Supabase anon key"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="supabase-service-key" className="text-brand-black font-medium">Supabase Service Role Key</Label>
                    <Input
                      id="supabase-service-key"
                      type="password"
                      placeholder="Enter your Supabase service role key"
                      value={supabaseServiceRole}
                      onChange={(e) => setSupabaseServiceRole(e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="jwt-secret" className="text-brand-black font-medium">JWT Secret</Label>
                    <Input
                      id="jwt-secret"
                      type="password"
                      placeholder="Enter JWT secret for token verification"
                    />
                  </div>
                </div>
              </div>

              {/* Environment Variables */}
              <div className="p-6 bg-purple-50 rounded-xl border border-purple-200">
                <h3 className="text-xl font-bold text-brand-black mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-purple-600" />
                  Environment Variables
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="environment" className="text-brand-black font-medium">Environment</Label>
                    <Input
                      id="environment"
                      placeholder="production / staging / development"
                      defaultValue="production"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="cors-origin" className="text-brand-black font-medium">CORS Origin</Label>
                    <Input
                      id="cors-origin"
                      placeholder="https://yourdomain.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="log-level" className="text-brand-black font-medium">Log Level</Label>
                    <Input
                      id="log-level"
                      placeholder="info / debug / error"
                      defaultValue="info"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="rate-limit" className="text-brand-black font-medium">Rate Limit (per minute)</Label>
                    <Input
                      id="rate-limit"
                      placeholder="60"
                      defaultValue="60"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save Settings Section */}
          <Card className="bg-white shadow-lg border-2 border-orange-200">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {hasUnsavedChanges ? (
                    <>
                      <AlertCircle className="w-6 h-6 text-amber-500" />
                      <div>
                        <h3 className="font-bold text-amber-700">Unsaved Changes</h3>
                        <p className="text-sm text-amber-600">You have modified settings that need to be saved</p>
                      </div>
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-6 h-6 text-green-600" />
                      <div>
                        <h3 className="font-bold text-green-700">All Settings Saved</h3>
                        <p className="text-sm text-green-600">Your platform configuration is up to date</p>
                      </div>
                    </>
                  )}
                </div>
                <div className="flex gap-3">
                  {hasUnsavedChanges && (
                    <Button 
                      variant="outline"
                      onClick={() => {
                        loadPlatformSettings();
                        setHasUnsavedChanges(false);
                      }}
                    >
                      Reset Changes
                    </Button>
                  )}
                  <Button 
                    onClick={savePlatformSettings}
                    size="lg"
                    className={`px-8 font-semibold ${
                      hasUnsavedChanges 
                        ? 'bg-brand-orange hover:bg-orange-600 text-white' 
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                  >
                    {hasUnsavedChanges ? (
                      <>
                        <Settings className="w-5 h-5 mr-2" />
                        Save All Settings
                      </>
                    ) : (
                      <>
                        <Check className="w-5 h-5 mr-2" />
                        All Settings Saved
                      </>
                    )}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Save All Settings - Floating Action (backup) */}
          {hasUnsavedChanges && (
            <div className="fixed bottom-6 right-6 z-50">
              <Button 
                onClick={savePlatformSettings}
                size="lg"
                className="bg-brand-orange hover:bg-orange-600 text-white shadow-xl px-8 py-4 text-lg font-semibold animate-pulse"
              >
                <Check className="w-5 h-5 mr-2" />
                Save All Settings
              </Button>
            </div>
          )}

          {/* API Configuration */}
          <Card className="bg-white shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-3 text-2xl text-brand-black">
                <Key className="w-6 h-6 text-brand-orange" />
                API & Integration Settings
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-6">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h3 className="font-semibold text-brand-black mb-2">Platform API Status</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-sm text-green-700">API is operational</span>
                  </div>
                  <p className="text-sm text-brand-gray">
                    Current API version: v2.1.0 • Last updated: Today at 14:30
                  </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <Button variant="outline" className="h-16 flex-col gap-2">
                    <BarChart3 className="w-5 h-5" />
                    View API Analytics
                  </Button>
                  <Button variant="outline" className="h-16 flex-col gap-2">
                    <Key className="w-5 h-5" />
                    Manage API Keys
                  </Button>
                  <Button variant="outline" className="h-16 flex-col gap-2">
                    <Globe className="w-5 h-5" />
                    Test Connections
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // Regular customer dashboard
  return (
    <div className="py-12 bg-gradient-to-br from-orange-50 to-gray-100 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        {/* Header with Logo */}
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-6">
            <img 
              src="/lovable-uploads/ae344ce5-1c9f-41c8-b990-94ddff083a5a.png" 
              alt="Fynlo Logo" 
              className="h-16 w-auto"
            />
            <h1 className="text-4xl md:text-5xl font-bold text-brand-black">Settings</h1>
          </div>
          <Badge variant="secondary" className="mb-4 bg-orange-100 text-brand-orange">Subscription Management</Badge>
          <h2 className="text-3xl md:text-4xl font-bold text-brand-black mb-6">
            Choose the plan that's right
            <span className="block text-brand-orange mt-2">
              for your business
            </span>
          </h2>
          <p className="text-xl text-brand-gray max-w-3xl mx-auto leading-relaxed">
            Industry-leading 1% transaction fee across all tiers. No hidden costs, no setup fees. 
            Start free or choose a plan that grows with your business.
          </p>
        </div>

        {/* Current Plan Status */}
        <div className="text-center mb-12 p-8 bg-white rounded-2xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Crown className="w-6 h-6 text-brand-orange" />
            <h3 className="text-2xl font-bold text-brand-black">Current Plan</h3>
          </div>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Badge className="bg-brand-orange text-white">
              {pricingPlans.find(p => p.planKey === currentPlan)?.name} Plan
            </Badge>
          </div>
          <p className="text-lg text-brand-gray">
            {pricingPlans.find(p => p.planKey === currentPlan)?.description}
          </p>
        </div>

        {/* Competitive Advantage Highlight */}
        <div className="text-center mb-12 p-8 bg-white rounded-2xl shadow-lg border border-gray-200">
          <h3 className="text-2xl font-bold text-brand-black mb-4">Industry-Leading Transaction Rates</h3>
          <p className="text-lg text-brand-gray mb-4">
            Just 1% transaction fee across all tiers - while competitors charge 2.9%+
          </p>
          <div className="flex items-center justify-center space-x-8 text-sm">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-brand-orange rounded-full"></div>
              <span className="text-brand-black font-semibold">Fynlo: 1%</span>
            </div>
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
              <span className="text-brand-gray">Competitors: 2.9%+</span>
            </div>
          </div>
        </div>

        {/* Pricing Cards */}
        <div id="pricing-plans" className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-16">
          {pricingPlans.map((plan, index) => (
            <Card 
              key={index}
              className={`relative overflow-hidden transition-all duration-300 hover:shadow-xl cursor-pointer group ${
                currentPlan === plan.planKey
                  ? 'ring-4 ring-brand-orange shadow-xl' 
                  : plan.highlighted 
                    ? 'ring-2 ring-brand-orange shadow-xl' 
                    : 'hover:shadow-lg hover:ring-2 hover:ring-orange-300'
              }`}
              onClick={() => handlePlanClick(plan.planKey)}
            >
              {currentPlan === plan.planKey && (
                <div className="absolute top-0 right-0 px-3 py-1 text-sm font-semibold bg-brand-orange text-white">
                  Current Plan
                </div>
              )}
              
              {plan.highlighted && currentPlan !== plan.planKey && (
                <div className="absolute top-0 right-0 px-3 py-1 text-sm font-semibold bg-brand-orange text-white">
                  Most Popular
                </div>
              )}

              {plan.planKey === 'alpha' && (
                <div className="absolute top-0 left-0 px-3 py-1 text-sm font-semibold bg-green-500 text-white">
                  🆓 FREE
                </div>
              )}

              {plan.planKey === 'omega' && (
                <div className="absolute top-0 left-0 px-3 py-1 text-sm font-semibold bg-purple-600 text-white">
                  🚀 ENTERPRISE
                </div>
              )}
              
              <CardContent className="p-8">
                <div className="text-center mb-6">
                  {/* Symbol in Box - matching brand theme */}
                  <div className={`text-6xl font-bold mb-4 transition-all duration-300 border-2 border-gray-300 rounded-lg w-24 h-24 flex items-center justify-center mx-auto ${
                    currentPlan === plan.planKey 
                      ? 'scale-110 text-brand-orange border-brand-orange' 
                      : 'group-hover:scale-110 text-brand-black group-hover:border-brand-orange'
                  } ${plan.planKey === 'beta' ? 'text-5xl' : ''}`}>
                    {plan.symbol}
                  </div>
                  
                  {/* Plan Name with brand styling */}
                  <h3 className={`text-2xl font-bold mb-2 transition-colors duration-300 ${
                    currentPlan === plan.planKey 
                      ? 'text-brand-black' 
                      : 'text-brand-black group-hover:text-brand-orange'
                  }`}>
                    <span className="text-brand-black">{plan.name.slice(0, -1)}</span><span className="text-brand-orange">{plan.name.slice(-1)}</span>
                  </h3>
                  
                  {/* Description */}
                  <p className={`text-lg mb-4 transition-colors duration-300 ${
                    currentPlan === plan.planKey 
                      ? 'text-brand-gray' 
                      : 'text-brand-gray group-hover:text-brand-black'
                  }`}>
                    {plan.description}
                  </p>
                  
                  {/* Price */}
                  <div className="text-4xl font-bold text-brand-black mb-2">
                    {plan.price}
                    <span className="text-lg font-normal text-brand-gray">/{plan.period}</span>
                  </div>
                </div>

                <div className="space-y-4 mb-8 max-h-80 overflow-y-auto">
                  {plan.features.map((feature, idx) => (
                    <div key={idx} className="flex items-start">
                      <Check className="w-5 h-5 text-green-600 mr-3 mt-0.5 flex-shrink-0" />
                      <span className={`text-brand-gray ${feature.includes('PLUS:') ? 'font-semibold text-brand-black' : ''}`}>
                        {feature}
                      </span>
                    </div>
                  ))}
                </div>

                {currentPlan !== plan.planKey && plan.planKey !== 'alpha' && (
                  <Button 
                    size="lg" 
                    className="w-full bg-brand-orange hover:bg-orange-600 text-white transition-all duration-300"
                    onClick={() => handleUpgrade(plan.planKey as 'beta' | 'omega')}
                  >
                    Upgrade to {plan.name} with SumUp
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                )}

                {currentPlan === plan.planKey && (
                  <Button 
                    size="lg" 
                    className="w-full bg-brand-orange hover:bg-orange-600 text-white shadow-lg"
                    disabled
                  >
                    Current Plan
                  </Button>
                )}

                {plan.planKey === 'alpha' && currentPlan !== plan.planKey && (
                  <Button 
                    size="lg" 
                    className="w-full bg-brand-black hover:bg-gray-800 text-white"
                  >
                    {plan.buttonText}
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform duration-300" />
                  </Button>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Additional Information */}
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg border border-gray-200 mb-8">
          <h3 className="text-2xl font-bold text-brand-black mb-4">All plans include:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-brand-gray">
            <div className="flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <span>No setup fees</span>
            </div>
            <div className="flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <span>No monthly minimums</span>
            </div>
            <div className="flex items-center justify-center">
              <Check className="w-5 h-5 text-green-600 mr-2" />
              <span>Cancel anytime</span>
            </div>
          </div>
          
          <div className="mt-6 p-4 bg-orange-50 rounded-xl border border-orange-200">
            <p className="text-brand-black font-semibold">
              💰 Save thousands compared to competitors charging 2.9%+ transaction fees
            </p>
          </div>
        </div>

        {/* Demo Notice */}
        <div className="text-center bg-white rounded-2xl p-8 shadow-lg border border-gray-200">
          <div className="flex items-start justify-center gap-3">
            <div className="w-6 h-6 bg-yellow-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
              <span className="text-xs font-bold text-yellow-800">!</span>
            </div>
            <div>
              <h3 className="font-semibold text-yellow-800">Demo Mode</h3>
              <p className="text-sm text-yellow-700 mt-1">
                This is a demonstration. In a real implementation, upgrade buttons would redirect to SumUp checkout. 
                For testing, you can manually change the subscription level in the user data or implement a demo toggle.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};