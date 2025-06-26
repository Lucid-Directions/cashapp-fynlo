# Fynlo CashApp POS - Dependency Management Guide

## Critical Version Matrix (UPDATED JANUARY 2025)

| Dependency | Required Version | Reason | Compatibility | Status |
|------------|------------------|--------|---------------|---------|
| **React Native** | 0.72.17 | STABLE (rolled back from 0.80.0) | ✅ WORKING | 🔒 LOCKED |
| **React** | 18.2.0 | RN 0.72.17 exact requirement | ✅ Compatible | 🔒 LOCKED |
| **iOS Deployment** | 13.0+ | RN 0.72.17 minimum | ✅ Compatible | ✅ Current |
| **Node.js** | 18.18.0+ | Modern features, performance | ✅ LTS | ✅ Current |
| **npm** | 9.0.0+ | Package resolution improvements | ✅ Current | ✅ Current |
| **CocoaPods** | 1.16.2+ | iOS dependency management | ✅ Latest | ✅ Current |

### 🚨 CRITICAL WARNING - DO NOT UPGRADE
**React Native 0.80.0** causes app crashes and startup failures due to:
- react-native-screens C++ API breaking changes
- New Architecture incompatibilities  
- Network timeout handling issues

## Version Lock Strategy

### Package.json Engines (NEVER CHANGE)
```json
{
  "engines": {
    "node": ">=18.18.0",
    "npm": ">=9.0.0"
  },
  "packageManager": "npm@11.4.2"
}
```

### Core Dependencies (LOCKED VERSIONS - STABLE CONFIGURATION)
```json
{
  "dependencies": {
    "react": "18.2.0",
    "react-native": "0.72.17",
    "@react-navigation/native": "6.1.0",
    "@react-navigation/stack": "6.3.0", 
    "@react-navigation/bottom-tabs": "6.5.0",
    "@react-navigation/drawer": "6.6.0",
    "react-native-screens": "3.27.0",
    "react-native-reanimated": "3.8.0",
    "react-native-gesture-handler": "2.26.0"
  },
  "devDependencies": {
    "react-test-renderer": "18.2.0"
  }
}
```

### iOS Configuration (UNIFIED TARGETS)
```ruby
# ios/Podfile
platform :ios, '13.0'  # Changed from 16.0 for RN 0.72.17

# All Xcode project files
IPHONEOS_DEPLOYMENT_TARGET = 13.0
```

## Dependency Resolution History

### Timeline: React Native Version Management

#### January 26, 2025 - CRITICAL ROLLBACK (CURRENT STABLE)
**Issue**: React Native 0.80.0 causing app crashes and startup failures
**Root Cause**: 
- react-native-screens incompatibility with RN 0.80.0 C++ API changes
- New Architecture breaking changes
- Network timeout and settings resolution infinite loops

**Solution Applied**:
```bash
# Emergency rollback to proven working configuration
npm install react@18.2.0 react-native@0.72.17
npm install @react-navigation/native@6.1.0 @react-navigation/stack@6.3.0 @react-navigation/bottom-tabs@6.5.0 @react-navigation/drawer@6.6.0
npm install react-native-screens@3.27.0
npm install react-native-reanimated@3.8.0
npm install react-test-renderer@18.2.0
cd ios && rm -rf Pods Podfile.lock && pod install
```

**Result**: ✅ App startup fixed, service fee editing working, network timeout protection added

#### June 26, 2025 - The Yoga Library Crisis (DEPRECATED)

**Issue Discovered:**
```
Build input file cannot be found:
'/Users/.../node_modules/react-native/ReactCommon/yoga/yoga/log.cpp'
Did you forget to declare this file as an output of a script phase?
```

**Investigation Results:**
1. **Yoga Library Change**: React Native 0.80.0 restructured the Yoga layout engine
2. **Missing File**: `log.cpp` was removed from the Yoga library structure
3. **Version Mismatch**: iOS deployment target 14.0 was too low for RN 0.80.0
4. **React Incompatibility**: React 18.x was incompatible with RN 0.80.0

**Resolution Process:**

**Step 1: Version Analysis**
```bash
# Discovered RN 0.80.0 requirements
npx react-native --version  # 18.0.0
cat package.json | grep react  # "react": "19.1.0", "react-native": "0.80.0"
```

**Step 2: React Native Documentation Review**
- RN 0.80.0 blog post confirmed React 19.1.0 requirement
- iOS 15.0+ initially tried, then discovered 16.0+ needed
- New Architecture enabled by default

**Step 3: Clean Installation Strategy**
```bash
# Remove all cached dependencies
rm -rf node_modules package-lock.json
cd ios && rm -rf Pods Podfile.lock

# Install correct versions
npm install react@19.1.0 react-native@0.80.0 --force
```

**Step 4: iOS Configuration Update**
```bash
# Update Podfile
sed -i '' 's/platform :ios, .*/platform :ios, '\''16.0'\''/g' ios/Podfile

# Update Xcode project
sed -i '' 's/IPHONEOS_DEPLOYMENT_TARGET = .*/IPHONEOS_DEPLOYMENT_TARGET = 16.0/g' ios/CashAppPOS.xcodeproj/project.pbxproj

# Reinstall pods
cd ios && pod install
```

**Final Result:**
✅ Build successful with React Native 0.80.0
✅ All dependencies resolved
✅ New Architecture working
✅ SumUp SDK compatibility maintained

## Dependency Conflict Prevention

### Common Conflict Patterns

