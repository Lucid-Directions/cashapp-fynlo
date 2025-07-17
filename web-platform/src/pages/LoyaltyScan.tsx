import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Gift, Star, Trophy, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ScanData {
  campaignId: string;
  type: string;
  restaurantId: string;
  programId: string;
}

export default function LoyaltyScan() {
  const [searchParams] = useSearchParams();
  const [scanData, setScanData] = useState<ScanData | null>(null);
  const [campaign, setCampaign] = useState<any>(null);
  const [restaurant, setRestaurant] = useState<any>(null);
  const [customerData, setCustomerData] = useState({
    email: '',
    phone: '',
    name: '',
    birthday: ''
  });
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState(false);
  const [claimed, setClaimed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const campaignParam = searchParams.get('campaign');
    const dataParam = searchParams.get('data');
    
    if (dataParam) {
      try {
        const decoded = JSON.parse(decodeURIComponent(dataParam));
        setScanData(decoded);
        loadCampaignData(decoded.campaignId);
      } catch (error) {
        console.error('Error parsing scan data:', error);
        toast({
          title: "Invalid QR Code",
          description: "This QR code is not valid or has expired",
          variant: "destructive",
        });
      }
    } else if (campaignParam) {
      // Legacy support for campaign parameter
      loadCampaignData(campaignParam);
    }
  }, [searchParams]);

  const loadCampaignData = async (campaignId: string) => {
    try {
      const { data: settings } = await supabase
        .from('platform_settings')
        .select('setting_value')
        .eq('setting_key', 'qr_campaigns')
        .single();

      const campaigns = (settings?.setting_value as any)?.campaigns || [];
      const foundCampaign = campaigns.find((c: any) => c.id === campaignId);
      
      if (!foundCampaign) {
        throw new Error('Campaign not found');
      }

      setCampaign(foundCampaign);

      // Load restaurant data
      const { data: restaurantData } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', foundCampaign.restaurant_id)
        .single();

      setRestaurant(restaurantData);

    } catch (error) {
      console.error('Error loading campaign:', error);
      toast({
        title: "Campaign Not Found",
        description: "This campaign is no longer available",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const claimReward = async () => {
    if (!campaign || !restaurant) return;

    setClaiming(true);
    try {
      // Call the loyalty tracker edge function
      const { data, error } = await supabase.functions.invoke('loyalty-tracker', {
        body: {
          type: 'qr_scan',
          campaign_id: campaign.id,
          restaurant_id: campaign.restaurant_id,
          program_id: campaign.program_id,
          customer_data: customerData,
          reward: campaign.qr_data.reward
        }
      });

      if (error) throw error;

      setClaimed(true);
      toast({
        title: "Reward Claimed!",
        description: getRewardMessage(campaign.qr_data.reward),
      });

    } catch (error) {
      console.error('Error claiming reward:', error);
      toast({
        title: "Error",
        description: "Failed to claim reward. Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(false);
    }
  };

  const getRewardMessage = (reward: any) => {
    switch (reward.type) {
      case 'points':
        return `You've earned ${reward.value} loyalty points!`;
      case 'percentage':
        return `You've unlocked ${reward.value}% off your next order!`;
      case 'free_item':
        return `You've earned a free ${reward.value}!`;
      case 'random':
        return "You've unlocked a mystery reward!";
      default:
        return "You've claimed your reward!";
    }
  };

  const getRewardIcon = (type: string) => {
    switch (type) {
      case 'points':
        return <Star className="w-8 h-8 text-yellow-500" />;
      case 'percentage':
        return <Trophy className="w-8 h-8 text-blue-500" />;
      case 'free_item':
        return <Gift className="w-8 h-8 text-green-500" />;
      case 'birthday':
        return <Heart className="w-8 h-8 text-red-500" />;
      default:
        return <Gift className="w-8 h-8 text-primary" />;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p>Loading your reward...</p>
        </div>
      </div>
    );
  }

  if (!campaign || !restaurant) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Invalid QR Code</CardTitle>
            <CardDescription>
              This QR code is not valid or has expired.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (claimed) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4">
              {getRewardIcon(campaign.qr_data.reward.type)}
            </div>
            <CardTitle className="text-green-600">Reward Claimed!</CardTitle>
            <CardDescription>
              {getRewardMessage(campaign.qr_data.reward)}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Thank you for joining {restaurant.name}'s loyalty program!
            </p>
            <Button className="w-full" onClick={() => window.close()}>
              Close
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            {getRewardIcon(campaign.campaign_type)}
          </div>
          <CardTitle>{campaign.name}</CardTitle>
          <CardDescription>{campaign.description}</CardDescription>
          <p className="text-sm font-medium text-primary">
            {restaurant.name}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-primary/10 p-4 rounded-lg text-center">
            <p className="font-semibold">Your Reward:</p>
            <p className="text-primary">{getRewardMessage(campaign.qr_data.reward)}</p>
          </div>

          <div className="space-y-3">
            <div>
              <Label htmlFor="email">Email Address</Label>
              <Input
                id="email"
                type="email"
                value={customerData.email}
                onChange={(e) => setCustomerData(prev => ({ ...prev, email: e.target.value }))}
                placeholder="your@email.com"
                required
              />
            </div>

            <div>
              <Label htmlFor="name">Name (Optional)</Label>
              <Input
                id="name"
                value={customerData.name}
                onChange={(e) => setCustomerData(prev => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
              />
            </div>

            <div>
              <Label htmlFor="phone">Phone (Optional)</Label>
              <Input
                id="phone"
                type="tel"
                value={customerData.phone}
                onChange={(e) => setCustomerData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="Your phone number"
              />
            </div>

            {campaign.campaign_type === 'birthday' && (
              <div>
                <Label htmlFor="birthday">Birthday</Label>
                <Input
                  id="birthday"
                  type="date"
                  value={customerData.birthday}
                  onChange={(e) => setCustomerData(prev => ({ ...prev, birthday: e.target.value }))}
                  required
                />
              </div>
            )}
          </div>

          <Button 
            className="w-full" 
            onClick={claimReward}
            disabled={!customerData.email || claiming || (campaign.campaign_type === 'birthday' && !customerData.birthday)}
          >
            {claiming ? 'Claiming...' : 'Claim Reward'}
          </Button>

          <p className="text-xs text-muted-foreground text-center">
            By claiming this reward, you agree to join our loyalty program and receive promotional emails.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}