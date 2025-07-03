# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

RULES

1. First think through the problem, read the codebase for relevant files, and write a plan to tasks/todo.md.
2. The plan should have a list of todo items that you can check off as you complete them
3. Before you begin working, check in with me and I will verify the plan.
4. Then, begin working on the todo items, marking them as complete as you go.
5. Please every step of the way just give me a high level explanation of what changes you made
6. Make every task and code change you do as simple as possible. We want to avoid making any massive or complex changes. Every change should impact as little code as possible. Everything is about simplicity.
7. Finally, add a review section to the [todo.md](http://todo.md/) file with a summary of the changes you made and any other relevant information.


## Project Overview

Fynlo is a production-ready Point of Sale (POS) system designed for restaurants and retail businesses. It's a comprehensive full-stack application with dual frontend interfaces and a centralized backend API.

**Status**: 85% Production Ready with enterprise-grade performance metrics

## Technology Stack

### Backend (FastAPI + PostgreSQL on DigitalOcean)

- **Framework**: FastAPI with Python 3.9+
- **Database**: PostgreSQL 13+ on DigitalOcean with SQLAlchemy ORM + Alembic migrations
- **Caching**: Redis for sessions and performance optimization
- **Authentication**: JWT with refresh tokens and role-based access control
- **Payment Processing**: SumUp (primary), Square, QR codes, Stripe (fallback)
- **Real-time**: WebSocket server supporting 1000+ concurrent connections
- **Background Tasks**: Celery

### Dual Frontend Architecture

#### Platform Owner Interface (Fynlo Management Dashboard)

- **Multi-tenant platform dashboard** with real-time KPIs and analytics
- **Restaurant management** with status monitoring and subscription management
- **System monitoring** including API health, database status, payment gateway monitoring
- **Cross-restaurant analytics** and performance benchmarking

#### Restaurant Side Interface (Individual POS Operations)

- **Framework**: React Native 0.72.17 with TypeScript
- **State Management**: Zustand with AsyncStorage persistence
- **Navigation**: React Navigation v6
- **Enhanced POS features**: Menu management, order processing, table management
- **Employee management**: Time clock, scheduling, payroll integration
- **Customer management**: Loyalty programs, purchase history
- **Development**: Node.js 18+ required

## Common Development Commands

### Backend Commands
```bash
# Setup and run backend
cd cashapp-fynlo/backend
pip install -r requirements.txt
alembic upgrade head
uvicorn app.main:app --reload

# Database migrations
alembic revision --autogenerate -m "description"
alembic upgrade head

# Testing
pytest tests/ -v
pytest tests/test_auth.py -v
```

### Frontend Commands  
```bash
# Setup and run React Native app
cd cashapp-fynlo/CashApp-iOS/CashAppPOS
npm install
cd ios && pod install && cd ..
npm start                    # Start Metro
npm run ios                  # Run on iOS
npm run android              # Run on Android

# Development utilities
npm run lint                 # ESLint
npm test                     # Jest tests
npm run clean               # Clean build artifacts
npm run clean:all           # Full clean + reinstall
```

## Architecture Overview

### Backend Architecture
The backend follows clean architecture principles with:
- **API Layer**: FastAPI with standardized response format via APIResponseHelper
- **Business Logic**: Pydantic models with comprehensive validation
- **Database Layer**: SQLAlchemy ORM with PostgreSQL
- **Security**: JWT authentication, input sanitization, role-based access
- **Multi-tenancy**: Platform supports multiple restaurants

### Frontend Architecture

#### Platform Owner Dashboard
- **Real-time monitoring**: Live KPIs, revenue tracking, restaurant status
- **Multi-tenant management**: Restaurant onboarding, subscription tiers, performance analytics
- **System oversight**: API health, database monitoring, payment gateway status

#### Restaurant POS Interface
- **Component-Based**: Modular React Native components
- **State Management**: AuthContext + Zustand stores
- **Navigation**: Nested navigators for complex app flows
- **Error Handling**: Error boundaries and graceful fallbacks
- **Offline Support**: Local storage with sync capabilities
- **Real-time synchronization**: Live order updates, kitchen displays, management dashboards

### Database Models
Key entities include:
- Users → Authentication & Authorization
- Restaurants → Multi-tenant restaurant management
- Products & Categories → Menu management
- Orders & Payments → Transaction processing
- Sections & Tables → Floor plan management
- POS Sessions → Session state management

## Key Features

### Core POS Functionality
- Order management (create, modify, track)
- Payment processing (QR codes, cards, cash, Apple Pay)
- Menu management (products, categories, modifiers)
- Table management (floor plans, sections)
- User management (multi-role authentication)
- Restaurant configuration

### Payment Processing Hierarchy (Priority Order)

**ALWAYS use SumUp as primary, others as fallback only**

1. **SumUp (Primary - Best Rates)**
   - 0.69% + £19/month for volumes >£2,714/month
   - 1.69% for lower volumes
   - Smart routing based on monthly volume analysis

2. **Square (Secondary Fallback)**
   - 1.75% flat rate
   - iOS SDK integration with native payment processing

3. **QR Payment (Third Option)**
   - 1.2% fee (Fynlo's competitive advantage)
   - Open Banking integration
   - Automatic fallback if declined

4. **Stripe (Last Resort Fallback)**
   - 1.4% + 20p per transaction
   - Complete PaymentIntent API with 3D Secure support
   - Only use when other methods fail

Additional Methods:
- **Apple Pay**: Native iOS wallet integration with merchant validation
- **Cash**: Traditional handling with digital till operations (0% fee)
- **Split Payments**: Multiple payment methods per order supported

## Environment Configuration

### Backend Environment Variables

```bash
# DigitalOcean Database
DATABASE_URL=postgresql://user:pass@digitalocean-cluster/fynlo_pos

# Redis Cache (DigitalOcean)
REDIS_URL=redis://digitalocean-redis:6379

# Authentication
SECRET_KEY=your-secret-key-here
ACCESS_TOKEN_EXPIRE_MINUTES=30

# Payment Processing (Priority Order)
SUMUP_API_KEY=your-sumup-key
SUMUP_MERCHANT_ID=your-merchant-id
SQUARE_APPLICATION_ID=your-square-app-id
SQUARE_ACCESS_TOKEN=your-square-token
QR_PAYMENT_FEE_PERCENTAGE=1.2
STRIPE_SECRET_KEY=sk_test_...  # Fallback only

# Platform Settings
PLATFORM_FEE_PERCENTAGE=0.5
HIGH_VOLUME_THRESHOLD=2714  # Monthly threshold for SumUp rate tiers

# Debug
DEBUG=true
```

## Development Notes

### Code Quality Standards
- TypeScript for all frontend code
- Pydantic models for backend validation
- Comprehensive error handling with FynloException patterns
- Input sanitization (removes dangerous characters: `<>'"();)&+`)
- DECIMAL precision for financial calculations

### Database Considerations
- Use Alembic for all schema changes
- JSONB validation for restaurant configuration
- DigitalOcean PostgreSQL 13+ with optimized indexing
- Multi-tenant data isolation with platform → restaurant → user hierarchy
- Performance metrics: 1.20ms average query time (24x better than industry standard)
- ACID compliance with automated backup procedures

### Testing Requirements
- Backend: pytest with comprehensive test coverage
- Frontend: Jest with React Native Testing Library
- Security: Regular dependency audits with `npm audit`

### Production Performance Metrics
The system has achieved enterprise-grade performance:
- **API Response Times**: 4.29ms average (23x better than industry standard)
- **Database Query Performance**: 1.20ms average (24x better than industry standard)
- **WebSocket Delivery**: Sub-50ms message delivery
- **Concurrent Users**: 1000+ simultaneous connections supported
- **Cache Hit Rate**: 90%+ with 70% query reduction through Redis
- **Security Score**: 90% OWASP Top 10 compliance with zero critical vulnerabilities

## Project Structure

```
/cashapp-fynlo/
├── backend/                 # FastAPI Backend
│   ├── app/                 # Main application code
│   ├── alembic/             # Database migrations
│   └── requirements.txt     # Python dependencies
├── CashApp-iOS/CashAppPOS/  # React Native Frontend
│   ├── src/                 # TypeScript source code
│   ├── ios/                 # iOS-specific files
│   ├── android/             # Android-specific files
│   └── package.json         # Node.js dependencies
├── addons/                  # Odoo-style addon system
│   ├── account/             # Accounting functionality
│   ├── point_of_sale/       # POS-specific features
│   └── payment/             # Payment processing
└── docs/                    # Project documentation
```

## Deployment Commands

### Backend Production
```bash
pip install -r requirements.txt
alembic upgrade head
gunicorn app.main:app --workers 4 --bind 0.0.0.0:8000
```

### Frontend Production
```bash
# iOS Release
cd ios && xcodebuild -workspace CashAppPOS.xcworkspace -scheme CashAppPOS -configuration Release

# Android Release
cd android && ./gradlew assembleRelease
```

## Special Considerations

### Payment Processing Priority

- **ALWAYS use SumUp first** - it's the primary payment provider
- **Smart routing**: Automatic provider selection based on transaction volume and restaurant's monthly threshold
- **Cost optimization**: System calculates cheapest provider for each transaction
- **Intelligent fallback**: Square → QR → Stripe in that order if SumUp fails

### Dual Frontend Architecture

- **Platform Owner Dashboard**: Real-time monitoring of all restaurants, subscription management, system oversight
- **Restaurant POS Interface**: Individual restaurant operations, employee management, customer management
- **Automatic synchronization**: When new restaurant is added on either side, both interfaces update automatically

### DigitalOcean Infrastructure

- Database and Redis hosted on DigitalOcean clusters
- Optimized for high-performance with sub-5ms response times
- Multi-tenant architecture with strict data isolation
- Automated backup and failover procedures

### Enterprise-Grade Requirements

- Handle all financial calculations with DECIMAL precision
- Real-time WebSocket management for 1000+ concurrent connections
- PCI DSS compliance ready for payment processing
- OWASP Top 10 security compliance
- Mobile-first design optimized for restaurant tablet environments
