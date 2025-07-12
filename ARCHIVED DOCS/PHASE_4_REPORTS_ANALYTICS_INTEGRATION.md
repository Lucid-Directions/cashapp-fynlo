# 📊 Phase 4: Reports & Analytics Integration

## Overview

Transform all static mock reports into dynamic, real-time analytics powered by actual business data. This phase ensures restaurant owners have accurate insights for decision-making.

**Duration**: 3 days  
**Priority**: MEDIUM  
**Dependencies**: Orders, inventory, and employee data must be real  

## 🎯 Goals

1. Replace ALL mock report data with real analytics
2. Implement real-time dashboard updates
3. Add data visualization components
4. Enable report exports (PDF, CSV)
5. Add custom date range selections
6. Implement performance optimizations

## 📍 Current Mock Data Locations

### DataService.ts Report Methods
- **Lines 705-928**: All report methods return mock data
  - `getSalesReport()` - Mock sales data
  - `getFinancialReport()` - Mock financial data
  - `getStaffReport()` - Mock staff performance
  - `getLaborReport()` - Mock labor costs
  - `getInventoryReport()` - Mock inventory data

### DatabaseService.ts Analytics
- **Lines 831-872**: Hardcoded analytics dashboard data

## 🛠️ Implementation Tasks

### Task 1: Sales Reports Integration (Day 1 Morning)
- [ ] Connect to real sales data endpoint
- [ ] Implement date range filtering
- [ ] Add product performance metrics
- [ ] Create sales trend visualization
- [ ] Add comparison periods

```typescript
// Sales report implementation
interface SalesReport {
  total_revenue: number;
  total_orders: number;
  average_order_value: number;
  top_products: ProductSales[];
  hourly_breakdown: HourlySales[];
  payment_methods_breakdown: PaymentBreakdown[];
  trends: SalesTrend[];
}

async getSalesReport(params: {
  start_date: string;
  end_date: string;
  restaurant_id: string;
  compare_to?: string; // previous_period, last_year
}): Promise<SalesReport> {
  const response = await api.get('/api/v1/reports/sales', { params });
  return response.data.data;
}
```

### Task 2: Financial Reports Integration (Day 1 Afternoon)
- [ ] Connect profit/loss calculations
- [ ] Add expense tracking
- [ ] Implement tax summaries
- [ ] Create cash flow reports
- [ ] Add financial projections

```typescript
// Financial report structure
interface FinancialReport {
  revenue: RevenueBreakdown;
  expenses: ExpenseBreakdown;
  profit_loss: ProfitLossStatement;
  tax_summary: TaxSummary;
  cash_flow: CashFlowStatement;
  projections?: FinancialProjections;
}

async getFinancialReport(params: {
  period: 'daily' | 'weekly' | 'monthly' | 'yearly';
  date: string;
  include_projections?: boolean;
}): Promise<FinancialReport>
```

### Task 3: Staff Performance Reports (Day 1 Afternoon)
- [ ] Connect employee sales data
- [ ] Add productivity metrics
- [ ] Implement performance rankings
- [ ] Create individual reports
- [ ] Add tips analysis

```typescript
// Staff performance metrics
interface StaffReport {
  employee_performance: EmployeeMetrics[];
  sales_by_employee: SalesByEmployee[];
  productivity_scores: ProductivityScore[];
  attendance_summary: AttendanceSummary;
  tips_analysis: TipsBreakdown;
}

async getStaffReport(params: {
  start_date: string;
  end_date: string;
  employee_id?: string; // Optional for individual reports
}): Promise<StaffReport>
```

### Task 4: Labor Cost Reports (Day 2 Morning)
- [ ] Calculate actual labor costs
- [ ] Add overtime analysis
- [ ] Implement scheduling efficiency
- [ ] Create cost projections
- [ ] Add labor vs revenue ratios

```typescript
// Labor cost analysis
interface LaborReport {
  total_labor_cost: number;
  labor_percentage: number;
  overtime_costs: number;
  scheduling_efficiency: number;
  hourly_breakdown: HourlyLabor[];
  employee_costs: EmployeeCost[];
}
```

### Task 5: Inventory Reports (Day 2 Morning)
- [ ] Connect real inventory data
- [ ] Add usage tracking
- [ ] Implement waste analysis
- [ ] Create reorder suggestions
- [ ] Add cost analysis

```typescript
// Inventory analytics
interface InventoryReport {
  current_value: number;
  usage_trends: UsageTrend[];
  waste_analysis: WasteReport;
  reorder_suggestions: ReorderItem[];
  cost_breakdown: InventoryCost[];
  turnover_rate: number;
}
```

### Task 6: Real-time Dashboard (Day 2 Afternoon)
- [ ] Replace mock dashboard data
- [ ] Implement WebSocket updates
- [ ] Add live order tracking
- [ ] Create activity feed
- [ ] Add alerts system

```typescript
// Live dashboard implementation
class DashboardService {
  async getDashboardData(): Promise<DashboardData> {
    const [sales, orders, staff, alerts] = await Promise.all([
      this.getTodaySales(),
      this.getActiveOrders(),
      this.getStaffStatus(),
      this.getActiveAlerts()
    ]);
    
    return { sales, orders, staff, alerts };
  }
  
  subscribeToDashboardUpdates(callback: (data: DashboardUpdate) => void): void {
    websocket.subscribe('dashboard.update', callback);
  }
}
```

