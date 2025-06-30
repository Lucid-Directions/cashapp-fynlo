# CLAUDE.md

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