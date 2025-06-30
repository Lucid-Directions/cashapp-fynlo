# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

- **CRITICAL**: Project context is in `cashapp-fynlo/CashApp-iOS/CashAppPOS/CONTEXT.md` (renamed from PROJECT_CONTEXT_COMPLETE.md)
- **Always check CONTEXT.md first** for common issues, bundle deployment fixes, and recent updates
- Contains solutions to recurring problems like "changes not showing in app"
<<<<<<< HEAD
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
=======
**IMPORTANT**: Always check `CONTEXT.md` first for project context, common issues, and recent updates!
>>>>>>> origin/main

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
- Backend documentation in `backend/RYAN DOCS/`

## Service Charge & Payment Settings Migration

Recent changes moved service charges and payment methods from restaurant control to platform control:
- Service charges are now fixed at 12.5% platform-wide
- Payment methods are configured by platform owners only
- Tax configuration screens show platform-controlled sections with lock icons
- Business settings show informational alerts instead of navigating to configuration screens

- **CRITICAL**: Project context is in `cashapp-fynlo/CashApp-iOS/CashAppPOS/CONTEXT.md` (renamed from PROJECT_CONTEXT_COMPLETE.md)
- **Always check CONTEXT.md first** for common issues, bundle deployment fixes, and recent updates
- Contains solutions to recurring problems like "changes not showing in app"

## Quick Bundle Deployment Fix (Most Common Issue)

When changes don't appear in the iOS app:
```bash
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npx metro build index.js --platform ios --dev false --out ios/main.jsbundle
mv ios/main.jsbundle.js ios/main.jsbundle
cp ios/main.jsbundle ios/CashAppPOS/main.jsbundle
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

## Production Readiness Status

The system is **83% production-ready** with 5/6 critical fixes complete:
- ✅ Duplicate function cleanup (authentication conflicts resolved)
- ✅ Response format standardization (consistent API responses)
- ✅ Input validation & security (comprehensive sanitization)
- ✅ Database storage implementation (mock data eliminated)
- ✅ Frontend critical issues (crash prevention, error handling)
- ⏳ Authorization validation (role-based access control - planned)

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
Put it in claude.md
And# 🤝 **Best Practices for Collaboration - Fynlo POS Project**

## **Git, GitHub & Team Coordination Guide**

**Project**: Fynlo POS - Hardware-Free Restaurant Management Platform  
**Team Structure**: Frontend (iOS/React Native) + Backend (FastAPI/PostgreSQL)  
**Repository**: https://github.com/Lucid-Directions/cashapp-fynlo  
**Created**: January 2025  

---

## 📋 **Quick Reference**

### **Daily Workflow Commands**
```bash
# Start of day - Get latest changes
git fetch origin
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-name-feature-description

# Regular commits
git add .
git commit -m "feat: descriptive message"
git push origin feature/your-name-feature-description

# End of day - Sync with team
git fetch origin
```

### **Emergency Commands**
```bash
# Undo last commit (if not pushed)
git reset --soft HEAD~1

# Discard local changes
git checkout -- .

# Get out of merge conflict state
git merge --abort

# See what changed
git diff
git log --oneline -10
```

---

## 🏗️ **Project Structure & Ownership**

### **Domain Separation**
```
Fynlo/
├── backend/                     # 👨‍💻 Ryan's Domain
│   ├── RYAN DOCS/              # Backend documentation
│   ├── app/                    # FastAPI application
│   ├── requirements.txt        # Python dependencies
│   └── README.md              # Backend setup guide
│
├── CashApp-iOS/CashAppPOS/     # 👤 Your Domain  
│   ├── src/                    # React Native source
│   ├── ios/                    # iOS-specific files
│   ├── IOS DOCS/              # iOS documentation
│   └── package.json           # Node dependencies
│
├── ARCHIVED DOCS/              # 📚 Shared Historical Docs
├── config/                     # 🔧 Shared Configuration
└── *.md                       # 📝 Project-level docs
```

### **Ownership Guidelines**
- **Backend Developer (Ryan)**: Full ownership of `/backend/` directory
- **Frontend Developer (You)**: Full ownership of `/CashApp-iOS/` directory  
- **Shared Ownership**: Root-level documentation, configuration files
- **Coordination Required**: API integration, data formats, WebSocket events

---

## 🌿 **Branching Strategy**

### **Branch Naming Convention**

#### **Feature Branches**
```bash
# Frontend features
feature/frontend-navigation-enhancement
feature/ios-payment-integration
feature/mobile-offline-sync

