# Profile Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/profile/ProfileScreen.tsx`  
**Purpose**: User account management and personal settings  
**Status**: 🟡 Complete UI but limited backend integration  
**Production Ready**: 40%

## 1. Current State Analysis

### What's Implemented ✅
- User profile display
- Edit profile functionality
- Change password UI
- Profile photo upload (UI only)
- Activity log view
- Personal preferences
- Logout functionality
- Professional UI with theming

### What's Not Working ❌
- Profile photo upload doesn't work
- Password change not connected to backend
- Activity log shows mock data
- Some profile edits don't persist
- No email verification flow
- Missing two-factor authentication
- Clock in/out status not real

### Code References
```typescript
// Lines 45-60: Profile data loading
const loadProfile = async () => {
  try {
    const authContext = useAuth();
    const currentUser = authContext.user;
    
    if (currentUser) {
      setProfile({
        id: currentUser.id,
        name: `${currentUser.firstName} ${currentUser.lastName}`,
        email: currentUser.email,
        phone: currentUser.phone || '',
        role: currentUser.role,
        joinDate: currentUser.createdAt,
        profilePhoto: currentUser.avatar
      });
    }
  } catch (error) {
    console.error('Failed to load profile:', error);
  }
};
```

## 2. Data Flow Diagram

```
ProfileScreen
    ↓
AuthContext (current user)
    ↓
Local state display
    ↓
Edit → Local update only
    ↓
Some changes → Backend
    ↓
Others lost on reload

Expected Flow:
ProfileScreen
    ↓
GET /api/v1/users/me
    ↓
Display full profile
    ↓
Edit → PUT /api/v1/users/me
    ↓
Update AuthContext
    ↓
Persist across app
```

## 3. Every Function & Requirement

### Profile Sections
1. **Personal Information**
   - Full name
   - Email address
   - Phone number
   - Date of birth
   - Address (optional)
   - Emergency contact

2. **Account Settings**
   - Username/Employee ID
   - Password management
   - Two-factor authentication
   - Security questions
   - Login sessions
   - Device management

3. **Work Information**
   - Role/Position
   - Department/Section
   - Hire date
   - Employee ID
   - Manager
   - Permissions

4. **Preferences**
   - Language
   - Theme
   - Notifications
   - Time zone
   - Date format
   - Shortcuts

5. **Activity**
   - Login history
   - Recent actions
   - Clock in/out times
   - Performance metrics
   - Sales summary

### Data Operations
```typescript
// User Profile Structure
interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  avatar?: string;
  role: UserRole;
  
  // Extended profile
  profile: {
    dateOfBirth?: Date;
    address?: Address;
    emergencyContact?: Contact;
    employeeId?: string;
    hireDate?: Date;
    department?: string;
    managerId?: string;
  };
  
  // Preferences
  preferences: {
    language: string;
    theme: string;
    notifications: NotificationPreferences;
    timezone: string;
    dateFormat: string;
  };
  
  // Work data
  workData: {
    clockedIn: boolean;
    lastClockIn?: Date;
    totalHoursThisWeek: number;
    totalSalesThisMonth: number;
    performanceScore?: number;
  };
  
  // Security
  security: {
    twoFactorEnabled: boolean;
    lastPasswordChange: Date;
    activeSessions: Session[];
  };
}

// Activity Log
interface ActivityLogEntry {
  id: string;
  timestamp: Date;
  action: string;
  details?: string;
  ipAddress?: string;
  device?: string;
}
```

### State Management
```typescript
// Local State
const [profile, setProfile] = useState<UserProfile | null>(null);
const [isEditing, setIsEditing] = useState(false);
const [isLoading, setIsLoading] = useState(true);
const [activityLog, setActivityLog] = useState<ActivityLogEntry[]>([]);
const [showPasswordModal, setShowPasswordModal] = useState(false);
const [uploadingPhoto, setUploadingPhoto] = useState(false);

// Edit Form State
const [editForm, setEditForm] = useState({
  firstName: '',
  lastName: '',
  phone: '',
  dateOfBirth: '',
  address: {
    line1: '',
    line2: '',
    city: '',
    postalCode: '',
    country: 'UK'
  }
});
```

## 4. Platform Connections

### Data Visibility
1. **Personal Data** - User sees only their own
2. **Activity Logs** - Personal actions only
3. **Performance Metrics** - Own statistics
4. **Clock Records** - Personal time tracking

