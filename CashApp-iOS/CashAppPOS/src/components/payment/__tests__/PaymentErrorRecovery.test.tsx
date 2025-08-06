import React from 'react';
import { render, fireEvent, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import PaymentErrorRecovery, {
  PaymentErrorType,
  RecoveryAction,
  PaymentError,
} from '../PaymentErrorRecovery';

// Mock dependencies
jest.mock('../../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
  },
}));

jest.mock('react-native-vector-icons/MaterialIcons', () => 'Icon');

// Mock Alert
jest.spyOn(Alert, 'alert').mockImplementation(() => {});

describe('PaymentErrorRecovery', () => {
  const mockOnRecoveryAction = jest.fn();
  const mockOnDismiss = jest.fn();

  const defaultError: PaymentError = {
    type: PaymentErrorType.NETWORK_ERROR,
    message: 'Network connection failed',
    timestamp: new Date(),
    retryCount: 0,
    amount: 100.50,
  };

  const defaultProps = {
    visible: true,
    error: defaultError,
    onRecoveryAction: mockOnRecoveryAction,
    onDismiss: mockOnDismiss,
    maxRetries: 3,
    allowOfflineMode: true,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    it('should render correctly when visible', () => {
      const { getByTestId, getByText } = render(
        <PaymentErrorRecovery {...defaultProps} />
      );

      expect(getByTestId('payment-error-recovery')).toBeTruthy();
      expect(getByText('Payment Failed')).toBeTruthy();
    });

    it('should not render when not visible', () => {
      const { queryByTestId } = render(
        <PaymentErrorRecovery {...defaultProps} visible={false} />
      );

      expect(queryByTestId('payment-error-recovery')).toBeNull();
    });

    it('should display error message', () => {
      const { getByText } = render(
        <PaymentErrorRecovery {...defaultProps} />
      );

      expect(getByText(defaultError.message!)).toBeTruthy();
    });
  });

  describe('Error Type Handling', () => {
    it('should handle NETWORK_ERROR type', () => {
      const { getByText } = render(
        <PaymentErrorRecovery {...defaultProps} />
      );

      expect(getByText('Network Issue')).toBeTruthy();
      expect(getByText(/Check your internet connection/)).toBeTruthy();
    });

    it('should handle CARD_DECLINED type', () => {
      const cardDeclinedError: PaymentError = {
        ...defaultError,
        type: PaymentErrorType.CARD_DECLINED,
        message: 'Card was declined',
      };

      const { getByText } = render(
        <PaymentErrorRecovery {...defaultProps} error={cardDeclinedError} />
      );

      expect(getByText('Card Declined')).toBeTruthy();
      expect(getByText(/Try a different payment method/)).toBeTruthy();
    });
  });

  describe('Recovery Actions', () => {
    it('should trigger RETRY_SAME action', async () => {
      const { getByText } = render(
        <PaymentErrorRecovery {...defaultProps} />
      );

      const retryButton = getByText('Retry Payment');
      fireEvent.press(retryButton);

      await waitFor(() => {
        expect(mockOnRecoveryAction).toHaveBeenCalledWith(
          RecoveryAction.RETRY_SAME,
          expect.objectContaining({
            retryCount: 1,
          })
        );
      });
    });
  });

  describe('Retry Limit', () => {
    it('should disable retry when max retries reached', () => {
      const errorWithMaxRetries: PaymentError = {
        ...defaultError,
        retryCount: 3,
      };

      const { queryByText } = render(
        <PaymentErrorRecovery
          {...defaultProps}
          error={errorWithMaxRetries}
          maxRetries={3}
        />
      );

      expect(queryByText('Retry Payment')).toBeNull();
    });
  });

  describe('Accessibility', () => {
    it('should have proper accessibility labels', () => {
      const { getByLabelText } = render(
        <PaymentErrorRecovery {...defaultProps} />
      );

      expect(getByLabelText('Payment error recovery modal')).toBeTruthy();
    });
  });
});
