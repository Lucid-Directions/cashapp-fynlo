import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SumUpCheckoutRequest {
  amount: number;
  currency: string;
  customer_id: string;
  plan_type: 'beta' | 'omega';
  return_url: string;
  description: string;
}

interface SumUpConfig {
  app_id: string;
  app_secret: string;
  merchant_code: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('No authorization header')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)
    if (!user) {
      throw new Error('Invalid token')
    }

    // Check if user is platform owner
    const { data: subscription } = await supabaseClient
      .from('user_subscriptions')
      .select('is_platform_owner')
      .eq('user_id', user.id)
      .single()

    if (!subscription?.is_platform_owner) {
      throw new Error('Access denied: Platform owner required')
    }

    if (req.method === 'POST') {
      const { action, ...payload } = await req.json()

      switch (action) {
        case 'create_checkout':
          return await createCheckout(payload as SumUpCheckoutRequest)
        case 'create_recurring_checkout':
          return await createRecurringCheckout(payload as SumUpCheckoutRequest)
        case 'test_connection':
          return await testConnection()
        default:
          throw new Error('Invalid action')
      }
    }

    return new Response('Method not allowed', { 
      status: 405,
      headers: corsHeaders 
    })

  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

async function getSumUpConfig(): Promise<SumUpConfig> {
  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const { data } = await supabaseClient
    .from('platform_settings')
    .select('setting_value')
    .eq('setting_key', 'payment_config')
    .single()

  if (!data?.setting_value) {
    throw new Error('SumUp configuration not found')
  }

  const config = data.setting_value as any
  return {
    app_id: config.sumup_app_id,
    app_secret: config.sumup_app_secret,
    merchant_code: config.merchant_code || 'DEFAULT_MERCHANT'
  }
}

async function getAccessToken(config: SumUpConfig): Promise<string> {
  const response = await fetch('https://api.sumup.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.app_id,
      client_secret: config.app_secret,
    }),
  })

  if (!response.ok) {
    throw new Error(`Failed to get access token: ${response.statusText}`)
  }

  const data = await response.json()
  return data.access_token
}

async function createCheckout(request: SumUpCheckoutRequest) {
  const config = await getSumUpConfig()
  const accessToken = await getAccessToken(config)

  const checkoutData = {
    checkout_reference: `PLAN_${request.plan_type.toUpperCase()}_${Date.now()}`,
    amount: request.amount,
    currency: request.currency,
    merchant_code: config.merchant_code,
    description: request.description,
    return_url: request.return_url,
    customer_id: request.customer_id,
  }

  const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(checkoutData),
  })

  if (!response.ok) {
    throw new Error(`Failed to create checkout: ${response.statusText}`)
  }

  const checkout = await response.json()
  
  return new Response(
    JSON.stringify({
      success: true,
      checkout_id: checkout.id,
      checkout_url: `https://pay.sumup.com/checkout/${checkout.id}`,
      checkout: checkout
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function createRecurringCheckout(request: SumUpCheckoutRequest) {
  const config = await getSumUpConfig()
  const accessToken = await getAccessToken(config)

  // For recurring payments, we need to set up the initial payment with SETUP_RECURRING_PAYMENT purpose
  const checkoutData = {
    checkout_reference: `RECURRING_${request.plan_type.toUpperCase()}_${Date.now()}`,
    amount: request.amount,
    currency: request.currency,
    merchant_code: config.merchant_code,
    description: `${request.description} - Recurring Subscription`,
    return_url: request.return_url,
    customer_id: request.customer_id,
    purpose: 'SETUP_RECURRING_PAYMENT'
  }

  const response = await fetch('https://api.sumup.com/v0.1/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(checkoutData),
  })

  if (!response.ok) {
    throw new Error(`Failed to create recurring checkout: ${response.statusText}`)
  }

  const checkout = await response.json()
  
  return new Response(
    JSON.stringify({
      success: true,
      checkout_id: checkout.id,
      checkout_url: `https://pay.sumup.com/checkout/${checkout.id}`,
      checkout: checkout,
      is_recurring: true
    }),
    { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    }
  )
}

async function testConnection() {
  try {
    const config = await getSumUpConfig()
    const accessToken = await getAccessToken(config)
    
    // Test by making a simple API call to verify credentials
    const response = await fetch('https://api.sumup.com/v0.1/me', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    })

    if (!response.ok) {
      throw new Error(`Connection test failed: ${response.statusText}`)
    }

    const profile = await response.json()
    
    return new Response(
      JSON.stringify({
        success: true,
        message: 'SumUp connection successful',
        merchant_code: profile.merchant_code || config.merchant_code
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
}