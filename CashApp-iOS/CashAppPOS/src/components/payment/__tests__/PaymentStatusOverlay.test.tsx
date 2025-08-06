import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Animated } from 'react-native';
import PaymentStatusOverlay from '../PaymentStatusOverlay';
import type { PaymentStatus } from '../PaymentStatusOverlay';

// Mock dependencies
jest.mock('../../../design-system/ThemeProvider', () => ({
  useTheme: () => ({
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
    shadows: {
      small: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
      },
      medium: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.15,
        shadowRadius: 8,
        elevation: 4,
      },
    },
  }),
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock Animated timing
jest.spyOn(Animated, 'timing').mockImplementation((value, config) => ({
  start: (callback) => {
    if (callback) callback({ finished: true });
  },
  stop: jest.fn(),
  reset: jest.fn(),
}));

// Mock Animated loop
jest.spyOn(Animated, 'loop').mockImplementation((animation) => ({
  start: jest.fn(),
  stop: jest.fn(),
  reset: jest.fn(),
}));

// Mock Animated sequence
jest.spyOn(Animated, 'sequence').mockImplementation((animations) => ({
  start: (callback) => {
    if (callback) callback({ finished: true });
  },
  stop: jest.fn(),
  reset: jest.fn(),
}));

describe('PaymentStatusOverlay', () => {
  const mockOnCancel = jest.fn();

  const defaultProps = {
    visible: true,
    status: 'processing' as PaymentStatus,
    amount: 99.99,
    currency: 'USD',
    paymentMethod: 'Credit Card',
    message: 'Processing payment...',
    onCancel: mockOnCancel,
    canCancel: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render correctly when visible', () => {
      const { getByTestId } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      expect(getByTestId('payment-status-overlay')).toBeTruthy();
    });

    it('should not render when not visible', () => {
      const { queryByTestId } = render(
        <PaymentStatusOverlay {...defaultProps} visible={false} />
      );

      expect(queryByTestId('payment-status-overlay')).toBeNull();
    });

    it('should display amount and currency', () => {
      const { getByText } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      expect(getByText('.99')).toBeTruthy();
    });

    it('should display payment method', () => {
      const { getByText } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      expect(getByText('Credit Card')).toBeTruthy();
    });

    it('should display custom message', () => {
      const { getByText } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      expect(getByText('Processing payment...')).toBeTruthy();
    });
  });

  describe('Status States', () => {
    it('should render processing status', () => {
      const { getByText, getByTestId } = render(
        <PaymentStatusOverlay
          {...defaultProps}
          status="processing"
        />
      );

      expect(getByText('Processing Payment')).toBeTruthy();
      expect(getByTestId('status-icon-processing')).toBeTruthy();
      expect(getByTestId('activity-indicator')).toBeTruthy();
    });

    it('should render success status', () => {
      const { getByText, getByTestId } = render(
        <PaymentStatusOverlay
          {...defaultProps}
          status="success"
          message="Payment successful!"
        />
      );

      expect(getByText('Payment Successful')).toBeTruthy();
      expect(getByText('Payment successful!')).toBeTruthy();
      expect(getByTestId('status-icon-success')).toBeTruthy();
    });

    it('should render failed status', () => {
      const { getByText, getByTestId } = render(
        <PaymentStatusOverlay
          {...defaultProps}
          status="failed"
          message="Payment failed. Please try again."
        />
      );

      expect(getByText('Payment Failed')).toBeTruthy();
      expect(getByText('Payment failed. Please try again.')).toBeTruthy();
      expect(getByTestId('status-icon-failed')).toBeTruthy();
    });
  });

  describe('Cancel Functionality', () => {
    it('should show cancel button when canCancel is true', () => {
      const { getByTestId } = render(
        <PaymentStatusOverlay {...defaultProps} canCancel={true} />
      );

      expect(getByTestId('cancel-payment-button')).toBeTruthy();
    });

    it('should hide cancel button when canCancel is false', () => {
      const { queryByTestId } = render(
        <PaymentStatusOverlay {...defaultProps} canCancel={false} />
      );

      expect(queryByTestId('cancel-payment-button')).toBeNull();
    });

    it('should call onCancel when cancel button is pressed', () => {
      const { getByTestId } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      const cancelButton = getByTestId('cancel-payment-button');
      fireEvent.press(cancelButton);

      expect(mockOnCancel).toHaveBeenCalled();
    });
  });

  describe('Animations', () => {
    it('should trigger fade in animation when visible', async () => {
      const { rerender } = render(
        <PaymentStatusOverlay {...defaultProps} visible={false} />
      );

      rerender(<PaymentStatusOverlay {...defaultProps} visible={true} />);

      await waitFor(() => {
        expect(Animated.timing).toHaveBeenCalled();
      });
    });

    it('should trigger pulse animation for processing status', () => {
      render(
        <PaymentStatusOverlay
          {...defaultProps}
          status="processing"
        />
      );

      expect(Animated.loop).toHaveBeenCalled();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      expect(getByLabelText('Payment status modal')).toBeTruthy();
    });

    it('should have accessible cancel button', () => {
      const { getByTestId } = render(
        <PaymentStatusOverlay {...defaultProps} />
      );

      const cancelButton = getByTestId('cancel-payment-button');
      expect(cancelButton.props.accessibilityRole).toBe('button');
      expect(cancelButton.props.accessibilityLabel).toBe('Cancel payment');
    });
  });
});
