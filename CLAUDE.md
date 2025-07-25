# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 🎯 CRITICAL IMPLEMENTATION PLAN - JANUARY 2025

**Current Status**: 85% Production Ready → 100% Target
**Implementation Duration**: 12 Working Days
**Approach**: Architecture-First with Clean Code Focus

### 📚 Master Plan Documents Created
- ✅ **[FINAL_MASTER_PLAN.md](/Users/arnauddecube/Documents/Fynlo/FINAL_MASTER_PLAN.md)** - Complete strategy and overview
- ✅ **[PHASE_0_ARCHITECTURE_SETUP.md](/Users/arnauddecube/Documents/Fynlo/PHASE_0_ARCHITECTURE_SETUP.md)** - Shared types package (Days 1-2)
- ✅ **[PHASE_1_CRITICAL_FIXES.md](/Users/arnauddecube/Documents/Fynlo/PHASE_1_CRITICAL_FIXES.md)** - WebSocket, Token, API fixes (Days 3-5)
- ✅ **[PHASE_2_PLATFORM_INTEGRATION.md](/Users/arnauddecube/Documents/Fynlo/PHASE_2_PLATFORM_INTEGRATION.md)** - Dashboard integration (Days 6-9)
- ✅ **[PHASE_3_MONITORING_DEPLOYMENT.md](/Users/arnauddecube/Documents/Fynlo/PHASE_3_MONITORING_DEPLOYMENT.md)** - Production ready (Days 10-12)
- ✅ **[CODE_CLEANUP_GUIDE.md](/Users/arnauddecube/Documents/Fynlo/CODE_CLEANUP_GUIDE.md)** - Systematic cleanup procedures

### 🚨 Critical Issues to Fix
1. **WebSocket Instability** - No heartbeat, no reconnection
2. **API Performance** - 10+ second timeouts, N+1 queries
3. **Token Race Conditions** - Multiple refresh attempts
4. **Code Duplication** - 200+ duplicate type definitions

## Current Implementation Phase
**STATUS**: Phase 2 Complete ✅ - Beginning Phase 3 (Monitoring & Deployment)
**COMPLETED**: ✅ WebSocket fixes, ✅ Token management, ✅ API optimization, ✅ Platform integration
**NEXT**: Health checks, metrics collection, production deployment scripts

7 Claude rules
1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.

## 🛠️ MCP SERVERS (Model Context Protocol Tools)

**Claude Code has 7 FREE MCP servers installed for enhanced capabilities:**

### 1. Desktop Commander (`mcp__desktop-commander__`)
- **Use for**: File system operations, terminal commands, system interactions
- **Examples**: "List all files in project", "Run npm install", "Create new folders"
- **When to use**: Any file/folder operations or command execution needs

### 2. Sequential Thinking (`mcp__sequential-thinking__`)
- **Use for**: Breaking down complex problems into logical steps
- **Examples**: "Plan architecture for new feature", "Break down implementation steps"
- **When to use**: Complex tasks requiring systematic planning

### 3. File System (`mcp__filesystem__`) 
- **Use for**: Direct file read/write in current project (project-scoped)
- **Examples**: "Read package.json", "Create new component file"
- **When to use**: Project-specific file operations (prefer over Desktop Commander for project files)

### 4. Memory Bank (`mcp__memory-bank__`)
- **Use for**: Storing context across conversations
- **Examples**: "Remember project structure", "Store coding preferences"
- **When to use**: Long-term context retention needs

### 5. Playwright (`mcp__playwright__`)
- **Use for**: Browser automation, web testing, screenshots
- **Examples**: "Take screenshot of webpage", "Fill out web forms", "Test UI flows"
- **When to use**: Browser-based testing or automation

### 6. Puppeteer (`mcp__puppeteer__`)
- **Use for**: Web scraping, PDF generation, browser automation
- **Examples**: "Scrape website data", "Generate PDF from webpage"  
- **When to use**: Data extraction or document generation from web

### 7. Semgrep (`mcp__semgrep__`)
- **Use for**: Code security analysis, vulnerability scanning
- **Examples**: "Scan for security issues", "Check code quality"
- **When to use**: Security audits, code quality checks

