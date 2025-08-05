# Fynlo POS Testing Guide

## Overview
This guide documents the testing infrastructure setup for the Fynlo POS React Native application. Last updated: August 2025.

## Test Configuration

### 1. Babel Configuration (`babel.config.js`)
```javascript
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: [
    ['module-resolver', { /* path aliases */ }],
    'react-native-reanimated/plugin', // Must be last
  ],
};
```

### 2. Jest Configuration Files
- **`jest.unit.config.js`**: Unit tests configuration
  - Coverage threshold: 70%
  - Excludes integration tests
  - Timeout: 10 seconds

- **`jest.integration.config.js`**: Integration tests configuration  
  - Coverage threshold: 60%
  - Only runs files in `src/integration/**`
  - Timeout: 30 seconds

### 3. Key Configuration Updates
- Added `babel-plugin-module-resolver` for path alias support
- Comprehensive `transformIgnorePatterns` for React Native 0.72.x
- Module name mapping matching TypeScript path aliases

## Running Tests

```bash
# Run all unit tests
npm test

# Run integration tests
npm run test:int

# Run with coverage
npm test -- --coverage

# Run specific test file
npm test -- --testPathPattern="ComponentName.test"

# Run in watch mode
npm test -- --watch
```

## Writing Tests

### Basic Component Test
```typescript
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { MyComponent } from '../MyComponent';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Expected Text')).toBeTruthy();
  });
});
```

### Testing with Providers
```typescript
import { renderWithProviders } from '@/testUtils';

it('should work with providers', () => {
  const { getByText } = renderWithProviders(<MyComponent />);
  expect(getByText('Text')).toBeTruthy();
});
```

### Testing Zustand Stores
```typescript
import { renderHook, act } from '@testing-library/react-native';
import { useStore } from './store';

beforeEach(() => {
  // Stores are automatically reset between tests
});

test('store actions', () => {
  const { result } = renderHook(() => useStore());
  
  act(() => {
    result.current.increment();
  });
  
  expect(result.current.count).toBe(1);
});
```

## Common Issues & Solutions

### 1. Escape Sequence Errors
**Problem**: `\!` in code causes "Expecting Unicode escape sequence" error  
**Solution**: Replace `\!` with `!`

### 2. Module Not Found
**Problem**: Cannot find module errors  
**Solution**: Add to `transformIgnorePatterns` in jest config

### 3. React Native Module Mocks
**Problem**: Native modules not available in test environment  
**Solution**: Mocks are configured in `__tests__/testSetup.ts`

## Test Coverage Goals

### Phase 1 (Current)
- [ ] Fix all failing tests
- [ ] Achieve 20% overall coverage
- [ ] 50% coverage for critical paths

### Phase 2
- [ ] 70% coverage for authentication
- [ ] 70% coverage for payment processing
- [ ] 70% coverage for order management

### Phase 3
- [ ] 80% overall coverage
- [ ] E2E tests with Detox
- [ ] Performance benchmarks

## Critical Test Areas

1. **Authentication** (`src/contexts/AuthContext.tsx`)
   - Token management
   - Role-based access
   - Restaurant isolation

2. **Payments** (`src/services/SumUpService.ts`)
   - Payment processing
   - Fee calculations
   - Error handling

3. **Orders** (`src/services/OrderService.ts`)
   - Order creation
   - WebSocket updates
   - Offline queue

4. **WebSocket** (`src/services/websocket/`)
   - Connection management
   - Reconnection logic
   - Message queuing

## Continuous Integration

Tests run automatically on:
- Pull request creation
- Push to feature branches
- Pre-merge checks

Failed tests block PR merging.

## Maintenance

### Monthly Tasks
- Review and update test coverage thresholds
- Update dependencies
- Review flaky tests
- Update this documentation

### When Adding Features
1. Write tests first (TDD)
2. Ensure new code has >80% coverage
3. Update integration tests if needed
4. Document any new test patterns

## Resources
- [React Native Testing Library](https://testing-library.com/docs/react-native-testing-library/intro/)
- [Jest Documentation](https://jestjs.io/docs/getting-started)
- [Testing React Native Apps](https://reactnative.dev/docs/testing-overview)