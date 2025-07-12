# Supabase Integration - Next Steps

## ✅ What We've Completed

1. **Database Migration Applied**
   - Added `supabase_id` column to users table
   - Added `auth_provider` column (default: 'supabase')
   - Made `password_hash` nullable for Supabase auth
   - Created index on `supabase_id` for fast lookups

2. **Backend Ready**
   - Authentication middleware configured to validate Supabase tokens
   - All necessary code in place

3. **Scripts Created**
   - `verify_supabase_setup.py` - Check configuration
   - `apply_supabase_migration.py` - Applied the migration
   - `link_supabase_users.py` - Link Supabase users to database

## 🎯 What You Need to Do

### Option 1: Get Your Supabase User ID (Recommended)

Since you already have a Supabase account for arnaud@luciddirections.co.uk:

1. Run this command:
   ```bash
   cd backend
   python3 get_supabase_token.py
   ```

2. When prompted:
   - Enter email: arnaud@luciddirections.co.uk
   - Enter your actual Supabase password
   - Choose option 2 (Sign in existing user)

3. The script will show your Supabase ID and access token

4. Update the database with your Supabase ID:
   ```sql
   UPDATE users 
   SET supabase_id = 'YOUR-SUPABASE-ID-HERE'
   WHERE email = 'arnaud@luciddirections.co.uk';
   ```

### Option 2: Test with Mobile App

1. Sign in using the mobile app with your Supabase credentials
2. The backend `/api/v1/auth/verify` endpoint will:
   - Validate your Supabase token
   - Create a user record if needed
   - Link your Supabase ID automatically

### Option 3: Create a Test Account

If you want to test with a fresh account:

```bash
cd backend
python3 get_supabase_token.py
# Choose option 1 (Sign up new user)
# Use a test email like test@fynlopos.com
```

## 📱 Testing the Integration

Once a user is linked:

1. **Mobile App**: Sign in with Supabase credentials
2. **Backend**: Will accept the Supabase token
3. **Database**: User record will have the Supabase ID

## 🧹 Final Cleanup

After confirming everything works:

1. Remove mock authentication from `backend/app/main.py`:
   - Delete the `/api/v1/auth/login` endpoint (lines 213-243)
   - Delete the mock credentials

2. Update the mobile app to use real endpoints:
   - `/api/v1/auth/verify` instead of mock login

## 🚨 Important Notes

- **Your existing Supabase users are safe** - we haven't deleted or modified them
- **The database users are ready** - they just need to be linked to Supabase IDs
- **No duplicate users** - the system will match by email address
- **Passwords**: Database passwords are now optional since Supabase handles auth

## 🤔 Common Issues

### "Invalid credentials" Error
- Make sure you're using your actual Supabase password, not "test123"
- The password you use to sign into the mobile app

### "User doesn't exist in Supabase"
- You may need to create the user in Supabase first
- Use option 1 in `get_supabase_token.py` to sign up

### Mobile app can't authenticate
- Check that the backend is deployed with the new changes
- Verify the mobile app is sending the token in the Authorization header