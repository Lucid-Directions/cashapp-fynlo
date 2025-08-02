# React Hooks Dependencies Migration

## Files to Update (49 potential violations)

### High Priority - Core Hooks
- [ ] useWebSocket.ts
- [ ] useRestaurantConfig.ts
- [ ] usePerformanceMonitor.ts

### Medium Priority - Store Hooks
- [ ] useInventoryStore.ts (multiple useEffect warnings)
- [ ] Custom hooks in stores

### Screen Components
- [ ] EmployeesScreen.tsx
- [ ] PaymentScreen.tsx
- [ ] Various screen components with useEffect

## Common Patterns to Fix
1. Missing dependencies in useEffect
2. Stale closures in callbacks
3. Unnecessary dependencies causing re-renders
4. Missing cleanup functions