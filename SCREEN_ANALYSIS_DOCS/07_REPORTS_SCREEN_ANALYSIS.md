# Reports Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/reports/ReportsScreen.tsx`  
**Purpose**: Business analytics, performance tracking, and data export  
**Status**: 🟡 Complete UI with mock data, no backend integration  
**Production Ready**: 25%

## 1. Current State Analysis

### What's Implemented ✅
- Sales reports with charts
- Staff performance metrics
- Product analytics
- Customer insights
- Date range filtering
- Export functionality (UI only)
- Professional data visualization
- Responsive layout with tabs

### What's Not Working ❌
- All data is hardcoded/mock
- No real analytics from backend
- Export doesn't actually work
- Date filtering is UI-only
- No real-time data updates
- Missing financial reconciliation
- No platform-level aggregation

### Code References
```typescript
// Lines 40-50: Mock data loading
const loadReports = async () => {
  setIsLoading(true);
  try {
    // Currently using mock data
    const dataService = DataService.getInstance();
    const reportsData = await dataService.getReports(selectedPeriod);
    setReportData(reportsData);
  } catch (error) {
    console.error('Failed to load reports:', error);
  } finally {
    setIsLoading(false);
  }
};
```

## 2. Data Flow Diagram

```
ReportsScreen
    ↓
DataService.getReports()
    ↓
Returns mock data (lines 480-928)
    ↓
Charts display fake metrics
    ↓
Export creates empty files

Expected Flow:
Backend aggregates data
    ↓
Real-time calculations
    ↓
ReportsScreen displays
    ↓
Export generates actual reports
    ↓
Platform owner sees aggregated data
```

## 3. Every Function & Requirement

### Report Types
1. **Sales Reports**
   - Daily/Weekly/Monthly revenue
   - Transaction volume
   - Average order value
   - Payment method breakdown
   - Peak hours analysis
   - Category performance

2. **Staff Performance**
   - Sales by employee
   - Orders processed
   - Average service time
   - Tips earned
   - Productivity metrics
   - Schedule adherence

3. **Product Analytics**
   - Best sellers
   - Slow movers
   - Profit margins
   - Category performance
   - Combo analysis
   - Waste tracking

4. **Customer Insights**
   - New vs returning
   - Visit frequency
   - Average spend
   - Loyalty participation
   - Demographics
   - Satisfaction scores

5. **Financial Reports**
   - P&L statements
   - Cash flow
   - Tax summaries
   - Service charges
   - Platform fees
   - Reconciliation

### Data Operations
```typescript
// Report Data Structure
interface ReportData {
  period: {
    start: Date;
    end: Date;
    label: string;
  };
  sales: {
    total: number;
    transactions: number;
    average: number;
    growth: number;
    byHour: ChartData[];
    byDay: ChartData[];
    byCategory: ChartData[];
    byPaymentMethod: ChartData[];
  };
  staff: {
    performance: StaffMetrics[];
    topPerformers: Employee[];
    productivity: ProductivityData;
  };
  products: {
    topSellers: ProductRanking[];
    categories: CategoryPerformance[];
    profitability: ProfitData[];
  };
  customers: {
    total: number;
    new: number;
    returning: number;
    segments: SegmentData[];
    satisfaction: number;
  };
}

// Export Formats
type ExportFormat = 'pdf' | 'csv' | 'excel' | 'json';
```

### State Management
```typescript
// Local State
const [selectedPeriod, setSelectedPeriod] = useState('today');
const [selectedReport, setSelectedReport] = useState('sales');
const [reportData, setReportData] = useState<ReportData | null>(null);
const [isLoading, setIsLoading] = useState(false);
const [exportFormat, setExportFormat] = useState<ExportFormat>('pdf');
const [dateRange, setDateRange] = useState({
  start: new Date(),
  end: new Date()
});

// Filter Options
const periods = [
  { value: 'today', label: 'Today' },
  { value: 'yesterday', label: 'Yesterday' },
  { value: 'week', label: 'This Week' },
  { value: 'month', label: 'This Month' },
  { value: 'quarter', label: 'This Quarter' },
  { value: 'year', label: 'This Year' },
  { value: 'custom', label: 'Custom Range' }
];
```

