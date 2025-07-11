# Customers Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/customers/CustomersScreen.tsx`  
**Purpose**: Customer relationship management and loyalty tracking  
**Status**: 🟡 UI complete but no data connection  
**Production Ready**: 30%

## 1. Current State Analysis

### What's Implemented ✅
- Customer list with loyalty levels
- Search functionality
- Segment filtering (VIP, Regular, New, Loyalty)
- Customer details modal
- Loyalty points display
- Visit history
- Contact information
- Professional UI with theming

### What's Not Working ❌
- No real customer data from backend
- DataService.getCustomers() not implemented
- Customer creation from POS not integrated
- Loyalty points system not functional
- No purchase history tracking
- Email/SMS marketing not connected

### Code References
```typescript
// Lines 42-57: Data loading issue
const loadCustomers = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const dataService = DataService.getInstance();
    // Method exists but returns empty/fails
    const customerData = await dataService.getCustomers();
    setCustomers(customerData || []);
  } catch (e: any) {
    setError(e.message || 'Failed to load customers.');
    setCustomers([]);
  } finally {
    setIsLoading(false);
  }
};
```

## 2. Data Flow Diagram

```
CustomersScreen
    ↓
DataService.getCustomers()
    ↓
DatabaseService (not implemented)
    ↓
GET /api/v1/customers
    ↓
Backend returns mock/empty
    ↓
Screen shows empty state

Expected Flow:
POS Screen → Create/Update Customer
    ↓
Customer Database
    ↓
CustomersScreen displays
    ↓
Loyalty points auto-calculated
```

## 3. Every Function & Requirement

### User Actions
1. **View Customers**
   - List all customers
   - See loyalty status badges
   - View total spent and visits
   - Check loyalty points
   - See last visit date

2. **Customer Management**
   - Add new customer
   - Edit customer details
   - View purchase history
   - Add notes/preferences
   - Tag customers

3. **Search & Filter**
   - Search by name, email, phone
   - Filter by segment (VIP, Regular, New, Loyalty)
   - Sort by various criteria
   - Export customer lists

4. **Customer Engagement**
   - Send promotional emails
   - SMS marketing
   - Birthday rewards
   - Loyalty notifications

### Data Operations
```typescript
// Customer Data Structure
interface CustomerData {
  id: string;
  name: string;
  email: string;
  phone: string;
  joinedDate: Date;
  lastVisit: Date;
  totalSpent: number;
  orderCount: number;
  averageOrderValue: number;
  loyaltyPoints: number;
  loyaltyTier: 'Bronze' | 'Silver' | 'Gold' | 'Platinum';
  tags: string[];
  notes: string;
  preferences: {
    favoriteItems: string[];
    dietaryRestrictions: string[];
    communicationPreferences: {
      email: boolean;
      sms: boolean;
      push: boolean;
    };
  };
}

// Segment Definitions
VIP: totalSpent > 500
Regular: orderCount >= 10
New: joinedDate within 30 days
Loyalty: loyaltyPoints > 1000
```

### State Management
```typescript
// Local State
const [customers, setCustomers] = useState<CustomerData[]>([]);
const [filteredCustomers, setFilteredCustomers] = useState<CustomerData[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedSegment, setSelectedSegment] = useState('all');
const [selectedCustomer, setSelectedCustomer] = useState<CustomerData | null>(null);
const [isLoading, setIsLoading] = useState<boolean>(true);
const [error, setError] = useState<string | null>(null);

// Filter Logic
const filterCustomers = () => {
  let filtered = customers;
  
  // Apply segment filter
  if (selectedSegment !== 'all') {
    switch (selectedSegment) {
      case 'vip':
        filtered = filtered.filter(c => c.totalSpent > 500);
        break;
      case 'regular':
        filtered = filtered.filter(c => c.orderCount >= 10);
        break;
      // ... other segments
    }
  }
  
  // Apply search
  if (searchQuery) {
    filtered = filtered.filter(customer =>
      customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      customer.phone.includes(searchQuery)
    );
  }
  
  setFilteredCustomers(filtered);
};
```

