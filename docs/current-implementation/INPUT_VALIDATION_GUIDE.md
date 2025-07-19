# Input Validation Implementation Guide

**Created**: January 19, 2025  
**Purpose**: Comprehensive input validation and sanitization for all user inputs

## Overview

A professional input validation system has been implemented to prevent security vulnerabilities including:
- XSS (Cross-Site Scripting)
- SQL Injection
- Command Injection
- Path Traversal
- Invalid data entry

## Components Created

### 1. InputValidationService (`src/services/InputValidationService.ts`)
Core validation service with methods for:
- Text sanitization (removes dangerous characters)
- Email validation (RFC compliant)
- UK phone number validation
- Amount/currency validation
- Password strength validation
- UK postcode validation
- URL validation
- Search query sanitization
- Credit card validation (with Luhn algorithm)
- File upload validation

### 2. useInputValidation Hook (`src/hooks/useInputValidation.ts`)
React hook providing:
- Easy-to-use validation functions
- Real-time field validation with debouncing
- Error state management
- Form-level validation
- Automatic error display

### 3. Analysis Script (`scripts/add-input-validation.js`)
Automated script that:
- Identifies 207 input fields across 29 files
- Detects field types automatically
- Suggests appropriate validation
- Can add validation TODOs to files

## Usage Examples

### Basic Field Validation

```typescript
import { useInputValidation } from '../hooks/useInputValidation';

const MyComponent = () => {
  const { validateEmail, errors, createFieldValidator } = useInputValidation();
  const [email, setEmail] = useState('');

  // Real-time validation
  const emailValidator = createFieldValidator('email', 'email', { required: true });

  return (
    <View>
      <TextInput
        value={email}
        onChangeText={(text) => {
          setEmail(text);
          emailValidator(text); // Validates as user types
        }}
        style={[styles.input, errors.email && styles.inputError]}
      />
      {errors.email && (
        <Text style={styles.errorText}>{errors.email[0]}</Text>
      )}
    </View>
  );
};
```

### Form Submission Validation

```typescript
const handleSubmit = () => {
  const { isValid, results } = validateForm({
    email: { value: email, type: 'email' },
    phone: { value: phone, type: 'phone' },
    amount: { value: amount, type: 'amount' }
  });

  if (!isValid) {
    // Errors are automatically set in the errors state
    return;
  }

  // Use sanitized values from results
  submitData({
    email: results.email.sanitized,
    phone: results.phone.sanitized,
    amount: results.amount.sanitized
  });
};
```

## Validation Types Available

### 1. Email Validation
- Format validation
- Length limits (max 254 chars)
- Dangerous character removal

### 2. UK Phone Validation
- Mobile: +447xxxxxxxxx
- Landline: Various UK formats
- Automatic +44 normalization

### 3. Amount Validation
- Numeric validation
- Negative number prevention
- 2 decimal place rounding
- Max amount limits

### 4. Password Validation
- Minimum 8 characters
- Uppercase requirement
- Lowercase requirement
- Number requirement
- Special character requirement

### 5. UK Postcode Validation
- Format validation
- Automatic formatting (adds space)
- Case normalization

### 6. Search Query Sanitization
- SQL keyword removal
- Special character sanitization
- Length limiting (100 chars)

### 7. URL Validation
- Protocol validation (http/https only)
- JavaScript protocol prevention
- Valid URL structure

### 8. Credit Card Validation
- Luhn algorithm validation
- Automatic masking for display
- Length validation

## Security Features

### Dangerous Character Removal
The service automatically removes:
```javascript
['<', '>', '"', "'", '(', ')', ';', '&', '+', '`', '|', '\\', '*']
```

### Pattern Detection & Removal
- `javascript:` URLs
- Event handlers (onclick, onload, etc.)
- Script tags
- iFrame/embed tags
- eval() expressions

### SQL Injection Prevention
Removes common SQL keywords:
- DROP, DELETE, INSERT, UPDATE
- SELECT, UNION, EXEC
- SQL comments (-- and /**/)

## Implementation Status

### Files Analyzed
- **230 total files** scanned
- **29 files** need validation
- **207 input fields** identified

### Key Files Needing Validation
1. **LoginScreen** - 4 fields ✅ (Example created)
2. **ProfileScreen** - 14 fields (personal info)
3. **RestaurantProfileScreen** - 18 fields (business info)
4. **PaymentProviderSettingsScreen** - 14 fields (API keys)
5. **InventoryScreen** - 26 fields (stock management)
6. **EmployeesScreen** - 10 fields (staff data)

## Next Steps

### 1. Apply Validation Suggestions
Run the script to add TODO comments:
```bash
node scripts/add-input-validation.js
```

### 2. Implement Priority Screens
Start with high-risk screens:
- Authentication (LoginScreen) ✅
- Payment settings
- User profile
- Restaurant configuration

### 3. Testing Checklist
- [ ] Test with malicious inputs
- [ ] Verify sanitization works
- [ ] Check error messages display
- [ ] Test form submission blocking
- [ ] Verify sanitized data in backend

### 4. Additional Considerations
- Add rate limiting for API calls
- Implement CAPTCHA for public forms
- Add request signing for sensitive operations
- Monitor validation failures

## Common Patterns

### Input with Icon and Error
```typescript
<View style={styles.inputWrapper}>
  <View style={[styles.inputContainer, errors.field && styles.inputError]}>
    <Icon name="icon-name" size={20} color={Colors.lightText} />
    <TextInput
      value={value}
      onChangeText={(text) => {
        setValue(text);
        fieldValidator(text);
      }}
      {...otherProps}
    />
  </View>
  {errors.field && (
    <Text style={styles.errorText}>{errors.field[0]}</Text>
  )}
</View>
```

### Custom Validation Options
```typescript
const customValidator = createFieldValidator('field', 'text', {
  required: true,
  minLength: 3,
  maxLength: 50,
  trim: true,
  toLowerCase: true
});
```

## Performance Considerations

- Real-time validation is debounced (300ms)
- Validation runs in JavaScript thread
- Sanitization is fast (regex-based)
- Error states managed efficiently

## Conclusion

The input validation system provides comprehensive protection against common security vulnerabilities while maintaining a good user experience. All 207 identified input fields should be updated to use this validation system for consistent security across the application.