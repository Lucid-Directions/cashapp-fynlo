#!/bin/bash

# Script to apply SocketRocket priority inversion patch

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
PATCH_FILE="$SCRIPT_DIR/socketrocket-priority-fix.patch"
SOCKETROCKET_DIR="$SCRIPT_DIR/Pods/SocketRocket"
TARGET_FILE="$SOCKETROCKET_DIR/SocketRocket/Internal/RunLoop/SRRunLoopThread.m"

echo "🔧 Applying SocketRocket priority inversion patch..."

# Check if patch file exists
if [ ! -f "$PATCH_FILE" ]; then
    echo "❌ Patch file not found: $PATCH_FILE"
    exit 1
fi

# Check if SocketRocket directory exists
if [ ! -d "$SOCKETROCKET_DIR" ]; then
    echo "❌ SocketRocket directory not found. Please run 'pod install' first."
    exit 1
fi

# Check if target file exists
if [ ! -f "$TARGET_FILE" ]; then
    echo "❌ Target file not found: $TARGET_FILE"
    exit 1
fi

# Check if patch has already been applied
if grep -q "Fix for priority inversion warning" "$TARGET_FILE"; then
    echo "✅ Patch has already been applied"
    exit 0
fi

# Apply the patch
cd "$SOCKETROCKET_DIR"
if patch -p1 < "$PATCH_FILE"; then
    echo "✅ Patch applied successfully!"
else
    echo "❌ Failed to apply patch"
    exit 1
fi