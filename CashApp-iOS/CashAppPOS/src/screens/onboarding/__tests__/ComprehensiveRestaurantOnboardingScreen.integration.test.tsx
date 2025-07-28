import React from 'react';
import { fireEvent, waitFor, within } from '@testing-library/react-native';
import { Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { renderWithProviders } from '../../../test-utils';
import ComprehensiveRestaurantOnboardingScreen from '../ComprehensiveRestaurantOnboardingScreen';

// Mock fetch for API calls
global.fetch = jest.fn();

// Mock navigation
const mockNavigate = jest.fn();
const mockReset = jest.fn();
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: mockNavigate,
    goBack: jest.fn(),
    setOptions: jest.fn(),
    reset: mockReset,
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
  
  const useAuthStore = jest.fn((selector) => {
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

// Mock useAppStore
jest.mock('../../../store/useAppStore', () => ({
  __esModule: true,
  default: jest.fn((selector) => {
    const state = {
      currentOrder: null,
      activeRestaurant: null,
      setActiveRestaurant: jest.fn(),
    };
    return selector ? selector(state) : state;
  }),
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Mock AsyncStorage
(AsyncStorage.getItem as jest.Mock).mockResolvedValue('test-auth-token');
(AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);

describe('ComprehensiveRestaurantOnboardingScreen - Full User Journey', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (fetch as jest.Mock).mockClear();
  });

  it('should complete the entire onboarding flow as a new user would', async () => {
    // Mock successful API response
    (fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({ 
        restaurant_id: 'rest-123',
        success: true 
      }),
    });

    const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
      <ComprehensiveRestaurantOnboardingScreen />
    );
    
    // Verify we're on Step 1
    expect(getByText('Restaurant Information')).toBeTruthy();
    expect(getByText('Step 1 of 9')).toBeTruthy();
    
    // Step 1: Fill in Restaurant Information
    const restaurantNameInput = getByTestId('restaurant-name');
    const displayNameInput = getByTestId('restaurant-display-name');
    
    fireEvent.changeText(restaurantNameInput, 'Test Restaurant');
    fireEvent.changeText(displayNameInput, 'Test Restaurant');
    
    // Select business type
    fireEvent.press(getByText('Restaurant'));
    
    // Try to go next without all required fields - should be disabled
    const nextButton = getByTestId('next-step-button');
    expect(nextButton.props.accessibilityState?.disabled).toBe(false); // Button should be enabled now
    
    // Click Next to go to Step 2
    fireEvent.press(nextButton);
    
    // Verify we're on Step 2
    await waitFor(() => {
      expect(getByText('Contact Information')).toBeTruthy();
      expect(getByText('Step 2 of 9')).toBeTruthy();
    });
    
    // Step 2: Fill in Contact Information
    const phoneInput = getByTestId('restaurant-phone');
    const emailInput = getByTestId('restaurant-email');
    
    fireEvent.changeText(phoneInput, '+44 20 1234 5678');
    fireEvent.changeText(emailInput, 'test@restaurant.com');
    
    // Click Next to go to Step 3
    fireEvent.press(getByTestId('next-step-button'));
    
    // Verify we're on Step 3
    await waitFor(() => {
      expect(getByText('Restaurant Location')).toBeTruthy();
      expect(getByText('Step 3 of 9')).toBeTruthy();
    });
    
    // Step 3: Fill in Address
    const streetInput = getByTestId('address-street');
    const cityInput = getByTestId('address-city');
    const postcodeInput = getByTestId('address-postcode');
    
    fireEvent.changeText(streetInput, '123 Test Street');
    fireEvent.changeText(cityInput, 'London');
    fireEvent.changeText(postcodeInput, 'SW1A 1AA');
    
    // Click Next to go to Step 4
    fireEvent.press(getByTestId('next-step-button'));
    
    // Verify we're on Step 4
    await waitFor(() => {
      expect(getByText('Owner Information')).toBeTruthy();
      expect(getByText('Step 4 of 9')).toBeTruthy();
    });
    
    // Step 4: Fill in Owner Information
    const ownerNameInput = getByTestId('owner-name');
    const ownerEmailInput = getByTestId('owner-email');
    
    fireEvent.changeText(ownerNameInput, 'John Doe');
    fireEvent.changeText(ownerEmailInput, 'owner@testrestaurant.com');
    
    // Click Next to go to Step 5
    fireEvent.press(getByTestId('next-step-button'));
    
    // Verify we're on Step 5 (Business Hours)
    await waitFor(() => {
      expect(getByText('Business Hours')).toBeTruthy();
      expect(getByText('Step 5 of 9')).toBeTruthy();
    });
    
    // Business hours are optional, just click Next
    fireEvent.press(getByTestId('next-step-button'));
    
    // Verify we're on Step 6 (Employee Management)
    await waitFor(() => {
      expect(getByText('Employee Management')).toBeTruthy();
      expect(getByText('Step 6 of 9')).toBeTruthy();
    });
    
    // Employees are optional, just click Next
    fireEvent.press(getByTestId('next-step-button'));
    
    // Verify we're on Step 7 (Menu Setup)
    await waitFor(() => {
      expect(getByText('Menu Setup')).toBeTruthy();
      expect(getByText('Step 7 of 9')).toBeTruthy();
    });
    
    // Menu setup is optional, click Skip for Now
    fireEvent.press(getByText('Skip for Now'));
    
    // Handle the alert dialog
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Skip Menu Setup?',
        'You can always add your menu later from the Settings menu.',
        expect.any(Array)
      );
    });
    
    // Simulate pressing Skip in the alert
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    const skipButton = alertCall[2].find((btn: any) => btn.text === 'Skip');
    skipButton.onPress();
    
    // Verify we're on Step 8 (Bank Details)
    await waitFor(() => {
      expect(getByText('Bank Details')).toBeTruthy();
      expect(getByText('Step 8 of 9')).toBeTruthy();
    });
    
    // Fill in Bank Details
    const sortCodeInput = getByPlaceholderText('00-00-00');
    const accountNumberInput = getByPlaceholderText('12345678');
    const accountNameInput = getByPlaceholderText('Your Restaurant Ltd');
    
    fireEvent.changeText(sortCodeInput, '12-34-56');
    fireEvent.changeText(accountNumberInput, '12345678');
    fireEvent.changeText(accountNameInput, 'Test Restaurant Ltd');
    
    // Click Next to go to Step 9
    fireEvent.press(getByTestId('next-step-button'));
    
    // Verify we're on Step 9 (Review)
    await waitFor(() => {
      expect(getByText('Review & Complete')).toBeTruthy();
      expect(getByText('Step 9 of 9')).toBeTruthy();
    });
    
    // Verify review shows our entered data
    expect(getByText('Test Restaurant')).toBeTruthy();
    expect(getByText('+44 20 1234 5678 • test@restaurant.com')).toBeTruthy();
    expect(getByText('123 Test Street, London SW1A 1AA')).toBeTruthy();
    expect(getByText('John Doe')).toBeTruthy();
    
    // Click Complete Setup
    fireEvent.press(getByTestId('complete-setup-button'));
    
    // Wait for API call
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        expect.stringContaining('/api/v1/restaurants/onboarding/create'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-auth-token',
            'Content-Type': 'application/json',
          }),
          body: expect.stringContaining('Test Restaurant'),
        })
      );
    });
    
    // Verify success alert is shown
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Onboarding Complete! 🎉',
        expect.stringContaining('Welcome to Fynlo, Test Restaurant!'),
        expect.any(Array)
      );
    });
    
    // Simulate clicking "Start Using POS"
    const successAlertCall = (Alert.alert as jest.Mock).mock.calls[1];
    const startUsingPOSButton = successAlertCall[2].find((btn: any) => btn.text === 'Start Using POS');
    startUsingPOSButton.onPress();
    
    // Verify navigation reset
    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledWith({
        index: 0,
        routes: [{ name: 'Main' }],
      });
    });
    
    // Verify AsyncStorage was updated
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('restaurant_id', 'rest-123');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('needs_onboarding', 'false');
  });

  it('should handle API errors during onboarding completion', async () => {
    // Mock API error response
    (fetch as jest.Mock).mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({ 
        detail: 'Restaurant with this name already exists' 
      }),
    });

    const { getByTestId, getByText, getByPlaceholderText } = renderWithProviders(
      <ComprehensiveRestaurantOnboardingScreen />
    );
    
    // Quickly fill required fields to get to the end
    // Step 1
    fireEvent.changeText(getByTestId('restaurant-name'), 'Existing Restaurant');
    fireEvent.changeText(getByTestId('restaurant-display-name'), 'Existing Restaurant');
    fireEvent.press(getByText('Restaurant'));
    fireEvent.press(getByTestId('next-step-button'));
    
    // Step 2
    await waitFor(() => getByText('Contact Information'));
    fireEvent.changeText(getByTestId('restaurant-phone'), '+44 20 1234 5678');
    fireEvent.changeText(getByTestId('restaurant-email'), 'existing@restaurant.com');
    fireEvent.press(getByTestId('next-step-button'));
    
    // Step 3
    await waitFor(() => getByText('Restaurant Location'));
    fireEvent.changeText(getByTestId('address-street'), '123 Test Street');
    fireEvent.changeText(getByTestId('address-city'), 'London');
    fireEvent.changeText(getByTestId('address-postcode'), 'SW1A 1AA');
    fireEvent.press(getByTestId('next-step-button'));
    
    // Step 4
    await waitFor(() => getByText('Owner Information'));
    fireEvent.changeText(getByTestId('owner-name'), 'John Doe');
    fireEvent.changeText(getByTestId('owner-email'), 'owner@existing.com');
    fireEvent.press(getByTestId('next-step-button'));
    
    // Skip steps 5-7
    await waitFor(() => getByTestId('next-step-button'));
    fireEvent.press(getByTestId('next-step-button'));
    await waitFor(() => getByTestId('next-step-button'));
    fireEvent.press(getByTestId('next-step-button'));
    await waitFor(() => getByText('Skip for Now'));
    fireEvent.press(getByText('Skip for Now'));
    const alertCall = (Alert.alert as jest.Mock).mock.calls[0];
    alertCall[2].find((btn: any) => btn.text === 'Skip').onPress();
    
    // Step 8 - Bank Details
    await waitFor(() => getByText('Bank Details'));
    fireEvent.changeText(getByPlaceholderText('00-00-00'), '12-34-56');
    fireEvent.changeText(getByPlaceholderText('12345678'), '12345678');
    fireEvent.changeText(getByPlaceholderText('Your Restaurant Ltd'), 'Test Ltd');
    fireEvent.press(getByTestId('next-step-button'));
    
    // Step 9 - Complete
    await waitFor(() => getByTestId('complete-setup-button'));
    fireEvent.press(getByTestId('complete-setup-button'));
    
    // Verify error alert is shown
    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith(
        'Error',
        'Restaurant with this name already exists'
      );
    });
  });

  it.skip('should validate required fields and prevent navigation', async () => {
    const { getByTestId, getByText } = renderWithProviders(
      <ComprehensiveRestaurantOnboardingScreen />
    );
    
    // Initially we should be on step 1
    expect(getByText('Restaurant Information')).toBeTruthy();
    expect(getByText('Step 1 of 9')).toBeTruthy();
    
    // Business type defaults to 'Restaurant', so we only need name and display name
    const nextButton = getByTestId('next-step-button');
    
    // Try to click next without filling required fields
    fireEvent.press(nextButton);
    
    // Should still be on step 1 (didn't navigate due to missing fields)
    expect(getByText('Restaurant Information')).toBeTruthy();
    expect(getByText('Step 1 of 9')).toBeTruthy();
    
    // Fill only restaurant name
    fireEvent.changeText(getByTestId('restaurant-name'), 'Test Restaurant');
    fireEvent.press(nextButton);
    
    // Should still be on step 1 (missing display name)
    expect(getByText('Restaurant Information')).toBeTruthy();
    
    // Fill display name
    fireEvent.changeText(getByTestId('restaurant-display-name'), 'Test Restaurant');
    
    // Now should be able to navigate
    fireEvent.press(nextButton);
    
    // Should navigate to step 2
    await waitFor(() => {
      expect(getByText('Contact Information')).toBeTruthy();
      expect(getByText('Step 2 of 9')).toBeTruthy();
    });
  });

  it('should handle email validation on blur', async () => {
    const { getByTestId, getByText } = renderWithProviders(
      <ComprehensiveRestaurantOnboardingScreen />
    );
    
    // Navigate to Step 2
    fireEvent.changeText(getByTestId('restaurant-name'), 'Test Restaurant');
    fireEvent.changeText(getByTestId('restaurant-display-name'), 'Test Restaurant');
    fireEvent.press(getByText('Restaurant'));
    fireEvent.press(getByTestId('next-step-button'));
    
    await waitFor(() => getByText('Contact Information'));
    
    const emailInput = getByTestId('restaurant-email');
    
    // Enter invalid email
    fireEvent.changeText(emailInput, 'invalid-email');
    fireEvent(emailInput, 'blur');
    
    // Try to navigate - should fail
    fireEvent.press(getByTestId('next-step-button'));
    
    // Should still be on Step 2
    await waitFor(() => {
      expect(getByText('Contact Information')).toBeTruthy();
    });
    
    // Fix email
    fireEvent.changeText(emailInput, 'valid@email.com');
    fireEvent(emailInput, 'blur');
    
    // Fill phone
    fireEvent.changeText(getByTestId('restaurant-phone'), '+44 20 1234 5678');
    
    // Now navigation should work
    fireEvent.press(getByTestId('next-step-button'));
    
    await waitFor(() => {
      expect(getByText('Restaurant Location')).toBeTruthy();
    });
  });
});