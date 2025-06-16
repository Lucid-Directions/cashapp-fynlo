#!/bin/bash

# Fynlo Mexican Restaurant POS - Development Startup Script
echo "🌮 Starting Fynlo Mexican Restaurant POS Development Environment..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the CashAppPOS directory"
    exit 1
fi

# Kill any existing Metro processes
echo "🧹 Cleaning up existing Metro processes..."
pkill -f "react-native start" || true
pkill -f "metro" || true

# Clean and rebuild JavaScript bundle
echo "📦 Building JavaScript bundle..."
npm run build:ios

# Start Metro bundler for development
echo "🚀 Starting Metro bundler..."
npx react-native start --reset-cache &
METRO_PID=$!

echo "✅ Development environment ready!"
echo "📱 You can now run the iOS app from Xcode"
echo "🌐 Metro bundler is running on http://localhost:8081"
echo ""
echo "To stop Metro bundler, run: kill $METRO_PID"
echo "Or press Ctrl+C to stop this script and Metro bundler"

# Wait for user to stop
wait $METRO_PID