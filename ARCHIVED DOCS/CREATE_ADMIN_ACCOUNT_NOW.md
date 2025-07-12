# Create Your Admin Account - Quick Steps

## Step 1: Create User in Supabase Dashboard

1. **Go to your Supabase Dashboard**:
   https://supabase.com/dashboard/project/eweggzpvuqczrrrwszyy/auth/users

2. **Click "Add user" → "Create new user"**

3. **Enter your details**:
   - Email: `sleepyarno@gmail.com`
   - Password: Choose a password (minimum 6 characters)
   - Auto Confirm Email: ✅ Check this box

4. **Click "Create user"**

## Step 2: Update Backend Configuration

Add to your `backend/.env` file:
```
# Your email as platform owner
PLATFORM_OWNER_EMAIL=sleepyarno@gmail.com
```

## Step 3: Test Login in App

1. **Rebuild and run the app** (I just rebuilt the bundle to fix the input errors)
2. **On login screen**:
   - Email: sleepyarno@gmail.com
   - Password: [password you created]
3. **Tap "Sign In"**

## What Happens Next

When you log in:
1. App authenticates with Supabase ✅
2. Gets your authentication token ✅
3. Calls backend to verify token ✅
4. Backend creates you as platform_owner (because email matches PLATFORM_OWNER_EMAIL) ✅
5. You're logged in as admin! ✅

## If Login Still Fails

**Check these things**:
1. Backend is running at: https://api.fynlo.co.uk or https://fynlopos-9eg2c.ondigitalocean.app
2. Backend has Supabase credentials in .env
3. Your email matches PLATFORM_OWNER_EMAIL in backend .env

## No GitHub Integration Needed!

- Supabase works independently
- GitHub integration is only for CI/CD, not authentication
- Your app already has the connection configured