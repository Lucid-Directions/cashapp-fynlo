/**
 * Simple test to verify Jest setup is working
 */

import { render, fireEvent } from '@testing-library/react-native';

describe('Jest Setup Verification', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have React Native components available', () => {
    // Use dynamic import for React Native components
    const RN = jest.requireActual('react-native');
    expect(RN.View).toBeDefined();
    expect(RN.Text).toBeDefined();
    expect(RN.TouchableOpacity).toBeDefined();
  });

  it('should have testing utilities available', () => {
    expect(render).toBeDefined();
    expect(fireEvent).toBeDefined();
  });
});
