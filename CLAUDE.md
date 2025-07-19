# CLAUDE.md - Fynlo POS Development Guide

## 🎯 Project Status: 98% Production Ready (Day 10/12 Complete)

### Implementation Documents
- **[FINAL_MASTER_PLAN.md](/Users/arnauddecube/Documents/Fynlo/FINAL_MASTER_PLAN.md)**
- **[CONTEXT.md](cashapp-fynlo/CashApp-iOS/CashAppPOS/CONTEXT.md)** - START HERE! Common issues & fixes
- Phase docs: PHASE_0 through PHASE_3, CODE_CLEANUP_GUIDE

### ✅ Fixed Issues
WebSocket stability | API < 500ms | Token race conditions | Security vulnerabilities | Redis SSL | Deployment diagnostics

### 7 Working Rules
1. Read problem → Find files → Write plan to tasks/todo.md
2. Create checklist of todos
3. Check with user before starting
4. Work on todos, mark complete as you go
5. Give high-level explanations only
6. Keep changes minimal and simple
7. Add review section to todo.md

## 🔒 SECURITY CHECKLIST (MANDATORY)

**Auth**: No bypasses, role validation, restaurant isolation  
**Variables**: Null checks, error handling, Redis fallbacks  
**Input**: SQL injection protection, sanitize `< > " ' ( ) ; & + \` | \ *`  
**Access**: RBAC, resource ownership, multi-tenant isolation  
**Data**: No secrets in code, HTTPS only, encrypt sensitive data  
**API**: Rate limiting, CORS, use APIResponseHelper  
**Frontend**: No hardcoded credentials, XSS prevention, secure storage  
**Testing**: Security tests, edge cases, penetration mindset

**Common vulnerabilities**: WebSocket bypass, undefined vars, access control bypass, Redis crashes, stack traces, insufficient sanitization

## 🚨 GIT WORKFLOW - NEVER LOSE FILES
```bash
# ALWAYS before switching branches:
git add . && git status && git commit -m "feat: preserve work"
# ONLY THEN: git checkout -b feature/new-branch
```

## 🚀 Quick Commands

### iOS Bundle Fix (Most Common)
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Backend
```bash
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# Seeds: python seed_chucho_menu.py
```

## Architecture

**Stack**: React Native + FastAPI + PostgreSQL + Redis + WebSockets  
**Multi-tenant**: Platform → Restaurants → Users  
**Payments**: QR (1.2%), Card/ApplePay (2.9%), Cash (0%)

### Key Files
- **Navigation**: AppNavigator, PlatformNavigator, MainNavigator
- **Auth**: AuthContext.tsx (roles: platform_owner, restaurant_owner, manager, employee)
- **Data**: DataService.ts, MockDataService.ts (demo mode)
- **Theme**: ThemeProvider.tsx, use `useTheme()` not Colors

### Platform vs Restaurant Control
**Platform**: Payment fees, service charge (12.5%), commissions  
**Restaurant**: VAT, business info, hours, receipts, users

## Development Patterns

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

## Git Guidelines

**Branches**: `feature/`, `bugfix/`, `hotfix/`  
**Commits**: `<type>(<scope>): <description>` (feat, fix, docs, test, chore)  
**PRs**: Small, focused, with tests

### Daily Workflow
```bash
git fetch origin && git pull origin main  # Morning
git add . && git commit -m "feat: ..."   # Throughout day
git push origin feature/branch            # Before breaks
```

## Testing Requirements
- Backend: pytest (80% coverage)
- Frontend: Jest + React Native Testing Library
- Security: Auth flows, input validation, multi-tenant isolation

## Key Business Workflows
1. **Orders**: Product → Cart → Payment → Kitchen
2. **Payments**: Method → Validation → Provider → Confirmation
3. **Real-time**: WebSocket → Order updates → UI sync

**Remember**: Check CONTEXT.md first for common issues. Always commit before switching branches. Keep changes simple.