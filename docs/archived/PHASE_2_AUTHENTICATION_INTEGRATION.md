# 🔐 Phase 2: Authentication Integration

## Overview

Replace the mock authentication system with real JWT-based authentication that integrates with the backend API. This phase ensures proper user management, role-based access control, and secure session handling.

**Duration**: 3 days  
**Priority**: CRITICAL  
**Dependencies**: Backend auth endpoints operational  

## 🎯 Goals

1. Remove ALL mock user creation from login flow
2. Implement real JWT token management
3. Integrate role-based access control
4. Add proper session persistence
5. Implement secure logout functionality
6. Add token refresh mechanism

## 📍 Current State Analysis

### Mock Authentication Issues
**File**: `src/screens/auth/LoginScreen.tsx`  
**Lines**: 61-80  
**Problem**: Creates mock user data even with real auth

```typescript
// CURRENT (Problematic)
const mockUser = {
  id: 'demo-user-id',
  email: email,
  name: 'Demo User',
  role: 'restaurant_owner' as UserRole,
  permissions: ['dashboard', 'pos', 'reports']
};
```

### Backend Auth Endpoints
**Login**: `POST /api/v1/auth/login`  
**Refresh**: `POST /api/v1/auth/refresh`  
**Logout**: `POST /api/v1/auth/logout`  
**Me**: `GET /api/v1/auth/me`  
**Status**: ✅ All operational

## 🛠️ Implementation Tasks

### Task 1: Update Auth Service (Day 1 Morning)
- [ ] Create proper `AuthService.ts` with JWT handling
- [ ] Implement secure token storage
- [ ] Add token refresh logic
- [ ] Handle token expiration
- [ ] Add logout functionality

```typescript
// AuthService.ts structure
interface AuthResponse {
  access_token: string;
  refresh_token: string;
  user: User;
  expires_in: number;
}

class AuthService {
  async login(credentials: LoginCredentials): Promise<AuthResponse>
  async refresh(refreshToken: string): Promise<AuthResponse>
  async logout(): Promise<void>
  async getCurrentUser(): Promise<User>
  async validateToken(token: string): Promise<boolean>
  setupTokenRefreshInterval(): void
}
```

### Task 2: Fix Login Screen (Day 1 Morning)
- [ ] Remove ALL mock user creation code
- [ ] Integrate real auth service
- [ ] Add proper error handling
- [ ] Update loading states
- [ ] Store tokens securely

```typescript
// LoginScreen.tsx updates
const handleLogin = async () => {
  try {
    setLoading(true);
    const response = await AuthService.login({ email, password });
    
    // Store tokens
    await SecureStore.setItemAsync('accessToken', response.access_token);
    await SecureStore.setItemAsync('refreshToken', response.refresh_token);
    
    // Update auth context with real user
    setUser(response.user);
    setIsAuthenticated(true);
    
  } catch (error) {
    showError('Invalid credentials');
  } finally {
    setLoading(false);
  }
};
```

### Task 3: Update Auth Context (Day 1 Afternoon)
- [ ] Remove demo mode logic
- [ ] Add token management
- [ ] Implement auto-refresh
- [ ] Add session persistence
- [ ] Handle auth state properly

```typescript
// AuthContext.tsx updates
interface AuthContextValue {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}
```

### Task 4: Implement Secure Storage (Day 1 Afternoon)
- [ ] Use expo-secure-store for tokens
- [ ] Encrypt sensitive user data
- [ ] Add token expiry checking
- [ ] Implement auto-logout on expiry
- [ ] Clear storage on logout

### Task 5: Add API Interceptors (Day 2 Morning)
- [ ] Add auth headers to all requests
- [ ] Implement 401 handling
- [ ] Auto-refresh on token expiry
- [ ] Queue requests during refresh
- [ ] Handle refresh failures

```typescript
// API Interceptor setup
axios.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

axios.interceptors.response.use(
  response => response,
  async error => {
    if (error.response?.status === 401) {
      await AuthService.refresh();
      return axios.request(error.config);
    }
    return Promise.reject(error);
  }
);
```

