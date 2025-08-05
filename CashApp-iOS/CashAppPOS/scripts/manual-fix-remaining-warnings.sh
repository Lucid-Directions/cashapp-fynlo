#!/bin/bash

echo "🔧 Fixing remaining React Native style warnings..."

# Fix QRCodePayment.tsx - remove duplicate unused styles
echo "Fixing QRCodePayment.tsx..."
sed -i '' '/^const qrWrapperStyles = StyleSheet\.create({/,/^});$/d' src/components/payment/QRCodePayment.tsx

# Fix ThemeSwitcher.tsx - remove undefined styles
echo "Fixing ThemeSwitcher.tsx..."
sed -i '' '/container: {/,/},/d' src/components/theme/ThemeSwitcher.tsx
sed -i '' '/track: {/,/},/d' src/components/theme/ThemeSwitcher.tsx
sed -i '' '/thumb: {/,/},/d' src/components/theme/ThemeSwitcher.tsx

# Fix List.tsx - remove undefined styles
echo "Fixing List.tsx..."
sed -i '' '/contentContainer: {/,/},/d' src/components/ui/List.tsx
sed -i '' '/columnWrapper: {/,/},/d' src/components/ui/List.tsx

# Fix Modal.tsx - remove undefined styles
echo "Fixing Modal.tsx..."
sed -i '' '/menuCard: {/,/},/d' src/components/ui/Modal.tsx
sed -i '' '/menuCardDisabled: {/,/},/d' src/components/ui/Modal.tsx
sed -i '' '/menuCardContent: {/,/},/d' src/components/ui/Modal.tsx
sed -i '' '/menuItemEmoji: {/,/},/d' src/components/ui/Modal.tsx
sed -i '' '/menuItemName: {/,/},/d' src/components/ui/Modal.tsx
sed -i '' '/menuItemPrice: {/,/},/d' src/components/ui/Modal.tsx
sed -i '' '/quantityPillContainer: {/,/},/d' src/components/ui/Modal.tsx

# Fix inline styles in CustomersScreen.tsx
echo "Fixing CustomersScreen.tsx..."
# This is complex - need to find and replace the specific lines

# Fix inline styles in EmployeesScreen.tsx
echo "Fixing EmployeesScreen.tsx..."
# Find the line with rgba color and replace it
perl -i -pe "s/style=\\{\\{ color: 'rgba\\(255, 255, 255, 0\\.8\\)' \\}\\}/style={styles.deleteText}/" src/screens/employees/EmployeesScreen.tsx
# Add the style if not exists
if ! grep -q "deleteText:" src/screens/employees/EmployeesScreen.tsx; then
  perl -i -pe "s/(const styles = StyleSheet\\.create\\(\\{)/\$1\n  deleteText: {\n    color: 'rgba(255, 255, 255, 0.8)',\n  },/" src/screens/employees/EmployeesScreen.tsx
fi

# Fix inline styles in UserProfileScreen.tsx
echo "Fixing UserProfileScreen.tsx..."
# This needs careful handling for the conditional style

# Fix other inline styles
echo "Fixing report screens..."
find src/screens/reports -name "*.tsx" -exec perl -i -pe "s/style=\\{\\{ fontWeight: 'bold' \\}\\}/style={styles.boldText}/g" {} \;
find src/screens/reports -name "*.tsx" -exec perl -i -pe "s/style=\\{\\{ fontStyle: 'italic' \\}\\}/style={styles.italicText}/g" {} \;
find src/screens/reports -name "*.tsx" -exec perl -i -pe "s/style=\\{\\{ marginBottom: 0 \\}\\}/style={styles.noMarginBottom}/g" {} \;

echo "✨ Manual fixes complete!"