## 4. Platform Connections

### Data Sent to Platform
1. **Aggregated Metrics**
   - Restaurant performance scores
   - Revenue summaries
   - Growth trends
   - Operational efficiency
   - Customer satisfaction

2. **Benchmarking Data**
   - Performance vs other restaurants
   - Industry comparisons
   - Best practices identification
   - Optimization opportunities

3. **Financial Reporting**
   - Platform commission calculations
   - Service charge summaries
   - Payment processing fees
   - Subscription revenue

### Platform Controls
1. **Report Access**
   - Available report types by subscription tier
   - Data retention periods
   - Export limitations
   - API rate limits

2. **Compliance Requirements**
   - Mandatory financial reports
   - Tax documentation
   - Audit trails
   - Data privacy controls

## 5. Backend Requirements

### Database Queries Needed
```sql
-- Sales Summary
SELECT 
  DATE_TRUNC('hour', created_at) as hour,
  COUNT(*) as order_count,
  SUM(total_amount) as revenue,
  AVG(total_amount) as avg_order_value,
  COUNT(DISTINCT customer_id) as unique_customers
FROM orders
WHERE restaurant_id = $1
  AND created_at BETWEEN $2 AND $3
  AND status = 'completed'
GROUP BY hour
ORDER BY hour;

-- Staff Performance
SELECT 
  u.id,
  u.first_name || ' ' || u.last_name as name,
  COUNT(o.id) as orders_processed,
  SUM(o.total_amount) as total_sales,
  AVG(o.tip_amount) as avg_tips,
  AVG(EXTRACT(EPOCH FROM (o.completed_at - o.created_at))/60) as avg_service_time
FROM users u
LEFT JOIN orders o ON u.id = o.processed_by
WHERE u.restaurant_id = $1
  AND o.created_at BETWEEN $2 AND $3
GROUP BY u.id;

-- Product Performance
SELECT 
  p.id,
  p.name,
  p.category,
  COUNT(oi.id) as times_sold,
  SUM(oi.quantity) as total_quantity,
  SUM(oi.subtotal) as total_revenue,
  SUM(oi.subtotal - (oi.quantity * p.cost)) as total_profit,
  (SUM(oi.subtotal - (oi.quantity * p.cost)) / NULLIF(SUM(oi.subtotal), 0)) * 100 as profit_margin
FROM products p
JOIN order_items oi ON p.id = oi.product_id
JOIN orders o ON oi.order_id = o.id
WHERE p.restaurant_id = $1
  AND o.created_at BETWEEN $2 AND $3
  AND o.status = 'completed'
GROUP BY p.id
ORDER BY total_revenue DESC;
```

### API Endpoints Required
```python
# Reports API
GET /api/v1/reports/sales
Query params:
  - restaurant_id: UUID
  - period: string
  - start_date: date
  - end_date: date
Response: {
  summary: {
    total_revenue: number,
    total_orders: number,
    avg_order_value: number,
    growth_percentage: number
  },
  charts: {
    revenue_by_hour: ChartData[],
    revenue_by_day: ChartData[],
    payment_methods: ChartData[],
    categories: ChartData[]
  },
  top_items: ProductSales[]
}

GET /api/v1/reports/staff
Response: {
  performance: [{
    employee_id: string,
    name: string,
    metrics: {
      sales: number,
      orders: number,
      avg_service_time: number,
      customer_rating: number
    }
  }],
  rankings: EmployeeRanking[]
}

GET /api/v1/reports/customers
Response: {
  metrics: {
    total: number,
    new: number,
    returning: number,
    churn_rate: number
  },
  segments: [{
    name: string,
    count: number,
    revenue_contribution: number
  }],
  trends: CustomerTrend[]
}

POST /api/v1/reports/export
Body: {
  report_type: string,
  format: 'pdf' | 'csv' | 'excel',
  period: string,
  filters: object
}
Response: {
  download_url: string,
  expires_at: datetime
}
```

