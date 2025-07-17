# Inventory Screen - Comprehensive Analysis

## Screen Overview
**File**: `src/screens/inventory/InventoryScreen.tsx`  
**Purpose**: Stock management and inventory tracking  
**Status**: 🟡 UI complete with advanced features but no backend  
**Production Ready**: 30%

## 1. Current State Analysis

### What's Implemented ✅
- Inventory list with stock levels
- Low stock alerts
- Search and category filtering
- Add/Edit item modals
- Restock functionality
- Receipt scanning modal (UI only)
- Stock status indicators
- Supplier management
- Loading and error states
- Feature flag support (ENV.FEATURE_INVENTORY)

### What's Not Working ❌
- No real inventory data from backend
- DataService.getInventory() not implemented
- Receipt scanning not functional
- Stock updates don't persist
- No integration with POS sales
- Supplier management not connected
- No purchase order system

### Code References
```typescript
// Lines 97-108: Data loading
const loadInventory = async () => {
  setIsLoading(true);
  setError(null);
  try {
    const dataService = DataService.getInstance();
    const inventoryData = await dataService.getInventory();
    setInventory(inventoryData || []);
  } catch (e: any) {
    setError(e.message || 'Failed to load inventory.');
    setInventory([]);
  } finally {
    setIsLoading(false);
  }
};
```

## 2. Data Flow Diagram

```
InventoryScreen
    ↓
DataService.getInventory() [MISSING]
    ↓
Should connect to InventoryItem table
    ↓
GET /api/v1/inventory
    ↓
Backend returns empty/mock
    ↓
Screen shows empty state

Expected Flow:
POS Sales → Deduct inventory
    ↓
Inventory tracking
    ↓
Low stock alerts
    ↓
Reorder suggestions
    ↓
Purchase orders
```

## 3. Every Function & Requirement

### User Actions
1. **View Inventory**
   - List all inventory items
   - See current stock levels
   - View reorder points
   - Check stock value
   - Monitor expiry dates

2. **Inventory Management**
   - Add new items
   - Edit item details
   - Adjust stock levels
   - Set reorder points
   - Track suppliers
   - Manage categories

3. **Stock Operations**
   - Manual stock count
   - Restock items
   - Transfer between locations
   - Write off damaged goods
   - Track wastage

4. **Receipt Scanning**
   - Scan supplier receipts
   - Auto-populate items
   - Update stock levels
   - Track purchase prices

### Data Operations
```typescript
// Inventory Data Structure
interface InventoryData {
  id: string;
  name: string;
  category: string;
  currentStock: number;
  unit: string;
  minimumStock: number;
  maximumStock: number;
  reorderPoint: number;
  unitCost: number;
  supplier: string;
  supplierId?: string;
  lastRestocked: Date;
  expiryDate?: Date;
  location?: string;
  barcode?: string;
  status: 'in-stock' | 'low-stock' | 'out-of-stock' | 'expired';
}

// Stock Movement Types
type StockMovement = {
  id: string;
  itemId: string;
  type: 'purchase' | 'sale' | 'adjustment' | 'transfer' | 'wastage';
  quantity: number;
  previousStock: number;
  newStock: number;
  reason?: string;
  reference?: string; // Order ID, PO number, etc.
  performedBy: string;
  timestamp: Date;
};
```

### State Management
```typescript
// Local State
const [inventory, setInventory] = useState<InventoryData[]>([]);
const [filteredInventory, setFilteredInventory] = useState<InventoryData[]>([]);
const [searchQuery, setSearchQuery] = useState('');
const [selectedCategory, setSelectedCategory] = useState('all');
const [selectedStatus, setSelectedStatus] = useState('all');
const [selectedItem, setSelectedItem] = useState<InventoryData | null>(null);
const [isLoading, setIsLoading] = useState<boolean>(true);
const [error, setError] = useState<string | null>(null);
const [showRestockModal, setShowRestockModal] = useState(false);
const [showEditModal, setShowEditModal] = useState(false);
const [showReceiptScanModal, setShowReceiptScanModal] = useState(false);
const [showAddItemModal, setShowAddItemModal] = useState(false);

// Form States
const [editFormData, setEditFormData] = useState({
  name: '',
  category: '',
  currentStock: '',
  minimumStock: '',
  maximumStock: '',
  unitCost: '',
  supplier: '',
});
```

