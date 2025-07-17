import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface PlatformMetrics {
  activeBusinesses: number;
  totalRevenue: number;
  totalTransactions: number;
  systemHealth: {
    uptime: number;
    status: 'operational' | 'degraded' | 'outage';
    services: {
      database: boolean;
      payments: boolean;
      api: boolean;
    };
  };
  recentActivity: any[];
  growthMetrics: {
    businessGrowth: number;
    revenueGrowth: number;
    transactionGrowth: number;
  };
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

    // Verify user is authenticated and is platform owner
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: corsHeaders }
      );
    }

    // Check if user is platform owner (admin role)
    const { data: userRole } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .maybeSingle();

    if (userRole?.role !== 'admin') {
      return new Response(
        JSON.stringify({ error: 'Platform owner access required' }),
        { status: 403, headers: corsHeaders }
      );
    }

    console.log('Fetching real platform metrics from database...');

    // Create admin client for platform-wide data access
    const adminClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const metrics: PlatformMetrics = {
      activeBusinesses: 0,
      totalRevenue: 0,
      totalTransactions: 0,
      systemHealth: {
        uptime: 99.9,
        status: 'operational',
        services: {
          database: true,
          payments: true,
          api: true,
        },
      },
      recentActivity: [],
      growthMetrics: {
        businessGrowth: 0,
        revenueGrowth: 0,
        transactionGrowth: 0,
      },
    };

    // Fetch active restaurants count
    const { data: restaurants, error: restaurantsError } = await adminClient
      .from('restaurants')
      .select('id')
      .eq('is_active', true);

    if (!restaurantsError && restaurants) {
      metrics.activeBusinesses = restaurants.length;
      console.log(`Found ${restaurants.length} active businesses`);
    } else {
      console.log('No restaurants found or error:', restaurantsError);
    }

    // Fetch total revenue from payments
    const { data: payments, error: paymentsError } = await adminClient
      .from('payments')
      .select('amount')
      .eq('payment_status', 'completed');

    if (!paymentsError && payments) {
      metrics.totalRevenue = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
      console.log(`Total revenue: £${metrics.totalRevenue}`);
    } else {
      console.log('No payments found or error:', paymentsError);
    }

    // Fetch total transactions count
    const { data: orders, error: ordersCountError } = await adminClient
      .from('orders')
      .select('id');

    if (!ordersCountError && orders) {
      metrics.totalTransactions = orders.length;
      console.log(`Total transactions: ${metrics.totalTransactions}`);
    } else {
      console.log('No orders found or error:', ordersCountError);
    }

    // Calculate growth metrics (compare last 30 days vs previous 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sixtyDaysAgo = new Date();
    sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);

    // Revenue growth
    const { data: recentPayments } = await adminClient
      .from('payments')
      .select('amount, created_at')
      .eq('payment_status', 'completed')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: previousPayments } = await adminClient
      .from('payments')
      .select('amount, created_at')
      .eq('payment_status', 'completed')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (recentPayments && previousPayments) {
      const recentRevenue = recentPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      const previousRevenue = previousPayments.reduce((sum, p) => sum + Number(p.amount), 0);
      
      if (previousRevenue > 0) {
        metrics.growthMetrics.revenueGrowth = ((recentRevenue - previousRevenue) / previousRevenue) * 100;
      }
    }

    // Transaction growth
    const { data: recentOrders30 } = await adminClient
      .from('orders')
      .select('id')
      .gte('created_at', thirtyDaysAgo.toISOString());

    const { data: previousOrders30 } = await adminClient
      .from('orders')
      .select('id')
      .gte('created_at', sixtyDaysAgo.toISOString())
      .lt('created_at', thirtyDaysAgo.toISOString());

    if (recentOrders30 && previousOrders30) {
      const recentCount = recentOrders30.length;
      const previousCount = previousOrders30.length;
      
      if (previousCount > 0) {
        metrics.growthMetrics.transactionGrowth = ((recentCount - previousCount) / previousCount) * 100;
      }
    }

    // Get recent activity from orders
    const { data: recentOrders, error: ordersError } = await adminClient
      .from('orders')
      .select(`
        id, 
        order_number, 
        total_amount,
        created_at, 
        status,
        restaurants (name)
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (!ordersError && recentOrders && recentOrders.length > 0) {
      metrics.recentActivity = recentOrders.map(order => ({
        id: order.id,
        type: 'order',
        description: `Order #${order.order_number} - £${Number(order.total_amount).toFixed(2)} from ${order.restaurants?.name || 'Unknown Restaurant'}`,
        timestamp: order.created_at,
        status: order.status,
      }));
      console.log(`Found ${recentOrders.length} recent orders`);
    } else {
      // Add a system message when no orders exist
      metrics.recentActivity = [{
        id: 'system-message',
        type: 'system',
        description: 'Platform connected successfully. Database ready for first orders.',
        timestamp: new Date().toISOString(),
        status: 'info',
      }];
      console.log('No orders found, showing system message');
    }

    // Test database connection for system health
    try {
      const { error: healthError } = await adminClient
        .from('restaurants')
        .select('id')
        .limit(1);
      
      metrics.systemHealth.services.database = !healthError;
    } catch (error) {
      metrics.systemHealth.services.database = false;
      console.error('Database health check failed:', error);
    }

    // Test payment service health by checking if we can reach external APIs
    const paymentHealthChecks = [];
    
    // Check Stripe
    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (stripeKey) {
      paymentHealthChecks.push(
        fetch('https://api.stripe.com/v1/charges?limit=1', {
          headers: { 'Authorization': `Bearer ${stripeKey}` },
        }).then(() => true).catch(() => false)
      );
    }

    // Check SumUp
    const sumupKey = Deno.env.get('SUMUP_API_KEY');
    if (sumupKey) {
      paymentHealthChecks.push(
        fetch('https://api.sumup.com/v0.1/me', {
          headers: { 'Authorization': `Bearer ${sumupKey}` },
        }).then(() => true).catch(() => false)
      );
    }

    if (paymentHealthChecks.length > 0) {
      const results = await Promise.all(paymentHealthChecks);
      metrics.systemHealth.services.payments = results.some(result => result);
    }

    // Determine overall system status
    const allServicesUp = Object.values(metrics.systemHealth.services).every(service => service);
    metrics.systemHealth.status = allServicesUp ? 'operational' : 'degraded';

    console.log('Platform metrics calculated successfully');

    return new Response(
      JSON.stringify(metrics),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    );

  } catch (error) {
    console.error('Error in platform-metrics function:', error);
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