## 6. Current Issues

### Critical Issues
1. **All Data is Mock**
   ```typescript
   // DataService.ts lines 480-928
   async getReports(period: string): Promise<ReportData> {
     // Returns completely fake data
     return {
       sales: {
         total: Math.random() * 10000,
         // etc...
       }
     };
   }
   ```

2. **No Real Calculations**
   - Metrics are random numbers
   - No actual aggregation
   - Trends are meaningless
   - Comparisons are fake

3. **Export Non-functional**
   ```typescript
   const handleExport = async () => {
     // Currently just shows a toast
     // No actual file generation
     showToast('Export feature coming soon');
   };
   ```

### Data Architecture Issues
```typescript
// Missing connections:
Orders → Aggregation → Reports
Inventory → Cost Analysis → Profit Reports
Customers → Behavior Analysis → Insights
Staff → Performance Tracking → Rankings
```

### Missing Features
1. **Real-time Updates**
   - No WebSocket for live data
   - Manual refresh required
   - Stale data problems

2. **Caching Strategy**
   - Reports recalculated every time
   - No performance optimization
   - Slow loading times

3. **Drill-down Capability**
   - Can't click into details
   - No transaction-level data
   - Limited investigation tools

## 7. Required Fixes

### Backend Implementation (Priority 1)
```python
# In reports.py
@router.get("/reports/sales")
async def get_sales_report(
    restaurant_id: str = Query(...),
    start_date: date = Query(...),
    end_date: date = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Use Redis cache for recent queries
    cache_key = f"sales_report:{restaurant_id}:{start_date}:{end_date}"
    cached = await redis.get(cache_key)
    if cached:
        return json.loads(cached)
    
    # Calculate metrics
    summary = calculate_sales_summary(db, restaurant_id, start_date, end_date)
    charts = generate_sales_charts(db, restaurant_id, start_date, end_date)
    top_items = get_top_selling_items(db, restaurant_id, start_date, end_date)
    
    result = {
        "summary": summary,
        "charts": charts,
        "top_items": top_items
    }
    
    # Cache for 5 minutes
    await redis.set(cache_key, json.dumps(result), expire=300)
    
    return result
```

### DataService Connection (Priority 2)
```typescript
// In DataService.ts
async getReports(reportType: string, period: string, customRange?: DateRange): Promise<ReportData> {
  if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
    try {
      const params = {
        restaurant_id: this.currentRestaurantId,
        period,
        start_date: customRange?.start || this.getPeriodStart(period),
        end_date: customRange?.end || this.getPeriodEnd(period)
      };
      
      const [sales, staff, products, customers] = await Promise.all([
        this.db.apiRequest('/api/v1/reports/sales', { params }),
        this.db.apiRequest('/api/v1/reports/staff', { params }),
        this.db.apiRequest('/api/v1/reports/products', { params }),
        this.db.apiRequest('/api/v1/reports/customers', { params })
      ]);
      
      return {
        period: {
          start: new Date(params.start_date),
          end: new Date(params.end_date),
          label: period
        },
        sales: sales.data,
        staff: staff.data,
        products: products.data,
        customers: customers.data
      };
    } catch (error) {
      console.error('Failed to fetch reports:', error);
      throw error;
    }
  }
  // Remove mock data fallback
  throw new Error('Reports API not available');
}
```

### Export Implementation (Priority 3)
```python
# Export service
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
import pandas as pd
import xlsxwriter

@router.post("/reports/export")
async def export_report(
    export_request: ExportRequest,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Generate report data
    data = await generate_report_data(
        db,
        export_request.report_type,
        export_request.restaurant_id,
        export_request.period
    )
    
    # Create export file
    if export_request.format == 'pdf':
        file_path = await generate_pdf_report(data)
    elif export_request.format == 'csv':
        file_path = await generate_csv_report(data)
    elif export_request.format == 'excel':
        file_path = await generate_excel_report(data)
    
    # Upload to S3 or similar
    download_url = await upload_to_storage(file_path)
    
    return {
        "download_url": download_url,
        "expires_at": datetime.utcnow() + timedelta(hours=24)
    }
```

