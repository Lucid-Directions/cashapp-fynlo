import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { renderWithProviders } from '../../../test-utils';
import ComprehensiveRestaurantOnboardingScreen from '../ComprehensiveRestaurantOnboardingScreen';

// Mock navigation
const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    setOptions: jest.fn(),
  }),
}));

// Mock dependencies
jest.mock('../../../services/DataService', () => ({
  DataService: {
    getInstance: jest.fn(() => ({
      validateBusinessEmail: jest.fn().mockResolvedValue({ isValid: true }),
      completeOnboarding: jest.fn().mockResolvedValue({ success: true }),
    })),
  },
}));

jest.mock('../../../store/useAuthStore', () => {
  const mockState = {
    user: { id: 'test-user' },
    isAuthenticated: false,
    isLoading: false,
    updateUser: jest.fn(),
    checkAuth: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  };

  const useAuthStore = jest.fn(selector => {
    return selector ? selector(mockState) : mockState;
  });

  // Add getState method
  useAuthStore.getState = () => mockState;

  return {
    __esModule: true,
    useAuthStore,
    default: useAuthStore,
  };
});

// Mock Alert
jest.spyOn(Alert, 'alert');

describe('ComprehensiveRestaurantOnboardingScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render the onboarding screen', () => {
    const { getByText } = renderWithProviders(<ComprehensiveRestaurantOnboardingScreen />);

    expect(getByText('Restaurant Setup')).toBeTruthy();
    expect(getByText('Restaurant Information')).toBeTruthy();
  });

  describe('Email Validation', () => {
    it('should not show validation errors while typing', async () => {
      const { getByPlaceholderText, getByText } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
      );

      // Fill in required fields for step 1
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      fireEvent.changeText(nameInput, 'Test Restaurant');

      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      fireEvent.changeText(displayNameInput, 'Test Restaurant');

      fireEvent.press(getByText('Restaurant'));

      // Navigate to contact step (step 2)
      fireEvent.press(getByText('Next'));

      // Start typing email
      const emailInput = getByPlaceholderText('owner@mariaskitchen.co.uk');

      // Type partial email
      fireEvent.changeText(emailInput, 'test@');

      // Should NOT show alert while typing
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should show inline error when email loses focus with invalid email', async () => {
      const { getByPlaceholderText, getByText, getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
      );

      // Fill in required fields for step 1
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      fireEvent.changeText(nameInput, 'Test Restaurant');

      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      fireEvent.changeText(displayNameInput, 'Test Restaurant');

      fireEvent.press(getByText('Restaurant'));

      // Navigate to contact step
      fireEvent.press(getByText('Next'));

      const emailInput = getByTestId('restaurant-email');

      // Type invalid email
      fireEvent.changeText(emailInput, 'invalid-email');

      // Trigger blur
      fireEvent(emailInput, 'blur');

      // Wait and check by trying to proceed
      fireEvent.press(getByText('Next'));

      // The validation should prevent navigation, we should still be on step 2
      await waitFor(() => {
        expect(getByText('Contact Information')).toBeTruthy();
      });

      // Should NOT show alert
      expect(Alert.alert).not.toHaveBeenCalled();
    });

    it('should allow navigation when valid email is entered', async () => {
      const { getByPlaceholderText, getByText, getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
      );

      // Fill in required fields for step 1
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      fireEvent.changeText(nameInput, 'Test Restaurant');

      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      fireEvent.changeText(displayNameInput, 'Test Restaurant');

      fireEvent.press(getByText('Restaurant'));

      // Navigate to contact step
      fireEvent.press(getByText('Next'));

      // Fill phone and email with valid data
      const phoneInput = getByTestId('restaurant-phone');
      fireEvent.changeText(phoneInput, '+44 20 1234 5678');

      const emailInput = getByTestId('restaurant-email');
      fireEvent.changeText(emailInput, 'valid@email.com');

      // Should be able to navigate to next step
      fireEvent.press(getByText('Next'));

      // Should now be on step 3 (Address)
      await waitFor(() => {
        expect(getByText('Restaurant Location')).toBeTruthy();
      });
    });
  });

  describe('Required Field Validation', () => {
    it('should prevent navigation when phone number is empty', async () => {
      const { getByText, getByPlaceholderText, getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
      );

      // Fill required fields for step 1
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      fireEvent.changeText(nameInput, 'Test Restaurant');

      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      fireEvent.changeText(displayNameInput, 'Test Restaurant');

      // Select business type
      fireEvent.press(getByText('Restaurant'));

      // Navigate to contact step
      fireEvent.press(getByText('Next'));

      // Fill email but not phone
      const emailInput = getByTestId('restaurant-email');
      fireEvent.changeText(emailInput, 'valid@email.com');

      // Try to go next without filling phone
      fireEvent.press(getByText('Next'));

      // Should still be on contact step
      await waitFor(() => {
        expect(getByText('Contact Information')).toBeTruthy();
      });

      // Should NOT show alert
      expect(Alert.alert).not.toHaveBeenCalled();
    });
  });

  describe('Navigation', () => {
    it('should navigate to MenuManagement on set up menu button', async () => {
      mockNavigate.mockClear();

      const { getByText, getByPlaceholderText, getByTestId } = renderWithProviders(
        <ComprehensiveRestaurantOnboardingScreen />,
      );

      // Fill required fields for step 1
      const nameInput = getByPlaceholderText("e.g., Maria's Mexican Kitchen");
      fireEvent.changeText(nameInput, 'Test Restaurant');
      const displayNameInput = getByPlaceholderText("e.g., Maria's Kitchen");
      fireEvent.changeText(displayNameInput, 'Test Restaurant');
      fireEvent.press(getByText('Restaurant'));

      // Navigate to step 2 - Contact Info
      fireEvent.press(getByText('Next'));

      // Fill contact info
      const phoneInput = getByPlaceholderText('+44 20 1234 5678');
      fireEvent.changeText(phoneInput, '+44 20 1234 5678');
      const emailInput = getByPlaceholderText('owner@mariaskitchen.co.uk');
      fireEvent.changeText(emailInput, 'test@restaurant.com');

      // Navigate to step 3 - Address
      fireEvent.press(getByText('Next'));

      // Fill address using testIDs
      const streetInput = getByTestId('address-street');
      fireEvent.changeText(streetInput, '123 Test Street');
      const cityInput = getByTestId('address-city');
      fireEvent.changeText(cityInput, 'London');
      const postcodeInput = getByTestId('address-postcode');
      fireEvent.changeText(postcodeInput, 'SW1A 1AA');

      // Navigate to step 4 - Owner Info
      fireEvent.press(getByText('Next'));

      // Fill owner info
      const ownerNameInput = getByPlaceholderText('Maria Rodriguez');
      fireEvent.changeText(ownerNameInput, 'Test Owner');
      const ownerEmailInput = getByPlaceholderText('owner@restaurant.com');
      fireEvent.changeText(ownerEmailInput, 'owner@test.com');

      // Navigate to step 5 - Business Hours
      fireEvent.press(getByText('Next'));

      // Navigate to step 6 - Delivery Zones
      fireEvent.press(getByText('Next'));

      // Navigate to step 7 - Menu Configuration
      fireEvent.press(getByText('Next'));

      // Click "Set Up Menu Now" button using testID
      fireEvent.press(getByTestId('setup-menu-button'));

      // Should navigate to MenuManagement
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('MenuManagement');
      });
    });
  });
});
