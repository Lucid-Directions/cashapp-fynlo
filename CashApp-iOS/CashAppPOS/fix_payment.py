import re

# Read the file
with open('src/screens/payment/EnhancedPaymentScreen.tsx', 'r') as f:
    content = f.read()

# Fix the manager authorization flow (around line 306)
# Looking for the pattern where card payment is selected with authorization
pattern1 = r"(\s+else if \(methodId === 'card'\) \{\s*\n\s+)setShowSumUpModal\(true\);"
replacement1 = r"""\1// Validate customer info before triggering SumUp
                if (\!isFormValid) {
                  Alert.alert('Required Information', 'Please enter valid customer name and email address.');
                  return;
                }
                setShowSumUpModal(true);"""

content = re.sub(pattern1, replacement1, content, count=1)

# Fix the standard payment flow (around line 325)
# Looking for the pattern where card payment is selected without authorization
pattern2 = r"(\s+else if \(methodId === 'card'\) \{\s*\n\s+// Card payment handling.*?\n\s+)setShowSumUpModal\(true\);"
replacement2 = r"""\1// Validate customer info before triggering SumUp
        if (\!isFormValid) {
          Alert.alert('Required Information', 'Please enter valid customer name and email address.');
          return;
        }
        setShowSumUpModal(true);"""

content = re.sub(pattern2, replacement2, content, count=1, flags=re.DOTALL)

# Write back the fixed content
with open('src/screens/payment/EnhancedPaymentScreen.tsx', 'w') as f:
    f.write(content)

print("Fixed payment validation in EnhancedPaymentScreen.tsx")
