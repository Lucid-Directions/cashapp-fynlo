### Implement Subscription Plans and Feature Gating

**Copy and paste this to Claude Code:**
```
Create subscription plan management and feature gating:

1. Create backend/app/models/subscriptions.py:
   
   class SubscriptionPlan(Base):
       __tablename__ = "subscription_plans"
       
       id = Column(Integer, primary_key=True)
       name = Column(String(50), unique=True, nullable=False)  # alpha, beta, omega
       display_name = Column(String(100), nullable=False)
       monthly_price = Column(DECIMAL(10, 2), nullable=False)
       features = Column(JSONB, default={})
       limits = Column(JSONB, default={})
       is_active = Column(Boolean, default=True)
       
   class PlanFeature(Base):
       __tablename__ = "plan_features"
       
       id = Column(Integer, primary_key=True)
       feature_key = Column(String(100), unique=True, nullable=False)
       feature_name = Column(String(255), nullable=False)
       description = Column(Text)
       category = Column(String(50))
       
   class PlanFeatureMapping(Base):
       __tablename__ = "plan_feature_mapping"
       
       plan_id = Column(Integer, ForeignKey("subscription_plans.id"), primary_key=True)
       feature_id = Column(Integer, ForeignKey("plan_features.id"), primary_key=True)
       is_enabled = Column(Boolean, default=True)
       limit_value = Column(Integer)

2. Create backend/app/core/feature_gate.py:
   
   FEATURE_KEYS = {
       # Basic POS Features (Alpha - all plans)
       'pos_basic': 'Basic POS functionality',
       'order_management': 'Order management',
       'basic_payments': 'Cash and card payments',
       'daily_reports': 'Daily sales reports',
       
       # Advanced Features (Beta and above)
       'inventory_management': 'Inventory tracking',
       'staff_management': 'Staff accounts and permissions',
       'advanced_reports': 'Advanced analytics and reports',
       'table_management': 'Table and section management',
       'customer_database': 'Customer management',
       
       # Premium Features (Omega only)
       'multi_location': 'Multiple restaurant locations',
       'api_access': 'API access for integrations',
       'custom_branding': 'Custom branding options',
       'priority_support': 'Priority customer support',
       'advanced_analytics': 'Advanced business intelligence',
       'unlimited_staff': 'Unlimited staff accounts',
   }
   
   def check_feature_access(restaurant_id: int, feature_key: str, db: Session) -> bool:
       """Check if a restaurant has access to a specific feature"""
       restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
       if not restaurant:
           return False
           
       # Get plan features from cache or database
       cache_key = f"plan:features:{restaurant.subscription_plan}"
       features = get_cached_data(cache_key)
       
       if not features:
           plan_features = db.query(PlanFeatureMapping).join(
               PlanFeature
           ).filter(
               PlanFeatureMapping.plan_id == restaurant.subscription_plan
           ).all()
           
           features = {pf.feature.feature_key: pf.is_enabled for pf in plan_features}
           cache_data(cache_key, features, ttl=3600)
       
       return features.get(feature_key, False)
   
   class FeatureGateMiddleware:
       """Middleware to check feature access"""
       def __init__(self, feature_key: str):
           self.feature_key = feature_key
           
       def __call__(self, request: Request, call_next):
           user = get_current_user(request)
           if not check_feature_access(user.restaurant_id, self.feature_key, get_db()):
               raise HTTPException(
                   status_code=403,
                   detail=f"This feature requires a higher subscription plan"
               )
           return call_next(request)

3. Create backend/app/api/v1/subscriptions.py:
   
   @router.get("/plans")
   async def get_subscription_plans(db: Session = Depends(get_db)):
       """Get all available subscription plans with features"""
       plans = db.query(SubscriptionPlan).filter(
           SubscriptionPlan.is_active == True
       ).all()
       
       result = []
       for plan in plans:
           features = db.query(PlanFeatureMapping).join(
               PlanFeature
           ).filter(
               PlanFeatureMapping.plan_id == plan.id,
               PlanFeatureMapping.is_enabled == True
           ).all()
           
           result.append({
               "id": plan.id,
               "name": plan.name,
               "display_name": plan.display_name,
               "monthly_price": float(plan.monthly_price),
               "features": [
                   {
                       "key": pf.feature.feature_key,
                       "name": pf.feature.feature_name,
                       "category": pf.feature.category,
                       "limit": pf.limit_value
                   } for pf in features
               ]
           })
       
       return result
   
   @router.get("/my-subscription")
   async def get_my_subscription(
       current_user: User = Depends(get_current_active_user),
       db: Session = Depends(get_db)
   ):
       """Get current user's subscription details"""
       restaurant = db.query(Restaurant).filter(
           Restaurant.id == current_user.restaurant_id
       ).first()
       
       if not restaurant:
           raise HTTPException(status_code=404, detail="Restaurant not found")
       
       plan = db.query(SubscriptionPlan).filter(
           SubscriptionPlan.name == restaurant.subscription_plan
       ).first()
       
       features = db.query(PlanFeatureMapping).join(
           PlanFeature
       ).filter(
           PlanFeatureMapping.plan_id == plan.id,
           PlanFeatureMapping.is_enabled == True
       ).all()
       
       return {
           "restaurant_id": restaurant.id,
           "plan": plan.name,
           "display_name": plan.display_name,
           "monthly_price": float(plan.monthly_price),
           "status": restaurant.subscription_status,
           "started_at": restaurant.subscription_started_at,
           "expires_at": restaurant.subscription_expires_at,
           "features": {
               pf.feature.feature_key: {
                   "enabled": True,
                   "limit": pf.limit_value
               } for pf in features
           }
       }

4. Update API endpoints with feature gates:
   
   # Example: Inventory endpoint only for Beta and Omega plans
   @router.get("/inventory", dependencies=[Depends(FeatureGateMiddleware("inventory_management"))])
   async def get_inventory(current_user: User = Depends(get_current_active_user)):
       # Inventory logic here
       pass
   
   # Example: Staff management only for Beta and Omega
   @router.post("/staff", dependencies=[Depends(FeatureGateMiddleware("staff_management"))])
   async def add_staff_member(current_user: User = Depends(get_current_active_user)):
       # Staff management logic
       pass

5. Create initial plan data script:
   
   # backend/scripts/setup_subscription_plans.py
   
   def setup_plans():
       plans_data = [
           {
               "name": "alpha",
               "display_name": "Alpha - Starter",
               "monthly_price": 29.99,
               "features": {
                   "orders_per_day": 100,
                   "staff_accounts": 2,
                   "basic_pos": True,
                   "basic_reports": True,
                   "payment_methods": ["cash", "card"]
               }
           },
           {
               "name": "beta",
               "display_name": "Beta - Professional", 
               "monthly_price": 59.99,
               "features": {
                   "orders_per_day": 500,
                   "staff_accounts": 5,
                   "all_alpha_features": True,
                   "inventory_management": True,
                   "table_management": True,
                   "advanced_reports": True,
                   "customer_database": True
               }
           },
           {
               "name": "omega",
               "display_name": "Omega - Enterprise",
               "monthly_price": 99.99,
               "features": {
                   "orders_per_day": "unlimited",
                   "staff_accounts": "unlimited",
                   "all_beta_features": True,
                   "multi_location": True,
                   "api_access": True,
                   "custom_branding": True,
                   "priority_support": True,
                   "advanced_analytics": True
               }
           }
       ]
       
       # Insert plans and features into database
       for plan_data in plans_data:
           # Create plan
           plan = SubscriptionPlan(
               name=plan_data["name"],
               display_name=plan_data["display_name"],
               monthly_price=plan_data["monthly_price"],
               features=plan_data["features"]
           )
           db.add(plan)
       
       db.commit()
```# Claude Code Implementation Guide - Backend & API Development

