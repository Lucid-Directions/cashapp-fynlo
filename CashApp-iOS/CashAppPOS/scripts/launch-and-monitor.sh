#!/bin/bash

# Launch and Monitor iOS App Script
# This script launches the app and immediately shows console output

SIMULATOR_ID="017F2F16-5645-412A-945E-ECCBB3FE805C"
BUNDLE_ID="com.fynlo.cashappposlucid"

echo "🚀 Launching app and monitoring logs..."
echo "=================================="

# Terminate any existing instance
xcrun simctl terminate "$SIMULATOR_ID" "$BUNDLE_ID" 2>/dev/null

# Launch the app
echo "Launching $BUNDLE_ID..."
xcrun simctl launch "$SIMULATOR_ID" "$BUNDLE_ID" &
LAUNCH_PID=$!

# Give it a second to start
sleep 2

# Get the app's process ID
APP_PID=$(xcrun simctl spawn "$SIMULATOR_ID" launchctl list | grep "$BUNDLE_ID" | awk '{print $1}')
echo "App PID: $APP_PID"

# Monitor the console output
echo ""
echo "📋 Console Output:"
echo "------------------"
xcrun simctl spawn "$SIMULATOR_ID" log stream --level debug --predicate "process == 'CashAppPOS'" --style compact --timeout 10 2>&1 | grep -v "nw_socket_handle_socket_event" | head -100

echo ""
echo "=================================="
echo "✅ Monitoring complete"