# Backend features  
feature/ryan-file-upload-system
feature/ryan-websocket-events
feature/ryan-push-notifications

# Shared features
feature/api-standardization
feature/authentication-flow
```

#### **Bug Fixes**
```bash
# Frontend bugs
bugfix/ios-login-crash
bugfix/mobile-payment-validation

# Backend bugs
bugfix/ryan-auth-token-refresh
bugfix/ryan-database-connection

# Integration bugs
bugfix/api-response-format
bugfix/websocket-connection-drop
```

### **Branch Lifecycle**
```bash
# 1. Create from latest main
git checkout main
git pull origin main
git checkout -b feature/your-branch-name

# 2. Develop with regular commits
git add .
git commit -m "feat: implement specific functionality"

# 3. Push regularly (backup + collaboration)
git push origin feature/your-branch-name

# 4. Before merging - sync with main
git checkout main
git pull origin main
git checkout feature/your-branch-name
git merge main  # or git rebase main

# 5. Create Pull Request in GitHub
# 6. After review and merge - cleanup
git checkout main
git pull origin main
git branch -d feature/your-branch-name
```

---

## 🔄 **Daily Collaboration Workflow**

### **Morning Routine (5 minutes)**
```bash
# 1. Check what team members did overnight
git fetch origin
git log --oneline origin/main ^main  # See new commits

# 2. Update your main branch
git checkout main
git pull origin main

# 3. Check for new branches from teammates
git branch -r | grep -v HEAD

# 4. Continue your work or create new branch
git checkout your-current-branch
# OR
git checkout -b feature/new-feature
```

### **Throughout the Day**
```bash
# Commit frequently (every 1-2 hours of work)
git add .
git commit -m "feat: add user authentication form"

# Push regularly (end of each work session)
git push origin feature/your-branch

# Check for team updates (before starting major changes)
git fetch origin
```

### **End of Day Routine (3 minutes)**
```bash
# 1. Commit your current work
git add .
git commit -m "wip: working on payment integration"

# 2. Push your work (backup)
git push origin feature/your-branch

# 3. Check team progress
git fetch origin
git log --oneline origin/main ^main

# 4. Plan tomorrow's work based on team updates
```

---

## 📝 **Commit Message Best Practices**

### **Format Standard**
```
<type>(<scope>): <description>

<body>

<footer>
```

### **Type Conventions**
- **feat**: New feature for the user
- **fix**: Bug fix for the user
- **docs**: Documentation changes
- **style**: Code formatting (no logic changes)
- **refactor**: Code restructuring (no feature changes)
- **test**: Adding or updating tests
- **chore**: Build process, dependency updates

### **Good Examples**
```bash
# Frontend commits
git commit -m "feat(ios): add Apple Pay integration to payment screen"
git commit -m "fix(mobile): resolve crash on order submission"
git commit -m "docs(frontend): update setup guide for iOS development"

# Backend commits  
git commit -m "feat(api): implement file upload endpoint for menu images"
git commit -m "fix(auth): resolve JWT token refresh issue"
git commit -m "perf(db): optimize product query with proper indexing"

# Integration commits
git commit -m "feat(integration): standardize API response format"
git commit -m "fix(websocket): resolve connection drops on mobile"
```

---

## 🔍 **Code Review Process**

### **Creating Pull Requests**

#### **Before Creating PR**
```bash
# 1. Ensure your branch is up to date
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main

# 2. Run tests locally
npm test  # for frontend
pytest   # for backend

# 3. Review your own changes
git diff main...feature/your-branch
```

#### **PR Template**
```markdown
## 🎯 Purpose
Brief description of what this PR accomplishes

## 🔧 Changes Made
- [ ] Feature A implemented
- [ ] Bug B fixed  
- [ ] Documentation updated

## 🧪 Testing
- [ ] Unit tests pass
- [ ] Integration tests pass
- [ ] Manual testing completed