### 8. DigitalOcean (`mcp__digitalocean-mcp-local__`)
- **Use for**: Infrastructure management, monitoring, deployment
- **Examples**: "Check backend service status", "View API logs", "Restart services", "Deploy changes"
- **When to use**: Infrastructure debugging, deployment, monitoring production services
- **Capabilities**: Apps, databases, droplets, monitoring, log access

**Note**: These tools are automatically available. Use `/mcp` command to see current status.

## 🔒 MANDATORY SECURITY CHECKLIST - MUST COMPLETE FOR EVERY CODE CHANGE

### CRITICAL: This checklist MUST be completed BEFORE and AFTER every code change. Security vulnerabilities have been repeatedly introduced in pull requests.

### 1. Authentication & Authorization Checks
- [ ] **No authentication bypass**: Verify tokens cannot be used to access other users' data
- [ ] **No fallback lookups**: NEVER lookup users by ID after token validation fails
- [ ] **Role validation**: Ensure users can only access resources for their role
- [ ] **Restaurant isolation**: Verify users cannot access other restaurants' data
- [ ] **Token expiration**: Check that expired tokens are rejected

### 2. Variable & Error Handling
- [ ] **All variables defined**: No undefined variable references (check all code paths)
- [ ] **Null checks**: Verify all objects exist before accessing properties
- [ ] **Error handling**: No stack traces or sensitive info in production errors
- [ ] **Redis fallbacks**: Handle Redis connection failures gracefully
- [ ] **Try-catch blocks**: Wrap external service calls appropriately

### 3. Input Validation & Sanitization
- [ ] **SQL injection protection**: Use parameterized queries only (no string concatenation)
- [ ] **Input sanitization**: Remove ALL dangerous characters: `< > " ' ( ) ; & + \` | \ *`
- [ ] **Path traversal**: Validate file paths don't contain `..` or absolute paths
- [ ] **Command injection**: Never pass user input to shell commands
- [ ] **Size limits**: Enforce limits on all user inputs and file uploads

### 4. Access Control
- [ ] **RBAC enforcement**: Check user role before EVERY data access
- [ ] **Resource ownership**: Verify user owns/has access to requested resource
- [ ] **Platform vs Restaurant**: Ensure platform-only settings cannot be modified
- [ ] **Multi-tenant isolation**: Data queries MUST filter by restaurant_id
- [ ] **Default deny**: Explicitly allow access, don't assume permission

### 5. Data Security
- [ ] **No secrets in code**: No API keys, passwords, or tokens in source
- [ ] **Sensitive data logging**: Never log passwords, tokens, or PII
- [ ] **HTTPS only**: All external API calls use HTTPS
- [ ] **Encryption**: Sensitive data encrypted at rest and in transit
- [ ] **PII handling**: Follow GDPR/privacy requirements for user data

### 6. API Security
- [ ] **Rate limiting**: Implement rate limits on all endpoints
- [ ] **CORS configuration**: Restrict origins appropriately
- [ ] **API versioning**: Maintain backward compatibility
- [ ] **Response standardization**: Use APIResponseHelper consistently
- [ ] **Error messages**: Don't leak system information in errors

### 7. Frontend Security
- [ ] **No hardcoded credentials**: Remove ALL mock users and demo passwords
- [ ] **XSS prevention**: Sanitize all user-generated content display
- [ ] **Secure storage**: Use secure storage for tokens (not localStorage)
- [ ] **Deep linking**: Validate all deep link parameters
- [ ] **API key exposure**: Never expose backend API keys in frontend

### 8. Testing Requirements
- [ ] **Security tests written**: Add tests for authentication/authorization
- [ ] **Edge cases tested**: Test with invalid, missing, and malicious inputs
- [ ] **Multi-tenant tests**: Verify cross-tenant access is blocked
- [ ] **Integration tests**: Test full request flow including auth
- [ ] **Penetration mindset**: Try to break your own code

### Common Vulnerabilities Found in This Codebase:
1. **WebSocket access bypass through user_id fallback**
2. **Undefined variable references (is_platform_owner)**
3. **Restaurant access control bypass in orders endpoint**
4. **Redis null reference crashes**
5. **Stack traces exposed in production**
6. **Insufficient input sanitization**
7. **Platform owner role determined by email only**