## Copy-Paste Instructions for Claude Code in Cursor

### Initial Setup Analysis

**Copy and paste this to Claude Code:**
```
I have a Fynlo POS system repository with the following structure:
- Backend: FastAPI with PostgreSQL (DigitalOcean managed database)
- Authentication: DigitalOcean OAuth (currently broken)
- Cache: Valkey (Redis fork) for session management
- Frontend: React Native mobile app

Please analyze the codebase and identify:
1. All platform owner functionality in the mobile app (screens, components, navigation)
2. Current authentication flow using DigitalOcean
3. Database schema related to platform owner features
4. Valkey cache usage patterns
5. Payment integration points (Sum Up, Stripe, QR, Cash)

Create a comprehensive list of files and features that need to be extracted from the mobile app.
```

### Update Authentication to Include Plan Information

**Copy and paste this to Claude Code:**
```
Update authentication to return user's subscription plan and features:

1. Update backend/app/api/v1/auth/login.py:
   
   @router.post("/login")
   async def login(credentials: LoginCredentials, db: Session = Depends(get_db)):
       # Authenticate user
       user = authenticate_user(db, credentials.email, credentials.password)
       if not user:
           raise HTTPException(status_code=401, detail="Invalid credentials")
       
       # Get user's restaurant and subscription info
       response_data = {
           "user": {
               "id": user.id,
               "email": user.email,
               "name": user.name,
               "is_platform_owner": user.is_platform_owner,
           },
           "access_token": create_access_token(user.id),
           "token_type": "bearer"
       }
       
       if user.is_platform_owner:
           # Platform owner gets full access
           response_data["user"]["role"] = "platform_owner"
       elif user.restaurant_id:
           # Get restaurant subscription details
           restaurant = db.query(Restaurant).filter(
               Restaurant.id == user.restaurant_id
           ).first()
           
           response_data["user"]["restaurant_id"] = restaurant.id
           response_data["user"]["restaurant_name"] = restaurant.name
           response_data["user"]["subscription_plan"] = restaurant.subscription_plan
           response_data["user"]["subscription_status"] = restaurant.subscription_status
           
           # Get enabled features for this plan
           features = get_plan_features(restaurant.subscription_plan, db)
           response_data["user"]["enabled_features"] = features
       
       return response_data

2. Create backend/app/api/v1/auth/me.py endpoint:
   
   @router.get("/me")
   async def get_current_user_info(
       current_user: User = Depends(get_current_active_user),
       db: Session = Depends(get_db)
   ):
       """Get current user info with subscription details"""
       user_data = {
           "id": current_user.id,
           "email": current_user.email,
           "name": current_user.name,
           "is_platform_owner": current_user.is_platform_owner,
       }
       
       if current_user.is_platform_owner:
           user_data["role"] = "platform_owner"
           user_data["permissions"] = "all"
       elif current_user.restaurant_id:
           restaurant = db.query(Restaurant).filter(
               Restaurant.id == current_user.restaurant_id
           ).first()
           
           user_data["restaurant"] = {
               "id": restaurant.id,
               "name": restaurant.name,
               "subscription": {
                   "plan": restaurant.subscription_plan,
                   "status": restaurant.subscription_status,
                   "expires_at": restaurant.subscription_expires_at
               }
           }
           
           # Get feature access
           user_data["features"] = get_user_features(current_user, db)
       
       return user_data
```

