# Employees Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/employees/EmployeesScreen.tsx`  
**Purpose**: Staff management and employee administration  
**Status**: 🟡 UI complete but crashes on data load  
**Production Ready**: 30%

## 1. Current State Analysis

### What's Implemented ✅
- Employee list with role badges
- Search and filter functionality
- Add/Edit employee modal
- Performance metrics display
- Schedule overview
- Loading states (basic)
- Error handling (basic)
- Theme support

### What's Not Working ❌
- Screen crashes after extended loading
- No real employee data from backend
- DataService.getEmployees() not properly implemented
- Mock data generator removed but no replacement
- Schedule screen navigation broken
- No time tracking integration

### Code References
```typescript
// Lines 60-74: Data loading issue
const loadEmployees = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const dataService = DataService.getInstance();
    // This method doesn't exist in DataService
    const employeeData = await dataService.getEmployees();
    setEmployees(employeeData || []);
  } catch (e: any) {
    setError(e.message || 'Failed to load employees.');
    setEmployees([]); // Clear employees on error
  } finally {
    setIsLoading(false);
  }
};
```

## 2. Data Flow Diagram

```
EmployeesScreen
    ↓
DataService.getEmployees() [MISSING]
    ↓
Should call DatabaseService
    ↓
GET /api/v1/employees
    ↓
Backend returns mock data
    ↓
Screen shows empty state or crashes

Expected Flow:
User table (with role filtering)
    ↓
Transform to EmployeeData format
    ↓
Display in screen
```

## 3. Every Function & Requirement

### User Actions
1. **View Employees**
   - List all staff members
   - See role badges (Manager, Cashier, Server, Kitchen)
   - View performance metrics
   - Check active/inactive status
   - See contact information

2. **Employee Management**
   - Add new employee
   - Edit employee details
   - Deactivate/reactivate employees
   - Assign roles and permissions
   - Set hourly rates

3. **Search & Filter**
   - Search by name, email, role
   - Filter by role (Manager, Cashier, etc.)
   - Filter by status (active/inactive)
   - Sort by various criteria

4. **Performance Tracking**
   - View total sales per employee
   - See performance scores
   - Check hours worked
   - Review schedule adherence

### Data Operations
```typescript
// Employee Data Structure
interface EmployeeData {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: 'Manager' | 'Cashier' | 'Server' | 'Kitchen';
  hourlyRate: number;
  totalSales: number;
  performanceScore: number;
  isActive: boolean;
  hireDate: Date;
  startDate: Date;
  totalOrders: number;
  avgOrderValue: number;
  hoursWorked: number;
}

// CRUD Operations Needed
- GET /api/v1/employees
- POST /api/v1/employees
- PUT /api/v1/employees/{id}
- DELETE /api/v1/employees/{id}
- GET /api/v1/employees/{id}/performance
- GET /api/v1/employees/{id}/schedule
```

### State Management
```typescript
// Local State
const [employees, setEmployees] = useState<EmployeeData[]>([]);
const [filteredEmployees, setFilteredEmployees] = useState<EmployeeData[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedRole, setSelectedRole] = useState<string>('all');
const [showAddModal, setShowAddModal] = useState(false);
const [selectedEmployee, setSelectedEmployee] = useState<EmployeeData | null>(null);
const [isLoading, setIsLoading] = useState<boolean>(true);
const [error, setError] = useState<string | null>(null);

// Form State
const [newEmployee, setNewEmployee] = useState({
  name: '',
  email: '',
  phone: '',
  role: 'Cashier',
  hourlyRate: '12.00',
});
```

## 4. Platform Connections

### Data Sent to Platform
1. **Staffing Metrics**
   - Total employees per restaurant
   - Role distribution
   - Average hourly rates
   - Turnover rates
   - Performance scores

2. **Labor Analytics**
   - Labor cost percentage
   - Sales per labor hour
   - Overtime tracking
   - Schedule compliance

3. **Compliance Data**
   - Work hour violations
   - Break compliance
   - Minimum wage compliance
   - Role permission audits

### Platform Controls
1. **Permission Templates**
   - Standardized role permissions
   - Access control policies
   - POS operation limits

2. **Labor Standards**
   - Maximum shift lengths
   - Required break periods
   - Overtime thresholds

## 5. Backend Requirements