## 4. Platform Connections

### Data Sent to Platform
1. **Inventory Metrics**
   - Total inventory value
   - Stock turnover rate
   - Wastage percentages
   - Supplier performance
   - Category distribution

2. **Operational Alerts**
   - Low stock warnings
   - Expired items
   - Unusual consumption patterns
   - Price variance alerts

3. **Cost Analysis**
   - Cost of goods sold (COGS)
   - Inventory holding costs
   - Purchase price trends
   - Supplier cost comparison

### Platform Controls
1. **Inventory Policies**
   - Reorder point formulas
   - Safety stock levels
   - Approved supplier lists
   - Price approval thresholds

2. **Compliance Settings**
   - Expiry date tracking rules
   - Wastage reporting requirements
   - Audit trail configuration

## 5. Backend Requirements

### Database Tables
```sql
-- InventoryItem table (exists)
inventory_items:
  - id (UUID)
  - restaurant_id (UUID)
  - product_id (UUID, nullable) -- Link to menu items
  - name (VARCHAR)
  - category (VARCHAR)
  - current_quantity (DECIMAL)
  - unit (VARCHAR)
  - reorder_level (DECIMAL)
  - maximum_stock (DECIMAL)
  - unit_cost (DECIMAL)
  - total_value (DECIMAL, computed)
  - location (VARCHAR)
  - barcode (VARCHAR)
  - expiry_date (DATE)
  - is_active (BOOLEAN)
  - created_at (TIMESTAMP)
  - updated_at (TIMESTAMP)

-- Stock Movements (needs creation)
stock_movements:
  - id (UUID)
  - inventory_item_id (UUID, FK)
  - movement_type (ENUM)
  - quantity (DECIMAL) -- Positive for in, negative for out
  - unit_cost (DECIMAL)
  - total_cost (DECIMAL)
  - reference_type (VARCHAR) -- 'order', 'purchase_order', 'adjustment'
  - reference_id (UUID)
  - reason (TEXT)
  - performed_by (UUID, FK to users)
  - created_at (TIMESTAMP)

-- Suppliers (exists)
suppliers:
  - id (UUID)
  - restaurant_id (UUID)
  - name (VARCHAR)
  - contact_name (VARCHAR)
  - email (VARCHAR)
  - phone (VARCHAR)
  - address (JSONB)
  - payment_terms (VARCHAR)
  - is_active (BOOLEAN)

-- Purchase Orders (exists)
purchase_orders:
  - id (UUID)
  - restaurant_id (UUID)
  - supplier_id (UUID)
  - order_number (VARCHAR)
  - status (ENUM)
  - total_amount (DECIMAL)
  - ordered_at (TIMESTAMP)
  - expected_at (TIMESTAMP)
  - received_at (TIMESTAMP)
```

