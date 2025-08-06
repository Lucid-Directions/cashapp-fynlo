#!/bin/bash

# Setup test environment for REAL infrastructure testing
# This sets up the required environment variables for Supabase and backend

echo "🚀 Setting up REAL test environment with EXISTING users..."

# Export Supabase credentials (from backend/.env.production)
# NOTE: These are set from environment or backend config - DO NOT hardcode production keys here!
export SUPABASE_URL="${SUPABASE_URL:-https://eweggzpvuqczrrrwszyy.supabase.co}"
export SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-[SET_FROM_ENV]}"

# Use REAL existing users (Arnaud's accounts from Supabase)
# Default: Restaurant Manager account
export TEST_USER_EMAIL="${TEST_USER_EMAIL:-arnaud@luciddirections.co.uk}"
export TEST_USER_PASSWORD="${TEST_USER_PASSWORD:-}"  # Must be set via environment

# Platform Owner account (for admin tests)
export PLATFORM_OWNER_EMAIL="${PLATFORM_OWNER_EMAIL:-sleepyarno@gmail.com}"
export PLATFORM_OWNER_PASSWORD="${PLATFORM_OWNER_PASSWORD:-}"  # Must be set via environment

# Restaurant ID for the restaurant manager's restaurant
export TEST_RESTAURANT_ID="${TEST_RESTAURANT_ID:-459da6bc-3472-4de6-8f0c-793373f1a7b0}"  # Arnaud's restaurant user ID from Supabase

# Backend configuration
export API_BASE_URL="https://fynlopos-9eg2c.ondigitalocean.app"
export WEBSOCKET_URL="wss://fynlopos-9eg2c.ondigitalocean.app/ws"

# Enable real infrastructure
export USE_REAL_BACKEND=true
export USE_REAL_AUTH=true
export USE_REAL_WEBSOCKET=true
export SKIP_MOCKS=true

echo "✅ Environment variables set:"
echo "   SUPABASE_URL: $SUPABASE_URL"
echo "   API_BASE_URL: $API_BASE_URL"
echo "   WEBSOCKET_URL: $WEBSOCKET_URL"
echo "   TEST_USER_EMAIL: $TEST_USER_EMAIL"

echo ""
echo "⚠️  IMPORTANT: Make sure you have created the test user account:"
echo "   1. Go to https://fynlo.co.uk"
echo "   2. Sign up with email: test@fynlo.co.uk"
echo "   3. Use password: TestPassword123!"
echo "   4. Select Alpha (free) plan"
echo ""

echo "📝 Running tests with REAL infrastructure..."
npm test