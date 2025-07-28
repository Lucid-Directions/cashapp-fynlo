#!/bin/bash

# Custom React Native bundling script for Xcode
# This replaces the outdated react-native-xcode.sh script

set -e

# Set default values
ENTRY_FILE="index.js"
BUNDLE_PLATFORM="ios"

# Determine if this is a debug or release build
if [[ "$CONFIGURATION" == *"Debug"* ]]; then
    DEV=true
    echo "Building for Debug - Metro will be used for development"
    # For debug builds, we don't need to bundle - Metro will serve the files
    exit 0
else
    DEV=false
    echo "Building for Release - Creating bundle"
fi

# Set bundle output path
BUNDLE_OUTPUT="$CONFIGURATION_BUILD_DIR/main.jsbundle"
ASSETS_DEST="$CONFIGURATION_BUILD_DIR"

# Navigate to the React Native project root
cd ..

# Generate the bundle using Metro
echo "Creating React Native bundle..."
echo "Entry file: $ENTRY_FILE"
echo "Platform: $BUNDLE_PLATFORM"
echo "Dev mode: $DEV"
echo "Bundle output: $BUNDLE_OUTPUT"
echo "Assets destination: $ASSETS_DEST"

# Run the Metro bundler
npx react-native bundle \
  --platform "$BUNDLE_PLATFORM" \
  --dev $DEV \
  --entry-file "$ENTRY_FILE" \
  --bundle-output "$BUNDLE_OUTPUT" \
  --assets-dest "$ASSETS_DEST"

echo "✅ React Native bundle created successfully!" 