### API Endpoints Required
```python
# Inventory Management
GET /api/v1/inventory?restaurant_id={id}&status={status}&category={category}
Response: {
  items: [{
    id: string,
    name: string,
    category: string,
    currentStock: number,
    unit: string,
    minimumStock: number,
    maximumStock: number,
    unitCost: number,
    totalValue: number,
    supplier: {
      id: string,
      name: string
    },
    lastRestocked: string,
    status: string
  }],
  summary: {
    totalItems: number,
    totalValue: number,
    lowStockCount: number,
    outOfStockCount: number
  }
}

POST /api/v1/inventory
Body: {
  name: string,
  category: string,
  initialStock: number,
  unit: string,
  reorderLevel: number,
  maximumStock: number,
  unitCost: number,
  supplierId: string,
  barcode?: string,
  expiryDate?: string
}

PUT /api/v1/inventory/{id}
Body: Partial<InventoryItem>

# Stock Operations
POST /api/v1/inventory/{id}/adjust
Body: {
  adjustment: number, // Positive or negative
  reason: string,
  type: 'restock' | 'count' | 'wastage' | 'damage'
}

POST /api/v1/inventory/{id}/transfer
Body: {
  toLocation: string,
  quantity: number,
  reason: string
}

# Receipt Scanning
POST /api/v1/inventory/receipt/scan
Body: {
  image: base64,
  supplierId?: string
}
Response: {
  items: [{
    name: string,
    quantity: number,
    unitPrice: number,
    matched?: boolean,
    inventoryItemId?: string
  }],
  total: number,
  supplier: string,
  date: string
}

# Reports
GET /api/v1/inventory/movements?item_id={id}&date_from={date}&date_to={date}
GET /api/v1/inventory/valuation?date={date}
GET /api/v1/inventory/consumption?period={period}
```

## 6. Current Issues

### Critical Issues
1. **No DataService Implementation**
   ```typescript
   // Missing in DataService.ts
   async getInventory(): Promise<InventoryData[]> {
     // Not implemented
   }
   ```

2. **No POS Integration**
   - Sales don't deduct inventory
   - No real-time stock tracking
   - Recipe-based deduction missing

3. **Receipt Scanning Non-functional**
   - UI exists but no OCR backend
   - No API endpoint for processing
   - Manual entry still required

### Data Flow Issues
```typescript
// Current: Isolated inventory management
// Needed: Integrated flow
POS Order → Recipe lookup → Ingredient deduction → Stock update → Alert if low
```

### Missing Features
1. **Automatic Deduction**
   - Link products to inventory items
   - Recipe-based consumption
   - Real-time updates

2. **Purchase Orders**
   - Create from low stock
   - Track deliveries
   - Update stock on receipt

3. **Analytics**
   - Usage patterns
   - Waste tracking
   - Cost analysis

## 7. Required Fixes

### DataService Implementation (Priority 1)
```typescript
// In DataService.ts
async getInventory(): Promise<InventoryData[]> {
  if (this.featureFlags.USE_REAL_API && this.isBackendAvailable) {
    try {
      const response = await this.db.apiRequest('/api/v1/inventory');
      return response.data.items.map(this.transformInventoryItem);
    } catch (error) {
      console.error('Failed to fetch inventory:', error);
      throw error;
    }
  }
  return [];
}

private transformInventoryItem(item: any): InventoryData {
  const currentStock = parseFloat(item.currentStock);
  const minimumStock = parseFloat(item.minimumStock || item.reorderLevel);
  
  return {
    id: item.id,
    name: item.name,
    category: item.category,
    currentStock: currentStock,
    unit: item.unit,
    minimumStock: minimumStock,
    maximumStock: parseFloat(item.maximumStock || 0),
    reorderPoint: minimumStock,
    unitCost: parseFloat(item.unitCost || 0),
    supplier: item.supplier?.name || '',
    supplierId: item.supplier?.id,
    lastRestocked: new Date(item.lastRestocked || item.updated_at),
    expiryDate: item.expiryDate ? new Date(item.expiryDate) : undefined,
    location: item.location,
    barcode: item.barcode,
    status: this.calculateStockStatus(currentStock, minimumStock)
  };
}

private calculateStockStatus(current: number, minimum: number): string {
  if (current <= 0) return 'out-of-stock';
  if (current <= minimum) return 'low-stock';
  return 'in-stock';
}
```

