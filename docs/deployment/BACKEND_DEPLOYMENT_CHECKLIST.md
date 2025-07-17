# Backend Deployment Readiness Checklist for Vercel Integration

## ✅ Current Status

### 🟢 Already Configured
- [x] **CORS Configuration**: Updated to accept Vercel domains
  - `https://fynlo.vercel.app`
  - `https://fynlo-*.vercel.app` (preview deployments)
  - `https://*.vercel.app` (development)
  - `http://localhost:8080` (local development)

- [x] **API Endpoints**: All REST endpoints available at `/api/v1/*`
- [x] **WebSocket Support**: Available at `/ws` endpoint
- [x] **Authentication**: JWT-based with Supabase integration
- [x] **Database**: PostgreSQL on DigitalOcean (managed)
- [x] **Redis**: Valkey instance for caching and sessions

### 🟡 Environment Variables Needed

For the backend to work with your Vercel deployment, ensure these are set in DigitalOcean:

```bash
# Already deployed on DigitalOcean App Platform
DATABASE_URL=<your-postgres-connection-string>
REDIS_URL=<your-redis-connection-string>

# Supabase Integration
SUPABASE_URL=<your-supabase-project-url>
SUPABASE_ANON_KEY=<your-supabase-anon-key>
SUPABASE_SERVICE_ROLE_KEY=<your-supabase-service-key>

# Production Settings
ENVIRONMENT=production
DEBUG=false
ERROR_DETAIL_ENABLED=false

# Security
SECRET_KEY=<generate-secure-key>
PLATFORM_OWNER_EMAIL=admin@fynlo.co.uk
PLATFORM_OWNER_SECRET_KEY=<your-secure-secret>
```

## 🔗 Backend Endpoints for Testing

### Health Check
```bash
curl https://fynlopos-9eg2c.ondigitalocean.app/health
```

### API Documentation
```
https://fynlopos-9eg2c.ondigitalocean.app/docs
```

### WebSocket Test
```javascript
const ws = new WebSocket('wss://fynlopos-9eg2c.ondigitalocean.app/ws');
ws.onopen = () => {
  ws.send(JSON.stringify({
    type: 'authenticate',
    token: 'your-jwt-token'
  }));
};
```

## 🚀 Deployment Steps

### 1. Verify Backend is Running
```bash
# Check health endpoint
curl https://fynlopos-9eg2c.ondigitalocean.app/health

# Expected response:
{
  "status": "healthy",
  "timestamp": "2025-01-17T...",
  "version": "1.0.0"
}
```

### 2. Test CORS with Vercel Domain
After deploying to Vercel, test CORS:

```javascript
// From your Vercel deployment
fetch('https://fynlopos-9eg2c.ondigitalocean.app/api/v1/health')
  .then(res => res.json())
  .then(data => console.log('CORS OK:', data))
  .catch(err => console.error('CORS Error:', err));
```

### 3. Configure Vercel Environment
In your Vercel project settings, add:

```
VITE_API_URL=https://fynlopos-9eg2c.ondigitalocean.app/api/v1
VITE_WEBSOCKET_URL=wss://fynlopos-9eg2c.ondigitalocean.app/ws
VITE_SUPABASE_URL=<your-supabase-url>
VITE_SUPABASE_ANON_KEY=<your-supabase-anon-key>
```

## 📊 Monitoring

### Backend Logs
- DigitalOcean App Platform → Your App → Runtime Logs

### Error Tracking
- Check browser console for CORS errors
- Network tab for failed requests
- WebSocket frames for connection issues

## 🔧 Troubleshooting

### CORS Issues
1. Check browser console for specific error
2. Verify backend logs show request
3. Ensure HTTPS is used for all URLs
4. Check that Vercel domain matches CORS whitelist

### WebSocket Connection Failed
1. Ensure using `wss://` not `ws://`
2. Check authentication token is valid
3. Verify WebSocket upgrade headers
4. Look for connection errors in backend logs

### Authentication Errors
1. Verify Supabase keys match between frontend/backend
2. Check JWT token expiration
3. Ensure user exists in database
4. Verify role permissions

## 📝 Notes

- Backend is already deployed and running on DigitalOcean
- Database migrations are automatically applied on deploy
- Redis is used for caching and session management
- All sensitive operations require authentication
- Platform owner endpoints require special verification

---

**Last Updated**: January 2025
**Backend URL**: https://fynlopos-9eg2c.ondigitalocean.app
**Status**: Production Ready