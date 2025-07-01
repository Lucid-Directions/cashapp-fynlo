
import React from 'react';
import { render } from '@testing-library/react-native';
import EnhancedPOSScreen from '../EnhancedPOSScreen';



// Mock the useTheme hook
jest.mock('../../../design-system/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        primary: '#00A651',
        secondary: '#0066CC',
        success: '#27AE60',
        warning: '#F39C12',
        danger: '#E74C3C',
        background: '#F8F9FA',
        white: '#FFFFFF',
        lightGray: '#ECF0F1',
        mediumGray: '#BDC3C7',
        darkGray: '#34495E',
        text: '#2C3E50',
        lightText: '#95A5A6',
        border: '#DDDDDD',
      },
    },
  }),
}));

// Mock the navigation hook
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    goBack: jest.fn(),
  }),
}));

describe('EnhancedPOSScreen', () => {
  it('renders correctly', () => {
    const { toJSON } = render(<EnhancedPOSScreen />);
    expect(toJSON()).toMatchSnapshot();
  });
});
