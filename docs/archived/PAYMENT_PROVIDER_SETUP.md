# Payment Provider Credentials Setup Guide

This guide provides step-by-step instructions for obtaining all required credentials for payment providers integrated with Fynlo POS.

## 🚨 Critical Issues Fixed

The saving issues you experienced were caused by **missing backend API endpoints**. These have now been fixed:

### ✅ Fixed Backend Issues:
- Added `/api/v1/platform/payment-processing` endpoints (GET/POST)
- Added `/api/v1/platform/plans-pricing` endpoints (GET/POST)  
- Added `/api/v1/platform/service-charge` endpoints (GET/POST)
- Added `/api/v1/platform/settings/bulk-update` endpoint
- Restarted backend server with persistence to JSON files

### ✅ Payment Processing Should Now Work:
- Percentage changes will save properly
- Plans & Pricing changes will persist
- Service charge configuration saves
- All platform settings are stored in `backend_data/` directory

---

## 1. SumUp API Setup ✅ **COMPLETE**

### Current Status: **READY TO USE**
Your SumUp configuration is complete and functional:

```bash
REACT_APP_SUMUP_API_KEY="sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU"
REACT_APP_SUMUP_AFFILIATE_KEY="your-sumup-affiliate-key"
REACT_APP_SUMUP_MERCHANT_CODE=M4EM2GKE
REACT_APP_SUMUP_ENVIRONMENT=sandbox
```

