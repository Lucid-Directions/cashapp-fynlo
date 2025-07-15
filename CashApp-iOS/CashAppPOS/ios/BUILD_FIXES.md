# iOS Build Configuration Fixes

## 1. Fix dSYM Warning

To fix the "empty dSYM file detected" warning:

1. Open `CashAppPOS.xcworkspace` in Xcode
2. Select the CashAppPOS project in the navigator
3. Go to Build Settings tab
4. Search for "Debug Information Format"
5. Set it to "DWARF with dSYM File" for both Debug and Release configurations
6. Clean build folder (Cmd+Shift+K)
7. Rebuild the project

## 2. Fix UIScene Lifecycle Warning

To fix "CLIENT OF UIKIT REQUIRES UPDATE" warning:

### Option A: Quick Fix (Suppress Warning)
Add to `ios/CashAppPOS/Info.plist`:
```xml
<key>UIApplicationSceneManifest</key>
<dict>
    <key>UIApplicationSupportsMultipleScenes</key>
    <false/>
</dict>
```

### Option B: Full Migration (Recommended)
This requires updating AppDelegate.m to support Scene Delegate, which is more complex and should be done carefully.

## 3. Build Script for dSYM Generation

Add this Run Script phase in Xcode:
1. Select CashAppPOS target
2. Build Phases tab
3. Click + → New Run Script Phase
4. Add this script:

```bash
# Ensure dSYM is generated
if [ "${CONFIGURATION}" == "Release" ]; then
    DSYM_PATH="${BUILT_PRODUCTS_DIR}/${DWARF_DSYM_FOLDER_PATH}/${DWARF_DSYM_FILE_NAME}"
    if [ ! -d "$DSYM_PATH" ]; then
        echo "warning: dSYM not found at $DSYM_PATH"
    fi
fi
```