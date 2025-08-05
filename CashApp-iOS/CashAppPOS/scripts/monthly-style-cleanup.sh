#!/bin/bash

# Monthly React Native Style Cleanup Script
# Run this monthly to identify genuine unused styles and inline styles

echo "🧹 Monthly React Native Style Cleanup"
echo "===================================="
echo ""

# Create a timestamp for the report
TIMESTAMP=$(date +"%Y-%m-%d")
REPORT_FILE="style-cleanup-report-${TIMESTAMP}.txt"

echo "Generating style cleanup report..."
echo ""

# Count current warnings
echo "📊 Current Warning Summary:" | tee "$REPORT_FILE"
echo "------------------------" | tee -a "$REPORT_FILE"

# Count total warnings
TOTAL_WARNINGS=$(npx eslint . --ext .tsx --quiet 2>/dev/null | grep -E "react-native/no-(unused-styles|inline-styles)" | wc -l | tr -d ' ')
echo "Total React Native style warnings: $TOTAL_WARNINGS" | tee -a "$REPORT_FILE"

# Count by type
UNUSED_STYLES=$(npx eslint . --ext .tsx --quiet 2>/dev/null | grep "react-native/no-unused-styles" | wc -l | tr -d ' ')
INLINE_STYLES=$(npx eslint . --ext .tsx --quiet 2>/dev/null | grep "react-native/no-inline-styles" | wc -l | tr -d ' ')

echo "- Unused styles: $UNUSED_STYLES" | tee -a "$REPORT_FILE"
echo "- Inline styles: $INLINE_STYLES" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Find files with genuine inline styles (excluding files with eslint-disable)
echo "📝 Files with Inline Styles to Fix:" | tee -a "$REPORT_FILE"
echo "--------------------------------" | tee -a "$REPORT_FILE"

npx eslint . --ext .tsx --format compact 2>/dev/null | grep -E "react-native/no-inline-styles" | \
  awk -F: '{print $1}' | sort | uniq | while read -r file; do
  # Check if file has eslint-disable comment
  if ! grep -q "eslint-disable react-native/no-unused-styles" "$file" 2>/dev/null; then
    COUNT=$(npx eslint "$file" --quiet 2>/dev/null | grep "react-native/no-inline-styles" | wc -l | tr -d ' ')
    echo "  $file: $COUNT inline styles" | tee -a "$REPORT_FILE"
  fi
done

echo "" | tee -a "$REPORT_FILE"

# Find genuinely unused styles in simple components
echo "🔍 Checking for Genuine Unused Styles:" | tee -a "$REPORT_FILE"
echo "-----------------------------------" | tee -a "$REPORT_FILE"
echo "(Checking only files without useThemedStyles pattern)" | tee -a "$REPORT_FILE"
echo "" | tee -a "$REPORT_FILE"

# Check components that don't use useThemedStyles
find src -name "*.tsx" -type f | while read -r file; do
  if ! grep -q "useThemedStyles" "$file" && grep -q "StyleSheet.create" "$file"; then
    UNUSED=$(npx eslint "$file" --quiet 2>/dev/null | grep "react-native/no-unused-styles" | wc -l | tr -d ' ')
    if [ "$UNUSED" -gt 0 ]; then
      echo "  $file: $UNUSED potentially unused styles" | tee -a "$REPORT_FILE"
    fi
  fi
done

echo "" | tee -a "$REPORT_FILE"

# Summary and recommendations
echo "📋 Recommendations:" | tee -a "$REPORT_FILE"
echo "----------------" | tee -a "$REPORT_FILE"

if [ "$INLINE_STYLES" -gt 0 ]; then
  echo "1. Fix $INLINE_STYLES inline styles for better performance" | tee -a "$REPORT_FILE"
  echo "   Run: npm run fix:inline-styles" | tee -a "$REPORT_FILE"
else
  echo "1. ✅ No inline styles found - great job!" | tee -a "$REPORT_FILE"
fi

if [ "$UNUSED_STYLES" -gt 100 ]; then
  echo "2. Review files without useThemedStyles for genuine unused styles" | tee -a "$REPORT_FILE"
else
  echo "2. ✅ Unused style warnings are under control" | tee -a "$REPORT_FILE"
fi

echo "" | tee -a "$REPORT_FILE"
echo "Report saved to: $REPORT_FILE" | tee -a "$REPORT_FILE"
echo ""
echo "✨ Cleanup check complete!"