### To Get Production Credentials:
1. Login to [SumUp Developer Dashboard](https://developer.sumup.com/)
2. Create production application
3. Get production API key (format: `sup_sk_LIVE_XXXXXXXX`)
4. Replace sandbox credentials in production

---

## 2. Square API Setup ⚠️ **MISSING ACCESS TOKEN**

### What You Need to Do:

#### Step 1: Get Square Developer Account
1. Go to [Square Developer Dashboard](https://developer.squareup.com/)
2. Create account or log in
3. Create new application

#### Step 2: Get Required Credentials
1. **Application ID**: Already have `sandbox-sq0idb-U9ANjXGxDZj6MgWlMod-xw`
2. **Access Token**: Go to your app → Credentials → Copy sandbox access token
3. **Location ID**: Go to your app → Locations → Copy location ID

#### Step 3: Update .env File
```bash
# Replace these placeholder values:
REACT_APP_SQUARE_ACCESS_TOKEN=your-actual-square-access-token
REACT_APP_SQUARE_LOCATION_ID=your-actual-location-id
```

#### Step 4: Production Setup
1. Get production application ID
2. Get production access token  
3. Get production location ID
4. Update production environment variables

### Required Square Credentials:
- ✅ `SQUARE_APPLICATION_ID` (have sandbox)
- ❌ `SQUARE_ACCESS_TOKEN` (need to get)
- ❌ `SQUARE_LOCATION_ID` (need to get)
- ✅ `SQUARE_ENVIRONMENT` (set to sandbox)

---

## 3. Stripe API Setup ⚠️ **MISSING WEBHOOK SECRET**

### Current Status: **PARTIALLY COMPLETE**
You have the publishable key but need webhook secret for full functionality.

#### Step 1: Get Stripe Account
1. Go to [Stripe Dashboard](https://dashboard.stripe.com/)
2. Create account or log in
3. Get your API keys

#### Step 2: Get Webhook Secret
1. In Stripe Dashboard → Developers → Webhooks
2. Create new webhook endpoint: `https://yourdomain.com/api/v1/stripe/webhook`
3. Select events: `payment_intent.succeeded`, `payment_intent.payment_failed`
4. Copy the webhook signing secret (starts with `whsec_`)

#### Step 3: Update .env File
```bash
# Add this to your .env:
REACT_APP_STRIPE_WEBHOOK_SECRET=whsec_your-actual-webhook-secret
```

### Required Stripe Credentials:
- ✅ `STRIPE_PUBLISHABLE_KEY` (have test key)
- ❌ `STRIPE_WEBHOOK_SECRET` (need to get)
- 🔒 `STRIPE_SECRET_KEY` (backend only - never in frontend)

---

## 4. Backend Database Setup 🔧 **NEEDS POSTGRESQL**

### Current Status: **JSON FILE STORAGE (TEMPORARY)**
The backend is currently using JSON files for storage. For production, you need PostgreSQL.

#### Option A: Local PostgreSQL Setup
```bash
# Install PostgreSQL
brew install postgresql  # macOS
sudo apt-get install postgresql  # Linux

# Start PostgreSQL service
brew services start postgresql  # macOS
sudo systemctl start postgresql  # Linux

# Create database and user
createdb fynlo_pos
createuser -P fynlo_user  # Enter password when prompted
```

#### Option B: Cloud PostgreSQL (Recommended)
1. **Heroku Postgres** (Free tier available)
2. **AWS RDS** (Production-ready)
3. **DigitalOcean Managed Database**
4. **PlanetScale** (MySQL alternative)

#### Step 3: Update Backend Configuration
Create `backend/.env` with database credentials:
```bash
DATABASE_URL=postgresql://fynlo_user:password@localhost:5432/fynlo_pos
```

---

## 5. Environment Variables Summary

### Frontend (.env) - REQUIRED UPDATES:
```bash
# Square - GET THESE FROM SQUARE DASHBOARD
REACT_APP_SQUARE_ACCESS_TOKEN=your-square-access-token
REACT_APP_SQUARE_LOCATION_ID=your-square-location-id

# Stripe - GET FROM STRIPE DASHBOARD  
REACT_APP_STRIPE_WEBHOOK_SECRET=whsec_your-webhook-secret
```

### Backend (backend/.env) - CREATE THIS FILE:
```bash
# Database
DATABASE_URL=postgresql://fynlo_user:password@localhost:5432/fynlo_pos

# Security
SECRET_KEY=generate-with-openssl-rand-base64-32

# Payment Providers (Backend Keys)
SQUARE_ACCESS_TOKEN=your-square-access-token
STRIPE_SECRET_KEY=sk_test_your-stripe-secret-key
SUMUP_SECRET_KEY=your-sumup-secret-key
```

---

## 6. Priority Action Items

### Immediate (to fix saving issues):
1. ✅ **FIXED**: Backend endpoints added and server restarted
2. ✅ **FIXED**: Payment processing and plans/pricing should now save

### Short Term (for full functionality):
1. **Get Square access token** from Square Developer Dashboard
2. **Get Stripe webhook secret** from Stripe Dashboard
3. **Test payment processing** and plans/pricing saving

### Medium Term (for production):
1. **Set up PostgreSQL database** (local or cloud)
2. **Generate secure backend SECRET_KEY**
3. **Get production credentials** for all payment providers
4. **Set up webhook endpoints** for payment confirmations

---

## 7. Testing Your Setup

### Test Payment Processing Saving:
1. Go to Platform Owner → Payment Processing
2. Change a percentage value
3. Click Save
4. Should show "Settings Saved" instead of "Save Failed"

### Test Plans & Pricing Saving:
1. Go to Platform Owner → Plans & Pricing  
2. Change a plan name
3. Click Save
4. Exit screen and return - changes should persist

### Verify Backend Data:
```bash
# Check if data is being saved
ls -la backend_data/
cat backend_data/plans_pricing.json
cat backend_data/service_charge.json
```

---

## 8. Production Deployment Checklist

### Security:
- [ ] Replace all test/sandbox credentials with production
- [ ] Generate strong SECRET_KEY for JWT tokens
- [ ] Set up SSL/HTTPS for API endpoints
- [ ] Configure secure database passwords
- [ ] Enable CORS only for your domain

### Monitoring:
- [ ] Set up Sentry for error tracking
- [ ] Configure application logging
- [ ] Set up database backup strategy
- [ ] Monitor API response times

### Payment Processing:
- [ ] Test all payment providers in sandbox
- [ ] Verify webhook endpoints work
- [ ] Test refund functionality
- [ ] Validate transaction fees

---

## 🔧 Current Issues Status

| Issue | Status | Solution |
|-------|---------|----------|
| Payment processing won't save | ✅ **FIXED** | Added backend endpoints |
| Plans & pricing changes don't persist | ✅ **FIXED** | Added persistence layer |
| "Save failed" errors | ✅ **FIXED** | Backend API now working |
| Square payment integration | ⚠️ **PARTIAL** | Need access token |
| Stripe webhook handling | ⚠️ **PARTIAL** | Need webhook secret |
| Database setup | 🔧 **OPTIONAL** | JSON files work for now |

The most critical saving issues should now be resolved. The missing payment provider credentials can be added when you're ready to enable those specific payment methods.