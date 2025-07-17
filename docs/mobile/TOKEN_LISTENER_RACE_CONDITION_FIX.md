# Token Listener Race Condition Fix

## Problem Summary

The authentication store had a race condition in the token listener setup mechanism that could prevent token refresh listeners from being properly initialized after module reloads.

### Root Cause

1. **Dual State Tracking**: The code used two separate variables to track listener setup:
   - `tokenListenersSetup` - A module-level variable that resets to `false` on module reload
   - `tokenRefreshListenerSetup` - A store state variable that could persist across reloads

2. **Early Exit Condition**: The `setupTokenListeners()` function checked both variables:
   ```typescript
   if (tokenListenersSetup || get().tokenRefreshListenerSetup) return;
   ```
   This caused the function to exit early even when the module reloaded and listeners needed to be re-established.

3. **Incorrect Handler References**: Event handlers were created as inline functions, making it impossible to properly remove them with `off()` since the function references would be different.

## Solution Implemented

### 1. Removed Module-Level Variable
- Eliminated the `tokenListenersSetup` module-level variable
- Now relies solely on store state for tracking listener setup

### 2. Fixed Handler References
- Created module-level variables to store handler function references
- This ensures `off()` can properly remove existing handlers before adding new ones
- Prevents duplicate event listeners from accumulating

### 3. Ensured Listener Re-initialization
- Modified `onRehydrateStorage` to always reset `tokenRefreshListenerSetup` to `false` before calling `setupTokenListeners()`
- This ensures listeners are properly set up after every module reload
- Added listener setup call after successful sign-in

### 4. Improved Cleanup Logic
- `setupTokenListeners()` now properly removes existing listeners before adding new ones
- Uses consistent handler references stored at module level

## Code Changes

```typescript
// Added module-level handler storage
let tokenRefreshedHandler: (() => Promise<void>) | null = null;
let tokenClearedHandler: (() => void) | null = null;

// Updated setupTokenListeners to:
// 1. Remove the module-level variable check
// 2. Properly clean up existing listeners
// 3. Store handler references for future cleanup
// 4. Always execute setup (no early exit based on module variable)

// Updated onRehydrateStorage to:
// 1. Reset tokenRefreshListenerSetup to false
// 2. Call setupTokenListeners() to ensure fresh setup

// Added setupTokenListeners() call after successful sign-in
```

## Benefits

1. **Reliability**: Token listeners are guaranteed to be set up after module reloads
2. **No Duplicates**: Proper cleanup prevents accumulation of duplicate listeners
3. **Consistent State**: Single source of truth for listener setup state
4. **Better Debugging**: Clear console logs indicate when listeners are set up

## Testing Recommendations

1. Test module hot reload scenarios
2. Verify token refresh continues to work after app resume
3. Check that listeners are not duplicated after multiple sign-ins
4. Ensure logout properly clears listeners
5. Test token expiry and automatic refresh flow

## Future Improvements

Consider implementing a more robust event system that:
- Automatically handles listener cleanup on module unload
- Provides listener introspection for debugging
- Implements listener lifecycle management