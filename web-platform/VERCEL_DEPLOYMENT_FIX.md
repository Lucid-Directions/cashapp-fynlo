# Vercel Deployment Fix Guide

## 🔧 Current Issue

The Vercel deployment is failing with:
```
error during build:
[vite:load-fallback] Could not load /vercel/path0/web-platform/src/lib/utils (imported by src/components/ui/tooltip.tsx): ENOENT: no such file or directory
```

## 🚨 Required Environment Variables

**CRITICAL**: You must add these environment variables in Vercel's project settings:

1. Go to your Vercel project dashboard
2. Navigate to Settings → Environment Variables
3. Add these variables as **plain environment variables** (NOT as secrets):

```
VITE_API_URL=https://fynlopos-9eg2c.ondigitalocean.app/api/v1
VITE_WEBSOCKET_URL=wss://fynlopos-9eg2c.ondigitalocean.app/ws
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

⚠️ **IMPORTANT**: Replace `your-project.supabase.co` and `your-anon-key-here` with your actual Supabase project details.

## 📝 Step-by-Step Fix

### 1. Get Supabase Credentials

If you don't have the Supabase credentials:
1. Go to https://supabase.com/dashboard
2. Select your Fynlo project (or create one if needed)
3. Go to Settings → API
4. Copy:
   - **Project URL** (use this for `VITE_SUPABASE_URL`)
   - **Anon/Public Key** (use this for `VITE_SUPABASE_ANON_KEY`)

### 2. Add Environment Variables in Vercel

1. Go to your Vercel project: https://vercel.com/[your-team]/cashapp-fynlo
2. Click on "Settings" tab
3. Navigate to "Environment Variables" in the left sidebar
4. Add each variable:
   - **Key**: `VITE_API_URL`
   - **Value**: `https://fynlopos-9eg2c.ondigitalocean.app/api/v1`
   - **Environment**: Select all (Production, Preview, Development)
   - Click "Save"
5. Repeat for all 4 variables

### 3. Verify Build Configuration

The project should already be configured with:
- **Root Directory**: `web-platform`
- **Framework Preset**: Vite
- **Build Command**: `npm run build` (default)
- **Output Directory**: `dist` (default)

### 4. Redeploy

After adding all environment variables:
1. Go to the "Deployments" tab
2. Click the three dots on the most recent deployment
3. Select "Redeploy"
4. Choose "Use existing Build Cache" → No (to ensure fresh build)
5. Click "Redeploy"

## 🔍 Troubleshooting

### If Build Still Fails

1. **Check Build Logs**: Look for any missing dependencies or type errors
2. **Verify Node Version**: Ensure Vercel is using Node 18+ (Settings → General → Node.js Version)
3. **Clear Cache**: In deployments, redeploy without cache

### Common Issues

1. **"Environment Variable references Secret which does not exist"**
   - Solution: Delete the variable and re-add as plain environment variable (not secret)

2. **TypeScript path alias errors**
   - The project is already configured correctly with `@/` alias
   - No changes needed to tsconfig or vite.config

3. **Missing dependencies**
   - All dependencies are already in package.json
   - Vercel should install them automatically

## 🧪 Local Testing

To test the build locally:

```bash
cd web-platform

# Create .env.local file
echo 'VITE_API_URL=https://fynlopos-9eg2c.ondigitalocean.app/api/v1' > .env.local
echo 'VITE_WEBSOCKET_URL=wss://fynlopos-9eg2c.ondigitalocean.app/ws' >> .env.local
echo 'VITE_SUPABASE_URL=https://your-project.supabase.co' >> .env.local
echo 'VITE_SUPABASE_ANON_KEY=your-anon-key' >> .env.local

# Install dependencies
npm install

# Test build
npm run build
```

If the build succeeds locally, it should work on Vercel with the correct environment variables.

## 📞 Support

If you continue to have issues:
1. Check the Vercel build logs for specific errors
2. Ensure all 4 environment variables are set correctly
3. The backend API at https://fynlopos-9eg2c.ondigitalocean.app should be running

---

**Last Updated**: January 2025
**Platform**: Vercel
**Required Action**: Add environment variables and redeploy