### Security Review Process:
1. Run security scan: `python security_scan.py` (if available)
2. Review auth flows: Trace every authentication path
3. Check access control: Verify every database query filters by permission
4. Validate inputs: Test with malicious payloads
5. Error handling: Ensure no sensitive data in error responses

Remember: It's better to be overly cautious with security than to introduce vulnerabilities that could compromise user data or system integrity. 

- **CRITICAL**: Project context is in `cashapp-fynlo/CashApp-iOS/CashAppPOS/CONTEXT.md` (renamed from PROJECT_CONTEXT_COMPLETE.md)
- **Always check CONTEXT.md first** for common issues, bundle deployment fixes, and recent updates
- Contains solutions to recurring problems like "changes not showing in app"
**IMPORTANT**: Always check `CONTEXT.md` first for project context, common issues, and recent updates!

## 🚨 CRITICAL GIT WORKFLOW WARNING 🚨

**NEVER SWITCH BRANCHES OR CREATE PRs WITHOUT COMMITTING CURRENT WORK FIRST**

**PROBLEM**: Multiple times documentation and code files have been "lost" when creating pull requests because they were only in the working directory, not committed to the base branch.

**MANDATORY WORKFLOW FOR ALL BRANCH OPERATIONS:**

```bash
# 1. ⚠️ ALWAYS COMMIT EVERYTHING TO BASE BRANCH FIRST
git add .
git status  # ← VERIFY what you're committing
git commit -m "feat: preserve current work state"

# 2. ONLY THEN create feature branches
git checkout -b feature/specific-change

# 3. Cherry-pick or reset to include only relevant changes for PR
```

**BEFORE ANY `git checkout` COMMAND:**
- ✅ Check `git status` - must be clean or everything committed
- ✅ Verify all documentation files are committed to base branch
- ✅ Never assume files exist in other branches

**This is NOT optional** - files have been lost 3+ times due to not following this workflow.

## Project Overview

**Fynlo POS** is a hardware-free restaurant point of sale platform built with React Native (iOS) and FastAPI backend. The app serves as a multi-tenant platform where platform owners can onboard multiple restaurant clients. The current implementation features a Mexican restaurant as the pilot client.

**Key Value Propositions:**
- Hardware-free: No expensive POS terminals required
- QR code payments at 1.2% fees (vs 2.9% traditional cards)
- Multi-tenant architecture: Platform → Restaurants → Users
- Real-time operations via WebSocket

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

# Build and install iOS app to device
cd ios && xcodebuild -workspace CashAppPOS.xcworkspace -scheme CashAppPOS -destination "platform=iOS,name=Device Name" build
xcrun devicectl device install app --device "DEVICE_ID" /path/to/CashAppPOS.app

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

# Update dependencies
npm run update:dependencies
```

### Backend (FastAPI)
```bash
cd backend/
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

## Architecture Overview

### Multi-Tenant Platform Structure
- **Platform Level**: Platform owners manage multiple restaurants
- **Restaurant Level**: Restaurant owners manage their specific business
- **User Level**: Staff members with role-based permissions

### Key Components

**Navigation Architecture:**
- `AppNavigator.tsx`: Root navigator deciding between platform/restaurant flows
- `PlatformNavigator.tsx`: Platform owner interface (dashboard, restaurants, monitoring, users)
- `MainNavigator.tsx`: Restaurant user interface (POS, orders, settings)
- `SettingsNavigator.tsx`: Comprehensive settings management

**Authentication & Authorization:**
- `AuthContext.tsx`: Multi-role authentication (platform_owner, restaurant_owner, manager, employee)
- Role-based navigation routing
- Demo mode support for investor presentations

**Theme System:**
- `ThemeProvider.tsx`: Global theme management with 10 color schemes
- `theme.ts`: Design system with light/dark modes
- Theme context should be used instead of hardcoded Colors constants

**Data Management:**
- `DataService.ts`: Unified API service with mock/real data switching
- `MockDataService.ts`: Demo data for presentations
- `DatabaseService.ts`: Real backend API client
- `useSettingsStore.ts`: Zustand store for settings persistence

### Platform vs Restaurant Settings

