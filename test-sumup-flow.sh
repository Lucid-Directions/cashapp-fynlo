#!/bin/bash

# Test SumUp Tap to Pay Flow

echo "Testing SumUp Tap to Pay Flow"
echo "=============================="
echo ""

# 1. Test backend configuration
echo "1. Testing backend SumUp configuration..."
echo "-------------------------------------------"

# Get auth token first (using test credentials)
echo "Getting auth token..."
AUTH_RESPONSE=$(curl -s -X POST "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/auth/verify" \
  -H "Content-Type: application/json" \
  -d '{"token": "test-token"}')

echo "Auth response: $AUTH_RESPONSE"
echo ""

# Test SumUp initialize endpoint
echo "Testing /api/v1/sumup/initialize endpoint..."
curl -X POST "https://fynlopos-9eg2c.ondigitalocean.app/api/v1/sumup/initialize" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  -d '{"mode": "sandbox"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  --max-time 10 2>&1 | tail -20

echo ""
echo "2. Expected SumUp configuration values:"
echo "-------------------------------------------"
echo "API Key: sup_sk_ygXrOtDeSxrqXshl7UihNsaZouj3ecwSN"
echo "Merchant Code: MDHRDN4N"
echo "Affiliate Key: sup_afk_8OlK0ooUnu0MxvmKx6Beapf4L0ekSCe9"
echo "App ID: 01 fynlo"
echo "Environment: sandbox"

echo ""
echo "3. Mobile App Flow:"
echo "-------------------------------------------"
echo "a) PaymentScreen should load and show 'Tap to Pay' option"
echo "b) Customer name/email should be OPTIONAL"
echo "c) Clicking 'Process Payment' should:"
echo "   - Initialize SumUp SDK with affiliate key from backend"
echo "   - Show SumUp login if not logged in"
echo "   - Show Tap to Pay activation if not activated"
echo "   - Present Tap to Pay modal (NOT card reader alert)"
echo ""

echo "4. Testing payment flow in app..."
echo "-------------------------------------------"
echo "Please test in the iOS app:"
echo "1. Go to cart with items"
echo "2. Proceed to payment"
echo "3. Select 'Tap to Pay'"
echo "4. Do NOT enter customer name (should be optional)"
echo "5. Click 'Process Payment'"
echo "6. Verify you see SumUp modal, NOT alert about card reader"
echo ""

echo "5. Check backend logs for errors..."
echo "-------------------------------------------"
doctl apps logs 04073e70-e799-4d27-873a-dadea0503858 --tail 20 | grep -E "(sumup|SumUp|SUMUP|affiliate|tap.to.pay)" 2>&1 || echo "No recent SumUp logs found"

echo ""
echo "Test complete. Please verify the mobile app shows the proper SumUp modal."