### Task 7: Data Visualization Components (Day 2 Afternoon)
- [ ] Implement chart components
- [ ] Add interactive graphs
- [ ] Create comparison views
- [ ] Add drill-down capability
- [ ] Implement responsive design

```typescript
// Chart components
<SalesChart 
  data={salesData}
  type="line"
  period="weekly"
  interactive={true}
  onDataPointClick={handleDrillDown}
/>

<RevenueComparison
  current={currentPeriod}
  previous={previousPeriod}
  format="percentage"
/>
```

### Task 8: Report Export Functionality (Day 3 Morning)
- [ ] Implement PDF generation
- [ ] Add CSV export
- [ ] Create email reports
- [ ] Add scheduled reports
- [ ] Implement templates

```typescript
// Export functionality
async exportReport(params: {
  type: 'sales' | 'financial' | 'staff' | 'inventory';
  format: 'pdf' | 'csv' | 'excel';
  date_range: DateRange;
  email_to?: string;
}): Promise<ExportResult> {
  const report = await this.generateReport(params);
  const file = await this.formatReport(report, params.format);
  
  if (params.email_to) {
    await this.emailReport(file, params.email_to);
  }
  
  return { file_url: file.url, expires_at: file.expires };
}
```

### Task 9: Performance Optimization (Day 3 Afternoon)
- [ ] Implement report caching
- [ ] Add lazy loading
- [ ] Optimize queries
- [ ] Add pagination
- [ ] Implement data aggregation

### Task 10: Testing & Polish (Day 3 Afternoon)
- [ ] Test all report types
- [ ] Verify calculations
- [ ] Check performance
- [ ] Add loading states
- [ ] Polish UI/UX

## 🔍 Verification Checklist

### Data Accuracy
- [ ] Sales totals match orders
- [ ] Financial calculations correct
- [ ] Staff hours accurate
- [ ] Inventory counts verified
- [ ] Date ranges working

### Performance
- [ ] Reports load < 2 seconds
- [ ] Charts render smoothly
- [ ] Exports complete quickly
- [ ] No UI freezing
- [ ] Efficient data caching

### User Experience
- [ ] Clear data visualizations
- [ ] Intuitive date selection
- [ ] Smooth interactions
- [ ] Helpful empty states
- [ ] Export options visible

## 📊 Report Screen Updates

### Update These Screens
1. `src/screens/reports/ReportsScreenSimple.tsx`
2. `src/screens/reports/SalesReportDetailScreen.tsx`
3. `src/screens/reports/FinancialReportDetailScreen.tsx`
4. `src/screens/reports/StaffReportDetailScreen.tsx`
5. `src/screens/reports/InventoryReportDetailScreen.tsx`
6. `src/screens/main/DashboardScreen.tsx`

### Add These Components
```typescript
// New visualization components
src/components/charts/SalesChart.tsx
src/components/charts/RevenueChart.tsx
src/components/charts/StaffPerformanceChart.tsx
src/components/reports/ReportHeader.tsx
src/components/reports/DateRangePicker.tsx
src/components/reports/ExportButton.tsx
```

## 🎨 UI/UX Improvements

### Chart Library
```bash
npm install react-native-chart-kit react-native-svg
```

### Chart Examples
```typescript
// Sales trend chart
<LineChart
  data={{
    labels: dates,
    datasets: [{
      data: salesValues,
      color: (opacity = 1) => `rgba(81, 150, 244, ${opacity})`,
    }]
  }}
  width={screenWidth - 32}
  height={220}
  chartConfig={{
    backgroundColor: theme.colors.background,
    backgroundGradientFrom: theme.colors.card,
    backgroundGradientTo: theme.colors.card,
    decimalPlaces: 0,
    color: (opacity = 1) => theme.colors.primary,
  }}
  bezier
  style={{ borderRadius: 16 }}
/>
```

## 📈 Success Metrics

- ✅ All reports show real data
- ✅ No mock data remaining
- ✅ Charts update in real-time
- ✅ Exports working properly
- ✅ Performance targets met

## 🔧 API Endpoints

```typescript
// Report endpoints
GET /api/v1/reports/sales
GET /api/v1/reports/financial
GET /api/v1/reports/staff
GET /api/v1/reports/labor
GET /api/v1/reports/inventory
GET /api/v1/reports/custom

// Dashboard endpoint
GET /api/v1/dashboard
WS  /ws/dashboard

// Export endpoints
POST /api/v1/reports/export
GET  /api/v1/reports/export/{id}/status
```

## 📅 Daily Milestones

- **Day 1**: Sales + Financial + Staff reports ✅
- **Day 2**: Labor + Inventory + Dashboard ✅
- **Day 3**: Exports + Optimization + Testing ✅

## ⚠️ Common Issues

1. **Large data sets** - Implement pagination
2. **Slow calculations** - Use backend aggregation
3. **Chart performance** - Limit data points
4. **Export timeouts** - Use async processing
5. **Cache invalidation** - Set proper TTLs

---

**Status**: Ready to Begin  
**Blockers**: Requires real order/inventory data  
**Next Step**: Connect sales report to backend