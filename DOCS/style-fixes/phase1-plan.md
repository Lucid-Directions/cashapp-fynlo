# Phase 1: Pattern Conversion

## Target: Convert createStyles(theme) to Static StyleSheet

### Files to Convert:
1. src/screens/customers/CustomersScreen.tsx
2. src/screens/settings/app/MenuManagementScreen.tsx  
3. src/screens/settings/user/UserProfileScreen.tsx
4. src/screens/payment/ServiceChargeSelectionScreen.tsx
5. src/screens/more/MoreScreen.tsx
6. src/components/modals/ReceiptScanModal.tsx
7. src/design-system/ThemeProvider.tsx
8. Additional files using createStyles pattern

### Pattern:
```typescript
// Before:
const createStyles = (theme: Theme) => StyleSheet.create({
  container: { backgroundColor: theme.colors.background }
});

// After:
const styles = StyleSheet.create({
  container: { flex: 1 }
});
// Use: style={[styles.container, { backgroundColor: theme.colors.background }]}
```

### Expected Impact:
~300 warnings eliminated