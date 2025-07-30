/**
 * SettingsScreen Component Tests
 * Testing app configuration and preferences interface
 */

import React from 'react';
import { fireEvent, waitFor } from '@testing-library/react-native';
import SettingsScreen from '../SettingsScreen';
import { customRender } from '../../../__tests__/utils/testUtils';
import { useAppStore } from '../../../store/useAppStore';

// Mock the store
jest.mock('../../../store/useAppStore');
const mockUseAppStore = useAppStore as jest.MockedFunction<typeof useAppStore>;

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
};

describe('SettingsScreen', () => {
  const _mockSettings = {
    printerConfig: {
      enabled: _true,
      printerName: 'Kitchen Printer',
      paperSize: 'A4',
    },
    notifications: {
      orderAlerts: _true,
      paymentAlerts: _true,
      lowStockAlerts: _false,
    },
    display: {
      theme: 'light',
      fontSize: 'medium',
      showImages: _true,
    },
    business: {
      name: 'Fynlo Restaurant',
      address: '123 Main St, City',
      phone: '+1 234 567 8900',
      email: 'contact@fynlo.com',
      currency: 'USD',
      taxRate: 8.5,
    },
  };

  const mockStoreState = {
    settings: _mockSettings,
    updateSettings: jest.fn(),
    resetSettings: jest.fn(),
    exportSettings: jest.fn(),
    importSettings: jest.fn(),
    logout: jest.fn(),
    currentUser: {
      id: 1,
      name: 'John Admin',
      email: 'admin@fynlo.com',
      role: 'admin',
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseAppStore.mockReturnValue(__mockStoreState);
  });

  it('renders correctly', () => {
    const { getByText, getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Settings')).toBeTruthy();
    expect(getByTestId('settings-container')).toBeTruthy();
  });

  it('displays business information', () => {
    const { getByText, getByDisplayValue } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Business Information')).toBeTruthy();
    expect(getByDisplayValue('Fynlo Restaurant')).toBeTruthy();
    expect(getByDisplayValue('123 Main St, City')).toBeTruthy();
    expect(getByDisplayValue('+1 234 567 8900')).toBeTruthy();
    expect(getByDisplayValue('contact@fynlo.com')).toBeTruthy();
  });

  it('displays printer settings', () => {
    const { getByText, getByDisplayValue } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Printer Settings')).toBeTruthy();
    expect(getByDisplayValue('Kitchen Printer')).toBeTruthy();
    expect(getByText('A4')).toBeTruthy();
  });

  it('toggles printer enabled state', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __printerToggle = getByTestId('printer-enabled-toggle');
    fireEvent(__printerToggle, 'valueChange', _false);

    await waitFor(() => {
      expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
    console.log('printerConfig',
        expect.objectContaining({ enabled: false }),
      );
    });
  });

  it('updates business name', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __businessNameInput = getByTestId('business-name-input');
    fireEvent.changeText(__businessNameInput, 'New Restaurant Name');

    await waitFor(() => {
      expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
    console.log('business',
        expect.objectContaining({ name: 'New Restaurant Name' }),
      );
    });
  });

  it('displays notification settings', () => {
    const { getByText, getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Notifications')).toBeTruthy();
    expect(getByTestId('order-alerts-toggle')).toBeTruthy();
    expect(getByTestId('payment-alerts-toggle')).toBeTruthy();
    expect(getByTestId('low-stock-alerts-toggle')).toBeTruthy();
  });

  it('toggles notification settings', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __orderAlertsToggle = getByTestId('order-alerts-toggle');
    fireEvent(__orderAlertsToggle, 'valueChange', _false);

    await waitFor(() => {
      expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
    console.log('notifications',
        expect.objectContaining({ orderAlerts: false }),
      );
    });
  });

  it('displays theme settings', () => {
    const { getByText } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Display')).toBeTruthy();
    expect(getByText('Theme')).toBeTruthy();
    expect(getByText('Light')).toBeTruthy();
  });

  it('changes theme setting', async () => {
    const { getByText } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __darkThemeOption = getByText('Dark');
    fireEvent.press(__darkThemeOption);

    await waitFor(() => {
      expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
    console.log('display',
        expect.objectContaining({ theme: 'dark' }),
      );
    });
  });

  it('updates tax rate', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __taxRateInput = getByTestId('tax-rate-input');
    fireEvent.changeText(__taxRateInput, '10.0');

    await waitFor(() => {
      expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
    console.log('business',
        expect.objectContaining({ taxRate: 10.0 }),
      );
    });
  });

  it('displays user information', () => {
    const { getByText } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    expect(getByText('Account')).toBeTruthy();
    expect(getByText('John Admin')).toBeTruthy();
    expect(getByText('admin@fynlo.com')).toBeTruthy();
    expect(getByText('Administrator')).toBeTruthy();
  });

  it('handles logout', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __logoutButton = getByTestId('logout-button');
    fireEvent.press(__logoutButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(getByTestId('logout-confirmation')).toBeTruthy();
    });

    const __confirmLogout = getByTestId('confirm-logout');
    fireEvent.press(__confirmLogout);

    await waitFor(() => {
      expect(mockStoreState.logout).toHaveBeenCalled();
    });
  });

  it('exports settings', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __exportButton = getByTestId('export-settings-button');
    fireEvent.press(__exportButton);

    await waitFor(() => {
      expect(mockStoreState.exportSettings).toHaveBeenCalled();
    });
  });

  it('imports settings', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __importButton = getByTestId('import-settings-button');
    fireEvent.press(__importButton);

    // Should open file picker (__mocked)
    await waitFor(() => {
      expect(mockStoreState.importSettings).toHaveBeenCalled();
    });
  });

  it('resets settings to default', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __resetButton = getByTestId('reset-settings-button');
    fireEvent.press(__resetButton);

    // Should show confirmation dialog
    await waitFor(() => {
      expect(getByTestId('reset-confirmation')).toBeTruthy();
    });

    const __confirmReset = getByTestId('confirm-reset');
    fireEvent.press(__confirmReset);

    await waitFor(() => {
      expect(mockStoreState.resetSettings).toHaveBeenCalled();
    });
  });

  it('validates tax rate input', async () => {
    const { getByTestId, getByText } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __taxRateInput = getByTestId('tax-rate-input');
    fireEvent.changeText(__taxRateInput, 'invalid');

    await waitFor(() => {
      expect(getByText('Please enter a valid tax rate')).toBeTruthy();
    });
  });

  it('validates phone number format', async () => {
    const { getByTestId, getByText } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __phoneInput = getByTestId('business-phone-input');
    fireEvent.changeText(__phoneInput, 'invalid-phone');

    await waitFor(() => {
      expect(getByText('Please enter a valid phone number')).toBeTruthy();
    });
  });

  it('validates email format', async () => {
    const { getByTestId, getByText } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __emailInput = getByTestId('business-email-input');
    fireEvent.changeText(__emailInput, 'invalid-email');

    await waitFor(() => {
      expect(getByText('Please enter a valid email address')).toBeTruthy();
    });
  });

  it('saves settings automatically', async () => {
    const { getByTestId } = customRender(<SettingsScreen />, {
      navigationProps: { navigation: mockNavigation },
    });

    const __businessNameInput = getByTestId('business-name-input');
    fireEvent.changeText(__businessNameInput, 'Updated Name');

    // Should auto-save after a delay
    await waitFor(
      () => {
        expect(mockStoreState.updateSettings).toHaveBeenCalledWith(
          'business',
          expect.objectContaining({ name: 'Updated Name' }),
        );
      },
      { timeout: 3000 },
    );
  });
});