### Create Platform Owner API Module

**Copy and paste this to Claude Code:**
```
Create a new platform owner API module at backend/app/api/v1/platform/ with these files:

1. __init__.py:
   - Create platform_router with prefix="/platform"
   - Include all sub-routers

2. businesses.py - Create these endpoints:
   GET /platform/businesses - List all restaurants with filters
   GET /platform/businesses/{id} - Get specific restaurant details
   GET /platform/businesses/{id}/analytics - Restaurant analytics
   GET /platform/businesses/{id}/health - System diagnostics
   PATCH /platform/businesses/{id}/status - Update restaurant status

3. analytics.py - Create these endpoints:
   GET /platform/analytics/overview - Platform-wide metrics
   GET /platform/analytics/revenue - Revenue by payment method
   GET /platform/analytics/transactions - Transaction trends
   GET /platform/analytics/realtime - Real-time dashboard data

4. payment_settings.py - Create these endpoints:
   GET /platform/payment-methods - Get all payment configurations
   PATCH /platform/payment-methods/sumup - Update Sum Up settings
   PATCH /platform/payment-methods/stripe - Update Stripe settings
   PATCH /platform/payment-methods/qr - Update QR code settings
   PATCH /platform/payment-methods/cash - Update cash settings
   GET /platform/fees - Get all fee structures
   PATCH /platform/fees - Update platform fees

5. subscriptions.py - Create these endpoints:
   GET /platform/subscriptions/plans - List all plans
   POST /platform/subscriptions/plans - Create new plan
   PATCH /platform/subscriptions/plans/{id} - Update plan
   GET /platform/subscriptions/active - List active subscriptions
   PATCH /platform/subscriptions/{id}/plan - Change subscription plan

Use Valkey cache for all analytics endpoints with 5-minute TTL.
All endpoints must use the get_platform_owner dependency for authorization.
```

