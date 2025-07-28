/**
 * Tests for Comprehensive Restaurant Onboarding Screen
 * Tests the complete onboarding flow to catch issues before production
 */

import React from 'react';
import { Alert } from 'react-native';
import {
  renderWithProviders,
  fireEvent,
  waitFor,
  createMockNavigation,
  createMockRoute,
  createMockUseAuthStore,
  createMockDataService,
} from '../../../test-utils';
import ComprehensiveRestaurantOnboardingScreen from '../ComprehensiveRestaurantOnboardingScreen';
import * as DataService from '../../../services/DataService';

// Mock modules
jest.mock('../../../services/DataService');
jest.mock('../../../store/useAuthStore');
jest.mock('../../../hooks/useRestaurantConfig', () => ({
  useRestaurantConfig: () => ({
    config: null,
    updateConfig: jest.fn(),
    completeSetupStep: jest.fn(),
    isLoading: false,
    error: null,
  }),
}));

// Mock Alert to capture error messages
jest.spyOn(Alert, 'alert');

describe('ComprehensiveRestaurantOnboardingScreen', () => {
  const mockNavigation = createMockNavigation();
  const mockRoute = createMockRoute();
  const mockDataService = createMockDataService();

  beforeEach(() => {
    jest.clearAllMocks();
    // Setup default mocks
    (DataService.default as any) = mockDataService;
    require('../../../store/useAuthStore').useAuthStore.mockReturnValue(
      createMockUseAuthStore({
        user: { id: '1', email: 'owner@restaurant.com' },
        isAuthenticated: true,
      })
    );
  });

  describe('Email Validation', () => {
    it('should validate employee email on blur', async () => {
      const { getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Navigate to employee section
      const nextButton = getByTestId('next-step-button');
      fireEvent.press(nextButton); // Skip basic info
      fireEvent.press(nextButton); // Skip contact info
      fireEvent.press(nextButton); // Skip hours
      fireEvent.press(nextButton); // Skip owner info
      fireEvent.press(nextButton); // Go to employees

      // Add employee
      const addEmployeeButton = getByTestId('add-employee-button');
      fireEvent.press(addEmployeeButton);

      // Enter employee email
      const emailInput = getByTestId('employee-email-0');
      fireEvent.changeText(emailInput, 'test@restaurant.com');
      fireEvent(emailInput, 'blur');

      // Wait for validation
      await waitFor(() => {
        expect(mockDataService.validateBusinessEmail).toHaveBeenCalledWith(
          'test@restaurant.com'
        );
      });
    });

    it('should show error for invalid employee email', async () => {
      mockDataService.validateBusinessEmail.mockResolvedValueOnce({
        isValid: false,
        message: 'Email already exists',
      });

      const { getByTestId, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Navigate to employee section
      const nextButton = getByTestId('next-step-button');
      for (let i = 0; i < 5; i++) {
        fireEvent.press(nextButton);
      }

      // Add employee
      fireEvent.press(getByTestId('add-employee-button'));

      // Enter duplicate email
      const emailInput = getByTestId('employee-email-0');
      fireEvent.changeText(emailInput, 'duplicate@restaurant.com');
      fireEvent(emailInput, 'blur');

      // Check for error message
      await waitFor(() => {
        expect(getByText('Email already exists')).toBeTruthy();
      });
    });

    it('should not show error alert for invalid email during onboarding', async () => {
      mockDataService.validateBusinessEmail.mockResolvedValueOnce({
        isValid: false,
        message: 'Email already exists',
      });

      const { getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Navigate to employee section
      const nextButton = getByTestId('next-step-button');
      for (let i = 0; i < 5; i++) {
        fireEvent.press(nextButton);
      }

      // Add employee
      fireEvent.press(getByTestId('add-employee-button'));

      // Enter invalid email
      const emailInput = getByTestId('employee-email-0');
      fireEvent.changeText(emailInput, 'invalid@restaurant.com');
      fireEvent(emailInput, 'blur');

      await waitFor(() => {
        // Ensure Alert.alert was NOT called
        expect(Alert.alert).not.toHaveBeenCalled();
      });
    });
  });

  describe('Navigation Flow', () => {
    it('should navigate through all steps correctly', async () => {
      const { getByTestId, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Step 1: Basic Info
      expect(getByText('Restaurant Setup')).toBeTruthy();
      fireEvent.changeText(getByTestId('restaurant-name'), 'Test Restaurant');
      fireEvent.changeText(getByTestId('display-name'), 'Test Display');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 2: Contact Info
      await waitFor(() => {
        expect(getByText('Contact Information')).toBeTruthy();
      });
      fireEvent.changeText(getByTestId('phone'), '07123456789');
      fireEvent.changeText(getByTestId('email'), 'contact@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 3: Operating Hours
      await waitFor(() => {
        expect(getByText('Operating Hours')).toBeTruthy();
      });
      fireEvent.press(getByTestId('next-step-button'));

      // Step 4: Owner Info
      await waitFor(() => {
        expect(getByText('Owner Information')).toBeTruthy();
      });
      fireEvent.changeText(getByTestId('owner-name'), 'John Doe');
      fireEvent.changeText(getByTestId('owner-email'), 'owner@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 5: Employees
      await waitFor(() => {
        expect(getByText('Staff Members')).toBeTruthy();
      });
      fireEvent.press(getByTestId('next-step-button'));

      // Step 6: Menu Setup
      await waitFor(() => {
        expect(getByText('Menu Configuration')).toBeTruthy();
      });
    });

    it('should navigate back correctly', async () => {
      const { getByTestId, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Go to step 2
      fireEvent.press(getByTestId('next-step-button'));
      
      await waitFor(() => {
        expect(getByText('Contact Information')).toBeTruthy();
      });

      // Go back
      fireEvent.press(getByTestId('back-button'));

      await waitFor(() => {
        expect(getByText('Restaurant Setup')).toBeTruthy();
      });
    });

    it('should show correct navigation index', async () => {
      const { getByTestId, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Check initial step
      expect(getByText('Step 1 of 8')).toBeTruthy();

      // Navigate to next steps
      fireEvent.press(getByTestId('next-step-button'));
      await waitFor(() => {
        expect(getByText('Step 2 of 8')).toBeTruthy();
      });

      fireEvent.press(getByTestId('next-step-button'));
      await waitFor(() => {
        expect(getByText('Step 3 of 8')).toBeTruthy();
      });
    });
  });

  describe('Form Validation', () => {
    it('should validate required fields before proceeding', async () => {
      const { getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Try to proceed without filling required fields
      fireEvent.press(getByTestId('next-step-button'));

      // Should show validation error
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          expect.any(String),
          expect.any(Array)
        );
      });
    });

    it('should validate UK phone numbers', async () => {
      const { getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Fill basic info and go to contact
      fireEvent.changeText(getByTestId('restaurant-name'), 'Test');
      fireEvent.changeText(getByTestId('display-name'), 'Test');
      fireEvent.press(getByTestId('next-step-button'));

      // Enter invalid phone
      await waitFor(() => {
        const phoneInput = getByTestId('phone');
        fireEvent.changeText(phoneInput, '123'); // Invalid UK phone
      });

      fireEvent.press(getByTestId('next-step-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Validation Error',
          expect.stringContaining('phone'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Complete Onboarding Flow', () => {
    it('should complete full onboarding successfully', async () => {
      mockDataService.completeOnboarding.mockResolvedValueOnce({
        success: true,
        restaurantId: '123',
      });

      const { getByTestId, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Fill all required fields through all steps
      // Step 1: Basic Info
      fireEvent.changeText(getByTestId('restaurant-name'), 'Test Restaurant');
      fireEvent.changeText(getByTestId('display-name'), 'Test Display');
      fireEvent.press(getByTestId('next-step-button'));

      // Step 2: Contact Info
      await waitFor(() => getByTestId('phone'));
      fireEvent.changeText(getByTestId('phone'), '07123456789');
      fireEvent.changeText(getByTestId('email'), 'contact@test.com');
      fireEvent.press(getByTestId('next-step-button'));

      // Skip through remaining steps
      for (let i = 0; i < 5; i++) {
        await waitFor(() => getByTestId('next-step-button'));
        fireEvent.press(getByTestId('next-step-button'));
      }

      // Complete setup
      await waitFor(() => getByTestId('complete-setup-button'));
      fireEvent.press(getByTestId('complete-setup-button'));

      // Verify navigation to main app
      await waitFor(() => {
        expect(mockNavigation.reset).toHaveBeenCalledWith({
          index: 0,
          routes: [{ name: 'MainNavigator' }],
        });
      });
    });

    it('should handle onboarding errors gracefully', async () => {
      mockDataService.completeOnboarding.mockRejectedOnce(
        new Error('Network error')
      );

      const { getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Quick navigation to last step
      for (let i = 0; i < 7; i++) {
        fireEvent.press(getByTestId('next-step-button'));
        await waitFor(() => getByTestId('next-step-button'));
      }

      // Try to complete
      fireEvent.press(getByTestId('complete-setup-button'));

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Setup Error',
          expect.stringContaining('error'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Configure Menu Navigation', () => {
    it('should navigate to PlatformNavigator when Configure Menu is pressed', async () => {
      const { getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
        {
          navigationProps: {
            navigation: mockNavigation,
            route: mockRoute,
          },
        }
      );

      // Navigate to menu setup step (step 6)
      for (let i = 0; i < 5; i++) {
        fireEvent.press(getByTestId('next-step-button'));
        await waitFor(() => getByTestId('next-step-button'));
      }

      // Press Configure Menu button
      await waitFor(() => getByTestId('configure-menu-button'));
      fireEvent.press(getByTestId('configure-menu-button'));

      // Verify navigation
      expect(mockNavigation.navigate).toHaveBeenCalledWith('PlatformNavigator');
    });
  });
});