## 4. Platform Connections

### Data Sent to Platform
1. **Customer Analytics**
   - Total customers per restaurant
   - Customer acquisition rate
   - Retention metrics
   - Average customer lifetime value
   - Segment distribution

2. **Engagement Metrics**
   - Email open rates
   - SMS response rates
   - Loyalty program participation
   - Repeat purchase rate

3. **Revenue Attribution**
   - Revenue by customer segment
   - Top customer contributions
   - Loyalty program ROI
   - Marketing campaign effectiveness

### Platform Controls
1. **Loyalty Program Settings**
   - Points earning rates
   - Tier thresholds
   - Reward redemption rules
   - Platform-wide promotions

2. **Communication Templates**
   - Email templates
   - SMS templates
   - Compliance settings
   - Opt-out management

## 5. Backend Requirements

### Database Tables
```sql
-- Customers table (exists)
customers:
  - id (UUID)
  - restaurant_id (UUID)
  - first_name (VARCHAR)
  - last_name (VARCHAR)
  - email (VARCHAR, unique per restaurant)
  - phone (VARCHAR)
  - date_of_birth (DATE)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)

-- Customer Metrics (needs creation)
customer_metrics:
  - id (UUID)
  - customer_id (UUID, FK)
  - total_spent (DECIMAL)
  - order_count (INT)
  - last_order_date (TIMESTAMP)
  - average_order_value (DECIMAL)
  - favorite_product_id (UUID)
  - visit_frequency_days (DECIMAL)

-- Loyalty Program (needs creation)
loyalty_accounts:
  - id (UUID)
  - customer_id (UUID, FK)
  - points_balance (INT)
  - lifetime_points (INT)
  - tier (ENUM: bronze, silver, gold, platinum)
  - tier_expiry_date (DATE)
  - last_earned_date (TIMESTAMP)

-- Customer Preferences (needs creation)
customer_preferences:
  - id (UUID)
  - customer_id (UUID, FK)
  - dietary_restrictions (JSONB)
  - favorite_items (UUID[])
  - communication_preferences (JSONB)
  - notes (TEXT)
  - tags (VARCHAR[])
```

### API Endpoints Required
```python
# Customer Management
GET /api/v1/customers?restaurant_id={id}&segment={segment}
Response: {
  customers: [{
    id: string,
    name: string,
    email: string,
    phone: string,
    joinedDate: string,
    metrics: {
      totalSpent: number,
      orderCount: number,
      lastVisit: string,
      averageOrderValue: number
    },
    loyalty: {
      points: number,
      tier: string,
      tierProgress: number
    }
  }]
}

POST /api/v1/customers
Body: {
  firstName: string,
  lastName: string,
  email: string,
  phone?: string,
  dateOfBirth?: string,
  preferences?: object
}

PUT /api/v1/customers/{id}
Body: Partial<Customer>

# Customer History
GET /api/v1/customers/{id}/orders
GET /api/v1/customers/{id}/loyalty/history

# Marketing
POST /api/v1/customers/campaign
Body: {
  segment: string,
  type: 'email' | 'sms',
  template_id: string,
  variables: object
}
```

## 6. Current Issues

### Critical Issues
1. **No DataService Implementation**
   ```typescript
   // DataService missing proper implementation
   async getCustomers(): Promise<CustomerData[]> {
     // Currently returns empty array or fails
   }
   ```

2. **Customer Creation Flow Broken**
   - POS screen captures customer info
   - CustomersService.saveCustomer exists
   - But data doesn't appear in Customers screen
   - No backend persistence

3. **Loyalty System Non-functional**
   - Points calculation not implemented
   - No tier progression logic
   - Rewards redemption missing

