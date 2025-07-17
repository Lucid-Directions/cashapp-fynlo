import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.50.2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    const { campaignId, customerData } = await req.json();

    console.log('Processing QR claim for campaign:', campaignId);

    // Get campaign details
    const { data: campaign, error: campaignError } = await supabase
      .from('qr_campaigns')
      .select(`
        *,
        loyalty_programs!inner(*)
      `)
      .eq('id', campaignId)
      .eq('is_active', true)
      .single();

    if (campaignError || !campaign) {
      console.error('Campaign not found:', campaignError);
      return new Response(
        JSON.stringify({ error: 'Campaign not found or inactive' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if campaign is within valid date range
    const now = new Date();
    if (campaign.starts_at && new Date(campaign.starts_at) > now) {
      return new Response(
        JSON.stringify({ error: 'Campaign has not started yet' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (campaign.expires_at && new Date(campaign.expires_at) < now) {
      return new Response(
        JSON.stringify({ error: 'Campaign has expired' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create or get customer data
    const customerHash = await crypto.subtle.digest(
      'SHA-256',
      new TextEncoder().encode(customerData.email + customerData.phone)
    ).then(buffer => Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join(''));

    let { data: existingCustomer } = await supabase
      .from('loyalty_customer_data')
      .select('*')
      .eq('program_id', campaign.program_id)
      .eq('customer_hash', customerHash)
      .single();

    if (!existingCustomer) {
      const { data: newCustomer, error: customerError } = await supabase
        .from('loyalty_customer_data')
        .insert({
          program_id: campaign.program_id,
          restaurant_id: campaign.restaurant_id,
          customer_email: customerData.email,
          customer_phone: customerData.phone,
          customer_hash: customerHash,
          current_points: 0,
          lifetime_points: 0,
          total_spent: 0,
          visit_count: 0,
          tier_level: 'bronze'
        })
        .select()
        .single();

      if (customerError) {
        console.error('Error creating customer:', customerError);
        return new Response(
          JSON.stringify({ error: 'Failed to create customer record' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      existingCustomer = newCustomer;
    }

    // Check usage limits
    const usageLimits = campaign.usage_limits || {};
    
    if (usageLimits.max_uses_per_customer) {
      const { count: customerUsageCount } = await supabase
        .from('qr_campaign_usage')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('customer_data_id', existingCustomer.id);

      if (customerUsageCount && customerUsageCount >= usageLimits.max_uses_per_customer) {
        return new Response(
          JSON.stringify({ error: 'You have already reached the maximum uses for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (usageLimits.total_max_uses) {
      const { count: totalUsageCount } = await supabase
        .from('qr_campaign_usage')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId);

      if (totalUsageCount && totalUsageCount >= usageLimits.total_max_uses) {
        return new Response(
          JSON.stringify({ error: 'This campaign has reached its maximum usage limit' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    if (usageLimits.daily_limit) {
      const today = new Date().toISOString().split('T')[0];
      const { count: dailyUsageCount } = await supabase
        .from('qr_campaign_usage')
        .select('*', { count: 'exact', head: true })
        .eq('campaign_id', campaignId)
        .eq('customer_data_id', existingCustomer.id)
        .gte('claimed_at', `${today}T00:00:00Z`)
        .lt('claimed_at', `${today}T23:59:59Z`);

      if (dailyUsageCount && dailyUsageCount >= usageLimits.daily_limit) {
        return new Response(
          JSON.stringify({ error: 'You have reached the daily limit for this campaign' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Calculate reward based on campaign type
    const rewardSettings = campaign.reward_settings || {};
    let pointsAwarded = 0;
    let rewardClaimed = {};

    switch (campaign.campaign_type) {
      case 'points_reward':
        pointsAwarded = rewardSettings.points || 0;
        rewardClaimed = { type: 'points', amount: pointsAwarded };
        break;
      case 'percentage_discount':
        rewardClaimed = { 
          type: 'discount', 
          percentage: rewardSettings.percentage || 0,
          description: `${rewardSettings.percentage}% off your next order`
        };
        break;
      case 'fixed_discount':
        rewardClaimed = { 
          type: 'discount', 
          amount: rewardSettings.amount || 0,
          description: `$${rewardSettings.amount} off your next order`
        };
        break;
      case 'free_item':
        rewardClaimed = { 
          type: 'free_item', 
          item: rewardSettings.item || 'Free item',
          description: `Free ${rewardSettings.item}`
        };
        break;
      case 'buy_x_get_y':
        rewardClaimed = { 
          type: 'buy_x_get_y',
          buy_quantity: rewardSettings.buy_quantity || 1,
          get_quantity: rewardSettings.get_quantity || 1,
          description: `Buy ${rewardSettings.buy_quantity} get ${rewardSettings.get_quantity} free`
        };
        break;
      default:
        pointsAwarded = 10; // Default points
        rewardClaimed = { type: 'points', amount: pointsAwarded };
    }

    // Record the claim
    const { error: usageError } = await supabase
      .from('qr_campaign_usage')
      .insert({
        campaign_id: campaignId,
        customer_data_id: existingCustomer.id,
        points_awarded: pointsAwarded,
        reward_claimed: rewardClaimed,
        metadata: {
          campaign_type: campaign.campaign_type,
          customer_data: customerData
        }
      });

    if (usageError) {
      console.error('Error recording usage:', usageError);
      return new Response(
        JSON.stringify({ error: 'Failed to record claim' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update customer points if applicable
    if (pointsAwarded > 0) {
      const { error: pointsError } = await supabase
        .from('loyalty_customer_data')
        .update({
          current_points: existingCustomer.current_points + pointsAwarded,
          lifetime_points: existingCustomer.lifetime_points + pointsAwarded,
          last_activity: new Date().toISOString(),
          visit_count: existingCustomer.visit_count + 1
        })
        .eq('id', existingCustomer.id);

      if (pointsError) {
        console.error('Error updating customer points:', pointsError);
      }

      // Record loyalty transaction
      await supabase
        .from('loyalty_transactions')
        .insert({
          program_id: campaign.program_id,
          customer_data_id: existingCustomer.id,
          transaction_type: 'qr_reward',
          points_change: pointsAwarded,
          points_balance: existingCustomer.current_points + pointsAwarded,
          reason: `QR Campaign: ${campaign.name}`,
          rule_id: campaignId
        });
    }

    // Update campaign analytics
    await supabase.rpc('increment_loyalty_analytics', {
      program_id: campaign.program_id,
      restaurant_id: campaign.restaurant_id,
      points_earned: pointsAwarded,
      rewards_claimed: 1
    }).catch(console.error);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Reward claimed successfully!',
        reward: rewardClaimed,
        pointsAwarded,
        customerPoints: existingCustomer.current_points + pointsAwarded
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in loyalty-qr-claim function:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});