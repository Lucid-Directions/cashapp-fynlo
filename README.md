# Fynlo POS - Multi-tenant Restaurant Point of Sale System

## Overview

Fynlo POS is a comprehensive, multi-tenant restaurant management system designed to modernize and streamline restaurant operations. The platform consists of a React Native mobile application for iOS (with planned Android support), a FastAPI backend, and a web-based management dashboard. It handles everything from order taking and payment processing to inventory management and real-time kitchen operations.

## Infrastructure Architecture

### Tech Stack
- **Mobile App**: React Native + TypeScript (iOS primary, Android planned)
- **Backend API**: FastAPI (Python 3.11+) with async/await patterns
- **Database**: PostgreSQL 15 (DigitalOcean Managed Database)
- **Cache/Session Store**: Valkey (Redis-compatible fork, DigitalOcean Managed)
- **Authentication**: Supabase Auth (JWT-based)
- **Real-time Communication**: WebSockets (Socket.IO)
- **Web Platform**: Next.js 14 with TypeScript (Vercel)
- **Infrastructure**: DigitalOcean App Platform
- **File Storage**: DigitalOcean Spaces (S3-compatible)
- **Email Service**: Resend (migrated from SendGrid)

### Hosting & Deployment
- **Website (fynlo.co.uk)**: Vercel deployment with automatic CI/CD from GitHub
- **Backend API**: DigitalOcean App Platform with automatic deployments
- **Database & Cache**: DigitalOcean Managed Databases (PostgreSQL + Valkey)
- **Mobile App**: Manual deployment to TestFlight (iOS)

## Authentication & User Flow

### Hybrid Authentication Architecture
The system uses a unique hybrid approach combining Supabase for authentication with DigitalOcean PostgreSQL for business data:

1. **User Registration** (Website Only)
   - Users MUST sign up through the website (fynlo.co.uk)
   - Mobile app has NO registration capability by design
   - During signup, users select a subscription plan:
     - **Alpha** (£0/month + 1%): Perfect for new restaurants & food trucks
       - Up to 500 transactions/month
       - Basic POS functions, QR ordering, digital receipts
       - Single location, single user account
     - **Beta** (£49/month + 1%): For growing restaurants  
       - Unlimited transactions, full kitchen display
       - Up to 5 staff accounts, 2 locations
       - Inventory management, Xero integration, priority support
     - **Omega** (£119/month + 1%): For restaurant groups & franchises
       - Unlimited everything, white-label options
       - Custom integrations, dedicated account manager
       - 24/7 phone support, advanced analytics
   - Supabase creates the authentication account with plan metadata
   - Verification email sent to confirm account

2. **Authentication Flow**
   ```
   Website Signup → Supabase Auth → Plan Selection → Email Verification
                            ↓
   Mobile App Login → Supabase Token → Backend API Verification
                            ↓
   PostgreSQL User Record Creation/Update → Feature Access Based on Plan
   ```

3. **Mobile App Login Process**
   - User enters website credentials in mobile app
   - App authenticates with Supabase, receives JWT token
   - Token sent to backend `/api/v1/auth/verify` endpoint
   - Backend validates token with Supabase
   - Creates/updates user record in PostgreSQL with subscription info
   - Returns feature flags based on subscription plan

### Multi-tenancy Model
```
Platform (Fynlo)
    ├── Restaurant A
    │   ├── Owner
    │   ├── Managers
    │   └── Employees
    └── Restaurant B
        ├── Owner
        ├── Managers
        └── Employees
```

Each restaurant is completely isolated with role-based access control (RBAC).

## Web Platform & Dashboard Connection

### Website (fynlo.co.uk)
- **Purpose**: Marketing, user registration, subscription management
- **Stack**: Next.js deployed on Vercel
- **Key Features**:
  - Landing pages and product information
  - User registration and subscription selection
  - Payment processing for subscriptions (Stripe integration)
  - Account management and billing
  - NO direct POS functionality (all POS features in mobile app)

