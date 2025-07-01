#!/bin/bash

# Fix RNDateTimePicker Yoga compatibility issue
# This script patches the DateTimePicker to work with newer Yoga versions

echo "🔧 Fixing RNDateTimePicker Yoga compatibility..."

PICKER_FILE="../Pods/RNDateTimePicker/ios/RNDateTimePickerShadowView.m"

if [ -f "$PICKER_FILE" ]; then
    # Replace YGNodeConstRef with YGNodeRef in the measure function
    sed -i '' 's/YGNodeConstRef node/YGNodeRef node/g' "$PICKER_FILE"
    echo "✅ RNDateTimePicker Yoga compatibility fixed!"
else
    echo "⚠️ RNDateTimePicker file not found, skipping patch"
fi