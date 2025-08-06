/**
 * POSScreen Component Tests
 * Testing the main point-of-sale interface
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { renderWithProviders } from '../../../__tests__/utils/renderWithProviders';
import POSScreen from '../POSScreen';

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    dispatch: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
  useFocusEffect: jest.fn(),
}));

// Mock SharedDataStore
jest.mock('../../../services/SharedDataStore');

// Mock other services
jest.mock('../../../services/DataService', () => ({
  fetchMenuItems: jest.fn(() => Promise.resolve([])),
  getInstance: jest.fn(() => ({
    fetchMenuItems: jest.fn(() => Promise.resolve([])),
  })),
}));

describe('POSScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders correctly and shows main elements', async () => {
    const { getByText, getByPlaceholderText } = renderWithProviders(<POSScreen />);
    
    await waitFor(() => {
      expect(getByText('All')).toBeTruthy();
      expect(getByPlaceholderText('Search menu...')).toBeTruthy();
    });
  });

  it('renders with proper navigation setup', async () => {
    const { getByTestId } = renderWithProviders(<POSScreen />);
    
    await waitFor(() => {
      // Check for cart icon
      const cartButton = getByTestId('cart-button');
      expect(cartButton).toBeTruthy();
    });
  });
});