### Platform Owner Access
```typescript
// Platform owners can view any user profile
interface PlatformUserManagement {
  viewUserProfile: (userId: string) => UserProfile;
  viewActivityLog: (userId: string) => ActivityLog[];
  resetPassword: (userId: string) => void;
  disableUser: (userId: string) => void;
  changeUserRole: (userId: string, newRole: UserRole) => void;
}
```

### Restaurant Owner Access
```typescript
// Restaurant owners can manage their staff
interface RestaurantUserManagement {
  viewStaffProfiles: () => UserProfile[];
  viewStaffActivity: (userId: string) => ActivityLog[];
  updateStaffRole: (userId: string, role: RestaurantRole) => void;
  viewTimeRecords: (userId: string) => TimeRecord[];
}
```

## 5. Backend Requirements

### User Profile Endpoints
```python
# Get current user profile
GET /api/v1/users/me
Response: {
  id: string,
  email: string,
  firstName: string,
  lastName: string,
  phone: string,
  avatar: string,
  role: string,
  restaurantId: string,
  profile: {
    employeeId: string,
    hireDate: string,
    department: string,
    emergencyContact: object
  },
  preferences: {
    language: string,
    theme: string,
    notifications: object
  },
  workData: {
    clockedIn: boolean,
    lastClockIn: datetime,
    hoursThisWeek: number,
    salesThisMonth: number
  }
}

# Update user profile
PUT /api/v1/users/me
Body: {
  firstName?: string,
  lastName?: string,
  phone?: string,
  profile?: object,
  preferences?: object
}

# Upload profile photo
POST /api/v1/users/me/avatar
Body: FormData with image file
Response: {
  avatarUrl: string
}

# Change password
POST /api/v1/users/me/password
Body: {
  currentPassword: string,
  newPassword: string
}

# Get activity log
GET /api/v1/users/me/activity
Query params:
  - limit: number
  - offset: number
  - startDate: date
  - endDate: date
Response: {
  entries: ActivityLogEntry[],
  total: number
}

# Clock in/out
POST /api/v1/users/me/clock
Body: {
  action: 'in' | 'out',
  location?: {
    latitude: number,
    longitude: number
  }
}

# Two-factor authentication
POST /api/v1/users/me/2fa/enable
POST /api/v1/users/me/2fa/disable
POST /api/v1/users/me/2fa/verify
```

### Database Schema
```sql
-- Extended user profile
CREATE TABLE user_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  employee_id VARCHAR(50),
  date_of_birth DATE,
  address JSONB,
  emergency_contact JSONB,
  hire_date DATE,
  department VARCHAR(100),
  manager_id UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Activity log
CREATE TABLE activity_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  action VARCHAR(100) NOT NULL,
  details JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  device_info JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Clock records
CREATE TABLE time_clock (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  restaurant_id UUID REFERENCES restaurants(id),
  clock_in TIMESTAMP NOT NULL,
  clock_out TIMESTAMP,
  break_minutes INTEGER DEFAULT 0,
  location POINT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- User sessions
CREATE TABLE user_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES users(id),
  token_hash VARCHAR(255) UNIQUE NOT NULL,
  device_info JSONB,
  ip_address VARCHAR(45),
  last_activity TIMESTAMP,
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

## 6. Current Issues

### Critical Issues
1. **Profile Photo Upload Broken**
   ```typescript
   // Current implementation doesn't upload
   const handlePhotoUpload = async (photo: any) => {
     setUploadingPhoto(true);
     // Missing: actual upload to backend
     // Currently just sets local state
     setProfile({...profile, avatar: photo.uri});
     setUploadingPhoto(false);
   };
   ```

2. **Password Change Not Connected**
   ```typescript
   // UI exists but doesn't call API
   const handlePasswordChange = async (currentPassword, newPassword) => {
     // TODO: Implement API call
     showToast('Password change coming soon');
   };
   ```

3. **Activity Log Shows Mock Data**
   ```typescript
   // Hardcoded activity entries
   const mockActivityLog = [
     { action: 'Clocked in', timestamp: '10:00 AM' },
     { action: 'Processed order #1234', timestamp: '10:15 AM' }
   ];
   ```

### Security Issues
1. **No Password Validation**
   - Missing complexity requirements
   - No confirmation field
   - No strength indicator

2. **Missing 2FA**
   - UI placeholder exists
   - Backend support missing
   - No QR code generation

3. **Session Management**
   - Can't view active sessions
   - Can't revoke sessions
   - No device tracking

## 7. Required Fixes

### Profile Photo Upload (Priority 1)
```typescript
// services/ProfileService.ts
export const uploadProfilePhoto = async (photoUri: string): Promise<string> => {
  try {
    const formData = new FormData();
    
    // Convert URI to blob
    const response = await fetch(photoUri);
    const blob = await response.blob();
    
    formData.append('avatar', {
      uri: photoUri,
      type: 'image/jpeg',
      name: 'profile.jpg'
    } as any);
    
    const result = await DatabaseService.apiRequest('/api/v1/users/me/avatar', {
      method: 'POST',
      headers: {
        'Content-Type': 'multipart/form-data',
      },
      body: formData
    });
    
    return result.data.avatarUrl;
  } catch (error) {
    console.error('Photo upload failed:', error);
    throw error;
  }
};

