# How to Create Your Admin Account with Supabase

## Overview
Since we've migrated to Supabase authentication, you need to create your admin account in Supabase first, then link it to the Fynlo POS system as a platform owner.

## Step 1: Create Your Supabase User Account

### Option A: Using Supabase Dashboard (Easiest)
1. Go to your Supabase project: https://supabase.com/dashboard/project/eweggzpvuqczrrrwszyy
2. Navigate to **Authentication** → **Users**
3. Click **"Add user"** → **"Create new user"**
4. Enter:
   - Email: `admin@fynlo.co.uk` (or your preferred admin email)
   - Password: Choose a strong password
   - Click "Create user"
5. Note the User UID that's generated (you'll need this)

### Option B: Using the Mobile App Sign Up (If Implemented)
If the sign-up flow is implemented in the app, you can:
1. Open the Fynlo POS app
2. Tap "Sign Up" on the login screen
3. Enter your email and password
4. Complete registration

### Option C: Using Supabase SQL Editor
1. Go to Supabase Dashboard → SQL Editor
2. Run this query:
```sql
-- Create auth user
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
) VALUES (
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@fynlo.co.uk',
  crypt('your-password-here', gen_salt('bf')),
  now(),
  now(),
  now(),
  '',
  '',
  '',
  ''
);
```

## Step 2: Link User as Platform Owner in Backend Database

Once you have created the Supabase user, you need to link it as a platform owner in your backend database.

### Using the Backend API Test Script

1. First, get your Supabase user token:
```bash
cd backend
python get_supabase_token.py
# Enter your email and password when prompted
# Copy the access token that's displayed
```

2. Create the platform owner user:
```bash
# You'll need to create a script or use the API directly
# Here's a sample curl command:
curl -X POST https://api.fynlo.co.uk/api/v1/auth/verify \
  -H "Authorization: Bearer YOUR_SUPABASE_TOKEN" \
  -H "Content-Type: application/json"
```

### Using Direct Database Access (If Available)

If you have direct database access, you can manually insert/update:

```sql
-- First, check if user exists
SELECT * FROM users WHERE email = 'admin@fynlo.co.uk';

-- If user exists, update to platform owner
UPDATE users 
SET 
  role = 'platform_owner',
  supabase_id = 'YOUR-SUPABASE-USER-ID',
  auth_provider = 'supabase',
  is_active = true
WHERE email = 'admin@fynlo.co.uk';

-- If user doesn't exist, create it
INSERT INTO users (
  id,
  email,
  full_name,
  role,
  supabase_id,
  auth_provider,
  is_active,
  created_at,
  updated_at
) VALUES (
  gen_random_uuid(),
  'admin@fynlo.co.uk',
  'Platform Administrator',
  'platform_owner',
  'YOUR-SUPABASE-USER-ID',
  'supabase',
  true,
  now(),
  now()
);
```

## Step 3: First Login to Mobile App

1. Open the Fynlo POS app
2. On the login screen, enter:
   - Email: `admin@fynlo.co.uk` (or the email you used)
   - Password: Your Supabase password
3. Tap "Sign In"

The app will:
1. Authenticate with Supabase
2. Get your access token
3. Verify with the backend API
4. Create/update your user record
5. Log you in as platform owner

## Troubleshooting

### "Invalid credentials" error
- Verify email and password are correct
- Check that user exists in Supabase Dashboard → Authentication → Users
- Ensure no typos in email address

### "User not found" after Supabase login
- The backend might not have your user record yet
- The `/auth/verify` endpoint should create it automatically
- Check backend logs for errors

### "Network request failed"
- Ensure backend is running: `https://api.fynlo.co.uk/health`
- Check internet connection
- Verify API URL in mobile app configuration

### Role is not platform_owner
- User might be created as regular user
- Need to manually update role in database
- Or use platform owner email from .env file

## Quick Test Commands

Test if your credentials work:
```bash
# From backend directory
cd backend
python get_supabase_token.py
# Enter: admin@fynlo.co.uk
# Enter: your-password
# Should return an access token
```

Test the verify endpoint:
```bash
# Use the token from above
curl -X POST https://api.fynlo.co.uk/api/v1/auth/verify \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json"
```

## Important Notes

1. **First User = Platform Owner**: If your backend is configured with `PLATFORM_OWNER_EMAIL=admin@fynlo.co.uk`, then the first user with this email will automatically become the platform owner.

2. **Password Security**: Use a strong password - Supabase enforces minimum 6 characters by default.

3. **Email Verification**: By default, Supabase might require email verification. You can disable this in Supabase Dashboard → Authentication → Providers → Email → Disable "Confirm email".

4. **Session Duration**: Sessions last 1 hour by default, with automatic refresh.

## Next Steps After Login

Once logged in as platform owner, you can:
- Access platform dashboard
- Manage restaurants
- Configure platform settings
- Monitor all restaurant activities
- Manage platform users

---

If you encounter any issues, check:
1. Backend logs for API errors
2. Supabase Dashboard → Logs for auth errors
3. Mobile app console for network errors