### Data Integration Issues
```typescript
// Frontend expects full CustomerData
// Backend only has basic Customer model
// Missing: metrics, loyalty, preferences

// Need to aggregate data from multiple tables:
- customers (base info)
- orders (for metrics calculation)
- loyalty_accounts (for points/tier)
- customer_preferences (for tags/notes)
```

## 7. Required Fixes

### DataService Implementation (Priority 1)
```typescript
// In DataService.ts
async getCustomers(): Promise<CustomerData[]> {
  if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
    try {
      const response = await this.db.apiRequest('/api/v1/customers');
      return response.data.customers.map(this.transformCustomerData);
    } catch (error) {
      console.error('Failed to fetch customers:', error);
      throw error;
    }
  }
  return [];
}

private transformCustomerData(customer: any): CustomerData {
  return {
    id: customer.id,
    name: `${customer.firstName} ${customer.lastName}`.trim(),
    email: customer.email,
    phone: customer.phone || '',
    joinedDate: new Date(customer.joinedDate),
    lastVisit: new Date(customer.metrics?.lastVisit || customer.joinedDate),
    totalSpent: customer.metrics?.totalSpent || 0,
    orderCount: customer.metrics?.orderCount || 0,
    averageOrderValue: customer.metrics?.averageOrderValue || 0,
    loyaltyPoints: customer.loyalty?.points || 0,
    loyaltyTier: customer.loyalty?.tier || 'Bronze',
    tags: customer.preferences?.tags || [],
    notes: customer.preferences?.notes || '',
    preferences: {
      favoriteItems: customer.preferences?.favoriteItems || [],
      dietaryRestrictions: customer.preferences?.dietaryRestrictions || [],
      communicationPreferences: customer.preferences?.communicationPreferences || {
        email: true,
        sms: false,
        push: false
      }
    }
  };
}
```

### Backend Implementation (Priority 2)
```python
# In customers.py
@router.get("/customers")
async def get_customers(
    restaurant_id: str = Query(...),
    segment: Optional[str] = Query(None),
    search: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Build base query
    query = db.query(Customer).filter(Customer.restaurant_id == restaurant_id)
    
    # Apply search
    if search:
        query = query.filter(
            or_(
                Customer.first_name.ilike(f"%{search}%"),
                Customer.last_name.ilike(f"%{search}%"),
                Customer.email.ilike(f"%{search}%"),
                Customer.phone.ilike(f"%{search}%")
            )
        )
    
    customers = query.all()
    
    # Enhance with metrics and loyalty data
    enhanced_customers = []
    for customer in customers:
        # Get metrics
        metrics = calculate_customer_metrics(db, customer.id)
        loyalty = get_loyalty_account(db, customer.id)
        
        # Apply segment filter
        if segment:
            if not matches_segment(metrics, loyalty, segment):
                continue
        
        enhanced_customers.append({
            "id": str(customer.id),
            "firstName": customer.first_name,
            "lastName": customer.last_name,
            "email": customer.email,
            "phone": customer.phone,
            "joinedDate": customer.created_at.isoformat(),
            "metrics": metrics,
            "loyalty": loyalty
        })
    
    return {"customers": enhanced_customers}
```

### Customer Creation Integration (Priority 3)
```typescript
// In POS Screen - processPayment function
const processPayment = async () => {
  // Create/update customer if email provided
  let customerId = null;
  if (customerEmail) {
    try {
      const customer = await CustomersService.saveCustomer({
        name: customerName,
        email: customerEmail,
      });
      customerId = customer.id;
    } catch (error) {
      console.warn('Customer save failed:', error);
    }
  }
  
  // Create order with customer reference
  const order = await DatabaseService.createOrder({
    customer_id: customerId,
    customer_name: customerName,
    customer_email: customerEmail,
    // ... rest of order data
  });
  
  // Update loyalty points
  if (customerId) {
    await DatabaseService.updateLoyaltyPoints(customerId, calculatePoints(total));
  }
};
```

