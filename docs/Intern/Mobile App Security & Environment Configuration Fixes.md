# Mobile App Security & Environment Configuration Fixes

**Priority**: CRITICAL (Security Vulnerabilities)  
**Timeline**: 1-2 days  
**Platform**: React Native (iOS)  
**Impact**: Eliminates hardcoded secrets, enables proper environment management

---

## Overview

This guide addresses critical security vulnerabilities in your mobile app where API keys are hardcoded and environment variables are not properly configured. These issues pose immediate security risks and prevent proper deployment practices.

## Problems Being Solved

### 1. Hardcoded SumUp API Keys (CRITICAL SECURITY ISSUE)
**Current State**: API keys exposed in source code
```typescript
// VULNERABLE - Found in multiple files
const affiliateKey = "sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU";
```

**Risk**: Anyone with access to the app bundle can extract and misuse these keys

### 2. Missing Supabase Client Configuration (FUNCTIONAL ISSUE)
**Current State**: Services import Supabase client that doesn't exist
```typescript
// BROKEN - File doesn't exist
import { supabase } from '../../lib/supabase';
```

**Risk**: Authentication will fail at runtime

### 3. No Environment Variable Management (DEPLOYMENT ISSUE)
**Current State**: No environment-specific configuration
**Risk**: Cannot deploy to different environments securely

---

## Solution Implementation

### Step 1: Install React Native Config

React Native Config allows secure environment variable management.

```bash
cd CashApp-iOS/CashAppPOS
npm install react-native-config
```

**For iOS (additional setup required):**
```bash
cd ios
pod install
```

### Step 2: Create Environment Configuration

Create environment files in the project root:

**Create `.env` (for development):**
```bash
# Supabase Configuration
SUPABASE_URL=https://eweggzpvuqczrrrwszyy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s

# SumUp Configuration
SUMUP_AFFILIATE_KEY=sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU

# API Configuration
API_BASE_URL=https://fynlopos-9eg2c.ondigitalocean.app
API_VERSION=v1

# Environment
NODE_ENV=development
```

**Create `.env.production` (for production builds):**
```bash
# Supabase Configuration
SUPABASE_URL=https://eweggzpvuqczrrrwszyy.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImV3ZWdnenB2dXFjenJycndzenl5Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTA3ODIyMTcsImV4cCI6MjA2NjM1ODIxN30.CRjEJ4w9xsIWB_PAMV_RfZox6yVMSnVT1b4QrA9SC0s

# SumUp Configuration (use production keys)
SUMUP_AFFILIATE_KEY=your_production_sumup_key

# API Configuration
API_BASE_URL=https://fynlopos-9eg2c.ondigitalocean.app
API_VERSION=v1

# Environment
NODE_ENV=production
```

**Create `.env.example` (for documentation):**
```bash
# Supabase Configuration
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your_supabase_anon_key

# SumUp Configuration
SUMUP_AFFILIATE_KEY=your_sumup_affiliate_key

# API Configuration
API_BASE_URL=https://your-api-domain.com
API_VERSION=v1

# Environment
NODE_ENV=development
```

### Step 3: Update .gitignore

Add environment files to `.gitignore`:
```bash
# Environment files
.env
.env.local
.env.production
.env.staging

# Keep example file
!.env.example
```

### Step 4: Create Supabase Client

Create `src/lib/supabase.ts`:
```typescript
import { createClient } from '@supabase/supabase-js';
import Config from 'react-native-config';

// Validate required environment variables
const supabaseUrl = Config.SUPABASE_URL;
const supabaseAnonKey = Config.SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error('SUPABASE_URL is required. Please check your environment configuration.');
}

if (!supabaseAnonKey) {
  throw new Error('SUPABASE_ANON_KEY is required. Please check your environment configuration.');
}

// Create Supabase client with React Native optimizations
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: {
      // Use AsyncStorage for React Native
      getItem: async (key: string) => {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        return await AsyncStorage.getItem(key);
      },
      setItem: async (key: string, value: string) => {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.setItem(key, value);
      },
      removeItem: async (key: string) => {
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        await AsyncStorage.removeItem(key);
      },
    },
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

// Export configuration for debugging (development only)
if (__DEV__) {
  console.log('🔐 Supabase client initialized:', {
    url: supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
  });
}
```

