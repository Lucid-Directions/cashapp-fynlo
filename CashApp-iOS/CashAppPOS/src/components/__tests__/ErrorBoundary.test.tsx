/**
 * ErrorBoundary Component Tests
 * Testing error boundary functionality and proper error handling
 */

import React from 'react';
import { Text } from 'react-native';
import { render } from '@testing-library/react-native';
import ErrorBoundary from '../ErrorBoundary';

// Mock the error handler and logger to avoid module issues
jest.mock('../../services/errorHandler', () => ({
  errorHandler: {
    showSupportInfo: jest.fn(),
  },
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    error: jest.fn(),
  },
}));

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>No error</Text>;
};

describe('ErrorBoundary', () => {
  // Mock console.error to avoid noise in tests
  const originalError = console.error;
  beforeAll(() => {
    console.error = jest.fn();
  });

  afterAll(() => {
    console.error = originalError;
  });

  it('should render children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>
    );

    expect(getByText('No error')).toBeTruthy();
  });

  it('should render error UI when there is an error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Oops\! Something went wrong')).toBeTruthy();
    expect(getByText(/We're sorry for the inconvenience/)).toBeTruthy();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <Text>Custom error message</Text>;

    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Custom error message')).toBeTruthy();
  });

  it('should show Try Again button', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Try Again')).toBeTruthy();
  });

  it('should show Contact Support button', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>
    );

    expect(getByText('Contact Support')).toBeTruthy();
  });
});