### Implement Valkey Cache Integration

**Copy and paste this to Claude Code:**
```
Update the Valkey (Redis) integration for platform owner features:

1. In backend/app/core/cache.py, add these cache functions:
   - cache_platform_analytics(key: str, data: dict, ttl: int = 300)
   - get_cached_analytics(key: str) -> Optional[dict]
   - invalidate_business_cache(business_id: int)
   - cache_payment_settings(settings: dict)

2. Create cache keys pattern:
   - platform:analytics:overview
   - platform:analytics:business:{id}
   - platform:payment:settings
   - platform:subscriptions:active

3. Implement cache warming for frequently accessed data
4. Add cache invalidation on data updates
5. Use Valkey pub/sub for real-time updates
```

### Database Schema Updates

**Copy and paste this to Claude Code:**
```
Create a new Alembic migration for platform owner features and subscription plans:

1. Update the users table:
   ALTER TABLE users ADD COLUMN is_platform_owner BOOLEAN DEFAULT FALSE;
   ALTER TABLE users ADD COLUMN platform_permissions JSONB DEFAULT '{}';

2. Update the restaurants table:
   ALTER TABLE restaurants ADD COLUMN subscription_plan VARCHAR(50) DEFAULT 'starter';
   ALTER TABLE restaurants ADD COLUMN subscription_status VARCHAR(50) DEFAULT 'trial';
   ALTER TABLE restaurants ADD COLUMN subscription_started_at TIMESTAMP;
   ALTER TABLE restaurants ADD COLUMN subscription_expires_at TIMESTAMP;
   ALTER TABLE restaurants ADD COLUMN payment_status VARCHAR(50) DEFAULT 'pending';

3. Create subscription plans table:
   CREATE TABLE subscription_plans (
       id SERIAL PRIMARY KEY,
       name VARCHAR(50) UNIQUE NOT NULL, -- 'alpha', 'beta', 'omega'
       display_name VARCHAR(100) NOT NULL,
       monthly_price DECIMAL(10,2) NOT NULL,
       features JSONB NOT NULL,
       limits JSONB NOT NULL,
       is_active BOOLEAN DEFAULT TRUE,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

4. Create plan features table:
   CREATE TABLE plan_features (
       id SERIAL PRIMARY KEY,
       feature_key VARCHAR(100) UNIQUE NOT NULL,
       feature_name VARCHAR(255) NOT NULL,
       description TEXT,
       category VARCHAR(50) -- 'pos', 'inventory', 'staff', 'analytics', 'reports'
   );

5. Create plan_feature_mapping table:
   CREATE TABLE plan_feature_mapping (
       plan_id INTEGER REFERENCES subscription_plans(id),
       feature_id INTEGER REFERENCES plan_features(id),
       is_enabled BOOLEAN DEFAULT TRUE,
       limit_value INTEGER, -- For features with limits (e.g., max staff accounts)
       PRIMARY KEY (plan_id, feature_id)
   );

6. Create platform tables:
   CREATE TABLE platform_settings (
       id SERIAL PRIMARY KEY,
       setting_key VARCHAR(255) UNIQUE NOT NULL,
       setting_value JSONB NOT NULL,
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE platform_payment_config (
       id SERIAL PRIMARY KEY,
       payment_method VARCHAR(50) NOT NULL,
       enabled BOOLEAN DEFAULT TRUE,
       transaction_fee DECIMAL(5,2) NOT NULL,
       settings JSONB DEFAULT '{}',
       updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

   CREATE TABLE platform_audit_log (
       id SERIAL PRIMARY KEY,
       user_id INTEGER REFERENCES users(id),
       action VARCHAR(255) NOT NULL,
       entity_type VARCHAR(100),
       entity_id INTEGER,
       details JSONB,
       created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
   );

7. Add indexes:
   CREATE INDEX idx_restaurants_subscription_plan ON restaurants(subscription_plan);
   CREATE INDEX idx_restaurants_subscription_status ON restaurants(subscription_status);
   CREATE INDEX idx_audit_log_user_id ON platform_audit_log(user_id);
   CREATE INDEX idx_audit_log_created_at ON platform_audit_log(created_at);
```

