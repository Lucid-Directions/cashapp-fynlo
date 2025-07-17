import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, CreditCard, CheckCircle, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface SumUpPaymentModalProps {
  isOpen: boolean;
  onClose: () => void;
  planType: 'beta' | 'omega';
  planName: string;
  planPrice: number;
  onSuccess: () => void;
}

export const SumUpPaymentModal: React.FC<SumUpPaymentModalProps> = ({
  isOpen,
  onClose,
  planType,
  planName,
  planPrice,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [checkoutUrl, setCheckoutUrl] = useState<string | null>(null);
  const [paymentStatus, setPaymentStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && !checkoutUrl) {
      createCheckout();
    }
  }, [isOpen]);

  const createCheckout = async () => {
    setLoading(true);
    setPaymentStatus('processing');
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('User not authenticated');

      const response = await fetch('/functions/v1/sumup-payments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
        },
        body: JSON.stringify({
          action: 'create_recurring_checkout',
          amount: planPrice,
          currency: 'GBP',
          customer_id: user.id,
          plan_type: planType,
          return_url: `${window.location.origin}/payment-success?plan=${planType}`,
          description: `${planName} Plan Subscription - £${planPrice}/month`
        }),
      });

      const result = await response.json();
      
      if (!result.success) {
        throw new Error(result.error || 'Failed to create checkout');
      }

      setCheckoutUrl(result.checkout_url);
      
      // Open SumUp checkout in a new window
      const paymentWindow = window.open(
        result.checkout_url,
        'sumup-payment',
        'width=500,height=600,scrollbars=yes,resizable=yes'
      );

      // Listen for payment completion
      const messageListener = (event: MessageEvent) => {
        if (event.origin !== 'https://pay.sumup.com') return;
        
        if (event.data.type === 'payment_success') {
          setPaymentStatus('success');
          updateUserSubscription();
          paymentWindow?.close();
        } else if (event.data.type === 'payment_error') {
          setPaymentStatus('error');
          paymentWindow?.close();
        }
      };

      window.addEventListener('message', messageListener);
      
      // Clean up listener when window closes
      const checkClosed = setInterval(() => {
        if (paymentWindow?.closed) {
          clearInterval(checkClosed);
          window.removeEventListener('message', messageListener);
          if (paymentStatus === 'processing') {
            setPaymentStatus('error');
            toast({
              title: "Payment Cancelled",
              description: "Payment window was closed before completion",
              variant: "destructive",
            });
          }
        }
      }, 1000);

    } catch (error) {
      console.error('Error creating checkout:', error);
      setPaymentStatus('error');
      toast({
        title: "Error",
        description: `Failed to create payment: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const updateUserSubscription = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const features = planType === 'beta' 
        ? ['analytics', 'inventory_management', 'staff_management', 'customer_database']
        : ['analytics', 'inventory_management', 'staff_management', 'customer_database', 'location_management', 'api_access', 'advanced_reporting', 'business_management'];

      const { error } = await supabase
        .from('user_subscriptions')
        .upsert({
          user_id: user.id,
          subscription_plan: planType,
          enabled_features: features,
          updated_at: new Date().toISOString()
        });

      if (error) throw error;

      toast({
        title: "Success!",
        description: `Welcome to ${planName}! Your subscription is now active.`,
      });

      onSuccess();
    } catch (error) {
      console.error('Error updating subscription:', error);
      toast({
        title: "Warning",
        description: "Payment successful but subscription update failed. Please contact support.",
        variant: "destructive",
      });
    }
  };

  const handleClose = () => {
    if (paymentStatus !== 'processing') {
      setCheckoutUrl(null);
      setPaymentStatus('idle');
      onClose();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <CreditCard className="w-5 h-5" />
            <span>Subscribe to {planName}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Plan Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <span className="font-medium">{planName} Plan</span>
              <Badge variant="default">
                £{planPrice}/month
              </Badge>
            </div>
            <p className="text-sm text-gray-600">
              Recurring monthly subscription
            </p>
            {planType === 'beta' && (
              <p className="text-xs text-gray-500 mt-1">
                Includes: Analytics, Inventory Management, Staff Management, Customer Database
              </p>
            )}
            {planType === 'omega' && (
              <p className="text-xs text-gray-500 mt-1">
                Includes: Everything in Beta + Multi-location, API Access, Advanced Reports
              </p>
            )}
          </div>

          {/* Payment Status */}
          <div className="flex items-center justify-center space-x-2 p-4 border rounded-lg">
            {paymentStatus === 'idle' && (
              <>
                <CreditCard className="w-5 h-5 text-gray-500" />
                <span className="text-gray-600">Ready to process payment</span>
              </>
            )}
            {paymentStatus === 'processing' && (
              <>
                <Loader2 className="w-5 h-5 animate-spin text-blue-600" />
                <span className="text-blue-600">Processing payment...</span>
              </>
            )}
            {paymentStatus === 'success' && (
              <>
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-600">Payment successful!</span>
              </>
            )}
            {paymentStatus === 'error' && (
              <>
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-600">Payment failed</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            {paymentStatus === 'idle' && (
              <Button
                onClick={createCheckout}
                disabled={loading}
                className="flex-1"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creating Payment...
                  </>
                ) : (
                  <>
                    <CreditCard className="w-4 h-4 mr-2" />
                    Pay with SumUp
                  </>
                )}
              </Button>
            )}
            
            {paymentStatus === 'error' && (
              <Button
                onClick={createCheckout}
                disabled={loading}
                className="flex-1"
              >
                Try Again
              </Button>
            )}

            {paymentStatus === 'success' && (
              <Button
                onClick={handleClose}
                className="flex-1"
              >
                Complete
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleClose}
              disabled={paymentStatus === 'processing'}
            >
              {paymentStatus === 'processing' ? 'Processing...' : 'Cancel'}
            </Button>
          </div>

          {/* SumUp Branding */}
          <div className="text-center">
            <p className="text-xs text-gray-500">
              Secure payment processing by SumUp
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};