### Database Structure
```sql
-- User table already exists with employee data
users:
  - id (UUID)
  - restaurant_id (UUID)
  - email (VARCHAR)
  - first_name (VARCHAR)
  - last_name (VARCHAR)
  - phone (VARCHAR)
  - role (ENUM: platform_owner, restaurant_owner, manager, employee)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMP)

-- Employee Profile Extension (needs creation)
employee_profiles:
  - id (UUID)
  - user_id (UUID, FK)
  - employee_id (VARCHAR) - Internal ID
  - hourly_rate (DECIMAL)
  - hire_date (DATE)
  - emergency_contact (JSONB)
  - address (JSONB)
  - tax_info (JSONB, encrypted)
  - bank_info (JSONB, encrypted)

-- Performance Metrics (needs creation)
employee_performance:
  - id (UUID)
  - user_id (UUID, FK)
  - period_start (DATE)
  - period_end (DATE)
  - total_sales (DECIMAL)
  - total_orders (INT)
  - avg_order_value (DECIMAL)
  - performance_score (DECIMAL)
  - punctuality_score (DECIMAL)
  - customer_rating (DECIMAL)
```

### API Endpoints Required
```python
# Employee Management
GET /api/v1/employees?restaurant_id={id}
Response: {
  employees: [{
    id: string,
    name: string,
    email: string,
    phone: string,
    role: string,
    hourlyRate: number,
    totalSales: number,
    performanceScore: number,
    isActive: boolean,
    hireDate: string,
    metrics: {
      totalOrders: number,
      avgOrderValue: number,
      hoursWorked: number
    }
  }]
}

POST /api/v1/employees
Body: {
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  role: string,
  hourlyRate: number,
  hireDate: string
}

PUT /api/v1/employees/{id}
Body: Partial<Employee>

# Performance Endpoints
GET /api/v1/employees/{id}/performance?period={period}
Response: {
  sales: ChartData[],
  orders: ChartData[],
  rating: number,
  attendance: AttendanceData
}

# Schedule Endpoints
GET /api/v1/employees/{id}/schedule?week={week}
POST /api/v1/employees/{id}/schedule
```

## 6. Current Issues

### Critical Issues
1. **Missing DataService Method**
   ```typescript
   // DataService.ts is missing:
   async getEmployees(): Promise<EmployeeData[]> {
     // Implementation needed
   }
   ```

2. **Backend Returns Wrong Format**
   - Frontend expects EmployeeData format
   - Backend returns User model format
   - No transformation layer exists

3. **No Real Employee Creation**
   - Add employee form doesn't call API
   - Only updates local state
   - Data lost on refresh

### Data Mapping Issues
```typescript
// Frontend expects:
{
  name: string,           // Full name
  role: string,          // Specific role
  hourlyRate: number,
  totalSales: number,
  performanceScore: number
}

// Backend User model has:
{
  first_name: string,
  last_name: string,
  role: string,          // Different enum values
  // Missing: hourlyRate, totalSales, performanceScore
}
```

## 7. Required Fixes

### DataService Implementation (Priority 1)
```typescript
// In DataService.ts
async getEmployees(): Promise<EmployeeData[]> {
  if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
    try {
      const response = await this.db.apiRequest('/api/v1/employees');
      // Transform backend format to frontend format
      return response.data.map(this.transformUserToEmployee);
    } catch (error) {
      console.error('Failed to fetch employees:', error);
      return [];
    }
  }
  // Return empty array for production (no mock fallback)
  return [];
}

private transformUserToEmployee(user: any): EmployeeData {
  return {
    id: user.id,
    name: `${user.first_name} ${user.last_name}`.trim(),
    email: user.email,
    phone: user.phone || '',
    role: this.mapUserRole(user.role),
    hourlyRate: user.profile?.hourly_rate || 0,
    totalSales: user.metrics?.total_sales || 0,
    performanceScore: user.metrics?.performance_score || 0,
    isActive: user.is_active,
    hireDate: new Date(user.created_at),
    startDate: new Date(user.created_at),
    totalOrders: user.metrics?.total_orders || 0,
    avgOrderValue: user.metrics?.avg_order_value || 0,
    hoursWorked: user.metrics?.hours_worked || 0
  };
}
```

