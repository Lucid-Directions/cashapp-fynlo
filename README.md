# Fynlo POS - Multi-tenant Restaurant Point of Sale System

## Overview

Fynlo POS is a comprehensive, multi-tenant restaurant management system designed to modernize and streamline restaurant operations. The platform consists of a React Native mobile application for iOS (with planned Android support), a FastAPI backend, and a web-based management dashboard. It handles everything from order taking and payment processing to inventory management and real-time kitchen operations.

## Infrastructure Architecture

### Tech Stack
- **Mobile App**: React Native + TypeScript (iOS primary, Android planned)
- **Backend API**: FastAPI (Python) with async/await patterns
- **Database**: PostgreSQL (hosted on DigitalOcean)
- **Cache/Session Store**: Valkey (Redis-compatible, hosted on DigitalOcean)
- **Authentication**: Supabase Auth
- **Real-time Communication**: WebSockets
- **Web Platform**: Next.js (hosted on Vercel)
- **Infrastructure**: DigitalOcean App Platform

### Hosting & Deployment
- **Website (fynlo.com)**: Vercel deployment with automatic CI/CD from GitHub
- **Backend API**: DigitalOcean App Platform with automatic deployments
- **Database & Cache**: DigitalOcean Managed Databases (PostgreSQL + Valkey)
- **Mobile App**: Manual deployment to TestFlight (iOS)

## Authentication & User Flow

### Hybrid Authentication Architecture
The system uses a unique hybrid approach combining Supabase for authentication with DigitalOcean PostgreSQL for business data:

1. **User Registration** (Website Only)
   - Users MUST sign up through the website (fynlo.com)
   - Mobile app has NO registration capability by design
   - During signup, users select a subscription plan:
     - **Alpha** (£29.99/month): Basic POS, 500 orders, 5 staff, 50 menu items
     - **Beta** (£59.99/month): + Inventory, reports, 2000 orders, 15 staff, 200 items
     - **Omega** (£129.99/month): Enterprise, unlimited everything, API access
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

### Website (fynlo.com)
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
- **QR Code Payments**: 1.2% transaction fee
- **Card/Apple Pay**: 2.9% transaction fee
- **Cash**: 0% fee

### Fee Structure
- **Transaction Fees**: Set by platform, non-negotiable by restaurants
- **Service Charge**: Default 10%, restaurants can adjust
- **Platform Commission**: 1% on all transactions
- **VAT**: Restaurant-configurable

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
**Current State**: ~60% backend, ~40% frontend
**Missing**:
- Integration tests for critical workflows
- End-to-end payment flow tests
- Multi-tenant isolation tests
- Performance/load testing

### 8. Deployment Challenges
**iOS**: Manual process, no CI/CD pipeline
**Backend**: Works but no staging environment
**Database**: No automated backup testing

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

This README reflects the current state of the Fynlo POS system as of January 2025. The platform is functional but requires significant improvements in reliability, testing, and operational tooling before it's ready for large-scale production use.