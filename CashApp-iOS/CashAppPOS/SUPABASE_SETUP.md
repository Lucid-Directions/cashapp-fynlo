# Mobile App Supabase Authentication Setup

## Quick Start

### 1. Install Dependencies
```bash
cd CashApp-iOS/CashAppPOS
npm install @supabase/supabase-js@2.39.0
npm install react-native-url-polyfill@2.0.0

# For iOS
cd ios && pod install && cd ..
```

### 2. Configure Environment Variables
Add these to your `.env` file:
```
# Supabase Configuration
SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-KEY-FROM-SUPABASE-DASHBOARD

# Backend API (keep existing)
API_URL=https://api.fynlo.co.uk/api/v1
```

### 3. Bundle the App
After making these changes, rebuild the bundle:
```bash
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

## What's New?

### Authentication Flow
1. **Before**: Mock authentication with hardcoded credentials
2. **After**: Real Supabase authentication with backend verification

### New Files Created
- `src/lib/supabase.ts` - Supabase client configuration
- `src/services/auth/supabaseAuth.ts` - Authentication service
- `src/store/useAuthStore.ts` - Zustand auth state management

### Key Features
- Automatic session persistence
- Token refresh on expiration
- Feature flags based on subscription plan
- Platform owner detection

## Usage Example

### In Your Components
```typescript
import { useAuthStore } from '../store/useAuthStore';

function MyComponent() {
  const { user, isAuthenticated, signIn, signOut } = useAuthStore();
  
  const handleLogin = async () => {
    try {
      await signIn(email, password);
      // Success - user is now authenticated
    } catch (error) {
      // Handle error
    }
  };
  
  // Check if user has a feature
  const canUseInventory = useAuthStore(state => state.hasFeature('inventory_management'));
  
  // Check if user has required plan
  const hasOmegaPlan = useAuthStore(state => state.requiresPlan('omega'));
}
```

## Next Steps

1. Update `LoginScreen.tsx` to use the new auth store
2. Update `AuthContext.tsx` to use Supabase
3. Update API client to include Supabase tokens
4. Remove all mock authentication code

## Troubleshooting

### "Supabase URL and Anon Key must be set"
- Check that your .env file has the correct values
- Restart Metro bundler after adding environment variables

### "Failed to verify with backend"
- Ensure backend is running with Supabase integration
- Check that backend has the same Supabase project configured

### "Invalid token" errors
- Token may be expired - auth store handles refresh automatically
- Check that backend Supabase service role key is configured