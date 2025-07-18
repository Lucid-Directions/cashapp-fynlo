# CashApp POS Manual Test Checklist

## Quick Test Script
Run this to test all critical features quickly:

```bash
# 1. Build the app
npm run build:ios

# 2. Run automated tests
./scripts/run-comprehensive-tests.sh

# 3. Launch the app
npm run ios
```

## Critical Issues to Test

### 1. Payment Method Selection ❌
**Location:** POS Screen → Payment Section
- [ ] Can you click on "Card" payment method?
- [ ] Can you click on "Cash" payment method?
- [ ] Can you click on "QR Code" payment method?
- [ ] Does the selected payment method highlight correctly?
- [ ] Does the selection persist when processing payment?

### 2. Currency Symbol ❌
**Location:** Throughout the app
- [ ] Check POS screen - all prices show £ not $
- [ ] Check Payment screen - total shows £ not $
- [ ] Check Orders screen - order totals show £ not $
- [ ] Check receipt preview - shows £ not $

### 3. Gift Card → QR Code ❌
**Location:** Settings → Business → Payment Methods
- [ ] "Gift Card" option should NOT appear
- [ ] "QR Code Payment" option should be present
- [ ] QR Code description mentions "1.2% fees"
- [ ] Can toggle QR Code payment on/off

### 4. Theme Colors ❌
**Location:** Settings → User → Theme & Display
- [ ] Can see "Color Theme" section
- [ ] 10 color options are visible:
  - [ ] Fynlo Green
  - [ ] Ocean Blue
  - [ ] Royal Purple
  - [ ] Sunset Orange
  - [ ] Cherry Red
  - [ ] Emerald Teal
  - [ ] Deep Indigo
  - [ ] Rose Pink
  - [ ] Fresh Lime
  - [ ] Golden Amber
- [ ] Can select different colors
- [ ] Selected color shows checkmark

### 5. User Profile Crash ❌
**Location:** Settings → User → User Profile
- [ ] Screen loads without crashing
- [ ] Can view profile information
- [ ] Can enter edit mode (click edit icon)
- [ ] Can save changes without crash
- [ ] Photo section doesn't crash (even without photo)

## Additional Features to Test

### Navigation
- [ ] All settings screens accessible
- [ ] Back buttons work
- [ ] No navigation loops

### Data Entry
- [ ] Forms validate correctly
- [ ] Required fields show errors
- [ ] Can save valid data

### Performance
- [ ] App loads quickly
- [ ] No lag when switching screens
- [ ] Smooth animations

## Test Results Summary

```
Date: _______________
Tester: _____________

✅ Passed: ___/25
❌ Failed: ___/25

Critical Issues Fixed:
- [ ] Payment selection works
- [ ] Currency shows £
- [ ] Gift card removed, QR code added
- [ ] 10 theme colors visible
- [ ] User profile doesn't crash

Ready for Production: YES / NO
```

## Automated Test Command

For quick regression testing:
```bash
# Run all tests
npm test

# Run specific test file
npm test -- --testPathPattern=ComprehensiveAppTest

# Run with coverage
npm test -- --coverage
```

## If Tests Fail

1. Check test-results/ directory for logs
2. Look for specific error messages
3. Test manually in simulator
4. Check console for runtime errors

## Notes
- Always test on both iPhone and iPad simulators
- Test in both light and dark mode
- Test with different user roles (owner, manager, employee)