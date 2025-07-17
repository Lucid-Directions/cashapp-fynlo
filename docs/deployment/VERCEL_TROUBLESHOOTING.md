# Vercel Deployment Troubleshooting Guide

## 🔧 Recent Fixes Applied

### 1. **Environment Variable Issue** ✅
- **Problem**: `vercel.json` was referencing secrets that don't exist
- **Fix**: Removed the `env` section from `vercel.json`
- **Action**: Set environment variables directly in Vercel dashboard

### 2. **CORS Middleware Syntax** ✅
- **Problem**: Inline comments breaking function call
- **Fix**: Removed comments, cleaned up syntax
- **Code**: 
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    allow_origin_regex=r"^https://fynlo-[a-zA-Z0-9\-]+\.vercel\.app$" if settings.ENVIRONMENT != "production" else None
)
```

### 3. **Regex Security Vulnerability** ✅
- **Problem**: Unanchored regex could match malicious domains
- **Fix**: Added `^` and `$` anchors, restricted to alphanumeric + hyphens

## 🚨 Vercel Deployment Checklist

If deployment is still failing, check these:

### 1. **Vercel Project Settings**
- [ ] Root Directory is set to `web-platform`
- [ ] Node.js version is 18.x or higher
- [ ] Framework Preset is set to "Vite"

### 2. **Environment Variables in Vercel**
Add these in Settings → Environment Variables (NOT as secrets):
```
VITE_API_URL=https://api.fynlo.co.uk/api/v1
VITE_WEBSOCKET_URL=wss://api.fynlo.co.uk/ws
VITE_SUPABASE_URL=your-supabase-project-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
```

### 3. **Build Command Override**
If default build fails, try overriding in Vercel:
- Build Command: `cd web-platform && npm install && npm run build`
- Output Directory: `web-platform/dist`

### 4. **Common Build Errors**

#### Missing Dependencies
```bash
# In Vercel build settings, try:
npm install --legacy-peer-deps
```

#### TypeScript Errors
- Check `tsconfig.json` for strict mode issues
- Ensure all imports have proper types

#### Vite Plugin Issues
- The `lovable-tagger` plugin might cause issues in production
- Already filtered out in production mode

### 5. **Debugging Steps**

1. **Check Vercel Build Logs**
   - Go to your Vercel dashboard
   - Click on the failed deployment
   - View "Build Logs" for specific errors

2. **Test Build Locally**
   ```bash
   cd web-platform
   npm install
   npm run build
   ```

3. **Environment Variable Test**
   ```bash
   # Create .env.local with your values
   cp .env.example .env.local
   # Edit .env.local with actual values
   npm run build
   ```

## 📝 Notes

- The backend CORS is configured to accept Vercel domains
- Preview deployments use regex pattern for dynamic URLs
- Production deployment uses explicit domain allowlist
- WebSocket connections require `wss://` protocol

## 🔗 Resources

- [Vercel Vite Guide](https://vercel.com/docs/frameworks/vite)
- [Vite Environment Variables](https://vitejs.dev/guide/env-and-mode.html)
- [Vercel Build Troubleshooting](https://vercel.com/docs/concepts/deployments/troubleshoot-a-build)

---

**Last Updated**: January 2025
**Status**: Monitoring PR #279 deployment