### WebSocket Implementation for Real-time Updates

**Copy and paste this to Claude Code:**
```
Create WebSocket support for real-time platform monitoring:

1. In backend/app/websockets/platform_ws.py:
   - Create WebSocketManager class for connection management
   - Implement authentication for WebSocket connections
   - Use Valkey pub/sub for broadcasting updates

2. Create endpoint:
   @app.websocket("/ws/platform/{token}")
   async def platform_websocket(websocket: WebSocket, token: str):
       # Verify token is for platform owner
       # Subscribe to Valkey channels:
       # - platform:updates:businesses
       # - platform:updates:transactions
       # - platform:updates:alerts
       # Broadcast updates every 5 seconds

3. Publish updates from business operations:
   - New order created
   - Payment processed
   - Business status changed
   - Error occurred
```

### Remove Platform Owner Code from Mobile App

**Copy and paste this to Claude Code:**
```
Remove platform owner functionality from the React Native app:

1. In CashApp-iOS/CashAppPOS/src/navigation/:
   - Remove PlatformOwnerNavigator.tsx
   - Update RootNavigator.tsx to remove platform owner routes
   - Simplify authentication flow in AuthNavigator.tsx

2. Delete these directories:
   - src/screens/PlatformOwner/
   - src/components/PlatformOwner/
   - src/services/platformOwner/

3. Update src/stores/authStore.ts:
   - Remove is_platform_owner checks
   - Remove platform owner state
   - Simplify login logic to only handle restaurant users

4. Update src/services/api/auth.ts:
   - Remove platform owner login flow
   - Update user type checking
   - Simplify token management

5. Clean up unused imports and dead code

Create a file REMOVED_PLATFORM_FEATURES.md documenting all removed functionality.
```

### Payment Integration Updates

**Copy and paste this to Claude Code:**
```
Update payment integrations to be configurable from platform API:

1. Create backend/app/services/payment_config.py:
   - Load payment settings from database
   - Cache settings in Valkey
   - Provide methods to get active payment methods
   - Calculate fees based on platform settings

2. Update payment processing endpoints to:
   - Check if payment method is enabled
   - Apply correct transaction fees
   - Log transactions to platform_audit_log
   - Publish updates via WebSocket

3. For Sum Up integration:
   - Store API credentials encrypted in platform_payment_config
   - Add webhook endpoint for Sum Up callbacks
   - Implement connection testing endpoint

4. For Stripe integration:
   - Store publishable and secret keys encrypted
   - Update webhook signature verification
   - Add platform fee to Stripe charges

5. For QR code payments:
   - Make QR generation configurable
   - Add platform branding options
   - Track QR payment conversions
```

### Testing Implementation