## 📱 Mobile Impact (if applicable)
- [ ] iOS app tested
- [ ] API compatibility verified
- [ ] Performance impact assessed

## 🔗 Related Issues
Fixes #123
Relates to #456

## 📋 Checklist
- [ ] Code follows project style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] No merge conflicts
```

---

## 🚨 **Conflict Resolution**

### **Merge Conflicts**
```bash
# When merge conflicts occur
git checkout main
git pull origin main
git checkout feature/your-branch
git merge main

# Git will show conflicts in files
# Edit conflicted files, look for:
<<<<<<< HEAD
Your changes
=======
Their changes
>>>>>>> main

# After resolving conflicts
git add .
git commit -m "resolve: merge conflicts with main"
git push origin feature/your-branch
```

### **Preventing Conflicts**
1. **Sync frequently** - `git fetch origin` daily
2. **Small, focused PRs** - Easier to review and merge
3. **Communicate changes** - Discuss major refactoring
4. **Domain separation** - Frontend/backend boundaries
5. **Coordinate shared files** - API specs, documentation

---

## 📡 **GitHub Features for Collaboration**

### **Issues & Project Management**
```bash
# Link commits to issues
git commit -m "feat: implement login form (fixes #42)"

# Reference issues in PRs
git commit -m "refactor: extract payment logic (relates to #58)"
```

### **GitHub Features to Use**
1. **Issues** - Track bugs, features, questions
2. **Milestones** - Group related issues for releases
3. **Labels** - Categorize issues (bug, enhancement, documentation)
4. **Projects** - Kanban boards for workflow management
5. **Wiki** - Detailed documentation
6. **Releases** - Version management and deployment
7. **Discussions** - Team communication and questions

---

## 🔧 **Environment & Setup Coordination**

### **Configuration Management**
```bash
# Environment files (never commit)
.env
.env.local
.env.development

# Configuration templates (commit these)
.env.example
.env.template
```

### **Dependency Management**
```bash
# Backend (Python)
pip freeze > requirements.txt  # Update dependencies
pip install -r requirements.txt  # Install dependencies

# Frontend (Node.js)
npm install  # Install dependencies  
npm update   # Update dependencies
```

### **Database Coordination**
```bash
# Backend migrations (Ryan's responsibility)
alembic revision --autogenerate -m "add new table"
alembic upgrade head

# Database state sharing
# Use migration files, not database dumps
```

---

## 📱 **Frontend-Backend Integration**

### **API Integration Workflow**
1. **Backend creates endpoint** - Ryan implements API
2. **API documentation** - Swagger/OpenAPI docs updated
3. **Frontend integration** - You consume the API
4. **Testing together** - End-to-end testing
5. **Refinement** - Iterate based on frontend needs

### **Communication Points**
```bash
# When backend adds new endpoints
git pull origin main
# Check: backend/app/api/ for new routes

# When frontend needs API changes
# Create issue describing need
# Tag backend developer for discussion
```

### **Data Format Coordination**
```typescript
// Frontend TypeScript interfaces should match backend schemas
interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'manager' | 'employee';
}
```

---

## 🧪 **Testing & Quality Assurance**

### **Testing Strategy**
1. **Unit tests** - Individual functions/components
2. **Integration tests** - API endpoints, database operations
3. **End-to-end tests** - Full user workflows
4. **Performance tests** - Load testing, response times
5. **Security tests** - Authentication, input validation

### **Testing Coordination**
```bash
# Run tests before pushing
npm test           # Frontend tests
pytest            # Backend tests

# Integration testing
# Start backend: npm run dev:backend
# Start frontend: npm run dev:frontend  
# Test user workflows manually
```

---

## 🚨 **Emergency Procedures**

### **Production Hotfixes**
```bash
# 1. Create hotfix branch from main
git checkout main
git pull origin main
git checkout -b hotfix/critical-security-fix

# 2. Make minimal fix
# 3. Test thoroughly
# 4. Create emergency PR
# 5. Deploy immediately after review
# 6. Merge back to main and development branches
```

### **Broken Main Branch**
```bash
# 1. Identify the breaking commit
git log --oneline
git bisect start

# 2. Revert the problematic commit
git revert <commit-hash>
git push origin main