### Step 5: Update API Configuration

Update `src/config/api.ts`:
```typescript
import Config from 'react-native-config';

// Validate required environment variables
const baseUrl = Config.API_BASE_URL;
const apiVersion = Config.API_VERSION || 'v1';

if (!baseUrl) {
  throw new Error('API_BASE_URL is required. Please check your environment configuration.');
}

// API Configuration using environment variables
export const API_CONFIG = {
  // Backend API - from environment
  BASE_URL: baseUrl,
  
  // API version prefix
  API_VERSION: `/${apiVersion}`,
  
  // Full API URL with version
  get FULL_API_URL() {
    return `${this.BASE_URL}/api${this.API_VERSION}`;
  },
  
  // Request timeout (10 seconds for reliable network calls)
  TIMEOUT: 10000,
  
  // Retry configuration
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
  
  // Health check endpoint
  HEALTH_ENDPOINT: '/health',
  
  // Platform endpoints
  PLATFORM_ENDPOINTS: {
    SERVICE_CHARGE: '/platform/public/service-charge',
    PAYMENT_METHODS: '/platform/public/payment-methods',
    SETTINGS: '/platform/settings',
  },
  
  // Environment info
  IS_DEVELOPMENT: Config.NODE_ENV === 'development',
  IS_PRODUCTION: Config.NODE_ENV === 'production',
};

// Health check function
export const checkAPIHealth = async (): Promise<boolean> => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT);
    
    const response = await fetch(`${API_CONFIG.BASE_URL}${API_CONFIG.HEALTH_ENDPOINT}`, {
      signal: controller.signal,
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    clearTimeout(timeoutId);
    return response.ok;
  } catch (error) {
    console.warn('API health check failed:', error.message);
    return false;
  }
};

// Export for easy access
export default API_CONFIG;

// Debug logging (development only)
if (__DEV__) {
  console.log('🌐 API Configuration:', {
    baseUrl: API_CONFIG.BASE_URL,
    fullUrl: API_CONFIG.FULL_API_URL,
    environment: Config.NODE_ENV,
  });
}
```

### Step 6: Remove Hardcoded Secrets

Update all files that contain hardcoded secrets:

**Update `src/components/payment/SumUpPaymentComponent.tsx`:**
```typescript
import Config from 'react-native-config';

// BEFORE (VULNERABLE)
// const affiliateKey = "sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU";

// AFTER (SECURE)
const affiliateKey = Config.SUMUP_AFFILIATE_KEY;

if (!affiliateKey) {
  throw new Error('SUMUP_AFFILIATE_KEY is required. Please check your environment configuration.');
}
```

**Update `src/components/payment/SumUpTestComponent.tsx`:**
```typescript
import Config from 'react-native-config';

// BEFORE (VULNERABLE)
// affiliateKey="sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU"

// AFTER (SECURE)
<SumUpComponent
  affiliateKey={Config.SUMUP_AFFILIATE_KEY}
  // ... other props
/>
```

**Update `src/screens/payment/PaymentScreen.tsx`:**
```typescript
import Config from 'react-native-config';

// BEFORE (VULNERABLE)
// const initSuccess = await sumUpService.initialize('sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU');

// AFTER (SECURE)
const affiliateKey = Config.SUMUP_AFFILIATE_KEY;
if (!affiliateKey) {
  console.error('SumUp affiliate key not configured');
  return;
}

const initSuccess = await sumUpService.initialize(affiliateKey);
```

### Step 7: Update Authentication Configuration