### Backend Implementation (Priority 2)
```python
# In inventory.py
@router.get("/inventory")
async def get_inventory(
    restaurant_id: str = Query(...),
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    query = db.query(InventoryItem).filter(
        InventoryItem.restaurant_id == restaurant_id,
        InventoryItem.is_active == True
    )
    
    if category and category != 'all':
        query = query.filter(InventoryItem.category == category)
    
    items = query.all()
    
    # Filter by status after fetching
    if status and status != 'all':
        items = [item for item in items if calculate_status(item) == status]
    
    # Calculate summary
    summary = {
        "totalItems": len(items),
        "totalValue": sum(item.current_quantity * item.unit_cost for item in items),
        "lowStockCount": len([i for i in items if i.current_quantity <= i.reorder_level]),
        "outOfStockCount": len([i for i in items if i.current_quantity <= 0])
    }
    
    return {
        "items": [format_inventory_item(item) for item in items],
        "summary": summary
    }

# Stock adjustment endpoint
@router.post("/inventory/{item_id}/adjust")
async def adjust_stock(
    item_id: str,
    adjustment: StockAdjustment,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    item = db.query(InventoryItem).filter(InventoryItem.id == item_id).first()
    if not item:
        raise HTTPException(404, "Item not found")
    
    # Record movement
    movement = StockMovement(
        inventory_item_id=item.id,
        movement_type=adjustment.type,
        quantity=adjustment.adjustment,
        unit_cost=item.unit_cost,
        total_cost=abs(adjustment.adjustment * item.unit_cost),
        reason=adjustment.reason,
        performed_by=current_user.id
    )
    
    # Update stock
    item.current_quantity += adjustment.adjustment
    
    db.add(movement)
    db.commit()
    
    return {"success": True, "new_quantity": item.current_quantity}
```

### POS Integration (Priority 3)
```python
# Auto-deduct on order completion
@event.listens_for(Order, 'after_update')
def deduct_inventory_on_order(mapper, connection, target):
    if target.status == 'completed':
        # Get order items with recipes
        for order_item in target.items:
            if order_item.product.recipe:
                for ingredient in order_item.product.recipe.ingredients:
                    # Deduct inventory
                    deduct_amount = ingredient.quantity * order_item.quantity
                    
                    # Create stock movement
                    movement = StockMovement(
                        inventory_item_id=ingredient.inventory_item_id,
                        movement_type='sale',
                        quantity=-deduct_amount,
                        reference_type='order',
                        reference_id=target.id,
                        reason=f'Sold in order {target.order_number}'
                    )
                    
                    # Check if low stock alert needed
                    if ingredient.inventory_item.current_quantity <= ingredient.inventory_item.reorder_level:
                        create_low_stock_alert(ingredient.inventory_item)
```

### Receipt Scanning Implementation (Priority 4)
```python
# OCR endpoint for receipt scanning
@router.post("/inventory/receipt/scan")
async def scan_receipt(
    file: UploadFile = File(...),
    supplier_id: Optional[str] = Query(None),
    db: Session = Depends(get_db)
):
    # Save uploaded file
    contents = await file.read()
    
    # Process with OCR (using Google Vision API or similar)
    ocr_results = await process_receipt_ocr(contents)
    
    # Extract items and amounts
    extracted_items = parse_receipt_text(ocr_results)
    
    # Try to match with existing inventory items
    matched_items = []
    for item in extracted_items:
        match = find_inventory_match(db, item['name'], restaurant_id)
        matched_items.append({
            **item,
            'matched': match is not None,
            'inventoryItemId': match.id if match else None
        })
    
    return {
        "items": matched_items,
        "total": sum(item['quantity'] * item['unitPrice'] for item in matched_items),
        "supplier": ocr_results.get('supplier_name', ''),
        "date": ocr_results.get('date', datetime.now().isoformat())
    }
```

## 8. Testing Requirements

### Unit Tests
1. Stock status calculations
2. Reorder point logic
3. Value calculations
4. Search and filtering
5. Stock adjustment validation

### Integration Tests
1. POS sale → inventory deduction
2. Receipt scan → stock update
3. Low stock → alert generation
4. Purchase order → stock receipt
5. Multi-location transfers

