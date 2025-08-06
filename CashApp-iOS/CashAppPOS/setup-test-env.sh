#!/bin/bash

# Setup test environment for REAL infrastructure testing
# This sets up the required environment variables for Supabase and backend

echo "🚀 Setting up REAL test environment..."

# Export Supabase credentials (from CLAUDE.md context)
export SUPABASE_URL="https://muukvrmagzsiqpbkmjhl.supabase.co"
export SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11dWt2cm1hZ3pzaXFwYmttamhsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MzAxMDkwNzIsImV4cCI6MjA0NTY4NTA3Mn0.YXHqM7BV9u8K5REdpVjNKgJTvPELZ5WXCLyGx_gnxNw"

# Test user credentials (you need to create this user on fynlo.co.uk)
export TEST_USER_EMAIL="test@fynlo.co.uk"
export TEST_USER_PASSWORD="TestPassword123!"
export TEST_RESTAURANT_ID="test-restaurant-001"

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