Update `src/config/auth.config.ts`:
```typescript
import Config from 'react-native-config';

export const AUTH_CONFIG = {
  // Use environment variable to control mock auth
  USE_MOCK_AUTH: Config.NODE_ENV === 'development' && Config.USE_MOCK_AUTH === 'true',
  
  // Mock user credentials for testing (only in development)
  MOCK_CREDENTIALS: Config.NODE_ENV === 'development' ? {
    restaurant_owner: {
      email: 'arnaud@luciddirections.co.uk',
      password: 'test123'
    },
    platform_owner: {
      email: 'admin@fynlo.com',
      password: 'platform123'
    }
  } : {},
};

// Debug logging (development only)
if (__DEV__) {
  console.log('🔐 Auth Configuration:', {
    useMockAuth: AUTH_CONFIG.USE_MOCK_AUTH,
    environment: Config.NODE_ENV,
  });
}
```

### Step 8: iOS Configuration

For iOS builds, you need to configure the environment in Xcode:

**Update `ios/.xcode.env`:**
```bash
# Path to node executable
export NODE_BINARY=$(command -v node)

# Environment configuration
export ENVFILE=.env
```

**For production builds, create `ios/.xcode.env.production`:**
```bash
# Path to node executable
export NODE_BINARY=$(command -v node)

# Environment configuration
export ENVFILE=.env.production
```

---

## Testing and Verification

### Step 1: Verify No Hardcoded Secrets Remain

Run this command to check for any remaining hardcoded secrets:
```bash
cd CashApp-iOS/CashAppPOS
grep -r "sup_sk_\|eyJhbGciOiJIUzI1NiI" src/ || echo "✅ No hardcoded secrets found"
```

### Step 2: Test Environment Variable Loading

Add temporary logging to verify environment variables are loaded:
```typescript
// Add to App.tsx temporarily
import Config from 'react-native-config';

console.log('Environment Check:', {
  hasSupabaseUrl: !!Config.SUPABASE_URL,
  hasSupabaseKey: !!Config.SUPABASE_ANON_KEY,
  hasSumUpKey: !!Config.SUMUP_AFFILIATE_KEY,
  hasApiUrl: !!Config.API_BASE_URL,
  nodeEnv: Config.NODE_ENV,
});
```

### Step 3: Test Authentication Flow

1. Start the app in development mode
2. Attempt to log in with test credentials
3. Verify Supabase authentication works
4. Check that API calls use correct base URL

### Step 4: Test Payment Integration

1. Navigate to payment screen
2. Verify SumUp initialization works with environment variable
3. Test payment flow (if possible in sandbox mode)

---

## Production Deployment

### For iOS App Store Builds:

1. **Use production environment file:**
   ```bash
   cp .env.production .env
   ```

2. **Build with production configuration:**
   ```bash
   npx react-native run-ios --configuration Release
   ```

3. **Verify production keys are used:**
   - Check that production SumUp keys are loaded
   - Verify API calls go to production backend
   - Ensure no development logging appears

### Security Checklist:

- [ ] No hardcoded API keys in source code
- [ ] Environment files added to .gitignore
- [ ] Production environment file configured
- [ ] Supabase client properly initialized
- [ ] API configuration uses environment variables
- [ ] Authentication flow tested and working
- [ ] Payment integration tested with environment variables

---

## Troubleshooting

### Issue: Environment variables not loading
**Solution**: Ensure react-native-config is properly installed and linked
```bash
cd ios && pod install
npx react-native clean
npx react-native run-ios
```

### Issue: Supabase authentication fails
**Solution**: Verify environment variables are correct
```typescript
// Add temporary debugging
console.log('Supabase Config:', {
  url: Config.SUPABASE_URL,
  keyLength: Config.SUPABASE_ANON_KEY?.length,
});
```

### Issue: SumUp initialization fails
**Solution**: Check affiliate key format and validity
```typescript
// Verify key format
const key = Config.SUMUP_AFFILIATE_KEY;
console.log('SumUp Key Valid:', key?.startsWith('sup_sk_'));
```

---

## Next Steps

After completing this guide:

1. **Proceed to logging cleanup** (Guide 2)
2. **Fix React Native warnings** (Guide 4)
3. **Implement proper error handling** for environment variable failures
4. **Set up monitoring** to track authentication and payment issues

This implementation eliminates critical security vulnerabilities and establishes proper environment management for your mobile app.

