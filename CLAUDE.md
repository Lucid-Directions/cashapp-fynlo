# CLAUDE.md - Fynlo POS Development Guide

## 🚨 CRITICAL RULE: NO ASSUMPTIONS
**NEVER make assumptions about code structure, imports, or functionality.**
- ALWAYS analyze the actual codebase first before writing any code
- ALWAYS verify module locations, function names, and class definitions exist
- ALWAYS check import paths and dependencies before using them
- ALWAYS understand the real implementation before writing tests
- Making assumptions wastes time and creates technical debt

## 🛠️ AVAILABLE TOOLS & AGENTS

### MCP Tools
- **Desktop Commander** (`mcp__desktop-commander__`) - System file operations, process management
- **File System** (`mcp__filesystem__`) - Project file operations
- **Sequential Thinking** (`mcp__sequential-thinking__`) - Break down complex problems
- **Memory Bank** (`mcp__memory-bank__`) - Persist context across conversations
- **Playwright/Puppeteer** (`mcp__playwright__`, `mcp__puppeteer__`) - Browser automation
- **SemGrep** (`mcp__semgrep__`) - Security scanning, code analysis
- **Ref** (`mcp__Ref__`) - Search documentation, GitHub, private resources
- **DigitalOcean** (`mcp__digitalocean-mcp-local__`) - Infrastructure management

### CLI Tools
- **Pieces**: `pieces` - Context management (`pieces search`, `pieces ask`, `pieces create`)
- **Supabase**: `/opt/homebrew/bin/supabase` - Auth & database management
- **GitHub**: `gh` - Repository & PR management
- **DigitalOcean**: `doctl` - Infrastructure control
- **Vercel**: `vercel` - Deployment (requires VERCEL_TOKEN env var)
- **Trivy**: `trivy` - Vulnerability scanner for dependencies and Docker images

### Specialized Sub-Agents (via Task tool)
- **fynlo-test-runner** - Run tests, fix failures, improve coverage
- **fynlo-bundle-deployer** - iOS bundle building & deployment fixes
- **fynlo-security-auditor** - Security vulnerability scanning
- **fynlo-api-optimizer** - Backend performance optimization
- **fynlo-websocket-debugger** - Real-time connection debugging
- **fynlo-platform-integrator** - Multi-tenant features
- **fynlo-infrastructure-manager** - DigitalOcean ops
- **general-purpose** - Complex research & multi-step tasks

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

## 🚨 GITHUB ISSUE ASSIGNMENT CHECK
**CRITICAL: BEFORE WORKING ON ANY GITHUB ISSUE**
- ALWAYS check if the issue is already assigned to someone
- Me arnaud/sleepyarno and Ryan are both working on this project so we always have to keep that in mind to avoid conflict 
- If assigned to another developer, DO NOT work on it
- Inform the user that the issue is assigned and cannot be worked on
- Only work on unassigned issues or issues assigned to you

## 🚨 GIT WORKFLOW - MANDATORY PR PROCESS
**CRITICAL: ALL CHANGES MUST GO THROUGH PULL REQUESTS -
**CRITICAL: Any amendments to the codebase or working on issues must be done on dedicated Feature brunch And then create a detailed pull request that will trigger the redeployment in DigitalOcean.
**CRITICAL: Once you create the pull request, Cursor Bugbot will analyze to find some bugs. We need to make sure that we use PR Guardian so that most of the bugs are already identified while we're creating the pull request and making the change.Any bugs found by Cursor on the PR must be corrected within the same PR. Never create a new PR to fix a bug within the PR.

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

## 💾 CONTEXT PERSISTENCE WITH PIECES

When you clear Claude conversation or restart, use Pieces CLI to maintain context:

```bash
# Search your saved snippets
pieces search "websocket fix"

# Ask Pieces about recent work
pieces ask "What have I been working on?"

# Save important fixes
pieces create -n "fix-name"
```

See `PIECES_WORKFLOW.md` for full workflow.

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

### Vercel Deployment
```bash
# First, set the token in your environment
export VERCEL_TOKEN="your-vercel-token-here"

# Deploy to preview environment
vercel

# Deploy to production
vercel --prod

# Pull environment variables
vercel env pull

# View deployment logs
vercel logs

# List all deployments
vercel list

# Rollback to previous deployment
vercel rollback
```

