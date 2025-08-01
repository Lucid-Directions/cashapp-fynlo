/**
 * Unit Tests for LoginScreen Component
 * Testing user authentication UI and interactions
 */

import React from 'react';

import { Alert } from 'react-native';

import { fireEvent, waitFor } from '@testing-library/react-native';

import {
  render,
  createMockNavigation,
  createMockAppStore,
} from '../../../__tests__/utils/testUtils';
import DatabaseService from '../../../services/DatabaseService';
import LoginScreen from '../LoginScreen';

// Mock navigation
const mockNavigation = createMockNavigation();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

// Mock DatabaseService
jest.mock('../../../services/DatabaseService');
const mockDatabaseService = DatabaseService as jest.Mocked<typeof DatabaseService>;

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock Zustand store
const mockStore = createMockAppStore();
jest.mock('../../../store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn(() => mockStore),
}));

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.getInstance.mockReturnValue({
      login: jest.fn(),
    } as any);
  });

  describe('Rendering', () => {
    it('should render all essential elements', () => {
      const { getByText, getByPlaceholderText } = render(<LoginScreen />);

      expect(getByText('Fynlo')).toBeTruthy();
      expect(getByText('Point of Sale')).toBeTruthy();
      expect(getByText('Welcome Back')).toBeTruthy();
      expect(getByText('Sign in to continue')).toBeTruthy();
      expect(getByPlaceholderText('Username')).toBeTruthy();
      expect(getByPlaceholderText('Password')).toBeTruthy();
      expect(getByText('Sign In')).toBeTruthy();
      expect(getByText('Forgot Password?')).toBeTruthy();
    });

    it('should render demo credentials section', () => {
      const { getByText } = render(<LoginScreen />);

      expect(getByText('Demo Credentials:')).toBeTruthy();
      expect(getByText('Username: demo')).toBeTruthy();
      expect(getByText('Password: demo123')).toBeTruthy();
    });

    it('should render footer information', () => {
      const { getByText } = render(<LoginScreen />);

      expect(getByText('Fynlo POS • Powered by CashApp')).toBeTruthy();
    });
  });

  describe('Form Interactions', () => {
    it('should update username input', () => {
      const { getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');

      fireEvent.changeText(usernameInput, 'test@example.com');

      expect(usernameInput.props.value).toBe('test@example.com');
    });

    it('should update password input', () => {
      const { getByPlaceholderText } = render(<LoginScreen />);
      const passwordInput = getByPlaceholderText('Password');

      fireEvent.changeText(passwordInput, 'password123');

      expect(passwordInput.props.value).toBe('password123');
    });

    it('should toggle password visibility', () => {
      const { getByPlaceholderText, getByTestId } = render(<LoginScreen />);
      const passwordInput = getByPlaceholderText('Password');

      // Initially password should be hidden
      expect(passwordInput.props.secureTextEntry).toBe(true);

      // Find and press the visibility toggle button
      const toggleButton = getByTestId('password-toggle');
      fireEvent.press(toggleButton);

      expect(passwordInput.props.secureTextEntry).toBe(false);

      // Press again to hide
      fireEvent.press(toggleButton);
      expect(passwordInput.props.secureTextEntry).toBe(true);
    });
  });

  describe('Login Functionality', () => {
    it('should show error for empty credentials', async () => {
      const { getByText } = render(<LoginScreen />);
      const loginButton = getByText('Sign In');

      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please enter both username and password'
        );
      });
    });

    it('should show error for empty username', async () => {
      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please enter both username and password'
        );
      });
    });

    it('should show error for empty password', async () => {
      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'Please enter both username and password'
        );
      });
    });

    it('should attempt login with valid credentials', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockStore.setUser).toHaveBeenCalled();
        expect(mockStore.setSession).toHaveBeenCalled();
      });
    });

    it('should handle login failure', async () => {
      const mockLogin = jest.fn().mockResolvedValue(false);
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'wrong@example.com');
      fireEvent.changeText(passwordInput, 'wrongpassword');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith('Login Failed', 'Invalid username or password');
      });
    });

    it('should handle login error', async () => {
      const mockLogin = jest.fn().mockRejectedValue(new Error('Network error'));
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Error',
          'An error occurred during login. Please try again.'
        );
      });
    });

    it('should show loading state during login', async () => {
      const mockLogin = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 100)));
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Should show loading text
      expect(getByText('Signing In...')).toBeTruthy();

      await waitFor(() => {
        expect(getByText('Sign In')).toBeTruthy();
      });
    });

    it('should disable button during loading', async () => {
      const mockLogin = jest
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve(true), 100)));
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      // Button should be disabled during loading
      expect(loginButton.props.disabled).toBe(true);

      await waitFor(() => {
        expect(loginButton.props.disabled).toBe(false);
      });
    });
  });

  describe('Navigation', () => {
    it('should navigate to forgot password screen', () => {
      const { getByText } = render(<LoginScreen />);
      const forgotPasswordButton = getByText('Forgot Password?');

      fireEvent.press(forgotPasswordButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByPlaceholderText, getByText } = render(<LoginScreen />);

      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      expect(usernameInput.props.accessibilityLabel).toBeDefined();
      expect(passwordInput.props.accessibilityLabel).toBeDefined();
      expect(loginButton.props.accessibilityLabel).toBeDefined();
    });

    it('should support keyboard navigation', () => {
      const { getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');

      expect(usernameInput.props.returnKeyType).toBe('next');
      expect(passwordInput.props.returnKeyType).toBe('done');
    });
  });

  describe('Form Validation', () => {
    it('should trim whitespace from username', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, '  test@example.com  ');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should handle special characters in credentials', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test+user@example.com');
      fireEvent.changeText(passwordInput, 'P@ssw0rd!123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockLogin).toHaveBeenCalledWith('test+user@example.com', 'P@ssw0rd!123');
      });
    });
  });

  describe('Store Integration', () => {
    it('should call setLoading during login process', async () => {
      const mockLogin = jest.fn().mockResolvedValue(true);
      mockDatabaseService.getInstance.mockReturnValue({
        login: mockLogin,
      } as any);

      const { getByText, getByPlaceholderText } = render(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Username');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockStore.setLoading).toHaveBeenCalledWith(true);
        expect(mockStore.setLoading).toHaveBeenCalledWith(false);
      });
    });
  });
});
