import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PaymentAnalytics {
  totalRevenue: number;
  totalTransactions: number;
  avgTransactionValue: number;
  recentTransactions: any[];
  stripeData?: any;
  sumupData?: any;
  squareData?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get the authorization header
    const authHeader = req.headers.get('authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Create client with user's token for authentication
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { authorization: authHeader },
        },
      }
    );

    // Verify user is authenticated
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Allow both GET and POST requests
    let restaurant_id, date_from, date_to;
    
    if (req.method === 'POST') {
      const body = await req.json();
      restaurant_id = body.restaurant_id;
      date_from = body.date_from;
      date_to = body.date_to;
    } else {
      // GET request - extract from URL params
      const url = new URL(req.url);
      restaurant_id = url.searchParams.get('restaurant_id');
      date_from = url.searchParams.get('date_from');
      date_to = url.searchParams.get('date_to');
    }
    
    console.log('Fetching payment analytics for:', { restaurant_id, date_from, date_to });

    // Check user permissions - platform owners can access all data, others only their restaurant
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    const isPlatformOwner = userRole?.role === 'admin';

    // If not platform owner and no restaurant_id provided, get user's restaurant
    if (!isPlatformOwner && !restaurant_id) {
      const { data: userRestaurantId } = await supabaseClient
        .rpc('get_user_restaurant_id', { _user_id: user.id });
      restaurant_id = userRestaurantId;
    }

    // Verify access to restaurant if specified
    if (restaurant_id && !isPlatformOwner) {
      const { data: hasAccess } = await supabaseClient
        .rpc('user_has_restaurant_access', { 
          _user_id: user.id, 
          _restaurant_id: restaurant_id 
        });
      
      if (!hasAccess) {
        return new Response(
          JSON.stringify({ error: 'Access denied to restaurant data' }),
          { status: 403, headers: corsHeaders }
        );
      }
    }

    const analytics: PaymentAnalytics = {
      totalRevenue: 0,
      totalTransactions: 0,
      avgTransactionValue: 0,
      recentTransactions: [],
    };

    // Build query with proper access control
    let query = supabaseClient
      .from('payments')
      .select('*')
      .gte('created_at', date_from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .lte('created_at', date_to || new Date().toISOString())
      .order('created_at', { ascending: false });
    
    // Filter by restaurant if provided (platform owners can see all, others restricted by RLS)
    if (restaurant_id) {
      query = query.eq('restaurant_id', restaurant_id);
    }
    
    const { data: localPayments, error } = await query;

    if (error) {
      console.error('Error fetching payments:', error);
    } else if (localPayments) {
      analytics.totalTransactions = localPayments.length;
      analytics.totalRevenue = localPayments.reduce((sum, payment) => sum + parseFloat(payment.amount.toString()), 0);
      analytics.avgTransactionValue = analytics.totalTransactions > 0 ? analytics.totalRevenue / analytics.totalTransactions : 0;
      analytics.recentTransactions = localPayments.slice(0, 10);
      console.log(`Found ${localPayments.length} payments with total revenue: £${analytics.totalRevenue}`);
    } else {
      console.log('No payment data found in database');
    }

    // Fetch from Stripe if available
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      try {
        const stripeResponse = await fetch('https://api.stripe.com/v1/charges', {
          headers: {
            'Authorization': `Bearer ${stripeKey}`,
            'Content-Type': 'application/x-www-form-urlencoded',
          },
        });
        
        if (stripeResponse.ok) {
          const stripeData = await stripeResponse.json();
          analytics.stripeData = {
            charges: stripeData.data?.length || 0,
            revenue: stripeData.data?.reduce((sum: number, charge: any) => 
              sum + (charge.amount_captured || 0), 0) / 100 || 0,
          };
          console.log('Stripe data fetched successfully');
        }
      } catch (error) {
        console.error('Error fetching Stripe data:', error);
      }
    }

    // Fetch from SumUp Restaurant API if available
    const sumupKey = Deno.env.get('SUMUP_RESTAURANT_API_KEY');
    if (sumupKey) {
      try {
        const sumupResponse = await fetch('https://api.sumup.com/v0.1/me/transactions', {
          headers: {
            'Authorization': `Bearer ${sumupKey}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (sumupResponse.ok) {
          const sumupData = await sumupResponse.json();
          analytics.sumupData = {
            transactions: sumupData.length || 0,
            revenue: sumupData.reduce((sum: number, tx: any) => 
              sum + (tx.amount || 0), 0) || 0,
          };
          console.log('SumUp data fetched successfully');
        }
      } catch (error) {
        console.error('Error fetching SumUp data:', error);
      }
    }

    // Fetch from Square if available
    const squareToken = Deno.env.get('SQUARE_ACCESS_TOKEN');
    if (squareToken) {
      try {
        const squareResponse = await fetch('https://connect.squareup.com/v2/payments', {
          headers: {
            'Authorization': `Bearer ${squareToken}`,
            'Content-Type': 'application/json',
            'Square-Version': '2024-01-18',
          },
        });
        
        if (squareResponse.ok) {
          const squareData = await squareResponse.json();
          analytics.squareData = {
            payments: squareData.payments?.length || 0,
            revenue: squareData.payments?.reduce((sum: number, payment: any) => 
              sum + (payment.amount_money?.amount || 0), 0) / 100 || 0,
          };
          console.log('Square data fetched successfully');
        }
      } catch (error) {
        console.error('Error fetching Square data:', error);
      }
    }

    return new Response(
      JSON.stringify(analytics),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in payment-analytics function:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );
  }
});