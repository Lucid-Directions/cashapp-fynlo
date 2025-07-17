# 🧹 Code Cleanup Guide - Comprehensive Checklist

**Purpose**: Ensure clean, maintainable code with zero duplication
**Scope**: All three systems (Mobile, Backend, Platform)
**Priority**: Critical for long-term maintainability

---

## 🎯 Overview

This guide provides a systematic approach to cleaning up the Fynlo POS codebase, removing all duplication, dead code, and implementing consistent patterns across all systems.

---

## 📋 Mobile App Cleanup (CashApp-iOS/CashAppPOS)

### 1. Remove Mock Data References

**Search Patterns**:
```bash
# Find all mock data references
grep -r "MockDataService" src/
grep -r "mockData" src/
grep -r "demoMode" src/
grep -r "// TODO: Replace with real" src/
grep -r "hardcoded" src/
```

**Files to Check**:
- [ ] `src/services/MockDataService.ts` - DELETE entire file
- [ ] `src/services/DataService.ts` - Remove mock fallbacks
- [ ] `src/screens/pos/POSScreen.tsx` - Remove hardcoded menu
- [ ] `src/screens/auth/LoginScreen.tsx` - Remove demo login
- [ ] `src/screens/orders/OrdersScreen.tsx` - Remove mock orders
- [ ] `src/screens/inventory/InventoryScreen.tsx` - Remove fake inventory

**Replacement Pattern**:
```typescript
// BEFORE (with mock fallback)
try {
  const response = await api.getMenu();
  return response.data;
} catch (error) {
  return MockDataService.getMenu(); // REMOVE THIS
}

// AFTER (proper error handling)
try {
  const response = await api.getMenu();
  return response.data;
} catch (error) {
  console.error('Failed to load menu:', error);
  throw new Error('Unable to load menu. Please try again.');
}
```

### 2. Remove Duplicate Type Definitions

**Search for Duplicates**:
```bash
# Find duplicate interfaces
grep -r "interface User {" src/
grep -r "interface Order {" src/
grep -r "interface Restaurant {" src/
grep -r "interface Product {" src/
grep -r "type OrderStatus" src/
```

**Files to Clean**:
- [ ] `src/types/index.ts` - Remove all, use @fynlo/shared
- [ ] `src/types/api.ts` - Remove all, use @fynlo/shared
- [ ] `src/types/models.ts` - Remove all, use @fynlo/shared
- [ ] `src/screens/*/types.ts` - Remove local type files
- [ ] `src/services/types.ts` - Remove service-specific types

**Migration Script**:
```typescript
// update-imports.js
const glob = require('glob');
const fs = require('fs');

const files = glob.sync('src/**/*.{ts,tsx}');

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Replace local imports with shared
  content = content.replace(
    /from ['"]\.\.\/types['"]/g,
    'from \'@fynlo/shared\''
  );
  
  content = content.replace(
    /from ['"]\.\.\/\.\.\/types['"]/g,
    'from \'@fynlo/shared\''
  );
  
  fs.writeFileSync(file, content);
});
```

### 3. Remove Console Statements

**Automated Removal**:
```javascript
// remove-console.js
const glob = require('glob');
const fs = require('fs');

const files = glob.sync('src/**/*.{ts,tsx}', {
  ignore: ['**/*.test.ts', '**/*.test.tsx']
});

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  
  // Remove console.log statements
  content = content.replace(/console\.(log|warn|error|info)\([^)]*\);?\n?/g, '');
  
  // Remove empty lines left by removal
  content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
  
  fs.writeFileSync(file, content);
});

console.log(`Cleaned ${files.length} files`);
```

### 4. Fix Theme Usage

**Find Hardcoded Colors**:
```bash
grep -r "Colors\." src/ | grep -v "theme"
grep -r "#[0-9a-fA-F]{6}" src/ # Hex colors
grep -r "rgb(" src/
```

**Replace Pattern**:
```typescript
// BEFORE
import { Colors } from '../constants/Colors';

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.light.background,
    borderColor: Colors.light.primary
  }
});

// AFTER
import { useTheme } from '../contexts/ThemeContext';

const MyComponent = () => {
  const { theme } = useTheme();
  
  const styles = StyleSheet.create({
    container: {
      backgroundColor: theme.colors.background,
      borderColor: theme.colors.primary
    }
  });
};
```

### 5. Remove Commented Code

**Find Commented Code**:
```bash
# Find single-line commented code
grep -r "^[[:space:]]*//.*[{};]" src/

# Find multi-line comments
grep -r "/\*" src/ | grep -v "@"
```

**Cleanup Rules**:
- Remove commented-out code blocks
- Keep documentation comments (/** */)
- Keep TODO comments with ticket numbers
- Remove "temporary" debugging comments

