# iOS Bundle Builder Subagent

## Purpose
Automate the iOS bundle building process for Fynlo POS, handling the complex Metro bundler workflow and deployment steps.

## Capabilities
- Automated iOS bundle creation with error handling
- Deployment to test devices
- Bundle size optimization
- Asset management
- Build validation

## Trigger Phrases
- "build ios bundle"
- "create ios release"
- "deploy to ios"
- "fix bundle issues"
- "prepare ios deployment"

## Core Workflow

### 1. Pre-Build Validation
```bash
# Check current branch
git branch --show-current

# Ensure clean working directory
git status --porcelain

# Verify iOS dependencies
cd CashApp-iOS/CashAppPOS/ios && pod install && cd ..
```

### 2. Bundle Building Process
```bash
# Navigate to iOS app directory
cd CashApp-iOS/CashAppPOS

# Clean previous builds
rm -rf ios/main.jsbundle*
rm -rf ios/CashAppPOS/main.jsbundle*

# Build the bundle with Metro
npx react-native bundle \
  --platform ios \
  --dev false \
  --entry-file index.js \
  --bundle-output ios/main.jsbundle \
  --assets-dest ios/CashAppPOS

# Copy bundle to Xcode project
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle

# Verify bundle creation
if [ -f "ios/CashAppPOS/main.jsbundle" ]; then
  echo "✅ Bundle created successfully"
  ls -lh ios/CashAppPOS/main.jsbundle
else
  echo "❌ Bundle creation failed"
  exit 1
fi
```

### 3. Post-Build Optimization
```bash
# Check bundle size
du -h ios/CashAppPOS/main.jsbundle

# Optimize images
find ios/CashAppPOS/assets -name "*.png" -exec pngquant --force --quality=65-80 {} \;

# Verify assets
find ios/CashAppPOS/assets -type f | wc -l
```

### 4. Deployment Options

#### Option A: TestFlight Deployment
```bash
# Archive and upload to App Store Connect
cd ios
xcodebuild -workspace CashAppPOS.xcworkspace \
  -scheme CashAppPOS \
  -configuration Release \
  -archivePath build/CashAppPOS.xcarchive \
  archive

# Export for App Store
xcodebuild -exportArchive \
  -archivePath build/CashAppPOS.xcarchive \
  -exportPath build \
  -exportOptionsPlist ExportOptions.plist
```

#### Option B: Direct Device Installation
```bash
# List connected devices
xcrun devicectl list devices

# Install to specific device
xcrun devicectl device install app --device [DEVICE_ID] build/CashAppPOS.ipa
```

## Error Handling

### Common Issues and Solutions

1. **Metro Bundle Error**
   ```bash
   # Clear Metro cache
   npx react-native start --reset-cache
   
   # Clear watchman
   watchman watch-del-all
   ```

2. **Missing Dependencies**
   ```bash
   # Reinstall node modules
   cd CashApp-iOS/CashAppPOS
   rm -rf node_modules
   npm install
   ```

3. **Pod Issues**
   ```bash
   cd ios
   pod deintegrate
   pod install
   ```

## Integration with CI/CD

### GitHub Actions Integration
```yaml
name: iOS Bundle Build
on:
  push:
    branches: [main, develop]

jobs:
  build:
    runs-on: macos-latest
    steps:
      - uses: actions/checkout@v3
      - name: Setup Node
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      - name: Install Dependencies
        run: |
          cd CashApp-iOS/CashAppPOS
          npm install
          cd ios && pod install
      - name: Build Bundle
        run: |
          cd CashApp-iOS/CashAppPOS
          npm run build:ios
```

## Monitoring & Validation

### Bundle Health Checks
- Size should be < 50MB for optimal performance
- Asset count should match source
- No missing module errors
- Successful app launch on device

### Performance Metrics
- Build time tracking
- Bundle size trends
- Asset optimization savings
- Deployment success rate

## Best Practices
1. Always build from a clean state
2. Verify git status before building
3. Test on multiple iOS versions
4. Keep bundle size optimized
5. Document any build customizations