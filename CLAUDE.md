# CLAUDE.md - Fynlo POS Development Guide

## 🚨 CRITICAL: NO LOCALHOST - PRODUCTION INFRASTRUCTURE ONLY

**We are in pre-production mode. ALL services use production infrastructure:**
- **Authentication**: Supabase (https://eweggzpvuqczrrrwszyy.supabase.co)
- **Backend API**: DigitalOcean (https://fynlopos-9eg2c.ondigitalocean.app)
- **Database**: PostgreSQL on DigitalOcean (NOT local)
- **WebSockets**: wss://fynlopos-9eg2c.ondigitalocean.app/ws

**NEVER use localhost:8000 or any local backend. The infrastructure is already deployed and running.**

## 🚨 CRITICAL: Pre-Commit Hooks Are Active

**Pre-commit hooks automatically run on EVERY commit** to prevent syntax errors and maintain code quality. If a commit fails, fix the issues and try again.

```bash
# Test hooks manually
pre-commit run --all-files

# Emergency bypass (USE SPARINGLY)
git commit --no-verify -m "message"

# Install if missing
pip install pre-commit && pre-commit install
```

## 🚨 PR WORKFLOW - MANDATORY

1. **Always create feature branch**: `git checkout -b fix/descriptive-name`
2. **Create detailed PR with What/Why/Testing sections**
3. **Fix Cursor bot findings within same PR** (never create new PR for fixes unless the task is too big)
4. **Wait for all checks to pass before merging, i merge all PR after my review**
5. **Plan the work To be distributed amongst the agents.Then use multiple agents in parallel.Make sure the work is distributed to the specialized agents**

## 📋 React Native Style Warnings Resolution (Issue #519)

**Resolution implemented on 2025-08-05**

### What We Discovered

- 93% of style warnings (487/523) were **false positives** from `react-native/no-unused-styles`
- ESLint cannot track styles through our `useThemedStyles` custom hook pattern
- Only 36 genuine inline style warnings remain

### Solution Implemented

1. **Changed ESLint rule to 'warn'** instead of disabling completely
2. **Added eslint-disable comments** to 8 files using `useThemedStyles` pattern
3. **Created monthly cleanup script** at `scripts/monthly-style-cleanup.sh`
4. **Kept `no-inline-styles` as error** to catch genuine issues

### Files with ESLint Disable Comments

These files use `useThemedStyles(createStyles)` pattern:

- `src/screens/main/POSScreen.tsx`
- `src/screens/more/MoreScreen.tsx`
- `src/screens/orders/OrdersScreen.tsx`
- `src/screens/settings/user/UserProfileScreen.tsx`
- `src/screens/settings/app/MenuManagementScreen.tsx`
- `src/screens/payment/ServiceChargeSelectionScreen.tsx`
- `src/screens/main/ProfileScreen.tsx`
- `src/screens/settings/RestaurantPlatformOverridesScreen.tsx`

### Monthly Maintenance

Run monthly to catch genuine unused styles:

```bash
./scripts/monthly-style-cleanup.sh
```

### Why This Approach?

- **Balanced**: Keeps the benefits of linting without false positives
- **Maintainable**: Clear documentation and process for future developers
- **Performance**: Prevents style bloat while allowing modern patterns
- **Developer Experience**: No more disruption from false warnings

### Key Lesson

ESLint rules designed for older React Native patterns may not work with modern hooks and custom theming systems. Always investigate bulk warnings before attempting automated fixes.

## 🚨 iOS App Launch Troubleshooting

### Common Error: "CashAppPOS has not been registered"

**Symptom**: iOS app fails to launch with error:
```
Invariant Violation: "CashAppPOS" has not been registered.
```

**Root Cause**: JavaScript bundle fails to execute due to runtime errors BEFORE app registration. The most common cause is missing imports (especially `logger`).

### Debugging Steps

1. **Check JavaScript Console**: The Xcode error is misleading. Use Safari Web Inspector:
   ```bash
   # Launch app in simulator
   xcrun simctl launch booted com.fynlone.CashAppPOS
   
   # Open Safari > Develop > [Simulator] > JSContext
   # Look for the ACTUAL JavaScript error (usually ReferenceError)
   ```

2. **Common Issue: Missing Logger Imports**
   - Files using `logger.info()`, `logger.error()` etc. without importing
   - Run detection script:
   ```bash
   ./scripts/fix-missing-logger-imports.sh
   ```

3. **Rebuild Bundle with Cache Clear**:
   ```bash
   cd CashApp-iOS/CashAppPOS
   npx metro build index.js --platform ios --dev false --out ios/main.jsbundle --reset-cache
   mv ios/main.jsbundle.js ios/main.jsbundle
   cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
   ```

4. **Force Clean Build**:
   ```bash
   # Clean everything
   cd ios
   rm -rf build/
   xcodebuild clean -workspace CashAppPOS.xcworkspace -scheme CashAppPOS
   
   # Rebuild in Xcode
   open CashAppPOS.xcworkspace
   # Click Run button (▶️)
   ```

### Prevention

- **Always import logger**: When using `logger` anywhere, import it:
  ```typescript
  import { logger } from '../utils/logger'; // Adjust path as needed
  ```
- **Check bundle after changes**: After modifying many files, rebuild bundle
- **Test in simulator**: Don't rely on Xcode errors alone - check actual runtime

### Quick Fix Script

We have an automated script that fixes missing logger imports:
```bash
chmod +x scripts/fix-missing-logger-imports.sh
./scripts/fix-missing-logger-imports.sh
```

This script:
- Finds all files using logger without importing it
- Adds correct relative import paths automatically
- Works for any depth of directory nesting

## 🛠️ Quick Reference

### Python Quality (MANDATORY before commits)

```bash
# Quick syntax check after edits
cd backend && python3 -m py_compile path/to/file.py

# Before commits
cd backend && ruff check app/ --fix && black app/

# Full quality check
python3 scripts/python-quality-check.py --backend-path backend
```

### Available Quality Tools (from PR #459 extraction)

- `scripts/python-quality-check.py` - Runs 6 tools (Ruff, Black, MyPy, Flake8, Bandit, Pylint)
- `scripts/pr459_fixer.py` - Fixes common Python patterns
- `scripts/batch-resolve-conflicts.py` - Resolves merge conflicts
- Pre-commit hooks in `.pre-commit-config.yaml`

### iOS Bundle Fix

```bash
cd CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

## 🏗️ Architecture

**Stack**: React Native + FastAPI + PostgreSQL + Redis + WebSockets
**Auth**: Supabase (website signup → mobile login)
**Deployment**: DigitalOcean (backend), Vercel (web)
**Multi-tenant**: Platform → Restaurants → Users

### Key Patterns

```python
# API Responses
from app.core.response_helper import APIResponseHelper
return APIResponseHelper.success(data=result)

# Error Handling (NOT HTTPException!)
raise FynloException(message="Error", status_code=400)

# Money Fields
price = Column(DECIMAL(10, 2), nullable=False)
```

## 🔒 Security Checklist

- **Auth**: Role validation, restaurant isolation
- **Input**: Sanitize `< > " ' ( ) ; & + \` | \ *`
- **API**: Rate limiting, CORS, use APIResponseHelper
- **Data**: No secrets in code, HTTPS only

## 📚 Key Context

### PR #459 Success Story

**Problem**: Massive 424-file PR with 48K+ changes became unmergeable
**Solution**: Strategic decomposition into focused PRs:

- PR #468, #472, #473, #467, #514-516: Code improvements ✅
- PR #518: Automation tools (pre-commit, quality scripts) ✅
**Result**: 100% objectives achieved, zero production risk

### Critical Rules

- **NO ASSUMPTIONS**: Always verify code exists before using
- **GitHub Issues**: Check assignment before working (arnaud/Ryan collaboration)
- **Test Coverage**: Backend 80% pytest, Frontend Jest + RTL

## 🛠️ Available Tools

### MCP Servers

- File System, Sequential Thinking, Memory Bank
- Playwright/Puppeteer, SemGrep, Ref, Tree-sitter

### CLI Tools

- `pieces` - Context persistence
- `gh` - GitHub management
- `doctl` - DigitalOcean
- `trivy` - Security scanning
- `supabase` - Database & auth (`/opt/homebrew/bin/supabase`)
  - Access production database via REST API
  - Credentials location: `backend/.env.production` (NEVER expose keys in docs!)
  - Existing test users for testing:
    - Platform Owner: sleepyarno@gmail.com (Arnaud)
    - Restaurant Manager: arnaud@luciddirections.co.uk (Arnaud)

### Specialized Agents (in parallel via Task tool)

- fynlo-test-runner, fynlo-bundle-deployer
- fynlo-security-auditor, fynlo-api-optimizer
- planning-agent, development-agent, testing-agent

## 🚀 Common Commands

```bash
# Backend dev
cd backend && source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Run tests
pytest backend/

# Security scan
trivy fs --scanners vuln backend/

# Pieces context
pieces search "recent work"
pieces create -n "fix-name"
```

## 📝 Remember

- Pre-commit hooks catch errors automatically
- Use FynloException, not HTTPException
- Always DECIMAL for money, never float
- Check issue assignment before working
- Keep PRs focused and testable