### User Acceptance Criteria
- [ ] Inventory loads within 2 seconds
- [ ] Stock updates immediately on sale
- [ ] Low stock alerts appear promptly
- [ ] Receipt scanning accuracy > 90%
- [ ] Stock counts persist
- [ ] Reports generate accurately
- [ ] Supplier management works

## 9. Platform Owner Portal Integration

### Inventory Analytics Dashboard
1. **Cross-Restaurant Metrics**
   ```sql
   -- Inventory efficiency by restaurant
   SELECT 
     r.name as restaurant,
     COUNT(ii.id) as total_items,
     SUM(ii.current_quantity * ii.unit_cost) as inventory_value,
     AVG(CASE WHEN ii.current_quantity <= ii.reorder_level THEN 1 ELSE 0 END) as low_stock_rate,
     SUM(sm.quantity * sm.unit_cost) / NULLIF(SUM(ii.current_quantity * ii.unit_cost), 0) as turnover_rate
   FROM restaurants r
   LEFT JOIN inventory_items ii ON r.id = ii.restaurant_id
   LEFT JOIN stock_movements sm ON ii.id = sm.inventory_item_id 
     AND sm.movement_type = 'sale' 
     AND sm.created_at > NOW() - INTERVAL '30 days'
   GROUP BY r.id;
   ```

2. **Waste Analysis**
   - Waste by category
   - Expiry tracking
   - Damage patterns
   - Cost of waste trends

3. **Supplier Performance**
   ```typescript
   interface SupplierMetrics {
     supplier_id: string;
     on_time_delivery_rate: number;
     price_variance: number;
     quality_issues: number;
     total_spend: number;
     item_count: number;
   }
   ```

### Operational Alerts
1. **Inventory Alerts**
   - Critical stock levels
   - Unusual consumption
   - Price anomalies
   - Expiry warnings

2. **Cost Control**
   - COGS trends
   - Price increase alerts
   - Wastage thresholds
   - Inventory holding costs

### Platform Reports
```sql
-- Top consumed items across platform
SELECT 
  ii.name as item,
  ii.category,
  SUM(ABS(sm.quantity)) as total_consumed,
  COUNT(DISTINCT ii.restaurant_id) as restaurants_using,
  AVG(ii.unit_cost) as avg_cost
FROM inventory_items ii
JOIN stock_movements sm ON ii.id = sm.inventory_item_id
WHERE sm.movement_type = 'sale' AND sm.created_at > NOW() - INTERVAL '30 days'
GROUP BY ii.name, ii.category
ORDER BY total_consumed DESC
LIMIT 50;

-- Inventory optimization opportunities
WITH inventory_metrics AS (
  SELECT 
    restaurant_id,
    category,
    SUM(current_quantity * unit_cost) as category_value,
    AVG(EXTRACT(days FROM NOW() - updated_at)) as avg_days_since_movement
  FROM inventory_items
  GROUP BY restaurant_id, category
)
SELECT 
  r.name,
  im.category,
  im.category_value,
  im.avg_days_since_movement,
  CASE 
    WHEN avg_days_since_movement > 30 THEN 'Slow moving - consider reduction'
    WHEN avg_days_since_movement < 3 THEN 'Fast moving - consider bulk ordering'
    ELSE 'Optimal'
  END as recommendation
FROM inventory_metrics im
JOIN restaurants r ON im.restaurant_id = r.id
ORDER BY im.category_value DESC;
```

## Next Steps

1. **Immediate**: Implement getInventory in DataService
2. **Today**: Create stock_movements table migration
3. **Tomorrow**: Link POS sales to inventory
4. **This Week**: Basic stock adjustments working
5. **Next Week**: Receipt scanning MVP
6. **Platform**: Inventory analytics dashboard

## Related Documentation
- See `01_POS_SCREEN_ANALYSIS.md` for sales integration
- See `13_BACKEND_REQUIREMENTS.md` for InventoryItem model
- See `Recipe.tsx` for ingredient management