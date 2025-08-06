import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import SumUpPaymentComponent from '../SumUpPaymentComponent';
import SumUpCompatibilityService from '../../../services/SumUpCompatibilityService';
import sumUpConfigService from '../../../services/SumUpConfigService';

// Mock dependencies
jest.mock('sumup-react-native-alpha', () => ({
  SumUpProvider: ({ children }: { children: React.ReactNode }) => children,
  useSumUp: () => ({
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  }),
  InitPaymentSheetResult: {
    success: 'success',
    failed: 'failed',
  },
  PresentPaymentSheetResult: {
    success: 'success',
    failed: 'failed',
    cancelled: 'cancelled',
  },
}));

jest.mock('../../../design-system/ThemeProvider', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#FFFFFF',
        surface: '#F5F5F5',
        primary: '#007AFF',
        success: '#4CAF50',
        error: '#F44336',
        warning: '#FF9800',
        text: '#000000',
        textSecondary: '#666666',
        border: '#E0E0E0',
      },
      spacing: {
        xs: 4,
        sm: 8,
        md: 16,
        lg: 24,
        xl: 32,
      },
      typography: {
        h1: { fontSize: 32, fontWeight: 'bold' },
        h2: { fontSize: 24, fontWeight: 'bold' },
        h3: { fontSize: 20, fontWeight: '600' },
        body: { fontSize: 16 },
        caption: { fontSize: 14 },
      },
    },
  }),
}));

jest.mock('../../../services/SumUpCompatibilityService');
jest.mock('../../../services/SumUpConfigService');
jest.mock('../../../utils/logger', () => ({
  default: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('SumUpPaymentComponent', () => {
  const mockOnPaymentComplete = jest.fn();
  const mockOnPaymentCancel = jest.fn();

  const defaultProps = {
    amount: 50.99,
    currency: 'USD',
    title: 'Test Payment',
    onPaymentComplete: mockOnPaymentComplete,
    onPaymentCancel: mockOnPaymentCancel,
  };

  const mockSumUpHooks = {
    initPaymentSheet: jest.fn(),
    presentPaymentSheet: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Default mock implementations
    (SumUpCompatibilityService.checkCompatibility as jest.Mock).mockResolvedValue({
      isCompatible: true,
      warnings: [],
    });

    (sumUpConfigService.getConfig as jest.Mock).mockReturnValue({
      apiKey: 'test-api-key',
      environment: 'test',
    });

    // Mock useSumUp hook
    const sumUpModule = require('sumup-react-native-alpha');
    sumUpModule.useSumUp = jest.fn(() => mockSumUpHooks);
  });

  describe('Rendering', () => {
    it('should render payment modal correctly', () => {
      const { getByTestId, getByText } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      expect(getByTestId('sumup-payment-modal')).toBeTruthy();
      expect(getByText('Test Payment')).toBeTruthy();
      expect(getByText('.99')).toBeTruthy();
    });

    it('should display loading state initially', () => {
      const { getByTestId } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      expect(getByTestId('payment-loading-indicator')).toBeTruthy();
    });

    it('should display payment status', () => {
      const { getByText } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      expect(getByText(/Initializing payment/i)).toBeTruthy();
    });
  });

  describe('Compatibility Check', () => {
    it('should check compatibility on mount', async () => {
      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(SumUpCompatibilityService.checkCompatibility).toHaveBeenCalled();
      });
    });

    it('should handle incompatible device', async () => {
      (SumUpCompatibilityService.checkCompatibility as jest.Mock).mockResolvedValue({
        isCompatible: false,
        error: 'Device not supported',
        warnings: [],
      });

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'Device Not Compatible',
          expect.stringContaining('Device not supported'),
          expect.any(Array)
        );
      });
    });
  });

  describe('Payment Flow', () => {
    it('should initialize payment sheet on mount', async () => {
      mockSumUpHooks.initPaymentSheet.mockResolvedValue({
        status: 'success',
      });

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(mockSumUpHooks.initPaymentSheet).toHaveBeenCalledWith({
          amount: 50.99,
          currency: 'USD',
          title: 'Test Payment',
          foreignTransactionId: expect.any(String),
        });
      });
    });

    it('should handle initialization failure', async () => {
      mockSumUpHooks.initPaymentSheet.mockResolvedValue({
        status: 'failed',
        error: 'Initialization failed',
      });

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnPaymentComplete).toHaveBeenCalledWith(
          false,
          undefined,
          'Failed to initialize payment: Initialization failed'
        );
      });
    });

    it('should handle successful payment', async () => {
      mockSumUpHooks.initPaymentSheet.mockResolvedValue({
        status: 'success',
      });

      mockSumUpHooks.presentPaymentSheet.mockResolvedValue({
        status: 'success',
        transactionCode: 'TX123456',
      });

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnPaymentComplete).toHaveBeenCalledWith(
          true,
          'TX123456',
          undefined
        );
      });
    });

    it('should handle payment cancellation', async () => {
      mockSumUpHooks.initPaymentSheet.mockResolvedValue({
        status: 'success',
      });

      mockSumUpHooks.presentPaymentSheet.mockResolvedValue({
        status: 'cancelled',
      });

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnPaymentCancel).toHaveBeenCalled();
      });
    });
  });

  describe('Cancel Functionality', () => {
    it('should show cancel button', () => {
      const { getByTestId } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      expect(getByTestId('cancel-payment-button')).toBeTruthy();
    });

    it('should call onPaymentCancel when cancel pressed', () => {
      const { getByTestId } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      const cancelButton = getByTestId('cancel-payment-button');
      fireEvent.press(cancelButton);

      expect(mockOnPaymentCancel).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should handle network errors', async () => {
      mockSumUpHooks.initPaymentSheet.mockRejectedValue(
        new Error('Network error')
      );

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnPaymentComplete).toHaveBeenCalledWith(
          false,
          undefined,
          expect.stringContaining('Network error')
        );
      });
    });

    it('should handle missing configuration', async () => {
      (sumUpConfigService.getConfig as jest.Mock).mockReturnValue(null);

      render(<SumUpPaymentComponent {...defaultProps} />);

      await waitFor(() => {
        expect(mockOnPaymentComplete).toHaveBeenCalledWith(
          false,
          undefined,
          expect.stringContaining('configuration')
        );
      });
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      expect(getByLabelText('Payment modal')).toBeTruthy();
      expect(getByLabelText('Cancel payment')).toBeTruthy();
    });

    it('should announce status changes', async () => {
      const { getByTestId } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      const statusContainer = getByTestId('payment-status-container');
      expect(statusContainer.props.accessibilityLiveRegion).toBe('polite');
    });

    it('should have accessible buttons', () => {
      const { getByTestId } = render(
        <SumUpPaymentComponent {...defaultProps} />
      );

      const cancelButton = getByTestId('cancel-payment-button');
      expect(cancelButton.props.accessibilityRole).toBe('button');
    });
  });
});