## 🔧 Python Quality Tools & Scripts

### Installed Python Quality Tools
When working on backend Python code, these tools are available:
- **Ruff**: Fast Python linter (`ruff check app/`)
- **Black**: Code formatter (`black app/`)
- **MyPy**: Type checker (`mypy app/`)
- **Flake8**: Style guide enforcement (`flake8 app/`)
- **Bandit**: Security linter (`bandit -r app/`)
- **Pylint**: Advanced linting (`pylint app/`)

### Custom Scripts for PR Resolution

#### 1. **Python Quality Checker** (`scripts/python-quality-check.py`)
Runs all 5 Python quality tools and generates comprehensive report:
```bash
python3 scripts/python-quality-check.py --backend-path backend
```
Use when: You need to verify Python code quality before committing

#### 2. **PR #459 Fixer** (`scripts/pr459_fixer.py`)
Specialized tool for fixing common Python issues:
```bash
# Validate only (no fixes)
python3 scripts/pr459_fixer.py --validate-only

# Fix common issues
python3 scripts/pr459_fixer.py
```
Use when: Fixing import issues, HTTPException migrations, or docstring problems

#### 3. **Batch Conflict Resolver** (`scripts/batch-resolve-conflicts.py`)
Automatically resolves simple merge conflicts:
```bash
python3 scripts/batch-resolve-conflicts.py
```
Use when: Dealing with many merge conflicts, especially import conflicts

#### 4. **Syntax Error Fixer** (`scripts/fix-syntax-errors.py`)
Fixes common Python syntax errors:
```bash
python3 scripts/fix-syntax-errors.py
```
Use when: Multiple syntax errors after merge conflicts

### Security Scanning

#### Trivy Usage
```bash
# Scan for vulnerabilities in dependencies
trivy fs --scanners vuln backend/

# Generate detailed JSON report
trivy fs --format json --output trivy-report.json backend/

# Scan Docker images
trivy image fynlo-backend:latest
```
Use when: Before any production deployment or after updating dependencies

### Common Patterns to Fix

#### 1. Validator Syntax Errors
```python
# WRONG
@validator('field')
    return value

# CORRECT
@validator('field')
def validate_field(cls, v):
    return v
```

#### 2. HTTPException to FynloException
```python
# WRONG
raise HTTPException(status_code=400, detail="Error")

# CORRECT
raise FynloException(message="Error", status_code=400)
```

#### 3. Print to Logger
```python
# WRONG
print("Debug info")

# CORRECT
logger.info("Debug info")
```

## 📋 PR Conflict Resolution Workflow

When dealing with large PRs with many conflicts (like PR #459):

1. **Analyze Conflicts**:
   ```bash
   git diff --name-only --diff-filter=U | wc -l  # Count conflicts
   python3 scripts/batch-resolve-conflicts.py    # Auto-resolve simple ones
   ```

2. **Fix Syntax Errors**:
   ```bash
   python3 scripts/pr459_fixer.py --validate-only  # Check errors
   python3 scripts/fix-syntax-errors.py           # Fix common issues
   ```

3. **Run Quality Checks**:
   ```bash
   python3 scripts/python-quality-check.py --backend-path backend
   ```

4. **Security Scan**:
   ```bash
   trivy fs --scanners vuln backend/
   ```

5. **Update Dependencies** (if vulnerabilities found):
   ```bash
   pip install --upgrade package-name>=safe-version
   ```

## 🚨 When to Use Which Tool

### Use MCP Tools When:
- **File System**: Reading/writing multiple files, searching patterns
- **Sequential Thinking**: Breaking down complex problems
- **SemGrep**: Deep security analysis beyond Bandit

### Use Python Quality Tools When:
- **Before commits**: Run at least Ruff and Black
- **Before PRs**: Run full python-quality-check.py
- **After merge conflicts**: Run pr459_fixer.py

### Use Security Tools When:
- **Before deployments**: Always run Trivy
- **After dependency updates**: Check for new vulnerabilities
- **In PRs**: Run Bandit for Python-specific security issues

### Use Custom Scripts When:
- **Many conflicts**: batch-resolve-conflicts.py
- **Syntax errors**: fix-syntax-errors.py
- **Import cleanup**: pr459_fixer.py

**Remember**: Always commit before switching branches. Keep changes simple. Check logs for common issues. Run quality checks before pushing.