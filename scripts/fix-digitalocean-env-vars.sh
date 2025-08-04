#!/bin/bash

# Script to fix DigitalOcean environment variables

APP_ID="04073e70-e799-4d27-873a-dadea0503858"

echo "🔍 SHERLOCK HOLMES INVESTIGATION COMPLETE!"
echo ""
echo "🚨 THE PROBLEM:"
echo "Your SECRET_KEY in DigitalOcean is set to:"
echo "'production-secret-key-change-this-to-a-long-random-string-in-deployment'"
echo ""
echo "This is a PLACEHOLDER that's literally telling you to change it!"
echo ""

# Generate a new secure SECRET_KEY
NEW_SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")

echo "✅ SOLUTION:"
echo ""
echo "1. Update SECRET_KEY with this secure value:"
echo "   $NEW_SECRET_KEY"
echo ""
echo "2. Keep SUMUP_ENVIRONMENT as 'sandbox' (since you're testing)"
echo ""
echo "3. Run these commands to update DigitalOcean:"
echo ""
echo "   # Update SECRET_KEY"
echo "   doctl apps config set $APP_ID SECRET_KEY='$NEW_SECRET_KEY'"
echo ""
echo "   # Ensure other critical vars are set"
echo "   doctl apps config set $APP_ID ENVIRONMENT='production'"
echo "   doctl apps config set $APP_ID DEBUG='false'"
echo "   doctl apps config set $APP_ID ERROR_DETAIL_ENABLED='false'"
echo ""
echo "4. Then check the deployment:"
echo "   doctl apps list-deployments $APP_ID --format ID,Phase,Created --no-header | head -5"
echo ""
echo "📝 IMPORTANT: The deployment was working before because:"
echo "   - PR #522 (Aug 4) added strict validation"
echo "   - Before that, these placeholder values weren't being checked"
echo "   - Your app has been running with an insecure SECRET_KEY!"
echo ""
echo "🔐 Save this SECRET_KEY securely: $NEW_SECRET_KEY"