### Backend Implementation (Priority 2)
```python
# In employees.py
@router.get("/employees")
async def get_employees(
    restaurant_id: str = Query(...),
    include_inactive: bool = Query(False),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify permission
    if current_user.restaurant_id != restaurant_id and current_user.role != 'platform_owner':
        raise HTTPException(403, "Not authorized")
    
    # Get users with employee roles
    query = db.query(User).filter(
        User.restaurant_id == restaurant_id,
        User.role.in_(['manager', 'employee'])
    )
    
    if not include_inactive:
        query = query.filter(User.is_active == True)
    
    users = query.all()
    
    # Transform to employee format with metrics
    employees = []
    for user in users:
        employee_data = {
            "id": str(user.id),
            "first_name": user.first_name,
            "last_name": user.last_name,
            "email": user.email,
            "phone": user.phone,
            "role": user.role,
            "is_active": user.is_active,
            "created_at": user.created_at.isoformat(),
            "metrics": await get_employee_metrics(db, user.id)
        }
        employees.append(employee_data)
    
    return {"employees": employees}
```

### Frontend Error Handling (Priority 3)
```typescript
// Improved error handling in EmployeesScreen
const loadEmployees = async () => {
  setIsLoading(true);
  setError(null);
  
  try {
    const dataService = DataService.getInstance();
    const employeeData = await dataService.getEmployees();
    
    if (!employeeData || employeeData.length === 0) {
      setEmployees([]);
      setError('No employees found. Add your first employee to get started.');
    } else {
      setEmployees(employeeData);
    }
  } catch (e: any) {
    console.error('Employee loading error:', e);
    setError('Unable to load employees. Please check your connection and try again.');
    setEmployees([]);
    
    // Show retry option
    Alert.alert(
      'Loading Error',
      'Failed to load employees. Would you like to retry?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Retry', onPress: loadEmployees }
      ]
    );
  } finally {
    setIsLoading(false);
  }
};
```

## 8. Testing Requirements

### Unit Tests
1. Employee filtering by role
2. Search functionality
3. Form validation
4. Performance metric calculations
5. Role permission checks

### Integration Tests
1. Create employee → appears in list
2. Edit employee → changes persist
3. Deactivate employee → filtered from active list
4. Performance data updates
5. Schedule integration

### User Acceptance Criteria
- [ ] Employees load within 2 seconds
- [ ] Search returns results instantly
- [ ] Add employee form validates all fields
- [ ] Changes persist across app restarts
- [ ] Performance metrics update daily
- [ ] Schedule navigation works
- [ ] Role-based permissions enforced

## 9. Platform Owner Portal Integration

### Employee Analytics Dashboard
1. **Staffing Overview**
   ```sql
   -- Restaurant staffing summary
   SELECT 
     r.name as restaurant,
     COUNT(CASE WHEN u.role = 'manager' THEN 1 END) as managers,
     COUNT(CASE WHEN u.role = 'employee' THEN 1 END) as employees,
     AVG(ep.hourly_rate) as avg_hourly_rate
   FROM restaurants r
   LEFT JOIN users u ON r.id = u.restaurant_id
   LEFT JOIN employee_profiles ep ON u.id = ep.user_id
   WHERE u.is_active = true
   GROUP BY r.id;
   ```

2. **Performance Tracking**
   - Top performers across platform
   - Sales per employee hour
   - Training compliance
   - Retention metrics

3. **Labor Cost Analysis**
   - Labor as % of revenue
   - Overtime trends
   - Schedule optimization suggestions
   - Cross-restaurant comparisons

### Compliance Monitoring
```typescript
interface ComplianceMetrics {
  minimum_wage_compliance: {
    compliant: boolean;
    violations: ViolationRecord[];
  };
  
  working_time_compliance: {
    max_hours_exceeded: EmployeeViolation[];
    break_violations: BreakViolation[];
  };
  
  permission_audit: {
    unauthorized_access: AccessViolation[];
    role_mismatches: RoleMismatch[];
  };
}
```

### Platform Reports
1. **Monthly Staffing Report**
   - Headcount changes
   - Turnover analysis
   - Cost per hire
   - Performance distribution

2. **Labor Efficiency Report**
   - Sales per labor hour by role
   - Optimal staffing levels
   - Peak hour coverage
   - Training ROI

## Next Steps

1. **Immediate**: Implement getEmployees in DataService
2. **Today**: Create employee_profiles table migration
3. **Tomorrow**: Connect add/edit forms to backend
4. **This Week**: Implement performance metrics
5. **Next Week**: Schedule management integration
6. **Platform**: Labor analytics dashboard

## Related Documentation
- See `13_BACKEND_REQUIREMENTS.md` for User model details
- See `12_PLATFORM_CONNECTIONS.md` for multi-tenant considerations
- See `EmployeeScheduleScreen.tsx` for schedule integration