### Real-time Dashboard (Priority 4)
```typescript
// WebSocket integration for live metrics
useEffect(() => {
  if (selectedPeriod === 'today') {
    const ws = new WebSocket(`${WS_URL}/reports/${restaurantId}`);
    
    ws.onmessage = (event) => {
      const update = JSON.parse(event.data);
      if (update.type === 'sales_update') {
        setReportData(prev => ({
          ...prev,
          sales: {
            ...prev.sales,
            total: update.data.total,
            transactions: update.data.transactions
          }
        }));
      }
    };
    
    return () => ws.close();
  }
}, [selectedPeriod, restaurantId]);
```

## 8. Testing Requirements

### Unit Tests
1. Date range calculations
2. Chart data formatting
3. Export file generation
4. Metric calculations
5. Filter logic

### Integration Tests
1. Report generation with real data
2. Export functionality
3. Caching behavior
4. Performance under load
5. Multi-restaurant isolation

### User Acceptance Criteria
- [ ] Reports load within 3 seconds
- [ ] Data matches manual calculations
- [ ] Exports contain complete data
- [ ] Charts are interactive
- [ ] Date filtering works correctly
- [ ] Real-time updates for today's data
- [ ] Drill-down navigation works

## 9. Platform Owner Portal Integration

### Platform Analytics Dashboard
```sql
-- Platform-wide metrics
CREATE VIEW platform_analytics AS
SELECT 
  DATE_TRUNC('day', o.created_at) as date,
  r.id as restaurant_id,
  r.name as restaurant_name,
  r.subscription_plan,
  COUNT(o.id) as orders,
  SUM(o.total_amount) as revenue,
  SUM(o.total_amount * 0.01) as platform_commission,
  SUM(o.service_charge_amount) as service_charges,
  AVG(o.total_amount) as avg_order_value
FROM orders o
JOIN restaurants r ON o.restaurant_id = r.id
WHERE o.status = 'completed'
GROUP BY date, r.id;

-- Restaurant performance ranking
WITH restaurant_metrics AS (
  SELECT 
    restaurant_id,
    SUM(total_amount) as total_revenue,
    COUNT(*) as total_orders,
    AVG(total_amount) as avg_order,
    COUNT(DISTINCT customer_id) as unique_customers,
    COUNT(DISTINCT DATE(created_at)) as active_days
  FROM orders
  WHERE created_at > NOW() - INTERVAL '30 days'
    AND status = 'completed'
  GROUP BY restaurant_id
)
SELECT 
  r.name,
  rm.*,
  RANK() OVER (ORDER BY total_revenue DESC) as revenue_rank,
  RANK() OVER (ORDER BY total_orders DESC) as volume_rank
FROM restaurant_metrics rm
JOIN restaurants r ON rm.restaurant_id = r.id
ORDER BY total_revenue DESC;
```

### Platform Reports
1. **Revenue Analytics**
   - Commission tracking
   - Subscription revenue
   - Payment processing fees
   - Growth trends

2. **Operational Insights**
   - System usage patterns
   - Feature adoption rates
   - Performance metrics
   - Error rates

3. **Comparative Analysis**
   - Restaurant benchmarking
   - Category performance
   - Regional trends
   - Seasonal patterns

## Next Steps

1. **Immediate**: Remove mock data from DataService
2. **Today**: Implement basic sales report endpoint
3. **Tomorrow**: Add staff and product analytics
4. **This Week**: Export functionality
5. **Next Week**: Real-time dashboard updates
6. **Platform**: Aggregated analytics for platform owners

## Related Documentation
- See `08_DASHBOARD_SCREEN_ANALYSIS.md` for real-time metrics
- See `13_BACKEND_REQUIREMENTS.md` for analytics endpoints
- See `DataService.ts` for report methods