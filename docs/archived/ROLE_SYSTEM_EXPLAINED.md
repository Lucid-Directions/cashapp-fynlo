# Fynlo POS Role System Explained

## 🎭 Role Hierarchy

```
┌─────────────────────┐
│  Platform Owner     │ ← You (sleepyarno@gmail.com)
│  (Super Admin)      │   Can manage ALL restaurants
└──────────┬──────────┘
           │
    ┌──────▼──────┐
    │ Restaurant  │
    │   Owner     │ ← Can manage their restaurant
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Manager    │ ← Can manage operations
    └──────┬──────┘
           │
    ┌──────▼──────┐
    │  Employee   │ ← Can process orders
    └─────────────┘
```

## 🔐 How Roles Are Assigned

### 1. Platform Owner (That's You!)
**Automatic Assignment**: When someone logs in with the email matching `PLATFORM_OWNER_EMAIL` in backend/.env
```python
# In backend/app/api/v1/endpoints/auth.py
if user_email == settings.PLATFORM_OWNER_EMAIL:
    user.role = "platform_owner"
```

**Your Powers**:
- Access platform dashboard
- Create/manage multiple restaurants
- View all restaurant analytics
- Manage platform settings
- Assign restaurant owners

### 2. Restaurant Owner
**How they're created**:
- Platform owner creates them through the app
- OR they sign up and platform owner approves
- OR via Sign Up screen (creates restaurant + owner)

**Their Powers**:
- Manage their restaurant settings
- Create manager/employee accounts
- View their restaurant analytics
- Configure menu, prices, taxes

### 3. Manager
**How they're created**:
- Restaurant owner creates them
- Assigned to specific restaurant

**Their Powers**:
- Process orders
- Manage inventory
- View reports
- Handle refunds
- Cannot change restaurant settings

### 4. Employee
**How they're created**:
- Restaurant owner or manager creates them
- Assigned to specific restaurant

**Their Powers**:
- Process orders
- View current orders
- Basic POS operations
- No access to settings/reports

## 🏢 Multi-Tenant Structure

```
Platform (Fynlo)
    ├── Restaurant A
    │   ├── Owner: John
    │   ├── Manager: Sarah
    │   └── Employees: Mike, Lisa
    │
    └── Restaurant B
        ├── Owner: Emma
        ├── Manager: David
        └── Employees: Tom, Amy
```

## 🔄 Role Assignment Flow

### When Someone Signs In:

1. **Supabase Authentication**
   ```
   User enters email/password → Supabase validates → Returns token
   ```

2. **Backend Verification** (`/api/v1/auth/verify`)
   ```python
   # Checks if user exists in database
   user = db.query(User).filter(User.email == email).first()
   
   # If platform owner email
   if email == PLATFORM_OWNER_EMAIL:
       user.role = "platform_owner"
   
   # If new user
   elif not user:
       user = create_user(email, role="employee")  # Default role
   ```

3. **App Receives User Info**
   ```json
   {
     "user": {
       "id": "123",
       "email": "sleepyarno@gmail.com",
       "role": "platform_owner",
       "restaurant_id": null  // Platform owners aren't tied to one restaurant
     }
   }
   ```

## 📝 Database Schema

```sql
-- Users table
CREATE TABLE users (
    id UUID PRIMARY KEY,
    email VARCHAR UNIQUE,
    role VARCHAR CHECK (role IN ('platform_owner', 'restaurant_owner', 'manager', 'employee')),
    restaurant_id UUID REFERENCES restaurants(id),  -- NULL for platform owners
    supabase_id UUID UNIQUE
);

-- User-Restaurant relationship
-- Platform owners: restaurant_id = NULL (access all)
-- Others: restaurant_id = specific restaurant
```

## 🎯 Your Specific Case

Since you're `sleepyarno@gmail.com` and it's set as `PLATFORM_OWNER_EMAIL`:

1. **First login**: Backend automatically assigns you `platform_owner` role
2. **Every login**: System recognizes you as platform owner
3. **In the app**: You see platform dashboard, not restaurant view

## 🔧 How to Create Other Users

### As Platform Owner, you can:

1. **Create Restaurant Owners**
   ```
   Platform Dashboard → Restaurants → Add Restaurant → Assign Owner
   ```

2. **They create their team**
   ```
   Restaurant Dashboard → Team → Add Manager/Employee
   ```

### Via Sign Up Screen:
- Creates restaurant owner + their restaurant
- You (platform owner) can later approve/modify

## 🚨 Important Security Notes

1. **Role Elevation**: Users can't change their own role
2. **Restaurant Isolation**: Users only see their restaurant's data
3. **Platform Access**: Only platform_owner role can access all data
4. **Audit Trail**: All role changes are logged

## 💡 Quick Tips

- **You're automatically platform owner** because your email matches the .env setting
- **Other users default to employee** unless explicitly set otherwise
- **Roles are stored in YOUR database**, not Supabase
- **Supabase only handles authentication**, your backend handles authorization

---

**Summary**: You're the platform owner because your email matches `PLATFORM_OWNER_EMAIL`. When others sign up, they become restaurant owners with their own restaurant. The role system ensures proper access control across the multi-tenant platform.