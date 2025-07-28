# Network Connectivity Fix - DNS Resolution & API Configuration

## Problem Summary

The iOS app was failing to connect to the backend API with DNS resolution errors:
```
NSURLErrorDomain Code=-1003
A server with the specified hostname could not be found.
```

## Root Causes

1. **Non-existent Domain**: App was configured to use `https://api.fynlopos.com` which doesn't exist in DNS
2. **Localhost Inaccessibility**: Physical iOS devices cannot access Mac's `localhost` (127.0.0.1)
3. **Production Flag Issue**: `__DEV__` was false in production bundles, forcing the non-existent production URL

## Implementation Details

### 1. API Configuration (`/src/config/api.ts`)

Created centralized API configuration using Mac's LAN IP:

```typescript
const MAC_LAN_IP = '192.168.0.109';

export const API_CONFIG = {
  // Backend API (FastAPI on port 8000) - ALWAYS use LAN IP for device testing
  // Physical devices cannot access localhost, and api.fynlopos.com doesn't exist in DNS
  BASE_URL: `http://${MAC_LAN_IP}:8000`,
  
  // Metro bundler (React Native dev server on port 8081)
  METRO_URL: `http://${MAC_LAN_IP}:8081`,
  
  // API version prefix
  API_VERSION: '/api/v1',
  
  // Full API URL with version
  get FULL_API_URL() {
    return `${this.BASE_URL}${this.API_VERSION}`;
  },
  
  // ... additional config
};
```

### 2. Service Updates

Updated all service files to use centralized API configuration:

- **DatabaseService.ts**: Changed from hardcoded localhost to `API_CONFIG.BASE_URL`
- **PlatformService.ts**: Updated to use `API_CONFIG.FULL_API_URL`
- **DataService.ts**: Health check now uses `API_CONFIG.BASE_URL`
- **WebSocketService.ts**: WebSocket URL uses LAN IP (converts http to ws)
- **APITestingService.ts**: Test endpoints use centralized config

### 3. Mock API Server (`mock_api_server.py`)

Created Flask-based mock server to provide expected endpoints:

```python
from flask import Flask, jsonify, request
from datetime import datetime

app = Flask(__name__)

# Enable CORS for all routes
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# Key endpoints implemented:
# - /health
# - /api/v1/platform-settings/service-charge
# - /api/v1/auth/login
# - /api/v1/products/mobile
# - /api/v1/payments/process
```

### 4. Bundle Deployment

Rebuilt JavaScript bundle with network fixes:
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

## Testing & Verification

### Server Status
```bash
# Check if mock server is running
lsof -i :8000

# Test health endpoint
curl "http://192.168.0.109:8000/health"

# Test service charge endpoint
curl "http://192.168.0.109:8000/api/v1/platform-settings/service-charge"
```

### Expected Responses
```json
// Health endpoint
{
  "status": "healthy",
  "timestamp": "2025-06-27T21:36:52.802015",
  "service": "fynlo-pos-mock-api",
  "version": "1.0.0"
}

// Service charge endpoint
{
  "success": true,
  "data": {
    "enabled": true,
    "rate": 12.5,
    "description": "Platform service charge"
  }
}
```

## Files Modified

1. **Created**:
   - `/src/config/api.ts` - Centralized API configuration
   - `/mock_api_server.py` - Flask mock API server

2. **Updated**:
   - `/src/services/DatabaseService.ts` - Use API_CONFIG
   - `/src/services/PlatformService.ts` - Use API_CONFIG
   - `/src/services/DataService.ts` - Use API_CONFIG
   - `/src/services/WebSocketService.ts` - Use API_CONFIG
   - `/src/services/APITestingService.ts` - Use API_CONFIG

3. **Bundle Files**:
   - `/ios/main.jsbundle` - Rebuilt with fixes
   - `/ios/CashAppPOS/main.jsbundle` - Deployed bundle

## Running the Mock Server

```bash
# Install Flask if needed
pip3 install flask

# Start mock server
cd /Users/arnauddecube/Documents/Fynlo/cashapp-fynlo
python3 mock_api_server.py

# Server runs on http://192.168.0.109:8000
```

## Key Learnings

1. **Physical devices cannot access localhost** - Always use LAN IP for device testing
2. **DNS must be resolvable** - Don't use placeholder domains in production code
3. **Centralize configuration** - Single source of truth prevents scattered hardcoded values
4. **Bundle deployment is critical** - TypeScript changes require bundle rebuild
5. **Mock servers accelerate development** - Don't wait for backend to test iOS features

## Future Considerations

1. **Environment Variables**: Use `.env` files for different environments (dev/staging/prod)
2. **Service Discovery**: Consider mDNS/Bonjour for automatic backend discovery
3. **HTTPS**: Add SSL certificates for secure communication
4. **Backend Deployment**: Deploy actual FastAPI backend when ready
5. **DNS Setup**: Register and configure actual domain when going to production

---

**Fix Date**: June 27, 2025
**Fixed By**: Arnaud (with Claude assistance)
**Time to Resolution**: Several hours (including backend setup attempts)