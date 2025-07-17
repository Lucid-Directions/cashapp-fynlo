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

    const { action, data } = await req.json()
    console.log('A/B test action:', action, data)

    switch (action) {
      case 'assign_variant':
        return await assignVariant(supabaseClient, data)
      case 'get_variant':
        return await getVariant(supabaseClient, data)
      case 'track_conversion':
        return await trackConversion(supabaseClient, data)
      case 'calculate_results':
        return await calculateResults(supabaseClient, data)
      default:
        throw new Error(`Unknown action: ${action}`)
    }
  } catch (error) {
    console.error('Error in A/B test function:', error)
    return new Response(
      JSON.stringify({ error: error.message }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    )
  }
})

async function assignVariant(supabase: any, data: any) {
  const { test_id, customer_id } = data

  // Check if customer already assigned
  const { data: existingAssignment, error: existingError } = await supabase
    .from('loyalty_ab_assignments')
    .select('*')
    .eq('test_id', test_id)
    .eq('customer_id', customer_id)
    .single()

  if (existingError && existingError.code !== 'PGRST116') {
    throw existingError
  }

  if (existingAssignment) {
    return new Response(
      JSON.stringify({
        variant: existingAssignment.variant,
        existing: true
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }

  // Get test configuration
  const { data: test, error: testError } = await supabase
    .from('loyalty_ab_tests')
    .select('*')
    .eq('id', test_id)
    .eq('status', 'active')
    .single()

  if (testError) throw testError

  // Determine variant based on traffic split
  const random = Math.random() * 100
  const variant = random < test.traffic_split ? 'variant' : 'control'

  // Create assignment
  const { error: assignmentError } = await supabase
    .from('loyalty_ab_assignments')
    .insert({
      test_id,
      customer_id,
      variant
    })

  if (assignmentError) throw assignmentError

  return new Response(
    JSON.stringify({
      variant,
      existing: false
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function getVariant(supabase: any, data: any) {
  const { test_id, customer_id } = data

  const { data: assignment, error } = await supabase
    .from('loyalty_ab_assignments')
    .select('variant')
    .eq('test_id', test_id)
    .eq('customer_id', customer_id)
    .single()

  if (error && error.code !== 'PGRST116') {
    throw error
  }

  return new Response(
    JSON.stringify({
      variant: assignment?.variant || null
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function trackConversion(supabase: any, data: any) {
  const { test_id, customer_id, conversion_type, value } = data

  // Get assignment
  const { data: assignment, error: assignmentError } = await supabase
    .from('loyalty_ab_assignments')
    .select('*')
    .eq('test_id', test_id)
    .eq('customer_id', customer_id)
    .single()

  if (assignmentError) throw assignmentError

  // Record conversion in loyalty_transactions with A/B test context
  const { data: customerData, error: customerError } = await supabase
    .from('loyalty_customer_data')
    .select('id, program_id')
    .eq('customer_hash', customer_id)
    .single()

  if (customerError) throw customerError

  const { error: transactionError } = await supabase
    .from('loyalty_transactions')
    .insert({
      program_id: customerData.program_id,
      customer_data_id: customerData.id,
      transaction_type: 'conversion',
      points_change: 0,
      points_balance: 0,
      order_amount: value,
      reason: `A/B test conversion: ${conversion_type}`,
      ab_test_id: test_id,
      variant: assignment.variant
    })

  if (transactionError) throw transactionError

  return new Response(
    JSON.stringify({
      success: true,
      variant: assignment.variant
    }),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}

async function calculateResults(supabase: any, data: any) {
  const { test_id } = data

  // Get test details
  const { data: test, error: testError } = await supabase
    .from('loyalty_ab_tests')
    .select('*')
    .eq('id', test_id)
    .single()

  if (testError) throw testError

  // Get all assignments
  const { data: assignments, error: assignmentsError } = await supabase
    .from('loyalty_ab_assignments')
    .select('variant')
    .eq('test_id', test_id)

  if (assignmentsError) throw assignmentsError

  // Get conversion data
  const { data: conversions, error: conversionsError } = await supabase
    .from('loyalty_transactions')
    .select('variant, order_amount')
    .eq('ab_test_id', test_id)
    .eq('transaction_type', 'conversion')

  if (conversionsError) throw conversionsError

  // Calculate results by variant
  const controlAssignments = assignments.filter(a => a.variant === 'control').length
  const variantAssignments = assignments.filter(a => a.variant === 'variant').length
  
  const controlConversions = conversions.filter(c => c.variant === 'control')
  const variantConversions = conversions.filter(c => c.variant === 'variant')

  const controlRevenue = controlConversions.reduce((sum, c) => sum + (c.order_amount || 0), 0)
  const variantRevenue = variantConversions.reduce((sum, c) => sum + (c.order_amount || 0), 0)

  const controlConversionRate = controlAssignments > 0 ? (controlConversions.length / controlAssignments) * 100 : 0
  const variantConversionRate = variantAssignments > 0 ? (variantConversions.length / variantAssignments) * 100 : 0

  const improvement = controlConversionRate > 0 ? 
    ((variantConversionRate - controlConversionRate) / controlConversionRate) * 100 : 0

  // Simple significance test (chi-squared approximation)
  const totalAssignments = controlAssignments + variantAssignments
  const totalConversions = controlConversions.length + variantConversions.length
  
  let significance = 'insufficient_data'
  if (totalAssignments > 100 && totalConversions > 10) {
    const expectedControlConversions = (totalConversions * controlAssignments) / totalAssignments
    const expectedVariantConversions = (totalConversions * variantAssignments) / totalAssignments
    
    const chiSquared = 
      Math.pow(controlConversions.length - expectedControlConversions, 2) / expectedControlConversions +
      Math.pow(variantConversions.length - expectedVariantConversions, 2) / expectedVariantConversions
    
    significance = chiSquared > 3.84 ? 'significant' : 'not_significant' // p < 0.05
  }

  const results = {
    control: {
      participants: controlAssignments,
      conversions: controlConversions.length,
      conversionRate: controlConversionRate,
      revenue: controlRevenue,
      confidence: 95
    },
    variant: {
      participants: variantAssignments,
      conversions: variantConversions.length,
      conversionRate: variantConversionRate,
      revenue: variantRevenue,
      confidence: 95
    },
    improvement,
    significance
  }

  return new Response(
    JSON.stringify(results),
    { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
  )
}