// ErrorBoundary.test.tsx - Test error boundary functionality
import React from 'react';
import { render } from '@testing-library/react-native';
import ErrorBoundary from '../ErrorBoundary';
import { Text } from 'react-native';

// Component that throws an error
const ThrowError = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (_shouldThrow) {
    throw new Error('Test error');
  }
  return <Text>No error</Text>;
};

describe('ErrorBoundary', () => {
  // Mock console.error to avoid noise in tests
  const originalError = console.error;
  beforeAll(() => {});

  afterAll(() => {});

  it('should render children when there is no error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={false} />
      </ErrorBoundary>,
    );

    expect(getByText('No error')).toBeTruthy();
  });

  it('should render error UI when there is an error', () => {
    const { getByText } = render(
      <ErrorBoundary>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(getByText('Oops! Something went wrong')).toBeTruthy();
    expect(getByText('We encountered an unexpected error. Please try again.')).toBeTruthy();
  });

  it('should render custom fallback when provided', () => {
    const customFallback = <Text>Custom error message</Text>;

    const { getByText } = render(
      <ErrorBoundary fallback={customFallback}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(getByText('Custom error message')).toBeTruthy();
  });

  it('should call onError callback when error occurs', () => {
    const onError = jest.fn();

    render(
      <ErrorBoundary onError={onError}>
        <ThrowError shouldThrow={true} />
      </ErrorBoundary>,
    );

    expect(_onError).toHaveBeenCalled();
    expect(_onError).toHaveBeenCalledWith(
      expect.any(_Error),
      expect.objectContaining({
        componentStack: expect.any(_String),
      }),
    );
  });
});
