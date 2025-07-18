# Quick Guide: How to Login as Admin

## Current Status
The app now uses Supabase authentication. There are **3 ways** to create your admin account:

## Method 1: Use the App's Sign Up Screen (Easiest)
1. Open the Fynlo POS app
2. On the login screen, tap **"Sign Up"** at the bottom
3. Fill in the form:
   - **Personal Info**: Your name, email, phone, password, and a 4-digit PIN
   - **Business Info**: Your business details
4. Tap **"Create Account"**
5. This will create your account in Supabase and log you in

**Note**: The first user to sign up with the email `admin@fynlo.co.uk` (if that's set in your backend .env as PLATFORM_OWNER_EMAIL) will automatically become the platform owner.

## Method 2: Create Account in Supabase Dashboard
1. Go to: https://supabase.com/dashboard/project/eweggzpvuqczrrrwszyy/auth/users
2. Click **"Add user"** → **"Create new user"**
3. Enter:
   - Email: `admin@fynlo.co.uk`
   - Password: Your chosen password
4. Click **"Create user"**
5. Now use these credentials to login in the app

## Method 3: Quick Test - Use Existing Test Account
If you already created a test account during setup, just use those credentials in the app's login screen.

## Important Notes

### Platform Owner Setup
The backend determines who is a platform owner based on:
1. The email matching `PLATFORM_OWNER_EMAIL` in backend/.env file
2. OR being manually set as `role = 'platform_owner'` in the database

### First Time Login Process
When you log in for the first time:
1. App authenticates with Supabase
2. Gets your access token
3. Calls backend `/auth/verify` endpoint
4. Backend creates/updates your user record
5. Sets your role based on email or existing database entry
6. Returns your user info to the app

### Troubleshooting Login Issues

**"Invalid login credentials"**
- Double-check email and password
- Ensure no spaces before/after email
- Password is case-sensitive

**"Network request failed"**
- Check your internet connection
- Verify backend is running at: https://api.fynlo.co.uk
- Try: https://fynlopos-9eg2c.ondigitalocean.app/health

**App crashes or shows white screen**
- The app might be trying to use the backend API
- Check if your backend has Supabase credentials configured
- Try restarting the app

**You login but aren't a platform owner**
- Check backend .env file has correct PLATFORM_OWNER_EMAIL
- May need to manually update your role in the database

## Quick Database Check (If Needed)

If you have database access, you can check/fix your user:
```sql
-- Check if your user exists
SELECT * FROM users WHERE email = 'admin@fynlo.co.uk';

-- Make yourself platform owner
UPDATE users 
SET role = 'platform_owner' 
WHERE email = 'admin@fynlo.co.uk';
```

## Next Steps After Login

Once logged in as platform owner, you can:
- Access the platform dashboard
- Create and manage restaurants
- View all platform analytics
- Manage platform settings

---

**Quick Summary**: Just use the app's Sign Up screen to create your account - it's the easiest way! The app will handle everything else automatically.