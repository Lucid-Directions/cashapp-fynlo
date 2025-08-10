#!/bin/bash

echo "📱 Monitoring Fynlo POS App..."
echo "================================"
echo "Waiting for app to launch..."
echo ""

# Function to monitor logs
monitor_logs() {
    echo "🔍 Capturing logs from POS screen navigation..."
    echo "================================================"
    
    # Stream logs and filter for relevant messages
    xcrun simctl spawn booted log stream --level debug --style compact | while read -r line; do
        # Check for app-specific logs
        if echo "$line" | grep -E "CashAppPOS|Fynlo|POS|cart|TypeError|undefined|error|Error|ERROR|crash|Crash|CRASH" > /dev/null; then
            echo "$line"
            
            # Specifically highlight POS screen errors
            if echo "$line" | grep -E "POSScreen|TypeError.*map|undefined.*object|cart.*undefined" > /dev/null; then
                echo "⚠️  POS SCREEN ERROR DETECTED: $line"
            fi
        fi
    done
}

# Start monitoring
monitor_logs