**Platform-Controlled Settings** (cannot be modified by restaurants):
- Payment processing fees and methods
- Service charge rates (fixed at 12.5%)
- Commission structures
- Tax compliance settings

**Restaurant-Controlled Settings**:
- VAT rates and tax exemptions
- Business information and branding
- Operating hours
- Receipt customization
- User management

## Critical Development Notes

### Bundle Management (CRITICAL!)
The app uses pre-built JavaScript bundles for stability. When making TypeScript changes:

```bash
# Build the bundle (from CashApp-iOS/CashAppPOS directory)
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle

# Metro adds .js extension, so rename
mv ios/main.jsbundle.js ios/main.jsbundle  

# Copy to iOS project directory
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

**Note**: Changes will NOT appear in the app unless you build and copy the bundle!

### Platform vs Restaurant Context
- Mexican restaurant menu/inventory is the **pilot client**, not the platform default
- The platform is designed to support ANY restaurant type with custom menus
- Always consider multi-tenant implications when adding features
- Settings should be categorized as platform-controlled vs restaurant-controlled

### Demo Mode
- `MockDataService.ts` provides demo data for investor presentations
- Demo mode must be preserved for business development
- Real backend integration should not interfere with demo functionality

### iOS Stability
- Metro bundler fallback is configured in `AppDelegate.swift`
- CocoaPods includes extensive Xcode 16.4 compatibility fixes
- SocketRocket patches are applied automatically during pod install

## Common Development Patterns

### Adding New Settings
1. Determine if setting is platform-controlled or restaurant-controlled
2. Add to appropriate settings navigator section
3. Use existing `SettingsCard`, `SettingsSection`, `ToggleSwitch` components
4. Persist data via `useSettingsStore` or backend API

### Screen Development
1. Use theme context: `const { theme } = useTheme()`
2. Follow existing navigation patterns
3. Add proper error boundaries and loading states
4. Consider both platform owner and restaurant user perspectives

### API Integration
1. Use `DataService.ts` for API calls
2. Implement mock data fallbacks
3. Handle authentication via `AuthContext`
4. Use proper TypeScript interfaces from `src/types/`

### Testing Screen Stability
Always test critical user flows:
- Platform settings navigation
- Payment methods (should show platform-controlled message)
- Service charge configuration (platform-controlled)
- Orders screen loading
- Theme picker functionality

## Known Issues & Workarounds

### Theme Application
Many screens use hardcoded `Colors` constants instead of theme context. To fix:
- Replace `Colors.primary` with `theme.colors.primary`
- Use `useTheme()` hook instead of importing Colors
- This is an ongoing migration that should be done incrementally

### Bundle Dependency
The app relies on pre-built bundles rather than Metro for production stability. This means:
- TypeScript changes require bundle regeneration
- Hot reload may not work consistently
- Always test with fresh bundles before deployment

### Multi-Platform Considerations
When working with settings or business logic:
- Check if the feature should be platform-controlled
- Ensure restaurant owners cannot modify platform revenue settings
- Consider the multi-tenant impact of any changes

## Project Context Files

- `CONTEXT.md`: Essential project context and development guide (START HERE!)
- `ios/APP_RUNTIME_FIXES.md`: iOS-specific fixes and bundle management
- Backend documentation in `ARCHIVED DOCS/` (RYAN_BACKEND_HANDOVER.md, RYAN_HANDOVER_SUMMARY.md)

## Service Charge & Payment Settings Migration

Recent changes moved service charges and payment methods from restaurant control to platform control:
- Service charges are now fixed at 12.5% platform-wide
- Payment methods are configured by platform owners only
- Tax configuration screens show platform-controlled sections with lock icons
- Business settings show informational alerts instead of navigating to configuration screens

- **CRITICAL**: Project context is in `cashapp-fynlo/CashApp-iOS/CashAppPOS/CONTEXT.md` (renamed from PROJECT_CONTEXT_COMPLETE.md)
- **Always check CONTEXT.md first** for common issues, bundle deployment fixes, and recent updates
- Contains solutions to recurring problems like "changes not showing in app"

## 🚀 Quick Reference Commands

### Bundle Deployment Fix (Most Common Issue)
When changes don't appear in the iOS app:
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
```

