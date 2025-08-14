# SumUp Native Module Diagnostics Plan

## Issue
SumUp Tap to Pay is not working in production app. Native module is undefined at runtime.

## Diagnostic Steps Required

### 1. Check Native Module Registration
- Verify SumUpTapToPayModule is registered in AppDelegate.m
- Check if module is properly linked in Xcode project
- Verify Info.plist has required permissions

### 2. Runtime Diagnostics
- Add logging to detect module availability
- Check if module loads on app start
- Verify SDK initialization

### 3. Error Handling
- Add fallback when module is unavailable
- Show user-friendly error messages
- Log detailed errors for debugging

## Files to Modify
1. NativeSumUpService.ts - Add comprehensive diagnostics
2. PaymentProcessingScreen.tsx - Add error boundaries
3. AppDelegate.m - Verify module registration
4. Info.plist - Check permissions