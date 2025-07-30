#!/bin/bash
# Optimize Fynlo POS App Platform Resources
# Reduces over-provisioned instances to save costs

echo "🚀 Fynlo POS App Platform Optimization Script"
echo "==========================================="
echo ""

# Check if doctl is installed
if ! command -v doctl &> /dev/null; then
    echo "❌ Error: doctl CLI not found. Please install it first:"
    echo "   brew install doctl"
    exit 1
fi

# Check authentication
if ! doctl account get &> /dev/null; then
    echo "❌ Error: Not authenticated with DigitalOcean"
    echo "   Run: doctl auth init"
    exit 1
fi

# Get app details
echo "📊 Fetching current app configuration..."
APP_ID=$(doctl apps list --format ID,Spec.Name --no-header | grep "fynlopos" | awk '{print $1}')

if [ -z "$APP_ID" ]; then
    echo "❌ Error: Could not find fynlopos app"
    exit 1
fi

echo "✅ Found app: $APP_ID"
echo ""

# Show current configuration
echo "📋 Current Configuration:"
doctl apps get $APP_ID --format "DefaultIngress.Rules.Component.Name,Spec.Services.InstanceCount,ActiveDeployment.Services.InstanceCount"

# Create optimized spec
cat > app-spec-optimized.yaml << 'EOF'
name: fynlopos
region: lon
services:
- name: cashapp-fynlo
  github:
    repo: Lucid-Directions/cashapp-fynlo
    branch: main
    deploy_on_push: true
  build_command: |
    cd backend
    pip install -r requirements.txt
  run_command: |
    cd backend
    uvicorn app.main:app --host 0.0.0.0 --port 8080
  environment_slug: python
  instance_count: 2  # Reduced from 4 to 2
  instance_size_slug: apps-s-1vcpu-1gb
  http_port: 8080
  health_check:
    http_path: /api/v1/health
    initial_delay_seconds: 20
    period_seconds: 10
    success_threshold: 1
    failure_threshold: 3
  envs:
  - key: DEPLOYMENT_ENV
    value: "production"
    type: "GENERAL"
  - key: REDIS_URL
    value: "${fynlo-pos-cache.REDIS_URL}"
    type: "APP_COMPONENT_REF"
  - key: DATABASE_URL
    value: "${fynlo-pos-db.DATABASE_URL}"
    type: "APP_COMPONENT_REF"
  routes:
  - path: /
  cors:
    allow_origins:
    - prefix: "https://fynlo.com"
    - prefix: "https://app.fynlo.com"
    allow_methods:
    - GET
    - POST
    - PUT
    - DELETE
    - OPTIONS
    - PATCH
    allow_headers:
    - Content-Type
    - Authorization
databases:
- name: fynlo-pos-db
  engine: PG
  production: true
  cluster_name: fynlo-pos-db
- name: fynlo-pos-cache
  engine: REDIS
  production: true
  cluster_name: fynlo-pos-cache
EOF

echo ""
echo "💡 Optimization Plan:"
echo "   - Reduce service instances from 4 to 2"
echo "   - CPU usage is only 2.5%, memory 20%"
echo "   - Estimated savings: $10-20/month"
echo ""

# Confirm before applying
read -p "Apply optimization? This will trigger a new deployment (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "❌ Optimization cancelled"
    exit 1
fi

# Apply the optimized configuration
echo ""
echo "🔧 Applying optimized configuration..."
doctl apps update $APP_ID --spec-path app-spec-optimized.yaml

# Monitor deployment
echo ""
echo "🔄 Monitoring deployment status..."
echo "   This may take 5-10 minutes..."

# Wait for deployment to start
sleep 10

# Check deployment status
DEPLOYMENT_ID=$(doctl apps list-deployments $APP_ID --format ID --no-header | head -1)
if [ ! -z "$DEPLOYMENT_ID" ]; then
    echo "   Deployment ID: $DEPLOYMENT_ID"
    
    # Monitor until complete
    while true; do
        STATUS=$(doctl apps get-deployment $APP_ID $DEPLOYMENT_ID --format Phase --no-header)
        echo "   Status: $STATUS"
        
        if [ "$STATUS" = "ACTIVE" ]; then
            echo "✅ Deployment successful!"
            break
        elif [ "$STATUS" = "ERROR" ] || [ "$STATUS" = "CANCELED" ]; then
            echo "❌ Deployment failed with status: $STATUS"
            echo "   Check logs: doctl apps logs $APP_ID"
            exit 1
        fi
        
        sleep 30
    done
fi

# Verify new configuration
echo ""
echo "📊 New Configuration:"
doctl apps get $APP_ID --format "DefaultIngress.Rules.Component.Name,Spec.Services.InstanceCount,ActiveDeployment.Services.InstanceCount"

# Clean up
rm -f app-spec-optimized.yaml

echo ""
echo "✅ Optimization complete!"
echo "💰 Expected monthly savings: $10-20"
echo ""
echo "📋 Next steps:"
echo "   1. Monitor app performance for 24 hours"
echo "   2. Check response times and error rates"
echo "   3. Scale up if needed: doctl apps update $APP_ID --spec-path <spec-file>"
echo ""
echo "📊 Monitor health:"
echo "   doctl apps logs $APP_ID --follow"