### Start Backend Server
```bash
cd backend
source venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Run Database Seeds
```bash
cd backend
python seed_chucho_menu.py  # Populate Chucho menu
python scripts/seed_database.py  # General seed data
```

### Check Current Git Branch
```bash
git branch --show-current  # Shows: fix/critical-auth-websocket-menu-issues
```

## Git & Development Guidelines

### Branching Conventions
Prefix by layer:
Front‑end: front/<feature>, Back‑end: back/<feature>
Example: front/header-styles, back/user-model-refactor

One branch – one purpose: Bug fix, feature, or experiment, never mix them.

Protected main branch:

Require PR review and passing CI before merge.

Disallow direct pushes to main.

3. Commit Message Guidelines
Style: <type>(<scope>): <imperative summary>
Types: feat, fix, refactor, docs, test, chore
Scope: folder or module name.
Example: fix(api): handle null token

Body: Explain why, reference issues:

nginx
Copy
Resolves #15
Avoid long lines; wrap at 72 characters.

4. Pull Request Best Practices
Small PRs – under 400 lines changed when possible.

Clear title – mirrors the squash commit message.

Description – what, why, and screenshots or GIFs for UI.

Review checklist – tests pass, docs updated, no debug prints.

Request review explicitly – assign the other developer.

Approve only when ready – use "Request changes" for blockers.

5. Issue & Project Management
Tool	How to use it	Benefit
GitHub Issues	One per task or bug. Use labels: front, back, bug, enhancement, good-first-issue.	Single source of truth for work items.
Project board (Kanban)	Columns: Todo, In progress, Review, Done. Link cards to issues or PRs.	Visualizes progress at a glance.
Milestones	Bundle related issues for a release (v1.0, Sprint‑3).	Tracks scope and deadlines.

6. Continuous Integration and Quality Gates
Use GitHub Actions to:

Run npm test or pytest on every push.

Lint code with ESLint or Flake8.

Build and deploy preview environments (Netlify, Render, etc).

Fail the build on:

Test failures.

Linter errors.

Coverage drop below threshold.

This stops broken code before it merges.

7. Resolving Conflicts Safely
Stay calm – conflicts are normal.

git fetch then git rebase origin/main.

Open conflicted files, keep the right lines, remove markers.

git add <files> and git rebase --continue.

Rerun tests; push with --force-with-lease.

Never use git push --force without --lease.

8. Advanced Git Commands at a Glance
Command	What it does	When to use it	Caution
git stash / git stash pop	Save work in progress and reapply later.	Quick context switch before pulling urgent fix.	Stash is stack‑based; name stashes for clarity (git stash save "wip login").
git cherry-pick <sha>	Apply a single commit onto current branch.	Hotfix a commit to production.	Creates duplicates if you later merge full branch.
git revert <sha>	Create a new commit that undoes another.	Roll back a bad commit on shared branch.	Safer than git reset for published history.
git reset --soft <sha>	Move HEAD and keep changes staged.	Combine several local commits before pushing (manual squash).	Do not run on commits already pushed.
git log --oneline --graph --decorate --all	Visualize history.	Inspect branch structure before rebase.	Read‑only.
git diff origin/main...HEAD	Show changes your branch introduces.	Self‑review before PR.	None.
git tag -a v1.0 -m "Release 1.0"	Annotated release tag.	Mark production deployments.	Push with git push origin --tags.

9 Release Flow
Create a release branch off main: release/1.0.

Only fixes and docs allowed after branching.

Tag: git tag -a v1.0 -m "Release 1.0".

Merge release back to main and develop if you have one.

Draft GitHub Release notes from commit history.

10 Housekeeping Tips
Delete stale branches older than 10 days.

Use .gitignore to avoid temporary files in commits.

Enable branch auto delete in repository settings.

Configure CODEOWNERS so each folder (e.g., /frontend/, /backend/) has an owner; GitHub then requests the right reviewer automatically.

Activate Dependabot for security updates.

11 Daily Checklist (Quick Reference)
Fetch and rebase main.

Work on a small, focused branch.

Write descriptive, atomic commits.

Push and open a PR early.

Review teammate's PRs.

Keep tests green.

Merge only through PRs.

Delete merged branches.

12 Signature and Commits

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Essential Development Commands

### Backend Development (FastAPI + PostgreSQL)
```bash
# Environment setup and database migration
cd backend
pip install -r requirements-dev.txt
alembic upgrade head