#### 1. React/React Native Version Mismatch
```bash
# Problem Pattern
npm error ERESOLVE unable to resolve dependency tree
Found: react@18.3.1
Could not resolve dependency: peer react@"19.1.0" from react-native@0.80.0

# Prevention Strategy
- Always use exact React version: 19.1.0
- Lock versions in package.json
- Use --force for initial installation only
```

#### 2. iOS Deployment Target Conflicts
```bash
# Problem Pattern
CocoaPods could not find compatible versions for pod "React-NativeModulesApple"
required a higher minimum deployment target

# Prevention Strategy
- Unified iOS 16.0 across all configurations
- Regular deployment target audits
- Automated checking in CI/CD
```

#### 3. Node.js/npm Version Issues
```bash
# Problem Pattern
npm WARN engine Unsupported engine for react-native@0.80.0
npm WARN engine expected: {"node":">=18.18.0"}

# Prevention Strategy
- Use Node.js 18.18.0+ LTS
- Document in .nvmrc file
- Team alignment on Node versions
```

### Automated Conflict Detection

#### Version Check Script
```bash
#!/bin/bash
# scripts/check-dependencies.sh

echo "🔍 Dependency Version Check"
echo "=========================="

# Node.js version
NODE_VERSION=$(node --version | cut -d'v' -f2)
echo "Node.js: $NODE_VERSION (required: >=18.18.0)"

# npm version
NPM_VERSION=$(npm --version)
echo "npm: $NPM_VERSION (required: >=9.0.0)"

# React Native version
RN_VERSION=$(npm list react-native --depth=0 | grep react-native | cut -d'@' -f2)
echo "React Native: $RN_VERSION (required: 0.80.0)"

# React version
REACT_VERSION=$(npm list react --depth=0 | grep react | cut -d'@' -f2 | head -1)
echo "React: $REACT_VERSION (required: 19.1.0)"

# iOS deployment target
IOS_TARGET=$(grep "platform :ios" ios/Podfile | grep -o "'[^']*'" | tr -d "'")
echo "iOS Deployment: $IOS_TARGET (required: 16.0+)"

echo "=========================="
```

#### Pre-commit Hook
```bash
#!/bin/bash
# .git/hooks/pre-commit

./scripts/check-dependencies.sh

if [ $? -ne 0 ]; then
    echo "❌ Dependency check failed. Please fix version issues before committing."
    exit 1
fi

echo "✅ Dependencies verified"
```

## Future Dependency Strategy

### React Native Update Policy

#### When to Update
- **Monthly Review**: Check React Native releases
- **Security Updates**: Immediate assessment
- **Major Features**: Evaluate business impact
- **Stability**: Wait for .1 or .2 releases

#### Update Testing Process
1. **Staging Environment**: Test all payment flows
2. **Device Testing**: Physical iPhone XS+ validation
3. **SumUp Integration**: Verify SDK compatibility
4. **Performance Testing**: Bundle size and startup time
5. **Documentation Update**: Version history maintenance

#### Rollback Criteria
- Build failures after clean installation
- Payment processing regressions
- SumUp SDK incompatibility
- Performance degradation >20%

### Version Monitoring

#### Dependencies to Watch
- **React Native**: Monthly releases
- **React**: Quarterly major releases
- **SumUp iOS SDK**: Payment provider updates
- **CocoaPods**: iOS dependency tool updates
- **Xcode**: Apple development environment

#### Update Notification Setup
```bash
# Package monitoring with npm-check-updates
npm install -g npm-check-updates
ncu --doctor # Test updates safely
```

## Emergency Recovery Procedures

### Complete Dependency Reset

If the project becomes completely unstable:

```bash
# 1. Full clean
rm -rf node_modules package-lock.json
cd ios && rm -rf Pods Podfile.lock DerivedData
cd .. && rm -rf ~/.npm/_cacache

# 2. Version verification
node --version  # Must be 18.18.0+
npm --version   # Must be 9.0.0+

# 3. Fresh installation
npm install
cd ios && pod install

# 4. Build clean
npx react-native clean
cd ios && xcodebuild clean -workspace CashAppPOS.xcworkspace -scheme CashAppPOS

# 5. Verification build
npx react-native run-ios --device "iPhone"
```

### Partial Recovery (Specific Issues)

#### React Version Issues Only
```bash
npm uninstall react
npm install react@19.1.0 --save-exact
npm install
```

#### iOS Pod Issues Only
```bash
cd ios
rm -rf Pods Podfile.lock
pod cache clean --all
pod install
```

#### Bundle Issues Only
```bash
rm -rf node_modules/.cache
npx react-native clean
npm start -- --reset-cache
```

## Dependency Audit & Security

### Regular Security Audits
```bash
# Run monthly
npm audit --audit-level high
npm audit fix --force  # Review changes carefully
```

### Dependency License Compliance
```bash
# Generate license report
npx license-checker --summary
```

### Bundle Size Monitoring
```bash
# Analyze bundle size impact
npx react-native bundle --platform ios --dev false --analyze
```

## Contact & Escalation

### For Dependency Issues
1. **Check this DEPENDENCIES.md** - Complete reference
2. **Review CONTEXT.md** - Project-specific context
3. **Check README.md** - Quick troubleshooting
4. **Contact Development Team** - For complex issues

### Documentation Maintenance
- **Update after major changes**
- **Version history tracking**
- **Team knowledge sharing**
- **Onboarding improvements**

---

**Last Updated**: June 26, 2025
**Maintained By**: Fynlo Development Team
**Version**: React Native 0.80.0 / React 19.1.0 / iOS 16.0+ 