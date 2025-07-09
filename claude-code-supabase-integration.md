# Claude Code - Complete Supabase Integration Guide

## Overview
I need to integrate Supabase authentication into the Fynlo POS backend and mobile app. The website already uses Supabase, and I have an existing Supabase project with API keys ready.

## My Supabase Credentials
- **Project URL**: `https://eyJhbGc...` (my actual project URL from Supabase dashboard)
- **Anon Key**: `eyJhbGc...` (the public anon key shown in screenshot)
- **Service Role Key**: `****` (the secret service_role key - I'll need to reveal and copy this)

## Phase 1: Backend Integration - Remove DigitalOcean Auth & Add Supabase

### Step 1: Update Requirements and Environment

**Copy and paste this to Claude Code:**
```
Update the backend to use Supabase authentication instead of DigitalOcean OAuth:

1. In backend/requirements.txt, add:
   supabase==2.3.0
   gotrue==2.0.0

2. Update backend/.env file:
   # Remove all DigitalOcean OAuth variables
   # Remove: DO_OAUTH_CLIENT_ID, DO_OAUTH_CLIENT_SECRET, DO_OAUTH_REDIRECT_URI
   
   # Add Supabase configuration
   SUPABASE_URL=https://[my-project-id].supabase.co
   SUPABASE_ANON_KEY=[my-anon-key-from-screenshot]
   SUPABASE_SERVICE_ROLE_KEY=[my-service-role-key-after-revealing]
   
   # Keep existing DigitalOcean database and cache
   DATABASE_URL=postgresql://user:pass@your-do-db-cluster.db.ondigitalocean.com:25060/fynlo?sslmode=require
   VALKEY_URL=redis://default:password@your-valkey-host:6379/0
   
   # Platform owner email
   PLATFORM_OWNER_EMAIL=admin@fynlo.co.uk

3. Create backend/app/core/supabase.py:

from supabase import create_client, Client
from app.core.config import settings

def get_supabase_client() -> Client:
    """Get Supabase client with service role key for admin operations"""
    return create_client(
        settings.SUPABASE_URL,
        settings.SUPABASE_SERVICE_ROLE_KEY
    )

supabase_admin = get_supabase_client()
```

### Step 2: Update Database Schema

**Copy and paste this to Claude Code:**
```
Create a new Alembic migration to update the users table for Supabase:

1. Generate migration:
   alembic revision -m "add_supabase_auth_support"

2. In the new migration file:

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

def upgrade():
    # Add Supabase ID column
    op.add_column('users', sa.Column('supabase_id', postgresql.UUID, unique=True, nullable=True))
    
    # Add auth provider column
    op.add_column('users', sa.Column('auth_provider', sa.String(50), server_default='supabase'))
    
    # Make password nullable since Supabase handles auth
    op.alter_column('users', 'password_hash', nullable=True)
    
    # Create index for faster lookups
    op.create_index('idx_users_supabase_id', 'users', ['supabase_id'])
    
    # Add subscription fields to restaurants table if not exists
    op.add_column('restaurants', sa.Column('subscription_plan', sa.String(50), server_default='alpha'))
    op.add_column('restaurants', sa.Column('subscription_status', sa.String(50), server_default='trial'))
    op.add_column('restaurants', sa.Column('subscription_started_at', sa.TIMESTAMP, nullable=True))
    op.add_column('restaurants', sa.Column('subscription_expires_at', sa.TIMESTAMP, nullable=True))

def downgrade():
    op.drop_index('idx_users_supabase_id')
    op.drop_column('users', 'supabase_id')
    op.drop_column('users', 'auth_provider')
    op.alter_column('users', 'password_hash', nullable=False)
    op.drop_column('restaurants', 'subscription_plan')
    op.drop_column('restaurants', 'subscription_status')
    op.drop_column('restaurants', 'subscription_started_at')
    op.drop_column('restaurants', 'subscription_expires_at')

3. Run migration:
   alembic upgrade head
```

### Step 3: Create Supabase Authentication Endpoints

**Copy and paste this to Claude Code:**
```
Replace the existing auth endpoints with Supabase integration:

1. Delete or rename the old auth file: backend/app/api/v1/auth/auth.py

2. Create new backend/app/api/v1/auth/auth.py:

from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime

from app.db.session import get_db
from app.core.supabase import supabase_admin
from app.models.user import User
from app.models.restaurant import Restaurant
from app.schemas.auth import AuthVerifyResponse, RegisterRestaurantRequest

router = APIRouter()

def get_plan_features(plan: str) -> list[str]:
    """Get enabled features for a subscription plan"""
    features = {
        'alpha': [
            'pos_basic',
            'order_management',
            'basic_payments',
            'daily_reports'
        ],
        'beta': [
            'pos_basic',
            'order_management',
            'basic_payments',
            'daily_reports',
            'inventory_management',
            'staff_management',
            'advanced_reports',
            'table_management',
            'customer_database'
        ],
        'omega': [
            'pos_basic',
            'order_management',
            'basic_payments',
            'daily_reports',
            'inventory_management',
            'staff_management',
            'advanced_reports',
            'table_management',
            'customer_database',
            'multi_location',
            'api_access',
            'custom_branding',
            'priority_support',
            'advanced_analytics',
            'unlimited_staff'
        ]
    }
    return features.get(plan, features['alpha'])

@router.post("/verify", response_model=AuthVerifyResponse)
async def verify_supabase_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Verify Supabase token and return user info with subscription details"""
    
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    # Extract token from "Bearer <token>" format
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify token with Supabase Admin API
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Find or create user in our database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            # First time login - create user
            db_user = User(
                supabase_id=str(supabase_user.id),
                email=supabase_user.email,
                name=supabase_user.user_metadata.get('full_name', ''),
                auth_provider='supabase',
                is_active=True,
                # Check if this should be platform owner
                is_platform_owner=(supabase_user.email == settings.PLATFORM_OWNER_EMAIL)
            )
            db.add(db_user)
            db.commit()
            db.refresh(db_user)
        
        # Build response
        response_data = {
            "user": {
                "id": db_user.id,
                "email": db_user.email,
                "name": db_user.name,
                "is_platform_owner": db_user.is_platform_owner,
            }
        }
        
        # Add restaurant info if user has one
        if db_user.restaurant_id:
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == db_user.restaurant_id
            ).first()
            
            if restaurant:
                response_data["user"]["restaurant_id"] = restaurant.id
                response_data["user"]["restaurant_name"] = restaurant.name
                response_data["user"]["subscription_plan"] = restaurant.subscription_plan
                response_data["user"]["subscription_status"] = restaurant.subscription_status
                response_data["user"]["enabled_features"] = get_plan_features(restaurant.subscription_plan)
        
        return response_data
        
    except Exception as e:
        print(f"Auth verification error: {str(e)}")
        raise HTTPException(status_code=401, detail="Invalid token")

@router.post("/register-restaurant")
async def register_restaurant(
    data: RegisterRestaurantRequest,
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
):
    """Register a new restaurant after Supabase signup"""
    
    if not authorization:
        raise HTTPException(status_code=401, detail="No authorization header")
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify token
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Check if user already has a restaurant
        if db_user.restaurant_id:
            raise HTTPException(status_code=400, detail="User already has a restaurant")
        
        # Create restaurant
        restaurant = Restaurant(
            name=data.restaurant_name,
            email=supabase_user.email,
            phone=data.phone,
            address=data.address,
            subscription_plan="alpha",  # Start with Alpha plan
            subscription_status="trial",
            subscription_started_at=datetime.utcnow(),
            is_active=True
        )
        db.add(restaurant)
        db.commit()
        db.refresh(restaurant)
        
        # Link user to restaurant
        db_user.restaurant_id = restaurant.id
        db.commit()
        
        return {
            "success": True,
            "restaurant_id": restaurant.id,
            "subscription_plan": "alpha",
            "message": "Restaurant registered successfully"
        }
        
    except Exception as e:
        print(f"Restaurant registration error: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to register restaurant")

3. Create schemas in backend/app/schemas/auth.py:

from pydantic import BaseModel
from typing import Optional, List

class RegisterRestaurantRequest(BaseModel):
    restaurant_name: str
    phone: Optional[str] = None
    address: Optional[str] = None

class UserInfo(BaseModel):
    id: int
    email: str
    name: Optional[str]
    is_platform_owner: bool
    restaurant_id: Optional[int] = None
    restaurant_name: Optional[str] = None
    subscription_plan: Optional[str] = None
    subscription_status: Optional[str] = None
    enabled_features: Optional[List[str]] = []

class AuthVerifyResponse(BaseModel):
    user: UserInfo
```

### Step 4: Update Authentication Middleware

**Copy and paste this to Claude Code:**
```
Update backend/app/core/auth.py to work with Supabase tokens:

from fastapi import Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import Optional

from app.core.supabase import supabase_admin
from app.db.session import get_db
from app.models.user import User

async def get_current_user(
    authorization: Optional[str] = Header(None),
    db: Session = Depends(get_db)
) -> User:
    """Get current user from Supabase token"""
    
    if not authorization:
        raise HTTPException(
            status_code=401,
            detail="No authorization header",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    token = authorization.replace("Bearer ", "")
    
    try:
        # Verify with Supabase
        user_response = supabase_admin.auth.get_user(token)
        supabase_user = user_response.user
        
        if not supabase_user:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user from our database
        db_user = db.query(User).filter(
            User.supabase_id == str(supabase_user.id)
        ).first()
        
        if not db_user:
            raise HTTPException(status_code=401, detail="User not found in database")
        
        if not db_user.is_active:
            raise HTTPException(status_code=403, detail="User account is inactive")
        
        return db_user
        
    except Exception as e:
        print(f"Auth error: {str(e)}")
        raise HTTPException(
            status_code=401,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

async def get_current_active_user(
    current_user: User = Depends(get_current_user)
) -> User:
    """Ensure user is active"""
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

async def get_platform_owner(
    current_user: User = Depends(get_current_active_user)
) -> User:
    """Ensure user is platform owner"""
    if not current_user.is_platform_owner:
        raise HTTPException(
            status_code=403,
            detail="Not enough permissions. Platform owner access required."
        )
    return current_user

async def get_restaurant_user(
    current_user: User = Depends(get_current_active_user),
    db: Session = Depends(get_db)
) -> User:
    """Ensure user has restaurant access"""
    if not current_user.restaurant_id:
        raise HTTPException(
            status_code=403,
            detail="Restaurant access required"
        )
    return current_user

# Remove all DigitalOcean OAuth related functions
```

### Step 5: Update Main App Configuration

**Copy and paste this to Claude Code:**
```
Update backend/app/main.py to remove DigitalOcean OAuth and configure CORS:

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1.api import api_router
from app.core.config import settings

app = FastAPI(
    title="Fynlo POS API",
    version="1.0.0",
    description="Backend API for Fynlo POS System"
)

# Configure CORS for Supabase and frontend domains
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Local development
        "http://localhost:5173",  # Vite development
        "https://fynlo.co.uk",   # Production website
        "https://*.supabase.co",  # Supabase domains
        settings.SUPABASE_URL,    # Your specific Supabase URL
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(api_router, prefix="/api/v1")

# Remove any DigitalOcean OAuth setup code

@app.get("/")
async def root():
    return {"message": "Fynlo POS API", "version": "1.0.0"}

@app.get("/health")
async def health_check():
    return {"status": "healthy"}
```

## Phase 2: Mobile App Supabase Integration

### Step 1: Install Supabase Dependencies

**Copy and paste this to Claude Code:**
```
In the React Native app (CashApp-iOS/CashAppPOS), install Supabase:

1. Install packages:
   cd CashApp-iOS/CashAppPOS
   npm install @supabase/supabase-js@2.39.0
   npm install react-native-url-polyfill@2.0.0
   npm install @react-native-async-storage/async-storage@1.19.0

2. For iOS:
   cd ios && pod install && cd ..

3. Create src/lib/supabase.ts:

import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

// Use the same Supabase credentials
const supabaseUrl = process.env.SUPABASE_URL || 'YOUR_SUPABASE_PROJECT_URL'
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

4. Update .env file in mobile app:
   SUPABASE_URL=https://[your-project].supabase.co
   SUPABASE_ANON_KEY=[your-anon-key]
   API_URL=https://api.fynlo.co.uk/api/v1
```

### Step 2: Create Supabase Auth Service

**Copy and paste this to Claude Code:**
```
Create src/services/auth/supabaseAuth.ts:

import { supabase } from '../../lib/supabase'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiClient } from '../api/client'

interface SignInParams {
  email: string
  password: string
}

interface SignUpParams extends SignInParams {
  restaurantName?: string
}

export const authService = {
  async signIn({ email, password }: SignInParams) {
    try {
      // 1. Sign in with Supabase
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      })
      
      if (error) throw error
      
      // 2. Verify with our backend and get user details
      const verifyResponse = await apiClient.post('/auth/verify', null, {
        headers: {
          Authorization: `Bearer ${data.session?.access_token}`
        }
      })
      
      // 3. Store enhanced user info
      await AsyncStorage.setItem('userInfo', JSON.stringify(verifyResponse.user))
      
      return {
        user: verifyResponse.user,
        session: data.session
      }
    } catch (error: any) {
      console.error('Sign in error:', error)
      throw new Error(error.message || 'Failed to sign in')
    }
  },
  
  async signUp({ email, password, restaurantName }: SignUpParams) {
    try {
      // 1. Sign up with Supabase
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            restaurant_name: restaurantName
          }
        }
      })
      
      if (error) throw error
      
      // 2. If restaurant name provided, register it
      if (restaurantName && data.session) {
        await apiClient.post('/auth/register-restaurant', {
          restaurant_name: restaurantName
        }, {
          headers: {
            Authorization: `Bearer ${data.session.access_token}`
          }
        })
      }
      
      return data
    } catch (error: any) {
      console.error('Sign up error:', error)
      throw new Error(error.message || 'Failed to sign up')
    }
  },
  
  async signOut() {
    try {
      await supabase.auth.signOut()
      await AsyncStorage.clear()
    } catch (error) {
      console.error('Sign out error:', error)
    }
  },
  
  async getSession() {
    const { data: { session } } = await supabase.auth.getSession()
    return session
  },
  
  async refreshSession() {
    const { data: { session }, error } = await supabase.auth.refreshSession()
    if (error) throw error
    return session
  },
  
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback)
  }
}
```

### Step 3: Update Auth Store

**Copy and paste this to Claude Code:**
```
Update src/stores/authStore.ts to use Supabase:

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { authService } from '../services/auth/supabaseAuth'
import { apiClient } from '../services/api/client'

interface User {
  id: number
  email: string
  name?: string
  is_platform_owner: boolean
  restaurant_id?: number
  restaurant_name?: string
  subscription_plan?: 'alpha' | 'beta' | 'omega'
  subscription_status?: string
  enabled_features?: string[]
}

interface AuthState {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  session: any | null
  
  // Actions
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, restaurantName?: string) => Promise<void>
  signOut: () => Promise<void>
  checkAuth: () => Promise<void>
  hasFeature: (feature: string) => boolean
  requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      isAuthenticated: false,
      isLoading: true,
      session: null,
      
      signIn: async (email: string, password: string) => {
        try {
          set({ isLoading: true })
          const { user, session } = await authService.signIn({ email, password })
          
          set({
            user,
            session,
            isAuthenticated: true,
            isLoading: false
          })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      signUp: async (email: string, password: string, restaurantName?: string) => {
        try {
          set({ isLoading: true })
          await authService.signUp({ email, password, restaurantName })
          
          // After signup, sign them in
          if (restaurantName) {
            await get().signIn(email, password)
          }
          
          set({ isLoading: false })
        } catch (error) {
          set({ isLoading: false })
          throw error
        }
      },
      
      signOut: async () => {
        await authService.signOut()
        set({
          user: null,
          session: null,
          isAuthenticated: false
        })
      },
      
      checkAuth: async () => {
        try {
          set({ isLoading: true })
          
          const session = await authService.getSession()
          if (session) {
            // Verify with backend
            const verifyResponse = await apiClient.post('/auth/verify', null, {
              headers: {
                Authorization: `Bearer ${session.access_token}`
              }
            })
            
            set({
              user: verifyResponse.user,
              session,
              isAuthenticated: true
            })
          } else {
            set({ isAuthenticated: false })
          }
        } catch (error) {
          console.error('Auth check failed:', error)
          set({ isAuthenticated: false })
        } finally {
          set({ isLoading: false })
        }
      },
      
      hasFeature: (feature: string) => {
        const { user } = get()
        if (!user) return false
        if (user.is_platform_owner) return true
        return user.enabled_features?.includes(feature) || false
      },
      
      requiresPlan: (plan: 'alpha' | 'beta' | 'omega') => {
        const { user } = get()
        if (!user) return false
        if (user.is_platform_owner) return true
        
        const planHierarchy = { alpha: 1, beta: 2, omega: 3 }
        const userPlanLevel = planHierarchy[user.subscription_plan || 'alpha']
        const requiredLevel = planHierarchy[plan]
        
        return userPlanLevel >= requiredLevel
      }
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated
      })
    }
  )
)
```

### Step 4: Update API Client

**Copy and paste this to Claude Code:**
```
Update src/services/api/client.ts to use Supabase tokens:

import { supabase } from '../../lib/supabase'

class ApiClient {
  private baseURL = process.env.API_URL || 'https://api.fynlo.co.uk/api/v1'
  
  private async getHeaders() {
    const { data: { session } } = await supabase.auth.getSession()
    
    return {
      'Content-Type': 'application/json',
      ...(session ? { 'Authorization': `Bearer ${session.access_token}` } : {})
    }
  }
  
  private async handleResponse(response: Response) {
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, try to refresh
        try {
          await supabase.auth.refreshSession()
          // Retry the request
          return null // Signal to retry
        } catch (error) {
          // Refresh failed, sign out
          await supabase.auth.signOut()
          throw new Error('Session expired')
        }
      }
      
      const error = await response.json().catch(() => ({ message: 'Unknown error' }))
      throw new Error(error.detail || error.message || `API Error: ${response.status}`)
    }
    
    return response.json()
  }
  
  async get(endpoint: string, options?: RequestInit) {
    const headers = await this.getHeaders()
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      method: 'GET',
      headers: { ...headers, ...options?.headers }
    })
    
    const result = await this.handleResponse(response)
    if (result === null) {
      // Retry after token refresh
      return this.get(endpoint, options)
    }
    
    return result
  }
  
  async post(endpoint: string, data?: any, options?: RequestInit) {
    const headers = await this.getHeaders()
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      ...options,
      method: 'POST',
      headers: { ...headers, ...options?.headers },
      body: data ? JSON.stringify(data) : undefined
    })
    
    const result = await this.handleResponse(response)
    if (result === null) {
      // Retry after token refresh
      return this.post(endpoint, data, options)
    }
    
    return result
  }
  
  // Add PUT, PATCH, DELETE methods following the same pattern
}

export const apiClient = new ApiClient()
```

### Step 5: Update App Entry Point

**Copy and paste this to Claude Code:**
```
Update App.tsx to initialize auth checking:

import React, { useEffect } from 'react'
import { NavigationContainer } from '@react-navigation/native'
import { useAuthStore } from './src/stores/authStore'
import { authService } from './src/services/auth/supabaseAuth'
import { RootNavigator } from './src/navigation/RootNavigator'
import { LoadingScreen } from './src/screens/LoadingScreen'

export default function App() {
  const { checkAuth, isLoading, isAuthenticated } = useAuthStore()
  
  useEffect(() => {
    // Check authentication on app start
    checkAuth()
    
    // Listen for auth state changes
    const { data: authListener } = authService.onAuthStateChange(
      async (event, session) => {
        console.log('Auth event:', event)
        if (event === 'SIGNED_IN') {
          checkAuth()
        } else if (event === 'SIGNED_OUT') {
          useAuthStore.setState({
            user: null,
            session: null,
            isAuthenticated: false
          })
        }
      }
    )
    
    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [])
  
  if (isLoading) {
    return <LoadingScreen />
  }
  
  return (
    <NavigationContainer>
      <RootNavigator isAuthenticated={isAuthenticated} />
    </NavigationContainer>
  )
}
```

## Phase 3: Remove Old DigitalOcean OAuth Code

**Copy and paste this to Claude Code:**
```
Remove all DigitalOcean OAuth related code:

1. Delete these files if they exist:
   - backend/app/api/v1/auth/digitalocean.py
   - backend/app/core/oauth.py
   - Any DigitalOcean OAuth related routes

2. Clean up imports in files that referenced DigitalOcean OAuth

3. Remove OAuth-related dependencies from requirements.txt if any

4. Ensure all API endpoints now use the new Supabase-based auth middleware
```

## Phase 4: Testing Instructions

**Copy and paste this to Claude Code:**
```
Create a test script to verify the integration:

1. Create backend/test_supabase_auth.py:

import asyncio
import httpx
from app.core.config import settings

async def test_auth_flow():
    # Test authentication verification
    async with httpx.AsyncClient() as client:
        # This would need a real Supabase token for testing
        headers = {"Authorization": "Bearer YOUR_TEST_TOKEN"}
        
        response = await client.post(
            f"http://localhost:8000/api/v1/auth/verify",
            headers=headers
        )
        
        print(f"Verify response: {response.status_code}")
        if response.status_code == 200:
            print(f"User data: {response.json()}")

if __name__ == "__main__":
    asyncio.run(test_auth_flow())

2. Update your platform owner email in the database:
   - Sign up on the website with your platform owner email
   - The backend will automatically flag it as platform owner

3. Test the mobile app:
   - Run the app in development
   - Try signing in with a test account
   - Verify features are properly gated by subscription
```

## Important Notes

1. **Environment Variables**: Make sure to update both backend and mobile app .env files with your actual Supabase credentials

2. **CORS**: The backend is configured to accept requests from Supabase domains and your frontend

3. **Platform Owner**: The first user who signs up with the email in PLATFORM_OWNER_EMAIL will automatically become the platform owner

4. **Mobile App**: The app now uses Supabase for auth but still calls your backend API for all POS functionality

5. **Token Refresh**: The mobile app automatically handles token refresh when needed

This completes the Supabase integration. The website already uses Supabase, the backend now accepts Supabase tokens, and the mobile app authenticates through Supabase.