# Development server with auto-reload
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Testing and code quality
pytest tests/ -v --cov=app --cov-report=html
black app/ tests/
flake8 app/
mypy app/
```

### Frontend Development (React Native)
```bash
# Setup and dependency management
cd CashApp-iOS/CashAppPOS
npm install
cd ios && pod install && cd ..

# Development builds
npm start                    # Metro bundler
npm run ios                  # iOS simulator
npm run android             # Android emulator

# Testing and quality
npm test                    # Jest test runner
npm run test:watch         # Watch mode
npm run lint               # ESLint
npm run build:ios          # Production iOS bundle

# Maintenance commands
npm run clean:all          # Full dependency refresh
npm run audit:security     # Security audit
```

### Database Operations
```bash
# Create new migration
cd backend
alembic revision --autogenerate -m "description"

# Apply migrations
alembic upgrade head

# Rollback migration
alembic downgrade -1
```

## Architecture Overview

### Multi-Platform POS System Architecture
This is a production-ready Point of Sale system with a **hybrid 3-tier architecture**:

1. **Frontend Layer**: React Native mobile app (`CashApp-iOS/CashAppPOS/`)
2. **Backend Layer**: FastAPI microservice (`backend/`)
3. **ERP Layer**: Odoo-based enterprise modules (`addons/`, `cashapp/`)

### Core Technology Stack
- **Backend**: FastAPI 0.108.0, PostgreSQL, Redis, SQLAlchemy ORM
- **Frontend**: React Native 0.72.17, TypeScript, Zustand state management
- **Payments**: Stripe, SumUp, QR codes, Apple Pay
- **Real-time**: WebSockets for live order updates
- **Authentication**: JWT with role-based access control

### Key Business Logic Components

#### Backend API Structure (`/backend/app/`)
- `api/v1/` - Main REST endpoints (auth, orders, payments, restaurants)
- `api/mobile/` - Mobile-optimized endpoints with simplified responses
- `core/` - Database, Redis, exception handling, configuration
- `services/` - Business logic (payment processors, analytics, validation)
- `models/` - SQLAlchemy database models
- `middleware/` - API versioning, mobile compatibility, CORS

#### Frontend Architecture (`/CashApp-iOS/CashAppPOS/src/`)
- `screens/` - Main UI screens (POS, orders, settings, analytics)
- `components/` - Reusable UI components with theming support
- `navigation/` - Stack, drawer, and bottom tab navigation
- `store/` - Zustand stores for state management with AsyncStorage persistence
- `services/` - API clients, payment processors, offline sync
- `types/` - TypeScript definitions for API responses and business entities

### Multi-Tenant Restaurant Platform
The system supports multiple restaurants with:
- Restaurant-specific configurations (taxes, business hours, floor plans)
- User roles per restaurant (owner, manager, staff)
- Isolated data and payment processing per tenant
- Shared platform features (analytics, reporting)

### Payment Processing Architecture
Smart payment routing with multiple providers:
- **QR Payments** (1.2% fee) - Lowest cost option
- **Card Payments** (2.9% fee) - Stripe integration
- **Apple Pay** (2.9% fee) - Contactless payments
- **Cash** (0% fee) - Traditional handling
- **Split Payments** - Multiple methods per order

## Critical Development Patterns

### API Response Standardization
All API endpoints use `APIResponseHelper` for consistent responses:
```python
from app.core.response_helper import APIResponseHelper

# Success response
return APIResponseHelper.success(data=result, message="Operation successful")

