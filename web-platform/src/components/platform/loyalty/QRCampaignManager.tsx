import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { QrCode, Eye, Copy, Download, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";

interface QRCampaign {
  id: string;
  name: string;
  description: string;
  campaign_type: string;
  qr_data: any;
  is_active: boolean;
  restaurant_id: string;
  program_id: string;
  created_at: string;
}

interface QRCampaignManagerProps {
  restaurants: Array<{ id: string; name: string }>;
  programs: Array<{ id: string; name: string; restaurant_id: string }>;
}

// Original QR Campaign Templates (Interactive & Gamified)
const ORIGINAL_QR_TEMPLATES = [
  {
    id: 'points_per_scan',
    name: 'Points Per Scan',
    description: 'Customers earn points for each QR code scan',
    type: 'points',
    placement: 'table_tent',
    defaultReward: { type: 'points', value: 50 }
  },
  {
    id: 'instant_discount',
    name: 'Instant Discount',
    description: 'Immediate discount upon scanning QR code',
    type: 'discount',
    placement: 'menu',
    defaultReward: { type: 'percentage', value: 15 }
  },
  {
    id: 'spin_wheel',
    name: 'Spin the Wheel',
    description: 'Gamified wheel spin for random rewards',
    type: 'gamification',
    placement: 'counter',
    defaultReward: { type: 'random', options: ['free_drink', 'double_points', '20_off'] }
  },
  {
    id: 'daily_check_in',
    name: 'Daily Check-in',
    description: 'Daily visit rewards with increasing bonuses',
    type: 'checkin',
    placement: 'entrance',
    defaultReward: { type: 'progressive', base: 25, multiplier: 1.5 }
  },
  {
    id: 'referral_bonus',
    name: 'Referral Bonus',
    description: 'Reward customers for bringing friends',
    type: 'referral',
    placement: 'receipt',
    defaultReward: { type: 'shared', referrer: 100, referee: 75 }
  }
];

// Comprehensive QR Campaign Templates (All 34 Ideas)
const COMPREHENSIVE_QR_TEMPLATES = [
  {
    id: 'receipt_free_coffee',
    name: 'Receipt Free Coffee',
    description: 'Print QR on receipts with "Scan for a free coffee!" to drive instant signups',
    type: 'receipt_signup',
    placement: 'receipt',
    defaultReward: { type: 'free_item', value: 'coffee', message: 'Scan for a free coffee!' }
  },
  {
    id: 'signup_discount',
    name: 'One-Time Signup Discount',
    description: 'Offer 10% off for scanning and joining the loyalty program',
    type: 'signup_discount',
    placement: 'any',
    defaultReward: { type: 'percentage', value: 10, oneTime: true }
  },
  {
    id: 'table_tent_surprise',
    name: 'Table Tent Surprise',
    description: 'QR codes on table tents with "Unlock a surprise reward!" to grab attention',
    type: 'surprise_reward',
    placement: 'table_tent',
    defaultReward: { type: 'mystery', options: ['free_appetizer', 'free_drink', '15_percent_off'], message: 'Unlock a surprise reward!' }
  },
  {
    id: 'digital_wallet_card',
    name: 'Digital Wallet Loyalty Card',
    description: 'Digital loyalty card for Apple/Google Wallet via QR scan',
    type: 'digital_wallet',
    placement: 'any',
    defaultReward: { type: 'wallet_integration', platforms: ['apple_wallet', 'google_pay'], points: 100 }
  },
  {
    id: 'wheel_spin_game',
    name: 'Gamified Wheel Spin',
    description: 'QR scans trigger a wheel-spin game for random rewards',
    type: 'gamification',
    placement: 'any',
    defaultReward: { type: 'wheel_spin', prizes: ['free_side', 'double_points', '20_percent_off', 'free_dessert', 'free_drink'] }
  },
  {
    id: 'menu_exclusive_deals',
    name: 'Menu Exclusive Deals',
    description: 'QR codes on menus with "Join our loyalty club for exclusive deals!"',
    type: 'exclusive_membership',
    placement: 'menu',
    defaultReward: { type: 'membership_perks', benefits: ['exclusive_deals', 'early_access', 'member_pricing'] }
  },
  {
    id: 'double_points_first_purchase',
    name: 'First Purchase Double Points',
    description: 'Double points for the first purchase after scanning to join',
    type: 'first_purchase_bonus',
    placement: 'any',
    defaultReward: { type: 'points_multiplier', value: 2, oneTime: true, duration: '7_days' }
  },
  {
    id: 'payment_integration',
    name: 'Payment Processor Integration',
    description: 'QR scans integrate with payment processor to link purchase data',
    type: 'payment_integration',
    placement: 'pos_system',
    defaultReward: { type: 'automatic_points', integration: 'stripe', points_per_dollar: 1 }
  },
  {
    id: 'takeout_next_order_points',
    name: 'Takeout Next Order Points',
    description: 'QR on takeout bags: "Scan to earn points on your next order!"',
    type: 'next_order_incentive',
    placement: 'takeout_bag',
    defaultReward: { type: 'future_points', value: 50, message: 'Scan to earn points on your next order!' }
  },
  {
    id: 'loyalty_starter_100',
    name: 'Loyalty Starter 100',
    description: 'First QR scan gives 100 bonus points as loyalty starter',
    type: 'starter_bonus',
    placement: 'any',
    defaultReward: { type: 'points', value: 100, firstScanOnly: true }
  },
  {
    id: 'weekly_prize_draw',
    name: 'Weekly Prize Draw',
    description: 'Counter QR codes: "Scan to enter a weekly prize draw!"',
    type: 'prize_draw',
    placement: 'counter',
    defaultReward: { type: 'contest_entry', frequency: 'weekly', prizes: ['free_meal', 'gift_card', 'merchandise'] }
  },
  {
    id: 'sister_restaurant_promo',
    name: 'Sister Restaurant Promo',
    description: 'Multi-venue QR: "Visit our sister restaurant for 20% off!"',
    type: 'cross_venue_promotion',
    placement: 'any',
    defaultReward: { type: 'cross_promotion', discount: 20, venues: 'sister_restaurants' }
  },
  {
    id: 'three_purchase_free_item',
    name: 'Three Purchase Free Item',
    description: 'Free menu item after three QR-linked purchases',
    type: 'purchase_milestone',
    placement: 'any',
    defaultReward: { type: 'milestone_reward', purchases_required: 3, reward: 'free_menu_item' }
  },
  {
    id: 'signage_free_dessert',
    name: 'In-Store Signage Free Dessert',
    description: 'In-store signage QR: "Join now for a free dessert!"',
    type: 'signage_promotion',
    placement: 'in_store_signage',
    defaultReward: { type: 'free_item', value: 'dessert', message: 'Join now for a free dessert!' }
  },
  {
    id: 'tiered_loyalty_system',
    name: 'Tiered Loyalty System',
    description: 'QR scans linked to tiered system—higher tiers unlock bigger rewards',
    type: 'tier_progression',
    placement: 'any',
    defaultReward: { type: 'tier_benefits', tiers: ['bronze', 'silver', 'gold', 'platinum'], escalating_rewards: true }
  },
  {
    id: 'checkin_no_purchase',
    name: 'Check-in Without Purchase',
    description: 'QR-based check-ins earn points without requiring a purchase',
    type: 'location_checkin',
    placement: 'entrance',
    defaultReward: { type: 'checkin_points', value: 25, no_purchase_required: true }
  },
  {
    id: 'bring_friend_shared_rewards',
    name: 'Bring a Friend Shared Rewards',
    description: 'Scan QR to refer someone—both get shared rewards',
    type: 'referral_program',
    placement: 'any',
    defaultReward: { type: 'shared_reward', referrer_points: 75, referee_points: 75 }
  },
  {
    id: 'seasonal_taco_discount',
    name: 'Seasonal Taco Discount',
    description: 'Limited-time QR: "Scan for a seasonal taco discount!"',
    type: 'seasonal_campaign',
    placement: 'any',
    defaultReward: { type: 'seasonal_discount', item: 'tacos', discount: 25, time_limited: true }
  },
  {
    id: 'email_receipt_signup',
    name: 'Email Receipt Signup',
    description: 'QR codes in emailed receipts for post-purchase signup',
    type: 'post_purchase_signup',
    placement: 'email_receipt',
    defaultReward: { type: 'retroactive_points', value: 50, for_current_purchase: true }
  },
  {
    id: 'app_scanner_deals',
    name: 'App QR Scanner Deals',
    description: 'Loyalty app homepage QR scanner for exclusive in-store deals',
    type: 'app_integration',
    placement: 'mobile_app',
    defaultReward: { type: 'app_exclusive_deals', scanner_required: true, deals: ['daily_specials', 'flash_sales'] }
  },
  {
    id: 'mystery_post_signup',
    name: 'Mystery Reward Post-Signup',
    description: 'Mystery reward for scanning, revealed after completing signup',
    type: 'mystery_signup',
    placement: 'any',
    defaultReward: { type: 'mystery_reveal', options: ['free_drink', 'free_appetizer', '20_percent_off'], reveal_after_signup: true }
  },
  {
    id: 'cup_next_visit_discount',
    name: 'To-Go Cup Next Visit Discount',
    description: 'QR on cups: "Scan to join and get 10% off next time!"',
    type: 'next_visit_incentive',
    placement: 'to_go_cup',
    defaultReward: { type: 'next_visit_discount', discount: 10, expires_in: '30_days' }
  },
  {
    id: 'visit_based_points',
    name: 'Visit-Based Points System',
    description: 'QR scans earn points per visit, not tied to purchase amounts',
    type: 'visit_rewards',
    placement: 'any',
    defaultReward: { type: 'visit_points', points_per_visit: 30, purchase_independent: true }
  },
  {
    id: 'exclusive_menu_items',
    name: 'Member Exclusive Menu Items',
    description: 'QR codes unlock exclusive menu items only for loyalty members',
    type: 'exclusive_menu',
    placement: 'menu',
    defaultReward: { type: 'menu_access', exclusive_items: ['secret_burger', 'member_special', 'chef_choice'] }
  },
  {
    id: 'birthday_freebie_input',
    name: 'Birthday Freebie Setup',
    description: 'Scan QR to input birthdate and set up birthday freebie',
    type: 'birthday_setup',
    placement: 'any',
    defaultReward: { type: 'birthday_program', setup_reward: 'free_appetizer', birthday_reward: 'free_entree' }
  },
  {
    id: 'social_media_challenge',
    name: 'Social Media Challenge',
    description: 'QR-linked social challenges: "Share and scan for bonus points!"',
    type: 'social_engagement',
    placement: 'any',
    defaultReward: { type: 'social_points', share_bonus: 50, platforms: ['instagram', 'facebook', 'tiktok'] }
  },
  {
    id: 'napkin_taco_club',
    name: 'Napkin Taco Club',
    description: 'QR on loyalty-branded napkins: "Join the taco club now!"',
    type: 'branded_napkin_promo',
    placement: 'napkin',
    defaultReward: { type: 'club_membership', club: 'taco_club', benefits: ['exclusive_tacos', 'taco_tuesday_deals'] }
  },
  {
    id: 'first_scan_new_location',
    name: 'First Scan New Location',
    description: 'First scan reward tied to multi-venue: "Try our new location!"',
    type: 'location_promotion',
    placement: 'any',
    defaultReward: { type: 'location_incentive', new_location_discount: 25, first_scan_bonus: 100 }
  },
  {
    id: 'member_referral_points',
    name: 'Member Referral Points',
    description: 'Existing members get points when their QR referrals sign up new people',
    type: 'member_referral_system',
    placement: 'any',
    defaultReward: { type: 'referral_points', existing_member_bonus: 100, new_member_bonus: 50 }
  },
  {
    id: 'event_limited_offer',
    name: 'Event Limited-Time Offer',
    description: 'QR at events/pop-ups: "Scan for a limited-time offer!"',
    type: 'event_promotion',
    placement: 'event_popup',
    defaultReward: { type: 'event_exclusive', discount: 30, time_limited: true, event_only: true }
  },
  {
    id: 'feedback_survey_points',
    name: 'Feedback Survey Points',
    description: 'QR-based feedback surveys reward loyalty points upon completion',
    type: 'survey_rewards',
    placement: 'any',
    defaultReward: { type: 'survey_points', points_for_completion: 40, survey_types: ['experience', 'food_quality', 'service'] }
  },
  {
    id: 'family_plan_shared_points',
    name: 'Family Plan Shared Points',
    description: 'Family loyalty tier—QR links multiple accounts for shared points',
    type: 'family_program',
    placement: 'any',
    defaultReward: { type: 'family_tier', shared_points: true, max_accounts: 6, family_bonuses: true }
  },
  {
    id: 'packaging_secret_menu',
    name: 'Packaging Secret Menu',
    description: 'QR on packaging: "Scan to unlock a secret menu item!"',
    type: 'secret_menu_unlock',
    placement: 'packaging',
    defaultReward: { type: 'secret_access', secret_items: ['hidden_burger', 'chef_special', 'off_menu_dessert'] }
  },
  {
    id: 'consecutive_scan_streak',
    name: 'Consecutive Scan Streak',
    description: 'Streak system where consecutive QR scans increase reward multipliers',
    type: 'streak_multiplier',
    placement: 'any',
    defaultReward: { type: 'streak_rewards', day_1: 25, day_3: 50, day_7: 100, day_14: 200, multiplier_increase: true }
  }
];

export function QRCampaignManager({ restaurants, programs }: QRCampaignManagerProps) {
  const [campaigns, setCampaigns] = useState<QRCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    restaurant_id: '',
    program_id: '',
    campaign_type: '',
    reward: { type: 'points', value: 100 },
    placement: 'receipt',
    expiry_date: '',
    max_uses: ''
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('qr_campaigns')
        .select(`
          *,
          restaurants(name),
          loyalty_programs(name)
        `)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching campaigns:', error);
        return;
      }

      setCampaigns(data || []);
    } catch (error) {
      console.error('Error fetching campaigns:', error);
    } finally {
      setLoading(false);
    }
  };

  const createCampaign = async () => {
    try {
      if (!selectedTemplate || !formData.name || !formData.restaurant_id || !formData.program_id) {
        toast({
          title: "Error",
          description: "Please fill in all required fields",
          variant: "destructive"
        });
        return;
      }

      // Prepare reward settings based on template
      const rewardSettings = selectedTemplate.defaultReward || formData.reward;

      const usageLimits = {
        max_uses_per_customer: formData.max_uses ? parseInt(formData.max_uses) : null,
        total_max_uses: null,
        daily_limit: null
      };

      const { data, error } = await supabase
        .from('qr_campaigns')
        .insert({
          name: formData.name,
          description: formData.description || selectedTemplate.description,
          campaign_type: selectedTemplate.type,
          qr_data: {
            campaignId: null, // Will be updated after insert
            type: selectedTemplate.type,
            restaurantId: formData.restaurant_id,
            programId: formData.program_id,
            template: selectedTemplate,
            placement: formData.placement
          },
          reward_settings: rewardSettings,
          usage_limits: usageLimits,
          is_active: true,
          starts_at: null,
          expires_at: formData.expiry_date || null,
          restaurant_id: formData.restaurant_id,
          program_id: formData.program_id
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating campaign:', error);
        toast({
          title: "Error",
          description: "Failed to create campaign",
          variant: "destructive"
        });
        return;
      }

      // Update qr_data with the actual campaign ID
      await supabase
        .from('qr_campaigns')
        .update({
          qr_data: {
            campaignId: data.id,
            type: selectedTemplate.type,
            restaurantId: formData.restaurant_id,
            programId: formData.program_id,
            template: selectedTemplate,
            placement: formData.placement
          }
        })
        .eq('id', data.id);

      await fetchCampaigns();
      setShowCreateDialog(false);
      resetForm();
      
      toast({
        title: "Success",
        description: "QR campaign created successfully"
      });
    } catch (error) {
      console.error('Error creating campaign:', error);
      toast({
        title: "Error",
        description: "Failed to create campaign",
        variant: "destructive"
      });
    }
  };

  const toggleCampaignStatus = async (campaignId: string) => {
    try {
      const campaign = campaigns.find(c => c.id === campaignId);
      if (!campaign) return;

      const { error } = await supabase
        .from('qr_campaigns')
        .update({ is_active: !campaign.is_active })
        .eq('id', campaignId);

      if (error) {
        console.error('Error updating campaign status:', error);
        toast({
          title: "Error",
          description: "Failed to update campaign status",
          variant: "destructive"
        });
        return;
      }

      await fetchCampaigns();

      toast({
        title: "Success",
        description: "Campaign status updated"
      });
    } catch (error) {
      console.error('Error updating campaign status:', error);
      toast({
        title: "Error",
        description: "Failed to update campaign status",
        variant: "destructive"
      });
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      description: '',
      restaurant_id: '',
      program_id: '',
      campaign_type: '',
      reward: { type: 'points', value: 100 },
      placement: 'receipt',
      expiry_date: '',
      max_uses: ''
    });
    setSelectedTemplate(null);
  };

  const handleTemplateSelect = (template: any) => {
    setSelectedTemplate(template);
    setFormData(prev => ({
      ...prev,
      name: template.name,
      description: template.description,
      campaign_type: template.type,
      placement: template.placement,
      reward: template.defaultReward
    }));
  };

  const generateQRCode = (campaign: QRCampaign) => {
    // Placeholder QR code generation
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(campaign.qr_data.url)}`;
  };

  const filteredPrograms = programs.filter(program => 
    formData.restaurant_id ? program.restaurant_id === formData.restaurant_id : true
  );

  if (loading) {
    return <div className="flex items-center justify-center p-8">Loading QR campaigns...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">QR Campaigns</h2>
          <p className="text-muted-foreground">Manage QR code loyalty campaigns</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="flex items-center gap-2">
              <Plus className="h-4 w-4" />
              Create Campaign
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-6xl h-[95vh] overflow-hidden flex flex-col">
            <DialogHeader className="flex-shrink-0">
              <DialogTitle>Create QR Campaign</DialogTitle>
              <DialogDescription>
                Choose a template and configure your QR code campaign
              </DialogDescription>
            </DialogHeader>
            
            <div className="flex-1 overflow-y-auto space-y-6 pr-2">
              <Tabs defaultValue="interactive" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="interactive">Interactive Templates</TabsTrigger>
                  <TabsTrigger value="comprehensive">All 34 Campaign Ideas</TabsTrigger>
                </TabsList>
                
                <TabsContent value="interactive" className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-4">Interactive & Gamified Templates</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-60 overflow-y-auto">
                      {ORIGINAL_QR_TEMPLATES.map((template) => (
                        <Card
                          key={template.id}
                          className={`cursor-pointer transition-colors ${
                            selectedTemplate?.id === template.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardContent className="p-4">
                            <h4 className="font-medium text-sm">{template.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1">{template.description}</p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {template.placement}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>
                
                <TabsContent value="comprehensive" className="space-y-4">
                  <div>
                    <h3 className="text-lg font-medium mb-4">All 34 QR Campaign Ideas</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-96 overflow-y-auto">
                      {COMPREHENSIVE_QR_TEMPLATES.map((template) => (
                        <Card
                          key={template.id}
                          className={`cursor-pointer transition-colors ${
                            selectedTemplate?.id === template.id
                              ? 'border-primary bg-primary/5'
                              : 'hover:border-primary/50'
                          }`}
                          onClick={() => handleTemplateSelect(template)}
                        >
                          <CardContent className="p-3">
                            <h4 className="font-medium text-xs">{template.name}</h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{template.description}</p>
                            <Badge variant="outline" className="mt-2 text-xs">
                              {template.placement}
                            </Badge>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </TabsContent>
              </Tabs>

              {/* Campaign Configuration */}
              {selectedTemplate && (
                <div className="space-y-4 border-t pt-4">
                  <h3 className="text-lg font-medium">Campaign Configuration</h3>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Campaign Name</Label>
                      <Input
                        id="name"
                        value={formData.name}
                        onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                        placeholder="Enter campaign name"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="restaurant">Restaurant</Label>
                      <Select
                        value={formData.restaurant_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, restaurant_id: value, program_id: '' }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select restaurant" />
                        </SelectTrigger>
                        <SelectContent>
                          {restaurants.map((restaurant) => (
                            <SelectItem key={restaurant.id} value={restaurant.id}>
                              {restaurant.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="program">Loyalty Program</Label>
                      <Select
                        value={formData.program_id}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, program_id: value }))}
                        disabled={!formData.restaurant_id}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select loyalty program" />
                        </SelectTrigger>
                        <SelectContent>
                          {filteredPrograms.map((program) => (
                            <SelectItem key={program.id} value={program.id}>
                              {program.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="placement">Placement</Label>
                      <Select
                        value={formData.placement}
                        onValueChange={(value) => setFormData(prev => ({ ...prev, placement: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="receipt">Receipt</SelectItem>
                          <SelectItem value="table_tent">Table Tent</SelectItem>
                          <SelectItem value="menu">Menu</SelectItem>
                          <SelectItem value="counter">Counter</SelectItem>
                          <SelectItem value="entrance">Entrance</SelectItem>
                          <SelectItem value="takeout_bag">Takeout Bag</SelectItem>
                          <SelectItem value="packaging">Packaging</SelectItem>
                          <SelectItem value="napkin">Napkin</SelectItem>
                          <SelectItem value="any">Any Location</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Description</Label>
                    <Textarea
                      id="description"
                      value={formData.description}
                      onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                      placeholder="Describe your campaign"
                      rows={3}
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="expiry">Expiry Date (Optional)</Label>
                      <Input
                        id="expiry"
                        type="date"
                        value={formData.expiry_date}
                        onChange={(e) => setFormData(prev => ({ ...prev, expiry_date: e.target.value }))}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="maxUses">Max Uses (Optional)</Label>
                      <Input
                        id="maxUses"
                        type="number"
                        value={formData.max_uses}
                        onChange={(e) => setFormData(prev => ({ ...prev, max_uses: e.target.value }))}
                        placeholder="Leave blank for unlimited"
                      />
                    </div>
                  </div>

                  <div className="flex justify-end space-x-2 pt-4">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setShowCreateDialog(false);
                        resetForm();
                      }}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={createCampaign}
                      disabled={!formData.name || !formData.restaurant_id || !formData.program_id}
                    >
                      Create Campaign
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Campaign List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">{campaign.name}</CardTitle>
                <Switch
                  checked={campaign.is_active}
                  onCheckedChange={() => toggleCampaignStatus(campaign.id)}
                />
              </div>
              <CardDescription>{campaign.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{campaign.campaign_type}</Badge>
                  <Badge variant={campaign.is_active ? "default" : "secondary"}>
                    {campaign.is_active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="flex items-center justify-center p-4 bg-muted rounded-lg">
                  <img
                    src={generateQRCode(campaign)}
                    alt="QR Code"
                    className="w-32 h-32"
                  />
                </div>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="h-4 w-4 mr-1" />
                    Preview
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Copy className="h-4 w-4 mr-1" />
                    Copy URL
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Download className="h-4 w-4 mr-1" />
                    Download
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {campaigns.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <QrCode className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No QR campaigns yet</h3>
            <p className="text-muted-foreground mb-4">
              Create your first QR campaign to start engaging customers
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              Create Campaign
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}