# 3. Notify team immediately
# 4. Fix in separate branch, then PR
```

---

## 📚 **Command Reference**

### **Essential Git Commands**
```bash
# Repository management
git clone <url>
git init
git remote add origin <url>

# Branch management
git branch                    # List local branches
git branch -r                 # List remote branches  
git branch -a                 # List all branches
git checkout <branch>         # Switch to branch
git checkout -b <branch>      # Create and switch to branch
git branch -d <branch>        # Delete local branch
git push origin --delete <branch>  # Delete remote branch

# Staging and committing
git add .                     # Stage all changes
git add <file>                # Stage specific file
git commit -m "message"       # Commit with message
git commit --amend            # Edit last commit

# Syncing with remote
git fetch origin              # Download changes (no merge)
git pull origin main          # Download and merge main
git push origin <branch>      # Upload branch
git push --set-upstream origin <branch>  # Set tracking

# Viewing history and changes
git log                       # View commit history
git log --oneline            # Compact history
git diff                     # View unstaged changes
git diff --staged            # View staged changes
git status                   # View repository status

# Merging and rebasing
git merge <branch>           # Merge branch into current
git rebase <branch>          # Rebase current onto branch
git merge --abort            # Cancel merge
git rebase --abort           # Cancel rebase

# Stashing
git stash                    # Save work temporarily
git stash pop                # Apply and remove stash
git stash list               # View all stashes
git stash apply stash@{0}    # Apply specific stash

# Undoing changes
git checkout -- <file>       # Discard file changes
git reset HEAD <file>        # Unstage file
git reset --soft HEAD~1      # Undo last commit (keep changes)
git reset --hard HEAD~1      # Undo last commit (lose changes)
git revert <commit>          # Create commit that undoes another
```

---

## 🎯 **Success Metrics**

### **Team Collaboration KPIs**
- **Merge conflicts**: < 1 per week per person
- **PR review time**: < 24 hours average
- **Build failures**: < 5% of commits
- **Test coverage**: > 80% maintained
- **Documentation coverage**: All new features documented

### **Communication Effectiveness**
- **Response time to questions**: < 4 hours during work hours
- **Standup participation**: Daily async updates
- **Knowledge sharing**: Weekly technical discussions
- **Blocker resolution**: < 24 hours average

---

## 🆘 **Troubleshooting Common Issues**

### **"I can't see my teammate's changes"**
```bash
# Solution: Fetch from remote
git fetch origin
git checkout main
git pull origin main
```

### **"My branch is behind main"**
```bash
# Solution: Merge main into your branch
git checkout your-branch
git merge main
# OR rebase (cleaner but more advanced)
git rebase main
```

### **"I have merge conflicts"**
```bash
# Solution: Resolve conflicts manually
# 1. Git will mark conflicted files
# 2. Edit files, remove conflict markers
# 3. Stage resolved files
git add .
git commit -m "resolve: merge conflicts"
```

### **"I committed to the wrong branch"**
```bash
# Solution: Cherry-pick to correct branch
git checkout correct-branch
git cherry-pick <commit-hash>
git checkout wrong-branch
git reset --hard HEAD~1  # Remove from wrong branch
```

### **"My local repository is messed up"**
```bash
# Nuclear option - start fresh (save work first!)
git stash                # Save current work
git fetch origin
git reset --hard origin/main
git stash pop           # Reapply your work
```

---

## 📞 **Team Communication**

### **Daily Standup Format**
```markdown
## Yesterday
- Completed: Feature X implementation
- Blocked by: API endpoint Y not ready

## Today  
- Plan: Integrate payment flow
- Need: Backend endpoint for payment confirmation

## Blockers
- None / Waiting for review of PR #123
```

### **Communication Channels**
- **Urgent issues**: Direct message/call
- **Daily updates**: Team chat
- **Technical discussions**: GitHub issues/discussions
- **Code reviews**: GitHub PR comments
- **Documentation**: GitHub wiki/README files

---

**Remember: Good collaboration is about communication, consistency, and consideration for your teammates. When in doubt, ask questions and document decisions!**

---

**Last Updated**: January 2025  
**Maintained By**: Fynlo Development Team  
**Next Review**: Monthly or as team grows also