# Error response
return APIResponseHelper.error(message="Error details", status_code=400)
```

### Database Model Patterns
Financial calculations use DECIMAL for precision:
```python
from sqlalchemy import DECIMAL
price = Column(DECIMAL(10, 2), nullable=False)  # Always use DECIMAL for money
```

### Frontend State Management
Zustand stores with persistence and error handling:
```typescript
interface StoreState {
  data: DataType[];
  loading: boolean;
  error: string | null;
  setData: (data: DataType[]) => void;
  clearError: () => void;
}
```

### Error Handling Patterns
Backend uses custom `FynloException` for consistent error handling:
```python
from app.core.exceptions import FynloException
raise FynloException("Detailed error message", status_code=400)
```

Frontend uses error boundaries and safe optional chaining:
```typescript
user?.profile?.settings?.theme ?? 'light'
```

## Critical Security & Validation

### Input Sanitization
All user inputs are sanitized to remove dangerous characters:
```python
dangerous_chars = ['<', '>', '"', "'", '(', ')', ';', '&', '+']
```

### Authentication Flow
- JWT tokens with configurable expiration
- Role-based access control (owner, manager, staff)
- Redis session management for performance
- Mobile-optimized authentication endpoints

### Data Validation
- Pydantic models for request/response validation
- UK phone number and email format validation
- JSONB field validation for restaurant configurations
- Business logic validation for orders and payments

## 🚀 PRODUCTION READINESS IMPLEMENTATION

### Implementation Timeline (12 Days)

**Phase 0 (Days 1-2)**: Architecture Setup ⚡
- Create @fynlo/shared types package
- Define all TypeScript interfaces  
- Remove 200+ duplicate type definitions
- Establish clean foundation

**Phase 1 (Days 3-5)**: Critical Fixes 🔧
- Implement WebSocket heartbeat (15-second intervals)
- Fix token refresh with mutex synchronization
- Optimize API with caching and eager loading
- Add database indexes for performance

**Phase 2 (Days 6-9)**: Platform Integration 🏢
- Migrate platform dashboard to shared types
- Implement role-based access control
- Create bidirectional sync service
- Add real-time monitoring

**Phase 3 (Days 10-12)**: Production Ready 🚀
- Health check endpoints
- Metrics collection service
- Deployment scripts
- Load testing & verification

### Key Technical Solutions

```typescript
// WebSocket Heartbeat
private startHeartbeat(): void {
  this.heartbeatInterval = setInterval(() => {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.send({ type: 'ping' });
    }
  }, 15000);
}

// Token Synchronization
private refreshMutex = new Mutex();
async refreshToken(): Promise<boolean> {
  return this.refreshMutex.runExclusive(async () => {
    // Prevents race conditions
  });
}
```

### Success Metrics
- WebSocket uptime > 99.5%
- API response time < 500ms  
- Zero authentication failures
- 0 duplicate types
- 0 console.log statements
- 30% code reduction target

## Development Environment Requirements

- **Node.js**: 18+ with npm 9+
- **Python**: 3.11+ with pip
- **Databases**: PostgreSQL 13+, Redis 6+
- **Mobile**: Xcode (iOS), Android Studio (Android)
- **Containerization**: Docker & docker-compose

## Testing Strategy

### Backend Testing
- **Unit Tests**: pytest with 80% coverage target
- **Integration Tests**: Database and Redis integration
- **API Tests**: FastAPI TestClient for endpoint validation
- **Security Tests**: Input validation and authentication

### Frontend Testing
- **Unit Tests**: Jest with React Native Testing Library
- **Component Tests**: UI component isolation testing
- **Integration Tests**: Navigation and state management
- **E2E Tests**: Critical user flows

## Deployment Considerations

### Backend Deployment
- Gunicorn WSGI server for production
- Database migrations via Alembic
- Redis for session and cache management
- Environment-based configuration

### Frontend Deployment
- iOS: Xcode build with proper signing
- Android: Gradle build with release configuration
- Code signing and app store distribution

## Key Business Workflows

1. **Order Creation**: Product selection → Cart management → Payment processing → Kitchen notification
2. **Payment Processing**: Method selection → Validation → Provider routing → Transaction confirmation
3. **Restaurant Management**: Multi-tenant configuration → User role assignment → Business analytics
4. **Real-time Updates**: WebSocket connections → Order status changes → UI synchronization

This system emphasizes reliability, security, and user experience for restaurant operations with enterprise-grade features and mobile-first design.

---

## 📚 Additional Documentation

- **[GITHUB_BEST_PRACTICES.md](../GITHUB_BEST_PRACTICES.md)** - Comprehensive Git workflow, branching strategies, PR guidelines, and team collaboration best practices
