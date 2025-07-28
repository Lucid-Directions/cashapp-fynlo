# Pieces Context for Claude Code

Last synced: Mon Jul 28 2025

## 🔄 Current Development Context

### Active Work
- Working Directory: `/Users/arnauddecube/Documents/Fynlo/cashapp-fynlo`
- Current Branch: `fix/missing-textinput-import`
- Main Branch: `main`
- Active Python Env: None
- Node Version: v18.20.8
- NPM Version: 10.8.2

### Recent Git Activity
```bash
34197b76 fix: add missing TextInput import and fix websocket test
a7c5f79f fix: correct import path for APIResponseHelper in onboarding_helper
3286e8b2 fix: implement lazy imports for boto3 to prevent deployment failures
fa03b940 merge: resolve conflicts with main branch
7da29d1a fix: critical WebSocket authentication and undefined variable bugs
bb051e35 Merge pull request #353 from Lucid-Directions/fix/websocket-security-hardening
2a5bcfd1 fix: resolve remaining linting issues in WebSocket implementation
a6b87e01 fix: address all critical bugs identified by Bugbot
3a415403 fix: critical bugs in WebSocket security implementation
3ce0e9b1 fix: comprehensive WebSocket security hardening
```

### Uncommitted Changes
```bash
 M PIECES_INTEGRATION.md
?? .claude/context/pieces-recent-activity.md
?? scripts/export-pieces-context.sh
```

## 💡 Saved Code Patterns & Solutions

### WebSocket Fixes
```python
# WebSocket authentication fix from recent work
async def authenticate_websocket(websocket: WebSocket, token: str):
    """Authenticate WebSocket connection with proper error handling"""
    try:
        # Verify token with timeout
        user = await verify_token_with_timeout(token)
        if not user:
            await websocket.close(code=1008)
            return None
        return user
    except Exception as e:
        logger.error(f"WebSocket auth error: {e}")
        await websocket.close(code=1011)
        return None
```

### Authentication Patterns
```typescript
// Supabase auth pattern with role verification
const verifyUserRole = async (supabaseToken: string): Promise<UserRole | null> => {
  try {
    const response = await api.post('/auth/verify', {
      token: supabaseToken
    });
    return response.data.user.role;
  } catch (error) {
    console.error('Role verification failed:', error);
    return null;
  }
};
```

### API Response Patterns
```python
# Standard API response pattern
from app.core.response_helper import APIResponseHelper

# Success response
return APIResponseHelper.success(data=result, message="Operation successful")

# Error response
return APIResponseHelper.error(message="Invalid request", status_code=400)
```

### Common Import Fixes
```typescript
// Missing TextInput import (recent fix)
import { TextInput } from 'react-native';

// APIResponseHelper import path fix
from app.core.response_helper import APIResponseHelper
```

## 🚀 Quick Commands

### iOS Bundle Fix
```bash
cd CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Backend Development
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Run Tests
```bash
# Backend tests
cd backend && pytest -v

# Frontend tests
npm test
```

## 🔧 Pieces CLI Integration

### Setup (One-time)
```bash
pieces onboarding  # Complete the setup wizard
```

### Usage
```bash
pieces create      # Save current clipboard to Pieces
pieces search "websocket"  # Search saved snippets
pieces list        # List all saved snippets
pieces run         # Interactive mode
```

### Export Context for Claude
```bash
# Run before clearing Claude conversation
./scripts/export-pieces-context.sh
```

## 📝 Architecture Reminders

- **Multi-tenant**: Platform → Restaurants → Users
- **Real-time**: WebSockets for order updates
- **Payments**: QR (1.2%), Card/ApplePay (2.9%), Cash (0%)
- **Auth**: Supabase tokens → Backend verification → PostgreSQL user records

## 🐛 Recent Issues & Solutions

1. **WebSocket Authentication**: Fixed undefined variable and token validation
2. **Import Errors**: Corrected TextInput and APIResponseHelper imports
3. **Boto3 Deployment**: Implemented lazy imports to prevent failures
4. **Linting Issues**: Resolved WebSocket implementation warnings

---
*This file is automatically read by Claude Code when starting new sessions*
*Update with: `./scripts/export-pieces-context.sh`*