/**
 * Simple test to verify Jest setup is working
 */

import { View, Text, TouchableOpacity } from 'react-native';

import { render, fireEvent } from '@testing-library/react-native';

describe('Jest Setup Verification', () => {
  it('should pass a simple test', () => {
    expect(1 + 1).toBe(2);
  });

  it('should have React Native components available', () => {
    expect(View).toBeDefined();
    expect(Text).toBeDefined();
    expect(TouchableOpacity).toBeDefined();
  });

  it('should have testing utilities available', () => {
    expect(render).toBeDefined();
    expect(fireEvent).toBeDefined();
  });
});
