# Fynlo Platform Dashboard - Vercel Deployment Guide

## 🚀 Quick Start

1. **Connect to Vercel**
   - Go to [vercel.com](https://vercel.com)
   - Import this repository: `Lucid-Directions/cashapp-fynlo`
   - Select the `web-platform` directory as the root directory

2. **Configure Environment Variables**
   Add these in Vercel's project settings (Settings → Environment Variables):
   
   **CRITICAL**: Add these as plain environment variables, NOT as secrets:
   ```
   VITE_API_URL=https://fynlopos-9eg2c.ondigitalocean.app/api/v1
   VITE_WEBSOCKET_URL=wss://fynlopos-9eg2c.ondigitalocean.app/ws
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
   ```
   
   **⚠️ IMPORTANT**: If you see an error like "Environment Variable references Secret which does not exist", it means the variables were added as secrets. Delete them and re-add as plain environment variables.
   
   Note: The backend URL should point to the DigitalOcean deployment.

3. **Deploy**
   - Click "Deploy"
   - Vercel will automatically build and deploy

## 📁 Project Structure

```
web-platform/
├── src/               # React source code
├── public/            # Static assets
├── dist/              # Build output (git-ignored)
├── vercel.json        # Vercel configuration
├── vite.config.ts     # Vite configuration
└── package.json       # Dependencies
```

## 🔧 Configuration Files

### vercel.json
- Configured for Vite framework
- SPA routing enabled (all routes → index.html)
- Environment variables mapped to Vercel secrets

### vite.config.ts
- Port 8080 for development
- Path aliases configured (@/ → ./src/)
- React SWC for fast refresh

## 🌍 Environment Variables

### Required for Production
- `VITE_API_URL`: Backend API endpoint
- `VITE_WEBSOCKET_URL`: WebSocket endpoint for real-time updates
- `VITE_SUPABASE_URL`: Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Supabase anonymous key

### Optional
- `VITE_ENV`: Environment name (production/staging/development)

## 🔄 Deployment Workflow

### Automatic Deployments
- **Production**: Pushes to `main` branch
- **Preview**: Pull requests and other branches

### Manual Deployment
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy from web-platform directory
cd web-platform
vercel

# Deploy to production
vercel --prod
```

## 🛠️ Local Development

```bash
# Install dependencies
cd web-platform
npm install

# Create .env.local from example
cp .env.example .env.local
# Edit .env.local with your values

# Start development server
npm run dev
```

## 🔍 Troubleshooting

### CORS Issues
- Backend is configured to accept Vercel domains
- Check browser console for specific CORS errors
- Ensure API_URL uses HTTPS in production

### WebSocket Connection
- WebSocket URL must use `wss://` for HTTPS sites
- Check browser console for connection errors
- Backend WebSocket endpoint: `/ws`

### Build Failures
- Check Vercel build logs
- Ensure all dependencies are in package.json
- Run `npm run build` locally to test

## 📊 Backend Endpoints

The platform dashboard connects to these backend services:

### Authentication
- POST `/api/v1/auth/login`
- POST `/api/v1/auth/refresh`
- POST `/api/v1/auth/logout`

### Platform Management
- GET `/api/v1/platform/restaurants`
- GET `/api/v1/platform/analytics`
- GET `/api/v1/platform/users`
- GET `/api/v1/platform/monitoring`

### WebSocket Events
- Connection: `wss://backend-url/ws`
- Authentication: Send token after connection
- Events: order_update, payment_received, etc.

## 🔐 Security Notes

- Never commit `.env` files
- Use Vercel environment variables for secrets
- All API calls require authentication tokens
- WebSocket connections require token authentication

## 🚦 Health Checks

- Platform Dashboard: `https://your-app.vercel.app/`
- API Health: `https://backend-url/health`
- WebSocket Test: Check browser console for connection status

## 📈 Monitoring

- Vercel Analytics (built-in)
- Browser console for errors
- Network tab for API calls
- WebSocket frame inspector for real-time events

## 🤝 Support

For deployment issues:
1. Check Vercel deployment logs
2. Verify environment variables
3. Test API endpoints with curl/Postman
4. Check backend CORS configuration

---

**Last Updated**: January 2025
**Backend**: DigitalOcean App Platform
**Frontend**: Vercel
**Database**: PostgreSQL (Managed by DigitalOcean)