### Loyalty System Implementation (Priority 4)
```python
# Loyalty calculations
def calculate_points(order_total: Decimal) -> int:
    """£1 = 10 points"""
    return int(order_total * 10)

def determine_tier(lifetime_points: int) -> str:
    if lifetime_points >= 10000:
        return "platinum"
    elif lifetime_points >= 5000:
        return "gold"
    elif lifetime_points >= 2000:
        return "silver"
    return "bronze"

# Auto-update on order completion
@event.listens_for(Order, 'after_update')
def update_customer_loyalty(mapper, connection, target):
    if target.status == 'completed' and target.customer_id:
        # Update metrics
        # Add loyalty points
        # Check tier progression
        pass
```

## 8. Testing Requirements

### Unit Tests
1. Customer filtering by segment
2. Search functionality
3. Loyalty tier calculations
4. Points earning rules
5. Data transformation

### Integration Tests
1. Customer creation from POS
2. Loyalty points update on order
3. Segment filtering accuracy
4. Email campaign sending
5. Data persistence

### User Acceptance Criteria
- [ ] Customers appear after POS transactions
- [ ] Search finds customers instantly
- [ ] Segments accurately categorize customers
- [ ] Loyalty points update automatically
- [ ] Customer history shows all orders
- [ ] Export functionality works
- [ ] Email/SMS campaigns deliver

## 9. Platform Owner Portal Integration

### Customer Analytics Dashboard
1. **Acquisition Metrics**
   ```sql
   -- New customers by period
   SELECT 
     DATE_TRUNC('week', created_at) as week,
     restaurant_id,
     COUNT(*) as new_customers
   FROM customers
   WHERE created_at > NOW() - INTERVAL '90 days'
   GROUP BY week, restaurant_id
   ORDER BY week DESC;
   ```

2. **Retention Analysis**
   - Cohort retention charts
   - Repeat purchase rates
   - Customer lifetime value trends
   - Churn prediction

3. **Segment Performance**
   ```typescript
   interface SegmentMetrics {
     segment: string;
     customer_count: number;
     total_revenue: number;
     avg_order_value: number;
     visit_frequency: number;
     retention_rate: number;
   }
   ```

### Marketing Effectiveness
1. **Campaign Analytics**
   - Open rates by restaurant
   - Click-through rates
   - Conversion tracking
   - ROI by campaign type

2. **Loyalty Program Metrics**
   - Participation rate
   - Points redemption rate
   - Tier distribution
   - Program ROI

### Platform Reports
```sql
-- Top customers across platform
SELECT 
  c.first_name || ' ' || c.last_name as customer,
  r.name as restaurant,
  cm.total_spent,
  cm.order_count,
  la.tier
FROM customers c
JOIN customer_metrics cm ON c.id = cm.customer_id
JOIN restaurants r ON c.restaurant_id = r.id
LEFT JOIN loyalty_accounts la ON c.id = la.customer_id
ORDER BY cm.total_spent DESC
LIMIT 100;

-- Loyalty program effectiveness
SELECT 
  r.name as restaurant,
  COUNT(DISTINCT la.customer_id) as enrolled_customers,
  AVG(cm.total_spent) as avg_spent_enrolled,
  AVG(cm2.total_spent) as avg_spent_not_enrolled
FROM restaurants r
LEFT JOIN loyalty_accounts la ON la.customer_id IN (
  SELECT id FROM customers WHERE restaurant_id = r.id
)
-- Complex join for comparison
GROUP BY r.id;
```

## Next Steps

1. **Immediate**: Implement getCustomers in DataService
2. **Today**: Create customer_metrics table migration
3. **Tomorrow**: Fix customer creation flow from POS
4. **This Week**: Implement loyalty points system
5. **Next Week**: Email/SMS marketing integration
6. **Platform**: Customer analytics dashboard

## Related Documentation
- See `01_POS_SCREEN_ANALYSIS.md` for customer creation flow
- See `13_BACKEND_REQUIREMENTS.md` for Customer model details
- See `CustomersService.ts` for existing save logic