### Task 6: Role-Based Navigation (Day 2 Morning)
- [ ] Update AppNavigator role checking
- [ ] Use real user roles from backend
- [ ] Remove hardcoded role logic
- [ ] Add permission checking
- [ ] Update navigation guards

### Task 7: User Profile Integration (Day 2 Afternoon)
- [ ] Fetch real user profile data
- [ ] Update ProfileScreen with real data
- [ ] Add profile edit functionality
- [ ] Implement password change
- [ ] Add profile picture upload

### Task 8: Session Management (Day 2 Afternoon)
- [ ] Implement session timeout
- [ ] Add "Remember Me" functionality
- [ ] Handle multiple device sessions
- [ ] Add session activity tracking
- [ ] Implement force logout

### Task 9: Error Handling & UX (Day 3 Morning)
- [ ] Add comprehensive error messages
- [ ] Implement retry mechanisms
- [ ] Add offline detection
- [ ] Show session expiry warnings
- [ ] Improve loading states

### Task 10: Testing & Security (Day 3 Afternoon)
- [ ] Test all auth flows
- [ ] Verify token refresh works
- [ ] Check role-based access
- [ ] Test session persistence
- [ ] Security audit auth flow

## 🔍 Verification Checklist

### Security
- [ ] No tokens in console logs
- [ ] Tokens stored securely
- [ ] Auto-logout on expiry
- [ ] Proper HTTPS usage
- [ ] No hardcoded credentials

### Functionality
- [ ] Login with real credentials works
- [ ] Token refresh automatic
- [ ] Logout clears all data
- [ ] Role-based routing works
- [ ] Session persists on app restart

### User Experience
- [ ] Clear error messages
- [ ] Smooth loading states
- [ ] No authentication loops
- [ ] Proper redirects after login
- [ ] Session timeout warnings

## 🚨 Common Issues & Solutions

### Issue 1: Token Expiry Loops
```typescript
// Solution: Implement proper refresh queue
let isRefreshing = false;
let refreshQueue: Array<() => void> = [];

const refreshToken = async () => {
  if (isRefreshing) {
    return new Promise(resolve => {
      refreshQueue.push(resolve);
    });
  }
  
  isRefreshing = true;
  try {
    await AuthService.refresh();
    refreshQueue.forEach(resolve => resolve());
    refreshQueue = [];
  } finally {
    isRefreshing = false;
  }
};
```

### Issue 2: Lost Auth State
```typescript
// Solution: Restore from secure storage
const restoreAuthState = async () => {
  const token = await SecureStore.getItemAsync('accessToken');
  if (token && await AuthService.validateToken(token)) {
    const user = await AuthService.getCurrentUser();
    setUser(user);
    setIsAuthenticated(true);
  }
};
```

## 📊 Success Metrics

- ✅ 0 mock users in authentication flow
- ✅ 100% real JWT authentication
- ✅ Automatic token refresh working
- ✅ Role-based access verified
- ✅ Session persistence functional

## 🔧 Technical Implementation

### Required Headers
```typescript
// All authenticated requests
{
  'Authorization': 'Bearer <access_token>',
  'Content-Type': 'application/json',
}
```

### Token Storage Keys
```typescript
const TOKEN_KEYS = {
  ACCESS: 'fynlo_access_token',
  REFRESH: 'fynlo_refresh_token',
  USER: 'fynlo_user_data',
  EXPIRY: 'fynlo_token_expiry'
};
```

### User Object Structure
```typescript
interface User {
  id: string;
  email: string;
  name: string;
  role: 'platform_owner' | 'restaurant_owner' | 'manager' | 'employee';
  restaurant_id?: string;
  permissions: string[];
  profile_image?: string;
  created_at: string;
  last_login: string;
}
```

## 📅 Daily Milestones

- **Day 1**: Auth service + Login fix + Secure storage ✅
- **Day 2**: API interceptors + Role navigation + Session ✅
- **Day 3**: Error handling + Testing + Security audit ✅

## ⚠️ Migration Considerations

1. **Existing Users**: May need to re-login
2. **Stored Credentials**: Will be cleared
3. **Active Sessions**: Will be terminated
4. **Remember Me**: Needs re-enablement

---

**Status**: Ready to Begin  
**Blockers**: None  
**Next Step**: Update AuthService.ts with JWT handling