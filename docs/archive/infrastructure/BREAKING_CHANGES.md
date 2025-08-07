# BREAKING CHANGES - Authentication Update

## Date: 2025-01-29
## Issue: #387
## PR: Remove mock authentication endpoint - Security Fix

---

## 🚨 SECURITY FIX: Mock Authentication Endpoint Removed

### What Changed
- **Removed** the mock authentication endpoint `/api/v1/auth/login` from:
  - `backend/app/main.py` 
  - `backend/app/main_minimal.py` (which had even more hardcoded credentials!)
- These endpoints allowed login with hardcoded credentials like:
  - `restaurant@fynlopos.com` / `restaurant123`
  - `owner@fynlopos.com` / `platformowner123`
  - `demo@fynlopos.com` / `demo`
  - And several others
- This was a **critical security vulnerability** that bypassed all authentication in production

### Why This Change Was Necessary
- The mock endpoint provided complete authentication bypass in production
- Anyone could login with the hardcoded credentials
- This gave full access to restaurant data without proper authentication

---

## 📝 Impact on Development

### Test Scripts That Need Updating
The following test scripts were using the mock endpoint and **MUST be updated**:

1. **`integration_test_all_fixes.js`** - Line where Authentication endpoint is tested
2. **`CashApp-iOS/CashAppPOS/testAPIConnectivity.js`** - Auth API test
3. **`CashApp-iOS/CashAppPOS/src/services/DatabaseService.ts`** - `login()` method (appears unused)
4. **`CashApp-iOS/CashAppPOS/src/services/APITestingService.ts`** - If using mock auth

### Other Important Notes
- Production mobile app is **NOT affected** - it already uses Supabase authentication
- Web dashboard is **NOT affected** - it already uses Supabase authentication
- Only development/test scripts need updating

---

## 🔄 Migration Guide

### ❌ OLD Way (No Longer Works)
```javascript
// This will now return 404 Not Found
await fetch('/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'restaurant@fynlopos.com',
    password: 'restaurant123'
  })
});
```

### ✅ NEW Way - Use Supabase Authentication

#### Option 1: Create Test Account via Supabase
```javascript
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

// Sign in with test account
const { data, error } = await supabase.auth.signInWithPassword({
  email: 'your-test-account@example.com',
  password: 'your-test-password'
});

if (data.session) {
  // Verify with backend
  const response = await fetch('/api/v1/auth/verify', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${data.session.access_token}`
    }
  });
  
  const userData = await response.json();
  console.log('Authenticated user:', userData);
}
```

#### Option 2: Use Environment Variables for Test Credentials
```javascript
// .env.test
TEST_USER_EMAIL=test@example.com
TEST_USER_PASSWORD=secure-test-password

// In your test script
const { data } = await supabase.auth.signInWithPassword({
  email: process.env.TEST_USER_EMAIL,
  password: process.env.TEST_USER_PASSWORD
});
```

#### Option 3: Skip Authentication for Specific Test Endpoints
Some endpoints don't require authentication. Update your tests to skip auth for these:
- `/health`
- `/docs`
- `/api/config/base_url`
- `/api/v1/public/*`

---

## 🛠️ Setting Up Test Authentication

### 1. Create Test Account
- Go to [Supabase Dashboard](https://app.supabase.com)
- Navigate to Authentication → Users
- Click "Add User" → "Create new user"
- Use a test email like `test-dev@example.com`
- Set a secure password

### 2. Configure Environment Variables
```bash
# .env.test or .env.development
SUPABASE_URL=your-project-url
SUPABASE_ANON_KEY=your-anon-key
TEST_USER_EMAIL=test-dev@example.com
TEST_USER_PASSWORD=your-secure-password
```

### 3. Update Test Scripts
Replace mock auth calls with proper Supabase authentication as shown in the migration guide above.

---

## ⚠️ Important Security Notes

1. **Never hardcode credentials** in test scripts
2. **Use environment variables** for test account credentials
3. **Create separate test accounts** for different test scenarios
4. **Rotate test passwords** regularly
5. **Do not share test accounts** between developers

---

## 🤝 Need Help?

If you're having trouble updating your test scripts:

1. Check the example implementations in the migration guide
2. Refer to the [Supabase Auth Documentation](https://supabase.com/docs/guides/auth)
3. Ask in the development Slack channel
4. Review the PR that made this change for more context

---

## 📅 Timeline

- **Immediate**: Mock endpoint is removed - will return 404
- **Required**: Update all test scripts before next deployment
- **Recommended**: Implement proper test authentication within 1 week

---

This is a critical security fix. Thank you for updating your test scripts promptly!