import React from 'react';
import { render } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
};

jest.mock('../../../lib/supabase', () => ({
  supabase: {
    auth: {
      signInWithPassword: jest.fn(),
    },
  },
}));

describe('LoginScreen', () => {
  it('should render login form', () => {
    const { getByPlaceholderText } = render(
      <LoginScreen navigation={mockNavigation as any} />
    );
    
    expect(getByPlaceholderText(/email/i)).toBeTruthy();
  });
});