### Management Dashboard
- **Access**: Web-based, responsive design
- **Authentication**: Same Supabase credentials as mobile app
- **Features**:
  - Restaurant configuration and settings
  - Staff management and permissions
  - Menu and inventory management
  - Sales reports and analytics
  - Multi-location management (Omega plan)

### Mobile App Connection
- Mobile app is the primary POS interface
- Real-time sync with dashboard via WebSockets
- Offline capability with sync when connection restored
- All business operations happen through the app

## Payment Processing

### Payment Methods & Fees
- **QR Code Payments**: 1.2% transaction fee (Fynlo's competitive advantage)
- **Card/Apple Pay**: 2.9% transaction fee (industry standard)
- **Cash**: 0% fee

### Fee Structure
- **Transaction Fees**: Platform-level, paid by customer on all plans
- **Service Charge**: Default 10%, configurable by restaurant
- **Platform Commission**: 1% on all transactions (included in subscription pricing)
- **VAT**: Restaurant-configurable based on location

## Current Issues & Challenges

### 1. iOS Bundle Building Issues
**Problem**: The most frequent issue is iOS bundle generation failing or producing corrupted bundles
**Symptoms**: 
- App crashes on launch
- White screen on startup
- "Unable to load script" errors
**Current Workaround**: Manual bundle rebuild using Metro bundler

### 2. WebSocket Connection Stability
**Problem**: WebSocket connections drop intermittently, especially on poor network conditions
**Impact**: 
- Orders may not update in real-time
- Kitchen display system delays
- Staff must manually refresh to see updates
**Missing**: Proper reconnection logic with exponential backoff

### 3. Authentication Token Refresh
**Problem**: Supabase tokens expire but refresh isn't always handled gracefully
**Symptoms**:
- Users randomly logged out
- API calls fail with 401 errors
- Need to force close and reopen app

### 4. Multi-tenant Data Isolation
**Concern**: While implemented, needs thorough security testing
**Risk Areas**:
- Cross-tenant data leakage
- Restaurant ID validation on all endpoints
- Proper scoping of database queries

### 5. Offline Mode Limitations
**Current State**: Basic offline capability exists but unreliable
**Issues**:
- Sync conflicts when coming back online
- Incomplete order data preservation
- No queue management for failed API calls

### 6. Performance Issues
**Backend**:
- N+1 query problems in order listing
- Missing database indexes on frequently queried fields
- Redis/Valkey underutilized for caching

**Mobile**:
- Large menu lists cause UI lag
- Image loading not optimized
- Memory leaks in long-running sessions

### 7. Testing Coverage
**Current State**: Limited test coverage across the stack
**Missing**:
- Integration tests for critical workflows
- End-to-end payment flow tests
- Multi-tenant isolation tests
- Performance/load testing
- Security vulnerability testing

### 8. Deployment Challenges
**iOS**: 
- Manual process, no CI/CD pipeline
- Frequent bundle building issues requiring manual intervention
- No automated testing before deployment

**Backend**: 
- DigitalOcean App Platform deployment works but lacks staging environment
- Environment variable management complex across environments
- No blue-green deployment strategy

**Database**: 
- No automated backup testing
- Manual migration process
- Missing disaster recovery procedures

### 9. Real-time Features
**WebSocket Issues**:
- 15-second heartbeat pattern not consistently implemented
- Missing exponential backoff on reconnection
- No message queuing for offline periods
- Connection drops on network changes

### 10. Platform Settings Migration
**Current State**: Settings scattered across database tables
**Planned**: Centralized platform_settings table but not yet implemented
**Impact**: Difficult to manage platform-wide configurations

## Development Workflow

### Environment Setup
1. **Backend**: Requires Python 3.11+, PostgreSQL, Valkey/Redis
2. **Mobile**: Requires Xcode 14+, Node.js 18+, CocoaPods
3. **Web**: Requires Node.js 18+, Vercel CLI

### Key Development Patterns
- **API Responses**: Standardized via APIResponseHelper
- **Error Handling**: Custom FynloException with proper status codes
- **Money Handling**: Always use DECIMAL(10,2) for monetary values
- **State Management**: Zustand for mobile app state
- **Real-time Updates**: WebSocket events for order/kitchen updates

### Security Considerations
- All API endpoints require authentication
- Restaurant isolation enforced at database level
- Input sanitization for SQL injection prevention
- Rate limiting on all public endpoints
- HTTPS enforced everywhere
- Secrets management via environment variables

## Future Roadmap & Missing Features

### High Priority
1. Android app development
2. Proper offline mode with conflict resolution
3. Automated iOS deployment pipeline
4. Comprehensive test suite
5. WebSocket reconnection improvements

### Medium Priority
1. Advanced analytics dashboard
2. Third-party integrations (accounting, suppliers)
3. Custom reporting tools
4. Multi-language support
5. Dark mode for night shifts

### Nice to Have
1. Voice ordering integration
2. AI-powered demand forecasting
3. Customer loyalty programs
4. Social media integration
5. Automated inventory reordering

## Known Limitations

1. **Single Currency**: Currently GBP only
2. **Time Zones**: UTC assumed, no multi-timezone support
3. **Localization**: English only
4. **Payment Providers**: Limited to current integrations
5. **Scaling**: Not tested beyond 50 concurrent users per restaurant
6. **Backup**: Manual process, no point-in-time recovery

## Support & Monitoring

### Current State
- Basic error logging to console/files
- No centralized logging system
- Manual monitoring of services
- No alerting system

### Needed Improvements
- Centralized logging (ELK stack or similar)
- Application Performance Monitoring (APM)
- Automated alerting for critical issues
- Customer support ticket system
- Status page for service health

## Repository Structure

```
cashapp-fynlo/
├── CashApp-iOS/          # React Native mobile app
│   ├── CashAppPOS/       # Main app directory
│   ├── ios/              # iOS specific code
│   └── android/          # Android specific code (planned)
├── backend/              # FastAPI backend
│   ├── app/              # Application code
│   ├── alembic/          # Database migrations
│   └── scripts/          # Utility scripts
├── web-platform/         # Next.js website & dashboard
│   ├── src/              # Source code
│   └── supabase/         # Supabase configuration
├── shared/               # Shared TypeScript types
└── docs/                 # Documentation

```

## Critical Configuration Notes

### Environment Variables
The system uses multiple `.env` files across different components:
- Backend requires ~30+ environment variables
- Supabase credentials must match between backend and mobile app
- DigitalOcean database URLs require SSL certificates
- Valkey connection requires Redis-compatible client

### Database Architecture
- Uses UUID primary keys throughout
- Multi-tenant isolation via restaurant_id foreign keys
- Monetary values stored as DECIMAL(10,2)
- Timezone handling assumes UTC

### Payment Provider Integration
- **SumUp**: Primary card payment provider (UK market)
- **Stripe**: Secondary provider (planned)
- **QR Payments**: Custom implementation with 1.2% fee
- All payment processing happens server-side for security

## Getting Started

### Prerequisites
- Node.js 18+
- Python 3.11+
- PostgreSQL 15+
- Redis/Valkey
- Xcode 14+ (for iOS development)
- Cocoapods

### Quick Start
1. Clone the repository
2. Set up environment variables (see `.env.example` files)
3. Install dependencies:
   ```bash
   # Backend
   cd backend && python -m venv venv && source venv/bin/activate
   pip install -r requirements.txt

   # Mobile app
   cd CashApp-iOS/CashAppPOS && npm install
   cd ios && pod install

   # Web platform
   cd web-platform && npm install
   ```

### Known Setup Issues
- iOS bundle must be built manually first time
- Supabase local development requires Docker
- DigitalOcean SSL certificates needed for production database
- Metro bundler port conflicts common

This README reflects the current state of the Fynlo POS system as of January 2025. The platform is functional but requires significant improvements in reliability, testing, and operational tooling before it's ready for large-scale production use. The codebase shows signs of rapid development with technical debt that needs addressing before scaling.