// In ProfileScreen
const handlePhotoUpload = async (photo: ImagePickerResult) => {
  if (!photo.cancelled && photo.uri) {
    setUploadingPhoto(true);
    try {
      const avatarUrl = await uploadProfilePhoto(photo.uri);
      
      // Update local state
      setProfile(prev => ({ ...prev, avatar: avatarUrl }));
      
      // Update auth context
      authContext.updateUser({ avatar: avatarUrl });
      
      showToast('Profile photo updated');
    } catch (error) {
      showToast('Failed to upload photo', 'error');
    } finally {
      setUploadingPhoto(false);
    }
  }
};
```

### Password Change Implementation (Priority 2)
```typescript
// components/ChangePasswordModal.tsx
interface PasswordChangeForm {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const ChangePasswordModal: React.FC<Props> = ({ visible, onClose }) => {
  const [form, setForm] = useState<PasswordChangeForm>({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  
  const validatePassword = (password: string): string[] => {
    const errors: string[] = [];
    
    if (password.length < 8) {
      errors.push('At least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('One uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
      errors.push('One lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
      errors.push('One number');
    }
    if (!/[!@#$%^&*]/.test(password)) {
      errors.push('One special character');
    }
    
    return errors;
  };
  
  const handleSubmit = async () => {
    const newErrors: Record<string, string> = {};
    
    // Validate current password
    if (!form.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    // Validate new password
    const passwordErrors = validatePassword(form.newPassword);
    if (passwordErrors.length > 0) {
      newErrors.newPassword = `Password must have: ${passwordErrors.join(', ')}`;
    }
    
    // Validate confirmation
    if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }
    
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    
    setLoading(true);
    try {
      await DatabaseService.apiRequest('/api/v1/users/me/password', {
        method: 'POST',
        body: {
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        }
      });
      
      showToast('Password changed successfully');
      onClose();
      
      // Force re-login for security
      setTimeout(() => {
        authContext.logout();
      }, 2000);
    } catch (error: any) {
      if (error.message?.includes('incorrect')) {
        setErrors({ currentPassword: 'Incorrect password' });
      } else {
        showToast('Failed to change password', 'error');
      }
    } finally {
      setLoading(false);
    }
  };
  
  return (
    <Modal visible={visible} onClose={onClose}>
      {/* Password change form UI */}
    </Modal>
  );
};
```

### Activity Log Integration (Priority 3)
```typescript
// In ProfileScreen
const loadActivityLog = async () => {
  try {
    const response = await DatabaseService.apiRequest('/api/v1/users/me/activity', {
      params: {
        limit: 20,
        offset: 0
      }
    });
    
    const formattedEntries = response.data.entries.map(entry => ({
      id: entry.id,
      action: entry.action,
      details: entry.details,
      timestamp: new Date(entry.created_at),
      icon: getIconForAction(entry.action),
      color: getColorForAction(entry.action)
    }));
    
    setActivityLog(formattedEntries);
  } catch (error) {
    console.error('Failed to load activity log:', error);
    setActivityLog([]);
  }
};

const getIconForAction = (action: string): string => {
  const actionIcons = {
    'clock_in': 'login',
    'clock_out': 'logout',
    'order_created': 'receipt',
    'order_completed': 'check-circle',
    'profile_updated': 'person',
    'password_changed': 'lock'
  };
  return actionIcons[action] || 'info';
};
```

### Two-Factor Authentication (Priority 4)
```typescript
// components/TwoFactorSetup.tsx
const TwoFactorSetup: React.FC = () => {
  const [qrCode, setQrCode] = useState<string>('');
  const [secret, setSecret] = useState<string>('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  
  const initiate2FA = async () => {
    try {
      const response = await DatabaseService.apiRequest('/api/v1/users/me/2fa/setup');
      setQrCode(response.data.qrCode);
      setSecret(response.data.secret);
    } catch (error) {
      showToast('Failed to setup 2FA', 'error');
    }
  };
  
  const verify2FA = async () => {
    try {
      await DatabaseService.apiRequest('/api/v1/users/me/2fa/verify', {
        method: 'POST',
        body: {
          code: verificationCode,
          secret: secret
        }
      });
      
      setIsEnabled(true);
      showToast('Two-factor authentication enabled');
    } catch (error) {
      showToast('Invalid verification code', 'error');
    }
  };
  
  return (
    <View>
      {!isEnabled ? (
        <>
          <Text>Scan this QR code with your authenticator app:</Text>
          <QRCode value={qrCode} size={200} />
          <TextInput
            placeholder="Enter verification code"
            value={verificationCode}
            onChangeText={setVerificationCode}
            keyboardType="number-pad"
            maxLength={6}
          />
          <Button title="Verify and Enable" onPress={verify2FA} />
        </>
      ) : (
        <View>
          <Text>Two-factor authentication is enabled</Text>
          <Button title="Disable 2FA" onPress={disable2FA} />
        </View>
      )}
    </View>
  );
};
```

## 8. Testing Requirements

### Unit Tests
1. Password validation rules
2. Photo upload handling
3. Activity log formatting
4. Profile data validation
5. 2FA code verification

### Integration Tests
1. Profile update persistence
2. Password change flow
3. Photo upload and display
4. Activity log pagination
5. Session management

### Security Tests
1. Password complexity enforcement
2. Old password verification
3. Session token validation
4. 2FA bypass prevention
5. Photo upload size limits

### User Acceptance Criteria
- [ ] Profile photo uploads and displays correctly
- [ ] Password changes work with validation
- [ ] Activity log shows real user actions
- [ ] All profile edits persist
- [ ] 2FA can be enabled/disabled
- [ ] Clock in/out updates in real-time
- [ ] Preferences apply immediately

## 9. Platform Owner Portal Integration

### User Management Dashboard
```typescript
// Platform can view/manage all users
interface PlatformUserDashboard {
  users: {
    total: number;
    byRole: Record<UserRole, number>;
    byRestaurant: Record<string, number>;
    active: number;
    inactive: number;
  };
  
  search: {
    byName: (query: string) => UserProfile[];
    byEmail: (email: string) => UserProfile;
    byRestaurant: (restaurantId: string) => UserProfile[];
    byRole: (role: UserRole) => UserProfile[];
  };
  
  actions: {
    viewProfile: (userId: string) => void;
    resetPassword: (userId: string) => void;
    changeRole: (userId: string, newRole: UserRole) => void;
    suspendUser: (userId: string, reason: string) => void;
    viewActivity: (userId: string, dateRange: DateRange) => ActivityLog[];
  };
}
```

### User Analytics
```sql
-- User activity patterns
SELECT 
  u.id,
  u.first_name || ' ' || u.last_name as name,
  u.role,
  r.name as restaurant,
  COUNT(DISTINCT DATE(al.created_at)) as active_days,
  COUNT(al.id) FILTER (WHERE al.action = 'order_created') as orders_created,
  AVG(EXTRACT(EPOCH FROM (tc.clock_out - tc.clock_in))/3600) as avg_hours_per_shift
FROM users u
LEFT JOIN restaurants r ON u.restaurant_id = r.id
LEFT JOIN activity_logs al ON u.id = al.user_id
LEFT JOIN time_clock tc ON u.id = tc.user_id
WHERE al.created_at > NOW() - INTERVAL '30 days'
GROUP BY u.id, r.name;

-- Security audit
SELECT 
  u.email,
  u.last_login,
  p.last_password_change,
  s.two_factor_enabled,
  COUNT(us.id) as active_sessions,
  MAX(al.created_at) FILTER (WHERE al.action = 'failed_login') as last_failed_login
FROM users u
LEFT JOIN user_profiles p ON u.id = p.user_id
LEFT JOIN user_security s ON u.id = s.user_id
LEFT JOIN user_sessions us ON u.id = us.user_id AND us.expires_at > NOW()
LEFT JOIN activity_logs al ON u.id = al.user_id
GROUP BY u.id, p.last_password_change, s.two_factor_enabled;
```

## Next Steps

1. **Immediate**: Fix profile photo upload
2. **Today**: Implement password change
3. **Tomorrow**: Connect activity log to real data
4. **This Week**: Add 2FA support
5. **Next Week**: Complete clock in/out integration
6. **Future**: Advanced session management

## Related Documentation
- See `AuthContext.tsx` for user authentication
- See `13_BACKEND_REQUIREMENTS.md` for user endpoints
- See `DatabaseService.ts` for API integration