### 6. Dead Code Elimination

**Find Unused Exports**:
```bash
# Use ts-prune for TypeScript
npx ts-prune | grep -v "used in module"
```

**Find Unused Components**:
```javascript
// find-unused-components.js
const glob = require('glob');
const fs = require('fs');

// Get all component files
const components = glob.sync('src/components/**/*.tsx')
  .map(file => {
    const name = file.split('/').pop().replace('.tsx', '');
    return { file, name };
  });

// Search for usage
components.forEach(({ file, name }) => {
  const pattern = new RegExp(`<${name}|import.*${name}`, 'g');
  const files = glob.sync('src/**/*.{ts,tsx}');
  
  let usageCount = 0;
  files.forEach(f => {
    if (f !== file) {
      const content = fs.readFileSync(f, 'utf8');
      if (pattern.test(content)) usageCount++;
    }
  });
  
  if (usageCount === 0) {
    console.log(`Unused component: ${file}`);
  }
});
```

### 7. Async/Await Consistency

**Find Promise Chains**:
```bash
grep -r "\.then(" src/ | grep -v "test"
grep -r "\.catch(" src/ | grep -v "test"
```

**Convert to Async/Await**:
```typescript
// BEFORE
function loadData() {
  api.getData()
    .then(response => {
      setData(response.data);
    })
    .catch(error => {
      setError(error.message);
    });
}

// AFTER
async function loadData() {
  try {
    const response = await api.getData();
    setData(response.data);
  } catch (error) {
    setError(error.message);
  }
}
```

---

## 📋 Backend Cleanup (backend/)

### 1. Remove Duplicate Models

**Check for Duplicates**:
```bash
# Find duplicate SQLAlchemy models
grep -r "class User(" app/
grep -r "class Restaurant(" app/
grep -r "class Order(" app/
```

**Consolidation Points**:
- [ ] Move all models to `app/models/`
- [ ] Remove model definitions from endpoints
- [ ] Use single source of truth for each model
- [ ] Ensure consistent relationships

### 2. API Response Standardization

**Find Non-Standard Responses**:
```bash
# Find direct returns
grep -r "return {" app/api/ | grep -v "APIResponseHelper"

# Find JSONResponse usage
grep -r "JSONResponse" app/
```

**Standardize All Responses**:
```python
# BEFORE
return {"success": True, "data": result}

# AFTER
return APIResponseHelper.success(data=result)

# BEFORE
return JSONResponse(
    status_code=400,
    content={"error": "Invalid input"}
)

# AFTER
return APIResponseHelper.error(
    message="Invalid input",
    status_code=400
)
```

### 3. Remove Print Statements

**Find and Remove**:
```bash
# Find print statements
grep -r "print(" app/ | grep -v "__pycache__"

# Replace with proper logging
sed -i 's/print(/logger.info(/g' app/**/*.py
```

### 4. Consolidate Error Handling

**Find Inconsistent Error Handling**:
```bash
# Find generic exceptions
grep -r "except Exception" app/

# Find status code literals
grep -r "status_code=4[0-9][0-9]" app/
```

**Use FynloException**:
```python
# BEFORE
except Exception as e:
    return JSONResponse(
        status_code=500,
        content={"error": str(e)}
    )

# AFTER
except Exception as e:
    logger.error(f"Unexpected error: {str(e)}")
    raise FynloException(
        message="An unexpected error occurred",
        error_code=ErrorCodes.INTERNAL_ERROR,
        status_code=500
    )
```

### 5. Database Query Optimization

**Find N+1 Queries**:
```python
# Add to models to detect N+1
from sqlalchemy import event

@event.listens_for(db.Session, "after_bulk_delete")
def receive_after_bulk_delete(update_context):
    logger.warning("Bulk delete detected - check for N+1")
```

**Add Eager Loading**:
```python
# BEFORE
orders = db.query(Order).all()
for order in orders:
    print(order.user.name)  # N+1 query

# AFTER
orders = db.query(Order).options(
    joinedload(Order.user),
    joinedload(Order.items)
).all()
```

### 6. Remove Hardcoded Values

**Find Hardcoded Configuration**:
```bash
# Find hardcoded URLs
grep -r "http://" app/ | grep -v "test"
grep -r "https://" app/ | grep -v "test"

# Find hardcoded credentials
grep -r "password" app/ | grep -v "test"
grep -r "secret" app/ | grep -v "test"
```

**Move to Configuration**:
```python
# BEFORE
STRIPE_KEY = "sk_test_123456789"

# AFTER
from app.core.config import settings
STRIPE_KEY = settings.STRIPE_SECRET_KEY
```

---

## 📋 Platform Dashboard Cleanup

