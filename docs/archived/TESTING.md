# Testing Guide for Fynlo POS

This document provides comprehensive information about the testing framework implemented for the Fynlo POS system.

## Overview

The testing framework includes:
- **Unit Tests**: Testing individual components and functions
- **Integration Tests**: Testing API interactions and data flows
- **Component Tests**: Testing React Native components
- **E2E Tests**: End-to-end testing with Detox
- **Performance Tests**: Testing app performance and memory usage

## Test Structure

```
src/
├── __tests__/
│   ├── fixtures/           # Mock data and test fixtures
│   ├── utils/             # Testing utilities and helpers
│   ├── integration/       # API integration tests
│   └── performance/       # Performance tests
├── store/__tests__/       # Zustand store tests
├── services/__tests__/    # Service layer tests
└── screens/*/tests__/     # Component tests
e2e/                       # End-to-end tests
```

## Running Tests

### All Tests
```bash
npm run test:all
```

### Unit Tests
```bash
npm run test:unit
npm run test:unit -- --watch    # Watch mode
```

### Integration Tests
```bash
npm run test:integration
```

### Component Tests
```bash
npm test -- --testPathPattern=screens
```

### E2E Tests
```bash
# Build and run E2E tests
npm run test:e2e:ios

# Just run tests (app must be built first)
npm run test:e2e
```

### Performance Tests
```bash
npm run test:performance
```

### With Coverage
```bash
npm run test:coverage
```

## Test Configuration

### Jest Configuration
- Located in `jest.config.js`
- Configured for React Native with TypeScript
- Coverage thresholds set to 80%
- Path mapping for clean imports

### Detox Configuration
- Located in `package.json` under `detox` section
- Configured for iOS simulator testing
- Supports both Debug and Release builds

## Writing Tests

### Unit Tests

Example unit test for a Zustand store:

```typescript
import { renderHook, act } from '@testing-library/react-hooks';
import { useAppStore } from '../useAppStore';

describe('useAppStore', () => {
  it('should add item to cart', () => {
    const { result } = renderHook(() => useAppStore());
    
    act(() => {
      result.current.addToCart({
        id: 1,
        name: 'Test Item',
        price: 9.99,
      });
    });
    
    expect(result.current.cart).toHaveLength(1);
    expect(result.current.cart[0].name).toBe('Test Item');
  });
});
```

### Component Tests

Example component test:

```typescript
import React from 'react';
import { fireEvent } from '@testing-library/react-native';
import { customRender } from '../../__tests__/utils/testUtils';
import LoginScreen from '../LoginScreen';

describe('LoginScreen', () => {
  it('should login with valid credentials', async () => {
    const { getByTestId, getByText } = customRender(<LoginScreen />);
    
    fireEvent.changeText(getByTestId('username-input'), 'demo');
    fireEvent.changeText(getByTestId('password-input'), 'demo123');
    fireEvent.press(getByTestId('login-button'));
    
    await waitFor(() => {
      expect(getByText('Welcome to Fynlo POS')).toBeTruthy();
    });
  });
});
```

### E2E Tests

Example E2E test:

```javascript
describe('Order Flow', () => {
  beforeEach(async () => {
    await device.reloadReactNative();
    await loginAsTestUser();
  });

  it('should complete order flow', async () => {
    await addItemToCart('Classic Burger');
    await openPaymentModal();
    await completePayment();
    
    await expect(element(by.text('Order Complete'))).toBeVisible();
  });
});
```

## Test Utilities

### Custom Render Function
The `customRender` function in `src/__tests__/utils/testUtils.tsx` provides:
- Navigation context
- Store providers
- Theme providers
- Mock data injection

### Global Test Helpers
- `mockApiResponses`: Standardized API response mocks
- `mockMenuItems`: Sample menu data
- `mockUsers`: Sample user data
- `mockOrders`: Sample order data

### E2E Test Helpers
- `loginAsTestUser()`: Quick login for tests
- `addItemToCart(itemName)`: Add item to cart
- `openPaymentModal()`: Open payment interface
- `completePayment()`: Complete payment flow

## Mocking

### API Mocking
- `fetch` is mocked globally in `jest.setup.js`
- Specific API responses can be mocked per test
- Fallback to mock data when API is unavailable

### Navigation Mocking
- React Navigation is mocked with jest functions
- Navigation props are injected via `customRender`

### AsyncStorage Mocking
- Uses `@react-native-async-storage/async-storage/jest/async-storage-mock`
- Automatically cleared between tests

## Coverage Requirements

- **Statements**: 80%
- **Branches**: 80%
- **Functions**: 80%
- **Lines**: 80%

## Performance Testing

Performance tests measure:
- Store operation speed
- Large dataset handling
- Memory usage
- Render performance
- Search efficiency
- Animation frame rates

Example performance test:

```typescript
it('should handle rapid cart operations efficiently', async () => {
  const { result } = renderHook(() => useAppStore());
  
  performance.mark('start');
  
  act(() => {
    for (let i = 0; i < 100; i++) {
      result.current.addToCart(mockItem);
    }
  });
  
  performance.mark('end');
  performance.measure('operations', 'start', 'end');
  
  const measurements = performance.getEntriesByName('operations');
  expect(measurements[0].duration).toBeLessThan(1000);
});
```

## CI/CD Integration

The testing pipeline runs on:
- **Every push** to main/develop branches
- **Every pull request**

Pipeline includes:
1. Lint and TypeScript checks
2. Unit tests with coverage
3. Integration tests
4. Performance tests
5. Security scanning
6. E2E tests (on macOS runners)
7. Build verification

## Debugging Tests

### Debug Mode
```bash
npm test -- --verbose
```

### Specific Test Files
```bash
npm test LoginScreen.test.tsx
```

### Debug E2E Tests
```bash
npm run test:e2e -- --loglevel verbose
```

### Watch Mode
```bash
npm test -- --watch
```

## Best Practices

1. **Test Structure**: Follow AAA pattern (Arrange, Act, Assert)
2. **Test Names**: Use descriptive names that explain the behavior
3. **Isolation**: Each test should be independent and repeatable
4. **Mocking**: Mock external dependencies and focus on unit behavior
5. **Coverage**: Aim for meaningful coverage, not just high percentages
6. **Performance**: Keep tests fast and efficient
7. **Maintenance**: Update tests when functionality changes

## Troubleshooting

### Common Issues

**Tests fail with "Cannot find module"**
- Check import paths are correct
- Verify `moduleNameMapper` in jest.config.js

**E2E tests timeout**
- Increase timeout in detox configuration
- Check if simulator is running
- Verify app is built correctly

**Performance tests inconsistent**
- Run with `--runInBand` to avoid parallel execution
- Use `performance.mark()` consistently
- Account for CI environment differences

**Mock not working**
- Ensure mock is defined before import
- Check mock is reset between tests
- Verify mock path matches module path

### Getting Help

1. Check test logs for specific error messages
2. Review the Jest and Detox documentation
3. Run tests in isolation to identify issues
4. Use debugger statements for complex test debugging

## Future Enhancements

- Visual regression testing with screenshot comparison
- Accessibility testing integration
- Load testing for high-traffic scenarios
- Cross-platform E2E testing (Android)
- Integration with external testing services