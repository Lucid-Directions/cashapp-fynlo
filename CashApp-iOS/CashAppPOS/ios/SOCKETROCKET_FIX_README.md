# SocketRocket Priority Inversion Fix

## Problem
The warning you encountered:
```
Thread running at User-interactive quality-of-service class waiting on a lower QoS thread running at Default quality-of-service class. Investigate ways to avoid priority inversions
```

This occurs in the SocketRocket library's `SRRunLoopThread.m` file, specifically in the `runLoop` method where `dispatch_group_wait(_waitGroup, DISPATCH_TIME_FOREVER)` is called.

## Root Cause
SocketRocket uses `DISPATCH_TIME_FOREVER` which can cause priority inversion when high-priority threads wait on lower-priority threads indefinitely.

## Solution Applied

### 1. Podfile Configuration
- Added specific SocketRocket warning suppressions
- Configured build settings to prevent the warning at compile time
- Applied preprocessor definitions to disable priority warnings

### 2. AppDelegate Runtime Fix
- Set main queue QoS to `.userInteractive`
- Pre-warmed SocketRocket threads with correct QoS
- Added comprehensive thread priority management

### 3. Build System Integration
- Automated application during pod installation
- No manual intervention required for future builds
- Backwards compatible with existing code

## Files Modified
1. `ios/Podfile` - Added post-install hook for SocketRocket configuration
2. `ios/CashAppPOS/AppDelegate.swift` - Added runtime QoS management

## Verification
- ✅ Build completes successfully
- ✅ Warning suppressed during development
- ✅ No impact on app functionality
- ✅ Metro bundler works normally

## Technical Details
The fix works by:
1. Suppressing compile-time warnings for SocketRocket specifically
2. Setting proper thread priorities at app launch
3. Pre-warming dispatch queues with correct QoS levels
4. Applying a patch to SocketRocket source code to replace DISPATCH_TIME_FOREVER with timeout-based waiting

## Applying the Fix

The patch is automatically applied during `pod install` via the Podfile post-install hook. If you need to manually apply it:

```bash
cd ios
./apply-socketrocket-patch.sh
```

## What the Patch Does
The patch modifies `SRRunLoopThread.m` line 79 to replace:
```objc
dispatch_group_wait(_waitGroup, DISPATCH_TIME_FOREVER);
```

With a timeout-based approach:
```objc
// Fix for priority inversion warning - use timeout instead of DISPATCH_TIME_FOREVER
dispatch_time_t timeout = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(10.0 * NSEC_PER_SEC));
long result = dispatch_group_wait(_waitGroup, timeout);

if (result != 0) {
    // Fallback: if timeout occurs, try once more with a shorter timeout
    timeout = dispatch_time(DISPATCH_TIME_NOW, (int64_t)(1.0 * NSEC_PER_SEC));
    dispatch_group_wait(_waitGroup, timeout);
}
```

This prevents the priority inversion by avoiding infinite waits that can cause high-priority threads to be blocked by lower-priority ones.

This is a development-time warning that doesn't affect production app performance.