### 1. Remove Duplicate API Clients

**Consolidate API Logic**:
- [ ] Single `PlatformAPIClient` class
- [ ] Remove duplicate axios instances
- [ ] Consistent error handling
- [ ] Shared interceptors

### 2. Component Deduplication

**Find Similar Components**:
```bash
# Find similar file names
find src/components -name "*Card*" -o -name "*List*" -o -name "*Modal*"

# Check for similar content
diff -r src/components/RestaurantCard.tsx src/components/RestaurantItem.tsx
```

**Create Shared Components**:
```typescript
// Before: Multiple card components
// RestaurantCard.tsx, UserCard.tsx, OrderCard.tsx

// After: Generic card component
interface GenericCardProps<T> {
  data: T;
  renderTitle: (data: T) => string;
  renderContent: (data: T) => ReactNode;
  onAction?: (data: T) => void;
}

export function GenericCard<T>({ data, renderTitle, renderContent, onAction }: GenericCardProps<T>) {
  // Shared card implementation
}
```

### 3. State Management Cleanup

**Find State Duplication**:
```bash
# Find useState for same data
grep -r "useState.*restaurant" src/
grep -r "useState.*user" src/
```

**Consolidate in Context**:
```typescript
// BEFORE: State in multiple components
const [restaurants, setRestaurants] = useState([]);
const [selectedRestaurant, setSelectedRestaurant] = useState(null);

// AFTER: Centralized in context
const { restaurants, selectedRestaurant, selectRestaurant } = usePlatform();
```

---

## 🔍 Verification Checklist

### Automated Verification

**Run Cleanup Verification**:
```bash
#!/bin/bash
# cleanup-verify.sh

echo "🔍 Verifying cleanup..."

# Check for mock data
MOCK_COUNT=$(grep -r "mock" src/ | grep -v "test" | wc -l)
echo "Mock references: $MOCK_COUNT"

# Check for console.log
CONSOLE_COUNT=$(grep -r "console.log" src/ | wc -l)
echo "Console.log statements: $CONSOLE_COUNT"

# Check for duplicate types
DUPLICATE_TYPES=$(grep -r "interface User {" src/ | wc -l)
echo "Duplicate User interfaces: $DUPLICATE_TYPES"

# Check for TODO comments
TODO_COUNT=$(grep -r "TODO" src/ | wc -l)
echo "TODO comments: $TODO_COUNT"

# TypeScript errors
echo "Running TypeScript check..."
npx tsc --noEmit

# ESLint
echo "Running ESLint..."
npx eslint src/

# Tests
echo "Running tests..."
npm test
```

### Manual Verification

**Final Checks**:
- [ ] No mock data in production code
- [ ] No duplicate type definitions
- [ ] No console.log statements
- [ ] No commented-out code blocks
- [ ] All imports use @fynlo/shared
- [ ] Consistent error handling
- [ ] No hardcoded values
- [ ] All API responses standardized
- [ ] Theme usage consistent
- [ ] No dead code

---

## 📊 Cleanup Metrics

### Before Cleanup
- Lines of Code: ~50,000
- Duplicate Types: 200+
- Mock Data Files: 15
- Console Statements: 500+
- Dead Code: ~10%

### After Cleanup Target
- Lines of Code: ~35,000 (30% reduction)
- Duplicate Types: 0
- Mock Data Files: 0
- Console Statements: 0
- Dead Code: 0%

---

## 🚀 Post-Cleanup Actions

1. **Update Documentation**
   - Remove references to mock data
   - Update type import examples
   - Document new patterns

2. **Update CI/CD**
   - Add cleanup checks to pipeline
   - Fail builds with console.log
   - Check for type safety

3. **Team Training**
   - Share cleanup patterns
   - Document best practices
   - Create coding standards

4. **Monitoring**
   - Track code quality metrics
   - Set up alerts for violations
   - Regular cleanup sprints

---

## 🛠️ Maintenance Tools

### Pre-Commit Hooks
```json
// .pre-commit-config.yaml
repos:
  - repo: local
    hooks:
      - id: no-console-log
        name: Check for console.log
        entry: sh -c 'grep -r "console.log" src/ && exit 1 || exit 0'
        language: system
        
      - id: no-mock-data
        name: Check for mock data
        entry: sh -c 'grep -r "MockDataService" src/ && exit 1 || exit 0'
        language: system
```

### ESLint Rules
```javascript
// .eslintrc.js
module.exports = {
  rules: {
    'no-console': 'error',
    'no-unused-vars': 'error',
    'no-commented-out-code': 'error',
    '@typescript-eslint/no-explicit-any': 'error'
  }
};
```

This cleanup guide ensures a maintainable, efficient codebase ready for long-term production use.