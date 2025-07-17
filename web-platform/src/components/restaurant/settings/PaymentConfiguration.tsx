import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { 
  CreditCard, 
  Banknote,
  Save, 
  Shield,
  AlertTriangle,
  CheckCircle
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface BankDetails {
  account_holder_name: string;
  bank_name: string;
  account_number: string;
  sort_code: string;
  iban?: string;
  swift_code?: string;
}

interface PaymentConfigurationProps {
  restaurantId: string;
}

export const PaymentConfiguration: React.FC<PaymentConfigurationProps> = ({ restaurantId }) => {
  const [bankDetails, setBankDetails] = useState<BankDetails>({
    account_holder_name: '',
    bank_name: '',
    account_number: '',
    sort_code: '',
    iban: '',
    swift_code: ''
  });
  const [sumupConnected, setSumupConnected] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadPaymentSettings();
  }, [restaurantId]);

  const loadPaymentSettings = async () => {
    try {
      // Load bank details from restaurant settings
      const { data: settings, error } = await supabase
        .from('restaurant_settings')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      if (settings?.payment_methods) {
        const paymentMethods = settings.payment_methods as string[];
        setSumupConnected(paymentMethods.includes('sumup'));
      }

      // Load bank details from database
      const { data: bankData } = await supabase
        .from('restaurant_bank_details')
        .select('*')
        .eq('restaurant_id', restaurantId)
        .single();

      if (bankData) {
        setBankDetails({
          account_holder_name: bankData.account_holder_name || '',
          bank_name: bankData.bank_name || '',
          account_number: bankData.account_number || '',
          sort_code: bankData.sort_code || '',
          swift_code: bankData.swift_code || '',
          iban: bankData.iban || ''
        });
      }
    } catch (error) {
      console.error('Error loading payment settings:', error);
      toast({
        title: "Error",
        description: "Failed to load payment settings",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const saveBankDetails = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('restaurant_bank_details')
        .upsert({
          restaurant_id: restaurantId,
          account_holder_name: bankDetails.account_holder_name,
          bank_name: bankDetails.bank_name,
          account_number: bankDetails.account_number,
          sort_code: bankDetails.sort_code,
          iban: bankDetails.iban,
          swift_code: bankDetails.swift_code
        });

      if (error) throw error;
      
      toast({
        title: "Success",
        description: "Bank details saved securely to database",
      });
    } catch (error) {
      console.error('Error saving bank details:', error);
      toast({
        title: "Error",
        description: "Failed to save bank details to database",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const connectSumUp = async () => {
    try {
      // Update payment methods to include SumUp
      const { data: currentSettings } = await supabase
        .from('restaurant_settings')
        .select('payment_methods')
        .eq('restaurant_id', restaurantId)
        .maybeSingle();

      const currentMethods = (currentSettings?.payment_methods as string[]) || [];
      const updatedMethods = currentMethods.includes('sumup') 
        ? currentMethods 
        : [...currentMethods, 'sumup'];

      const { error } = await supabase
        .from('restaurant_settings')
        .upsert({
          restaurant_id: restaurantId,
          payment_methods: updatedMethods
        });

      if (error) throw error;

      setSumupConnected(true);
      toast({
        title: "Success",
        description: "SumUp payment method enabled",
      });
    } catch (error) {
      console.error('Error connecting SumUp:', error);
      toast({
        title: "Error",
        description: "Failed to enable SumUp",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return <div className="p-6">Loading payment settings...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Payment Configuration</h2>
        <p className="text-gray-600">Configure your payment methods and bank details for payouts</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* SumUp Integration */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CreditCard className="w-5 h-5" />
              <span>SumUp Payment Processing</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <CreditCard className="w-5 h-5 text-blue-600" />
                </div>
                <div>
                  <h3 className="font-medium">SumUp Card Reader</h3>
                  <p className="text-sm text-gray-500">
                    Accept card payments with SumUp terminal
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

            {!sumupConnected && (
              <Button onClick={connectSumUp} className="w-full">
                Connect SumUp
              </Button>
            )}

            <div className="bg-blue-50 p-4 rounded-lg">
              <h4 className="font-medium text-blue-900 mb-2">SumUp Benefits</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Accept all major cards and contactless payments</li>
                <li>• Competitive transaction rates</li>
                <li>• Fast next-day payouts</li>
                <li>• Integrated with Fynlo platform</li>
              </ul>
            </div>
          </CardContent>
        </Card>

        {/* Bank Details */}
        <Card>
          <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Banknote className="w-5 h-5" />
            <span>Bank Account Details</span>
          </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2 p-3 bg-amber-50 rounded-lg">
              <Shield className="w-4 h-4 text-amber-600" />
              <p className="text-sm text-amber-800">
                Your bank details are encrypted and stored securely
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                <Input
                  id="account_holder_name"
                  value={bankDetails.account_holder_name}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, account_holder_name: e.target.value }))}
                  placeholder="Full name as on bank account"
                />
              </div>

              <div>
                <Label htmlFor="bank_name">Bank Name</Label>
                <Input
                  id="bank_name"
                  value={bankDetails.bank_name}
                  onChange={(e) => setBankDetails(prev => ({ ...prev, bank_name: e.target.value }))}
                  placeholder="e.g., Barclays, HSBC, Lloyds"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="account_number">Account Number</Label>
                  <Input
                    id="account_number"
                    value={bankDetails.account_number}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, account_number: e.target.value }))}
                    placeholder="12345678"
                    maxLength={8}
                  />
                </div>

                <div>
                  <Label htmlFor="sort_code">Sort Code</Label>
                  <Input
                    id="sort_code"
                    value={bankDetails.sort_code}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, sort_code: e.target.value }))}
                    placeholder="12-34-56"
                    maxLength={8}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="iban">IBAN (Optional)</Label>
                  <Input
                    id="iban"
                    value={bankDetails.iban || ''}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, iban: e.target.value }))}
                    placeholder="GB29 NWBK 6016 1331 9268 19"
                  />
                </div>

                <div>
                  <Label htmlFor="swift_code">SWIFT Code (Optional)</Label>
                  <Input
                    id="swift_code"
                    value={bankDetails.swift_code || ''}
                    onChange={(e) => setBankDetails(prev => ({ ...prev, swift_code: e.target.value }))}
                    placeholder="NWBKGB2L"
                  />
                </div>
              </div>
            </div>

            <Button onClick={saveBankDetails} disabled={saving} className="w-full">
              <Save className="w-4 h-4 mr-2" />
              Save Bank Details
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Payout Information */}
      <Card>
        <CardHeader>
          <CardTitle>Payout Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Payout Schedule</h4>
              <p className="text-sm text-gray-600">
                Daily payouts for SumUp transactions
              </p>
              <p className="text-sm text-gray-600">
                Weekly payouts for cash reconciliation
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Transaction Fees</h4>
              <p className="text-sm text-gray-600">
                Platform fee: 1% of transaction value
              </p>
              <p className="text-sm text-gray-600">
                Payment processing fees apply
              </p>
            </div>
            
            <div className="p-4 border rounded-lg">
              <h4 className="font-medium text-gray-900 mb-2">Settlement Currency</h4>
              <p className="text-sm text-gray-600">
                All payouts in GBP (£)
              </p>
              <p className="text-sm text-gray-600">
                Next payout: Within 1-2 business days
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};