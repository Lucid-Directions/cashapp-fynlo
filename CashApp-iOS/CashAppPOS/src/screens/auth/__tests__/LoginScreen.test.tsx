/**
 * Unit Tests for LoginScreen Component
 * Testing user authentication UI and interactions
 */

import React from 'react';
import { Alert } from 'react-native';
import { fireEvent, waitFor, render } from '@testing-library/react-native';
import LoginScreen from '../LoginScreen';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNavigation,
}));

// Mock DatabaseService
const mockDatabaseService = {
  login: jest.fn(),
};

jest.mock('../../../services/DatabaseService', () => ({
  __esModule: true,
  default: {
    getInstance: () => mockDatabaseService,
  },
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock useAuthStore
const mockAuthStore = {
  user: null,
  isAuthenticated: false,
  isLoading: false,
  signIn: jest.fn().mockResolvedValue(true),
  signOut: jest.fn(),
  refreshUser: jest.fn(),
};

jest.mock('../../../store/useAuthStore', () => ({
  useAuthStore: (selector: any) => {
    if (selector) {
      return selector(mockAuthStore);
    }
    return mockAuthStore;
  },
}));// Mock useAppStore
const mockStore = {
  setUser: jest.fn(),
  setSession: jest.fn(),
  setLoading: jest.fn(),
  user: null,
  session: null,
  isLoading: false,
};

jest.mock('../../../store/useAppStore', () => ({
  __esModule: true,
  default: () => mockStore,
}));

// Wrapper for tests with providers
const TestWrapper = ({ children }: { children: React.ReactNode }) => {
  return <>{children}</>;
};

const customRender = (ui: React.ReactElement) => {
  return render(ui, { wrapper: TestWrapper });
};

describe('LoginScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDatabaseService.login.mockClear();
  });

  describe('Rendering', () => {
    it('should render all essential elements', () => {
      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);

      expect(getByText('fynlo')).toBeTruthy();
      expect(getByText('Professional Point of Sale System')).toBeTruthy();
      expect(getByText('Welcome Back')).toBeTruthy();
      expect(getByText('Sign in to continue')).toBeTruthy();
      expect(getByPlaceholderText('Email')).toBeTruthy();
      expect(getByPlaceholderText('Password')).toBeTruthy();
      expect(getByText('Sign In')).toBeTruthy();
      expect(getByText('Forgot Password?')).toBeTruthy();
    });

    it('should render demo credentials section', () => {
      const { getByText } = customRender(<LoginScreen />);

      expect(getByText('Demo Credentials:')).toBeTruthy();
      expect(getByText('Username: demo')).toBeTruthy();
      expect(getByText('Password: demo123')).toBeTruthy();
    });

    it('should render footer information', () => {
      const { getByText } = customRender(<LoginScreen />);

      expect(getByText('Fynlo POS System • Secure Payment Processing')).toBeTruthy();
    });
  });

  describe('Form Interactions', () => {
    it('should update username input', () => {
      const { getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');

      fireEvent.changeText(usernameInput, 'test@example.com');

      expect(usernameInput.props.value).toBe('test@example.com');
    });

    it('should update password input', () => {
      const { getByPlaceholderText } = customRender(<LoginScreen />);
      const passwordInput = getByPlaceholderText('Password');

      fireEvent.changeText(passwordInput, 'password123');

      expect(passwordInput.props.value).toBe('password123');
    });

    it('should toggle password visibility', () => {
      const { getByPlaceholderText, getByTestId } = customRender(<LoginScreen />);
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
      const { getByText } = customRender(<LoginScreen />);
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
      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
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
      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
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
      mockDatabaseService.login.mockResolvedValue(true);

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test@example.com');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockDatabaseService.login).toHaveBeenCalledWith('test@example.com', 'password123');
        expect(mockStore.setUser).toHaveBeenCalled();
        expect(mockStore.setSession).toHaveBeenCalled();
      });
    });

    it('should handle login failure', async () => {
      mockDatabaseService.login.mockResolvedValue(false);

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
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
      mockDatabaseService.login.mockRejectedValue(new Error('Network error'));

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
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
      mockDatabaseService.login.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
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
      mockDatabaseService.login.mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve(true), 100))
      );

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
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
      const { getByText } = customRender(<LoginScreen />);
      const forgotPasswordButton = getByText('Forgot Password?');

      fireEvent.press(forgotPasswordButton);

      expect(mockNavigation.navigate).toHaveBeenCalledWith('ForgotPassword');
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByPlaceholderText, getByText } = customRender(<LoginScreen />);

      const usernameInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      expect(usernameInput.props.accessibilityLabel).toBeDefined();
      expect(passwordInput.props.accessibilityLabel).toBeDefined();
      expect(loginButton.props.accessibilityLabel).toBeDefined();
    });

    it('should support keyboard navigation', () => {
      const { getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');

      expect(usernameInput.props.returnKeyType).toBe('next');
      expect(passwordInput.props.returnKeyType).toBe('done');
    });
  });

  describe('Form Validation', () => {
    it('should trim whitespace from username', async () => {
      mockDatabaseService.login.mockResolvedValue(true);

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, '  test@example.com  ');
      fireEvent.changeText(passwordInput, 'password123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockDatabaseService.login).toHaveBeenCalledWith('test@example.com', 'password123');
      });
    });

    it('should handle special characters in credentials', async () => {
      mockDatabaseService.login.mockResolvedValue(true);

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
      const passwordInput = getByPlaceholderText('Password');
      const loginButton = getByText('Sign In');

      fireEvent.changeText(usernameInput, 'test+user@example.com');
      fireEvent.changeText(passwordInput, 'P@ssw0rd\!123');
      fireEvent.press(loginButton);

      await waitFor(() => {
        expect(mockDatabaseService.login).toHaveBeenCalledWith('test+user@example.com', 'P@ssw0rd\!123');
      });
    });
  });

  describe('Store Integration', () => {
    it('should call setLoading during login process', async () => {
      mockDatabaseService.login.mockResolvedValue(true);

      const { getByText, getByPlaceholderText } = customRender(<LoginScreen />);
      const usernameInput = getByPlaceholderText('Email');
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
