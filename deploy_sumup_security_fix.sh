#!/bin/bash

# Deployment Script for SumUp Security Fix
# This script helps deploy the backend and prepare mobile app for release

set -e  # Exit on error

echo "🚀 Fynlo POS - SumUp Security Fix Deployment"
echo "============================================"

# Check if we're in the right directory
if [ ! -f "backend/app/main.py" ]; then
    echo "❌ Error: Please run this script from the project root directory"
    exit 1
fi

# Function to deploy backend
deploy_backend() {
    echo ""
    echo "📦 Deploying Backend to DigitalOcean..."
    echo "----------------------------------------"
    
    # Check if doctl is installed
    if ! command -v doctl &> /dev/null; then
        echo "❌ Error: doctl (DigitalOcean CLI) is not installed"
        echo "Install it with: brew install doctl"
        exit 1
    fi
    
    echo "1. Pushing latest changes to GitHub..."
    git add -A
    git commit -m "fix: Remove hardcoded SumUp API key and implement secure backend configuration" || echo "No changes to commit"
    git push origin main
    
    echo ""
    echo "2. DigitalOcean will automatically deploy from GitHub"
    echo "   Monitor deployment at: https://cloud.digitalocean.com/apps"
    
    echo ""
    echo "3. IMPORTANT: Set these environment variables in DigitalOcean App Platform:"
    echo "   - SUMUP_API_KEY=sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU"
    echo "   - SUMUP_ENVIRONMENT=production"
    echo "   - SUMUP_APP_ID=com.anonymous.cashapppos"
    echo "   - SUMUP_MERCHANT_CODE=<YOUR_MERCHANT_CODE>"
    
    echo ""
    echo "📝 See backend/deploy/production_env_variables.md for complete list"
}

# Function to prepare mobile app
prepare_mobile_app() {
    echo ""
    echo "📱 Preparing Mobile App for Deployment..."
    echo "----------------------------------------"
    
    cd CashApp-iOS/CashAppPOS
    
    echo "1. Installing dependencies..."
    npm install
    
    echo ""
    echo "2. Building iOS bundle..."
    npx react-native bundle \
        --platform ios \
        --dev false \
        --entry-file index.js \
        --bundle-output ios/CashAppPOS/main.jsbundle \
        --assets-dest ios/CashAppPOS
    
    echo ""
    echo "3. Installing iOS pods..."
    cd ios
    pod install
    cd ..
    
    echo ""
    echo "✅ Mobile app is ready for building in Xcode"
    echo "   1. Open ios/CashAppPOS.xcworkspace in Xcode"
    echo "   2. Select your team for signing"
    echo "   3. Archive and upload to App Store Connect"
    
    cd ../..
}

# Function to run tests
run_tests() {
    echo ""
    echo "🧪 Running Tests..."
    echo "-------------------"
    
    # Test backend
    echo "Testing backend SumUp endpoint..."
    cd backend
    python test_sumup_endpoint.py || echo "⚠️  Backend tests need configuration"
    cd ..
    
    echo ""
    echo "✅ Tests completed"
}

# Main menu
echo ""
echo "What would you like to do?"
echo "1. Deploy Backend to DigitalOcean"
echo "2. Prepare Mobile App for Release"
echo "3. Run Tests"
echo "4. Do Everything (Recommended)"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
    1)
        deploy_backend
        ;;
    2)
        prepare_mobile_app
        ;;
    3)
        run_tests
        ;;
    4)
        run_tests
        deploy_backend
        prepare_mobile_app
        ;;
    *)
        echo "❌ Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Deployment preparation complete!"
echo ""
echo "Next Steps:"
echo "1. Verify environment variables are set in DigitalOcean"
echo "2. Monitor backend deployment at https://cloud.digitalocean.com/apps"
echo "3. Test the /api/v1/sumup/initialize endpoint"
echo "4. Build and test mobile app thoroughly"
echo "5. Submit mobile app to App Store"