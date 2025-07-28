# CLAUDE.md - Fynlo POS Development Guide

## 7 Working Rules
1. Read problem → Find files → Write plan to tasks/todo.md
2. Create checklist of todos
3. Check with user before starting
4. Work on todos, mark complete as you go
5. Give high-level explanations only
6. Keep changes minimal and simple
7. Add review section to todo.md

## 🔐 USER SIGNUP & AUTHENTICATION FLOW

### Critical User Journey (Website → App)
1. **Website Signup** (fynlo.com)
   - Users sign up on the website (NOT in the mobile app)
   - Choose subscription plan: Alpha ($29.99), Beta ($59.99), or Omega ($129.99)
   - Supabase creates account with plan metadata
   - User receives verification email

2. **Plan-Based Access Levels**
   - **Alpha**: Basic POS, 500 orders/month, 5 staff, 50 menu items
   - **Beta**: + Inventory, reports, 2000 orders/month, 15 staff, 200 menu items
   - **Omega**: Enterprise, unlimited everything, API access, multi-location

3. **Authentication Architecture**
   ```
   Website Signup → Supabase Auth → Plan Selection
                          ↓
   Mobile App Login → Supabase Token → Backend Verify
                          ↓
   PostgreSQL User Record → Feature Access
   ```

4. **Mobile App Login**
   - Users log in with website credentials
   - App calls `/api/v1/auth/verify` with Supabase token
   - Backend creates/updates user with subscription info
   - Returns enabled features based on plan

5. **Access Control**
   - Features gated by subscription plan
   - Backend validates plan before API access
   - Mobile app uses `hasFeature()` checks
   - No plan changes in mobile app (website only)

## 🚨 GIT WORKFLOW - MANDATORY PR PROCESS
**CRITICAL: ALL CHANGES MUST GO THROUGH PULL REQUESTS - NO DIRECT COMMITS**
**CRITICAL: DO NOT CHANGE ANY CODE - RAISE ALL PROBLEMS AS GITHUB ISSUES**

### MANDATORY WORKFLOW:
1. **CREATE FEATURE BRANCH**: 
   ```bash
   git checkout -b fix/descriptive-name
   ```

2. **MAKE CHANGES AND COMMIT**:
   ```bash
   git add .
   git commit -m "fix: detailed description of changes"
   ```

3. **PUSH TO ORIGIN**:
   ```bash
   git push origin fix/descriptive-name
   ```

4. **CREATE DETAILED PR**:
   ```bash
   gh pr create --title "Fix: Clear description" --body "## What
   - Detailed list of changes
   
   ## Why
   - Explanation of the problem
   - How this fixes it
   
   ## Testing
   - How to verify the fix works"
   ```

5. **WAIT FOR CHECKS**: Let GitHub Actions run tests before merging

**NEVER**:
- Commit directly to main
- Push without creating a PR
- Merge without PR checks passing

## 🚀 Quick Commands

### iOS Bundle Fix (Most Common Issue)
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Backend Development
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Seeds: python seed_chucho_menu.py
```

## 🏗️ Architecture Overview

**Stack**: React Native + FastAPI + PostgreSQL + Redis + WebSockets  
**Multi-tenant**: Platform → Restaurants → Users  
**Payments**: QR (1.2%), Card/ApplePay (2.9%), Cash (0%)

### Hybrid Architecture (Supabase + DigitalOcean)
- **Authentication**: Supabase (users, sessions, tokens)
- **Business Data**: PostgreSQL on DigitalOcean (orders, menu, inventory)
- **Real-time**: WebSockets for live updates

### Key Files
- **Navigation**: AppNavigator, PlatformNavigator, MainNavigator
- **Auth**: AuthContext.tsx (roles: platform_owner, restaurant_owner, manager, employee)
- **Data**: DataService.ts, MockDataService.ts (demo mode)
- **Theme**: ThemeProvider.tsx, use `useTheme()` not Colors

### Platform vs Restaurant Control
**Platform**: Payment fees, service charge (10% default), platform commission (1%)  
**Restaurant**: VAT, business info, hours, receipts, users

## 🔒 SECURITY CHECKLIST (MANDATORY)

**Auth**: No bypasses, role validation, restaurant isolation  
**Variables**: Null checks, error handling, Redis fallbacks  
**Input**: SQL injection protection, sanitize `< > " ' ( ) ; & + \` | \ *`  
**Access**: RBAC, resource ownership, multi-tenant isolation  
**Data**: No secrets in code, HTTPS only, encrypt sensitive data  
**API**: Rate limiting, CORS, use APIResponseHelper  
**Frontend**: No hardcoded credentials, XSS prevention, secure storage  
**Testing**: Security tests, edge cases, penetration mindset

## 📝 Development Patterns

### API Responses
```python
from app.core.response_helper import APIResponseHelper
return APIResponseHelper.success(data=result)  # or .error()
```

### Money Fields
```python
price = Column(DECIMAL(10, 2), nullable=False)  # Always DECIMAL
```

### Error Handling
```python
raise FynloException("message", status_code=400)
```

### State Management
```typescript
interface StoreState {
  data: DataType[];
  loading: boolean;
  error: string | null;
}
```

## 🧪 Testing Requirements
- Backend: pytest (80% coverage)
- Frontend: Jest + React Native Testing Library
- Security: Auth flows, input validation, multi-tenant isolation

## 🛠️ MCP SERVERS (Available Tools)

**File Operations**: `mcp__desktop-commander__` (system files), `mcp__filesystem__` (project files)  
**Problem Solving**: `mcp__sequential-thinking__` (break down complex tasks)  
**Memory**: `mcp__memory-bank__` (persist context across conversations)  
**Browser**: `mcp__playwright__`, `mcp__puppeteer__` (automation, testing)  
**Security**: `mcp__semgrep__` (code analysis, vulnerability scanning)  
**Infrastructure**: `mcp__digitalocean-mcp-local__` (deployment, monitoring, logs)
**Documentation**: `mcp__Ref__` (search docs, GitHub, private resources)

**CLI Tools Available**:
- **Supabase CLI**: `/opt/homebrew/bin/supabase` - For managing Supabase projects
- **DigitalOcean CLI**: `doctl` - For infrastructure management
- **GitHub CLI**: `gh` - For repository management

Use `/mcp` to check status. These tools are automatically available.

## 📚 Key Business Workflows
1. **Orders**: Product → Cart → Payment → Kitchen
2. **Payments**: Method → Validation → Provider → Confirmation
3. **Real-time**: WebSocket → Order updates → UI sync

## Development Commands

### iOS Development
```bash
# Initial setup (first time only)
cd ios && pod install && cd ..

# Start Metro bundler
npm start

# Build for iOS device
npm run build:ios

# Build iOS bundle manually
npx react-native bundle --platform ios --dev false --entry-file index.js --bundle-output ios/CashAppPOS/main.jsbundle --assets-dest ios/CashAppPOS

# Clean builds when needed
npm run clean
npm run clean:all
```

### Testing & Debugging
```bash
# Run tests
npm test

# Lint code
npm run lint

# Security audit
npm run audit:security
```

**Remember**: Always commit before switching branches. Keep changes simple. Check logs for common issues.