**Copy and paste this to Claude Code:**
```
Create comprehensive tests for platform functionality:

1. In backend/tests/test_platform/:
   
   test_auth.py:
   - Test platform owner authentication
   - Test regular user access denied
   - Test token refresh with Valkey
   
   test_businesses.py:
   - Test listing all businesses
   - Test filtering and pagination
   - Test business details access
   
   test_analytics.py:
   - Test analytics calculations
   - Test cache hit/miss scenarios
   - Test real-time data accuracy
   
   test_payment_settings.py:
   - Test payment method toggling
   - Test fee updates
   - Test configuration validation
   
   test_websocket.py:
   - Test WebSocket authentication
   - Test real-time message delivery
   - Test reconnection handling

2. Create integration tests:
   - Full platform owner login flow
   - End-to-end payment with fees
   - WebSocket subscription lifecycle
```

### Environment Configuration

**Copy and paste this to Claude Code:**
```
Update .env file with these variables:

# DigitalOcean
DO_OAUTH_CLIENT_ID=your_client_id
DO_OAUTH_CLIENT_SECRET=your_client_secret
DO_OAUTH_REDIRECT_URI=https://api.fynlo.co.uk/auth/callback
DO_SPACES_ACCESS_KEY=your_spaces_key
DO_SPACES_SECRET_KEY=your_spaces_secret

# Database (DigitalOcean Managed)
DATABASE_URL=postgresql://user:pass@your-do-db-cluster.db.ondigitalocean.com:25060/fynlo?sslmode=require

# Valkey Cache (Redis fork)
VALKEY_URL=redis://default:password@your-valkey-host:6379/0
VALKEY_CACHE_TTL=300

# Platform Settings
PLATFORM_OWNER_EMAIL=admin@fynlo.co.uk
PLATFORM_DASHBOARD_URL=https://fynlo.co.uk/dashboard
ENABLE_PLATFORM_FEATURES=true

# Payment Providers
SUMUP_API_KEY=encrypted_key
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
QR_PAYMENT_FEE=1.2
CARD_PAYMENT_FEE=2.9

# WebSocket
WS_HEARTBEAT_INTERVAL=30
WS_CONNECTION_TIMEOUT=60
```

### Deployment Configuration

**Copy and paste this to Claude Code:**
```
Update deployment configuration for DigitalOcean:

1. Create docker-compose.prod.yml:
   - Use DigitalOcean managed database
   - Connect to Valkey cache
   - Configure environment variables
   - Set up health checks

2. Update nginx configuration:
   - Add WebSocket support
   - Configure CORS for dashboard domain
   - Add rate limiting for platform endpoints
   - Enable SSL with Let's Encrypt

3. Create GitHub Actions workflow:
   - Build and test on push
   - Deploy to DigitalOcean App Platform
   - Run database migrations
   - Clear Valkey cache after deployment

4. Set up monitoring:
   - Configure DigitalOcean monitoring
   - Add custom metrics for platform usage
   - Set up alerts for errors
   - Monitor WebSocket connections
```

### Data Migration Script

**Copy and paste this to Claude Code:**
```
Create a migration script to set up initial platform data:

1. Create backend/scripts/setup_platform_owner.py:
   
   # Find or create platform owner user
   # Set is_platform_owner = True
   # Create default payment configurations:
   - Sum Up: enabled=True, fee=1.69
   - Stripe: enabled=True, fee=2.9
   - QR Code: enabled=True, fee=1.2
   - Cash: enabled=True, fee=0.0
   
   # Create default subscription plans:
   - Basic: £29/month
   - Standard: £59/month
   - Premium: £99/month
   
   # Initialize platform settings
   # Set up Valkey cache keys
   # Create audit log entry

2. Create rollback script in case of issues
3. Test in staging environment first
```

## Important Notes for Claude Code

1. **Always check existing code structure before making changes**
2. **Use DigitalOcean services (OAuth, Managed Database, Spaces) where already configured**
3. **Valkey is a Redis fork - use Redis client libraries but refer to it as Valkey in comments**
4. **Maintain backward compatibility for existing restaurant apps**
5. **Test WebSocket connections with DigitalOcean's load balancer configuration**
6. **Encrypt all sensitive payment provider credentials before storing**
7. **Use proper error handling and logging throughout**
8. **Follow the existing code style and patterns in the repository**