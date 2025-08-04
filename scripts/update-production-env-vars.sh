#!/bin/bash

# Script to update DigitalOcean environment variables for production deployment

APP_ID="04073e70-e799-4d27-873a-dadea0503858"

echo "🔧 Updating DigitalOcean environment variables for production..."
echo ""

# Generate a secure SECRET_KEY
SECRET_KEY=$(python3 -c "import secrets; print(secrets.token_urlsafe(64))")
echo "✅ Generated new SECRET_KEY: ${SECRET_KEY:0:10}... (truncated for security)"

# Update the app specification with correct environment variables
echo "📝 Creating updated app specification..."

cat > /tmp/env-update.yaml << EOF
# Add or update these environment variables
env_vars:
  - key: ENVIRONMENT
    value: production
    scope: RUN_AND_BUILD_TIME
  - key: SECRET_KEY
    value: $SECRET_KEY
    scope: RUN_AND_BUILD_TIME
    type: SECRET
  - key: SUMUP_ENVIRONMENT
    value: production
    scope: RUN_AND_BUILD_TIME
  - key: DEBUG
    value: "false"
    scope: RUN_AND_BUILD_TIME
  - key: ERROR_DETAIL_ENABLED
    value: "false"
    scope: RUN_AND_BUILD_TIME
EOF

echo ""
echo "📋 Environment variables to be updated:"
echo "  - ENVIRONMENT=production"
echo "  - SECRET_KEY=(new secure value)"
echo "  - SUMUP_ENVIRONMENT=production"
echo "  - DEBUG=false"
echo "  - ERROR_DETAIL_ENABLED=false"
echo ""

echo "⚠️  To apply these changes, run the following commands:"
echo ""
echo "1. First, check current values:"
echo "   doctl apps spec get $APP_ID --format yaml | grep -A 50 'envs:'"
echo ""
echo "2. Update each environment variable:"
echo "   # Set ENVIRONMENT to production"
echo "   doctl apps config set $APP_ID ENVIRONMENT=production"
echo ""
echo "   # Set new SECRET_KEY"
echo "   doctl apps config set $APP_ID SECRET_KEY='$SECRET_KEY'"
echo ""
echo "   # Set SUMUP_ENVIRONMENT to production"
echo "   doctl apps config set $APP_ID SUMUP_ENVIRONMENT=production"
echo ""
echo "   # Set DEBUG to false"
echo "   doctl apps config set $APP_ID DEBUG=false"
echo ""
echo "   # Set ERROR_DETAIL_ENABLED to false"
echo "   doctl apps config set $APP_ID ERROR_DETAIL_ENABLED=false"
echo ""
echo "3. Trigger a new deployment:"
echo "   doctl apps create-deployment $APP_ID"
echo ""
echo "4. Monitor deployment:"
echo "   doctl apps logs $APP_ID --tail --follow"
echo ""
echo "🔐 IMPORTANT: Save the SECRET_KEY in a secure location!"
echo "SECRET_KEY: $SECRET_KEY"