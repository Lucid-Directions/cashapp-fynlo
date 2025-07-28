# Backend Supabase Authentication Setup

## Quick Start

### 1. Install Dependencies
```bash
cd backend
pip install -r requirements.txt
```

### 2. Configure Environment Variables
Add these to your `.env` file:
```
# Supabase Configuration
SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
SUPABASE_ANON_KEY=YOUR-ANON-KEY-FROM-SUPABASE-DASHBOARD
SUPABASE_SERVICE_ROLE_KEY=YOUR-SERVICE-ROLE-KEY-FROM-SUPABASE-DASHBOARD

# Platform Owner Email
PLATFORM_OWNER_EMAIL=admin@fynlo.co.uk
```

### 3. Run Database Migration
```bash
alembic upgrade head
```

This will add:
- `supabase_id` column to users table
- `auth_provider` column to track authentication method
- Make `password_hash` nullable
- Add subscription fields to restaurants table

### 4. Test the Integration

#### Option 1: Get a Supabase Token
```bash
python get_supabase_token.py
```
Follow the prompts to sign up or sign in a test user.

#### Option 2: Run the Test Suite
```bash
python test_supabase_auth.py
```
Replace `TEST_TOKEN` with the token from Option 1.

## What Changed?

### Authentication Flow
1. **Before**: JWT tokens created and validated locally
2. **After**: Supabase handles authentication, we validate their tokens

### User Creation
1. **Before**: Users created with password hash in our database
2. **After**: Users created in Supabase, linked via `supabase_id`

### Endpoints
- `/api/v1/auth/verify` - Verify Supabase token and get user info
- `/api/v1/auth/register-restaurant` - Create restaurant after signup

### Middleware
- `get_current_user()` now validates Supabase tokens
- All audit logging maintained
- Role-based access control unchanged

## Troubleshooting

### "Supabase client not initialized"
- Check that all three Supabase environment variables are set
- Ensure you've restarted the backend after adding them

### "Invalid token" errors
- Token may be expired (they last 1 hour by default)
- Get a fresh token using `get_supabase_token.py`

### "User not found in database"
- User exists in Supabase but not locally
- The `/verify` endpoint will auto-create local user records

## Next Steps
1. Test all protected endpoints with Supabase tokens
2. Update any frontend code to use Supabase authentication
3. Plan migration for existing users (they'll need to reset passwords)