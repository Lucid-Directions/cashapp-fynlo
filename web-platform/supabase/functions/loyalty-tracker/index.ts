import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Check if this is a SumUp webhook
    const contentType = req.headers.get('content-type')
    if (contentType && contentType.includes('application/json')) {
      const payload = await req.json()
      console.log('Received payload:', payload)

      // Handle SumUp webhook events
      if (payload.event_type === 'PAYMENT' || payload.event_type === 'CHECKOUT_COMPLETED') {
        return await processSumUpWebhook(supabaseClient, payload)
      }

      // Handle API actions
      if (payload.action) {
        const { action, data } = payload
        console.log('Loyalty tracker action:', action, data)

        switch (action) {
          case 'track_purchase':
            return await trackPurchase(supabaseClient, data)
          case 'award_points':
            return await awardPoints(supabaseClient, data)
          case 'redeem_points':
            return await redeemPoints(supabaseClient, data)
          case 'process_referral':
            return await processReferral(supabaseClient, data)
          case 'update_tier':
            return await updateCustomerTier(supabaseClient, data)
          default:
            throw new Error(`Unknown action: ${action}`)
        }
      }
    }

    return new Response('Invalid request', { 
      status: 400,
      headers: corsHeaders 
    })
  } catch (error) {
    console.error('Error in loyalty tracker:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

async function trackPurchase(supabase: any, data: any) {
  const { program_id, customer_email, order_amount, order_id, restaurant_id } = data

  // Get or create customer data
  let { data: customerData, error: customerError } = await supabase
    .from('loyalty_customer_data')
    .select('*')
    .eq('program_id', program_id)
    .eq('customer_email', customer_email)
    .single()

  if (customerError && customerError.code !== 'PGRST116') {
    throw customerError
  }

  if (!customerData) {
    // Create new customer
    const { data: newCustomer, error: createError } = await supabase
      .from('loyalty_customer_data')
      .insert({
        program_id,
        restaurant_id,
        customer_email,
        customer_hash: btoa(customer_email), // Simple hash for demo
        current_points: 0,
        lifetime_points: 0,
        total_spent: 0,
        visit_count: 0,
        tier_level: 'bronze',
        last_activity: new Date().toISOString(),
        last_purchase: new Date().toISOString()
      })
      .select()
      .single()

    if (createError) throw createError
    customerData = newCustomer
  }

  // Get program rules
  const { data: program, error: programError } = await supabase
    .from('loyalty_programs')
    .select('settings')
    .eq('id', program_id)
    .single()

  if (programError) throw programError

  // Calculate points based on rules
  const settings = program.settings || {}
  const rules = settings.rules || []
  
  let pointsEarned = 0
  let appliedRules = []

  for (const rule of rules) {
    if (!rule.isActive) continue

    switch (rule.type) {
      case 'spend':
        if (order_amount >= rule.condition.value) {
          const basePoints = Math.floor(order_amount * (rule.action.value || 1))
          const multiplier = rule.action.multiplier || 1
          pointsEarned += basePoints * multiplier
          appliedRules.push(rule.id)
        }
        break
      case 'visit':
        pointsEarned += rule.action.value || 1
        appliedRules.push(rule.id)
        break
    }
  }

  // Update customer data
  const newTotalSpent = (customerData.total_spent || 0) + order_amount
  const newLifetimePoints = (customerData.lifetime_points || 0) + pointsEarned
  const newCurrentPoints = (customerData.current_points || 0) + pointsEarned
  const newVisitCount = (customerData.visit_count || 0) + 1

  const { error: updateError } = await supabase
    .from('loyalty_customer_data')
    .update({
      current_points: newCurrentPoints,
      lifetime_points: newLifetimePoints,
      total_spent: newTotalSpent,
      visit_count: newVisitCount,
      last_activity: new Date().toISOString(),
      last_purchase: new Date().toISOString()
    })
    .eq('id', customerData.id)

  if (updateError) throw updateError

  // Record transaction
  const { error: transactionError } = await supabase
    .from('loyalty_transactions')
    .insert({
      program_id,
      customer_data_id: customerData.id,
      transaction_type: 'earn',
      points_change: pointsEarned,
      points_balance: newCurrentPoints,
      order_amount,
      order_id,
      reason: `Purchase - Applied rules: ${appliedRules.join(', ')}`,
      rule_id: appliedRules.join(',')
    })

  if (transactionError) throw transactionError

  // Update analytics
  await updateAnalytics(supabase, program_id, restaurant_id, {
    total_transactions: 1,
    total_revenue: order_amount,
    points_earned: pointsEarned
  })

  return new Response(
    JSON.stringify({
      success: true,
      points_earned: pointsEarned,
      new_balance: newCurrentPoints,
      applied_rules: appliedRules,
      customer_id: customerData.id
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function awardPoints(supabase: any, data: any) {
  const { customer_data_id, points, reason, rule_id } = data

  // Get customer data
  const { data: customerData, error: customerError } = await supabase
    .from('loyalty_customer_data')
    .select('*')
    .eq('id', customer_data_id)
    .single()

  if (customerError) throw customerError

  const newCurrentPoints = (customerData.current_points || 0) + points
  const newLifetimePoints = (customerData.lifetime_points || 0) + points

  // Update customer points
  const { error: updateError } = await supabase
    .from('loyalty_customer_data')
    .update({
      current_points: newCurrentPoints,
      lifetime_points: newLifetimePoints,
      last_activity: new Date().toISOString()
    })
    .eq('id', customer_data_id)

  if (updateError) throw updateError

  // Record transaction
  const { error: transactionError } = await supabase
    .from('loyalty_transactions')
    .insert({
      program_id: customerData.program_id,
      customer_data_id,
      transaction_type: 'bonus',
      points_change: points,
      points_balance: newCurrentPoints,
      reason,
      rule_id
    })

  if (transactionError) throw transactionError

  return new Response(
    JSON.stringify({
      success: true,
      points_awarded: points,
      new_balance: newCurrentPoints
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function redeemPoints(supabase: any, data: any) {
  const { customer_data_id, points, reward_id, reason } = data

  // Get customer data
  const { data: customerData, error: customerError } = await supabase
    .from('loyalty_customer_data')
    .select('*')
    .eq('id', customer_data_id)
    .single()

  if (customerError) throw customerError

  if ((customerData.current_points || 0) < points) {
    throw new Error('Insufficient points for redemption')
  }

  const newCurrentPoints = (customerData.current_points || 0) - points

  // Update customer points
  const { error: updateError } = await supabase
    .from('loyalty_customer_data')
    .update({
      current_points: newCurrentPoints,
      last_activity: new Date().toISOString()
    })
    .eq('id', customer_data_id)

  if (updateError) throw updateError

  // Record transaction
  const { error: transactionError } = await supabase
    .from('loyalty_transactions')
    .insert({
      program_id: customerData.program_id,
      customer_data_id,
      transaction_type: 'redeem',
      points_change: -points,
      points_balance: newCurrentPoints,
      reason: reason || `Redeemed reward: ${reward_id}`,
      rule_id: reward_id
    })

  if (transactionError) throw transactionError

  // Update analytics
  await updateAnalytics(supabase, customerData.program_id, customerData.restaurant_id, {
    points_redeemed: points,
    rewards_claimed: 1
  })

  return new Response(
    JSON.stringify({
      success: true,
      points_redeemed: points,
      new_balance: newCurrentPoints
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function processReferral(supabase: any, data: any) {
  const { referrer_email, referee_email, program_id, restaurant_id } = data

  // Get referrer data
  const { data: referrerData, error: referrerError } = await supabase
    .from('loyalty_customer_data')
    .select('*')
    .eq('program_id', program_id)
    .eq('customer_email', referrer_email)
    .single()

  if (referrerError) throw referrerError

  // Get program settings
  const { data: program, error: programError } = await supabase
    .from('loyalty_programs')
    .select('settings')
    .eq('id', program_id)
    .single()

  if (programError) throw programError

  const settings = program.settings || {}
  const referralBonus = settings.advanced?.referralBonus || { enabled: false, referrerPoints: 50, refereePoints: 25 }

  if (!referralBonus.enabled) {
    throw new Error('Referral program not enabled')
  }

  // Award points to referrer
  await awardPoints(supabase, {
    customer_data_id: referrerData.id,
    points: referralBonus.referrerPoints,
    reason: `Referral bonus for referring ${referee_email}`,
    rule_id: 'referral_bonus'
  })

  // Create or get referee data and award welcome bonus
  let { data: refereeData, error: refereeError } = await supabase
    .from('loyalty_customer_data')
    .select('*')
    .eq('program_id', program_id)
    .eq('customer_email', referee_email)
    .single()

  if (refereeError && refereeError.code !== 'PGRST116') {
    throw refereeError
  }

  if (!refereeData) {
    const { data: newReferee, error: createError } = await supabase
      .from('loyalty_customer_data')
      .insert({
        program_id,
        restaurant_id,
        customer_email: referee_email,
        customer_hash: btoa(referee_email),
        current_points: referralBonus.refereePoints,
        lifetime_points: referralBonus.refereePoints,
        total_spent: 0,
        visit_count: 0,
        tier_level: 'bronze',
        last_activity: new Date().toISOString()
      })
      .select()
      .single()

    if (createError) throw createError
    refereeData = newReferee
  } else {
    await awardPoints(supabase, {
      customer_data_id: refereeData.id,
      points: referralBonus.refereePoints,
      reason: `Welcome bonus for being referred by ${referrer_email}`,
      rule_id: 'referee_welcome'
    })
  }

  // Update referrer's referral count
  const { error: updateReferrerError } = await supabase
    .from('loyalty_customer_data')
    .update({
      referrals_made: (referrerData.referrals_made || 0) + 1
    })
    .eq('id', referrerData.id)

  if (updateReferrerError) throw updateReferrerError

  return new Response(
    JSON.stringify({
      success: true,
      referrer_bonus: referralBonus.referrerPoints,
      referee_bonus: referralBonus.refereePoints
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function updateCustomerTier(supabase: any, data: any) {
  const { customer_data_id, new_tier } = data

  const { error } = await supabase
    .from('loyalty_customer_data')
    .update({
      tier_level: new_tier,
      last_activity: new Date().toISOString()
    })
    .eq('id', customer_data_id)

  if (error) throw error

  return new Response(
    JSON.stringify({
      success: true,
      new_tier
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function processSumUpWebhook(supabase: any, payload: any) {
  console.log('Processing SumUp webhook:', payload)

  try {
    // Extract payment information from SumUp webhook
    const amount = payload.amount || payload.transaction?.amount
    const currency = payload.currency || payload.transaction?.currency
    const customer_email = payload.customer?.email || payload.checkout?.customer_email
    const checkout_reference = payload.checkout?.checkout_reference || payload.id

    if (!amount || !customer_email) {
      console.log('Missing required fields:', { amount, customer_email })
      return new Response(JSON.stringify({ success: true, message: 'Ignored - missing required fields' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Find active loyalty programs that have SumUp integration
    const { data: integrations, error: integrationsError } = await supabase
      .from('loyalty_integrations')
      .select(`
        program_id,
        restaurant_id,
        programs:loyalty_programs(*)
      `)
      .eq('provider', 'sumup')
      .eq('is_active', true)

    if (integrationsError) throw integrationsError

    if (!integrations || integrations.length === 0) {
      console.log('No active SumUp integrations found')
      return new Response(JSON.stringify({ success: true, message: 'No integrations found' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Process payment for each integrated loyalty program
    const results = []
    for (const integration of integrations) {
      try {
        const trackResult = await trackPurchase(supabase, {
          program_id: integration.program_id,
          restaurant_id: integration.restaurant_id,
          customer_email,
          order_amount: amount,
          order_id: checkout_reference,
        })
        
        results.push({
          program_id: integration.program_id,
          success: true,
          result: JSON.parse(trackResult.body)
        })
      } catch (error) {
        console.error(`Error processing payment for program ${integration.program_id}:`, error)
        results.push({
          program_id: integration.program_id,
          success: false,
          error: error.message
        })
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'SumUp webhook processed',
      results 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Error processing SumUp webhook:', error)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
}

async function updateAnalytics(supabase: any, program_id: string, restaurant_id: string, metrics: any) {
  const today = new Date().toISOString().split('T')[0]

  // Get or create today's analytics record
  let { data: analytics, error: analyticsError } = await supabase
    .from('loyalty_analytics')
    .select('*')
    .eq('program_id', program_id)
    .eq('restaurant_id', restaurant_id)
    .eq('date', today)
    .single()

  if (analyticsError && analyticsError.code !== 'PGRST116') {
    throw analyticsError
  }

  if (!analytics) {
    const { data: newAnalytics, error: createError } = await supabase
      .from('loyalty_analytics')
      .insert({
        program_id,
        restaurant_id,
        date: today,
        ...metrics
      })
      .select()
      .single()

    if (createError) throw createError
    return newAnalytics
  } else {
    const updates: any = {}
    
    Object.keys(metrics).forEach(key => {
      updates[key] = (analytics[key] || 0) + metrics[key]
    })

    const { error: updateError } = await supabase
      .from('loyalty_analytics')
      .update(updates)
      .eq('id', analytics.id)

    if (updateError) throw updateError
  }
}