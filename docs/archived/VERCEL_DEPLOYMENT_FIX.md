# Vercel Deployment Fix Guide

## Current Issue
The Vercel deployment is failing with the error:
```
Environment Variable "VITE_API_URL" references Secret "fynlo_api_url", which does not exist.
```

## Solution Steps

### 1. Remove Existing Secrets (if any)
1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Look for any variables that show as "Secret" type
4. Delete all secret-type variables

### 2. Add Environment Variables (NOT Secrets)
Add these as **plain environment variables**:

```
VITE_API_URL=https://fynlopos-9eg2c.ondigitalocean.app/api/v1
VITE_WEBSOCKET_URL=wss://fynlopos-9eg2c.ondigitalocean.app/ws
VITE_SUPABASE_URL=your_actual_supabase_url
VITE_SUPABASE_ANON_KEY=your_actual_supabase_anon_key
```

**Important**: 
- DO NOT use the "Create Secret" option
- Use the standard "Add Environment Variable" option
- These should appear as regular text, not as encrypted secrets

### 3. Verify Configuration
After adding the variables:
1. They should be visible in plain text (values may be hidden but not encrypted)
2. They should NOT have a lock icon or "Secret" label
3. The type should be "Environment Variable" not "Secret"

### 4. Redeploy
1. Go to the Deployments tab
2. Find the failed deployment
3. Click the three dots menu → Redeploy
4. Or trigger a new deployment by pushing to the branch

## Fixed Issues in Code

### 1. Vite Extension Resolution
Added extension resolution to `vite.config.ts`:
```typescript
resolve: {
  alias: {
    "@": path.resolve(__dirname, "./src"),
  },
  extensions: ['.mjs', '.js', '.mts', '.ts', '.jsx', '.tsx', '.json'],
},
```

### 2. CORS Configuration
- Removed invalid wildcard patterns from backend config
- Kept regex pattern for Vercel preview deployments
- Production origins are explicitly listed

### 3. Documentation Updates
- Updated DEPLOYMENT.md with clearer instructions
- Added specific DigitalOcean backend URL
- Added warning about secret vs environment variable distinction

## Backend URLs
- Production: `https://fynlopos-9eg2c.ondigitalocean.app`
- API Endpoint: `https://fynlopos-9eg2c.ondigitalocean.app/api/v1`
- WebSocket: `wss://fynlopos-9eg2c.ondigitalocean.app/ws`

## Testing the Fix
Once deployed, verify:
1. The web platform loads without errors
2. API calls to the backend work (check browser console)
3. WebSocket connections establish properly
4. CORS headers allow the Vercel domain

## Additional Notes
- The backend is configured to accept requests from `https://fynlo.vercel.app`
- Preview deployments use regex pattern matching for dynamic URLs
- Make sure to use the actual Supabase credentials, not placeholder values