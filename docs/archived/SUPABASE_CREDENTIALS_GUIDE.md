# Step-by-Step Guide: Getting Supabase Credentials for Fynlo POS

## Overview
This guide provides detailed instructions for obtaining the three critical credentials needed from your Supabase dashboard:
1. **Project URL** - Your unique Supabase project endpoint
2. **Anon Key** - Public key for client-side authentication
3. **Service Role Key** - Secret key for backend admin operations

## Prerequisites
- Access to your Supabase project dashboard
- Project should already be created (you mentioned you have one ready)

## Step 1: Access Your Supabase Dashboard

1. Go to [https://supabase.com/dashboard](https://supabase.com/dashboard)
2. Sign in with your Supabase account
3. Select your Fynlo project from the list of projects

## Step 2: Get Your Project URL

1. Once in your project dashboard, look at the left sidebar
2. Click on **"Settings"** (gear icon at the bottom)
3. Click on **"API"** in the settings submenu
4. In the **"Project URL"** section, you'll see your URL:
   ```
   https://YOUR-PROJECT-ID.supabase.co
   ```
5. **Copy this entire URL** - this is your `SUPABASE_URL`

### What to look for:
- The URL format should be: `https://[random-string].supabase.co`
- Make sure to copy the full URL including `https://`
- This URL is unique to your project

## Step 3: Get Your Anon (Public) Key

1. Stay on the same **Settings → API** page
2. Scroll down to the **"Project API keys"** section
3. You'll see two keys listed:
   - **anon public** (this is what we need)
   - **service_role secret** (we'll get this next)
4. Next to the **anon public** key, click the **"Copy"** button
5. This is your `SUPABASE_ANON_KEY`

### What to look for:
- This is a long string (200+ characters) starting with `eyJ...`
- It's safe to use in client-side code (mobile app)
- You might see it labeled as "anon key" or "anon public"

## Step 4: Get Your Service Role Key

⚠️ **IMPORTANT SECURITY NOTE**: This key has full admin access. Never expose it in client-side code!

1. Still on the **Settings → API** page
2. In the **"Project API keys"** section
3. Find the **service_role secret** key
4. Click **"Reveal"** button (you may need to confirm)
5. Once revealed, click the **"Copy"** button
6. This is your `SUPABASE_SERVICE_ROLE_KEY`

### What to look for:
- Another long string (200+ characters) starting with `eyJ...`
- Will be different from the anon key
- Keep this absolutely secret - backend only!

## Step 5: Configure Backend Environment

Add these to your `backend/.env` file:

```bash
# Supabase Authentication Configuration
SUPABASE_URL="https://YOUR-PROJECT-ID.supabase.co"
SUPABASE_ANON_KEY="eyJ...your-long-anon-key..."
SUPABASE_SERVICE_ROLE_KEY="eyJ...your-long-service-role-key..."

# Keep your existing configuration
PLATFORM_OWNER_EMAIL="admin@fynlo.co.uk"
# ... rest of your existing config ...
```

## Step 6: Configure Mobile App Environment

Add these to your `CashApp-iOS/CashAppPOS/.env` file:

```bash
# Supabase Configuration
SUPABASE_URL=https://YOUR-PROJECT-ID.supabase.co
SUPABASE_ANON_KEY=eyJ...your-long-anon-key...

# Keep your existing backend API URL
API_URL=https://api.fynlo.co.uk/api/v1
```

## Step 7: Verify Your Setup

### Quick Verification Checklist:
- [ ] **Project URL** ends with `.supabase.co`
- [ ] **Anon Key** is 200+ characters, starts with `eyJ`
- [ ] **Service Role Key** is 200+ characters, starts with `eyJ`
- [ ] **Service Role Key** is DIFFERENT from Anon Key
- [ ] Backend `.env` has all three values in quotes
- [ ] Mobile `.env` has URL and Anon Key (NO service role key)

## Optional: Database Connection (If Needed)

If you need direct database access later:

1. Go to **Settings → Database**
2. Find **"Connection string"** section
3. You'll see different connection strings for:
   - URI (for ORMs)
   - PSQL (for command line)
   - .NET, JDBC, etc.
4. The password is shown as `[YOUR-PASSWORD]` - click to reveal

**Note**: We're NOT using this for authentication migration - keeping database in DigitalOcean!

## Common Issues & Solutions

### "Invalid API key"
- Check you copied the complete key (easy to miss characters)
- Ensure no extra spaces or line breaks
- Verify you're using anon key in mobile, service role in backend

### "Project not found"
- Verify the Project URL is correct
- Check there's no typo in the random string part
- Ensure you're using `https://` not `http://`

### Keys Look Similar
- The keys will have different content after the `eyJ` prefix
- Service role key has more permissions encoded
- If in doubt, check the Supabase dashboard labels

## Security Best Practices

1. **Never commit `.env` files** to Git
2. **Service Role Key** = Backend only, never in mobile app
3. **Anon Key** = Safe for mobile app, but still in .env
4. **Rotate keys** if ever exposed (Settings → API → Roll keys)

## Next Steps After Adding Credentials

### Backend:
```bash
cd backend
pip install -r requirements.txt
alembic upgrade head
python test_supabase_auth.py  # Test the connection
```

### Mobile App:
```bash
cd CashApp-iOS/CashAppPOS
npm install @supabase/supabase-js@2.39.0
npm install react-native-url-polyfill@2.0.0
cd ios && pod install && cd ..
```

## Questions to Ask Yourself

Before proceeding, verify:
1. ✅ Do I have all three credentials copied?
2. ✅ Are they in the correct .env files?
3. ✅ Is the service role key ONLY in the backend?
4. ✅ Are my .env files in .gitignore?

---

**Created**: January 9, 2025  
**Purpose**: Supabase Authentication Migration for Fynlo POS