import React, { Component, ReactNode } from 'react';
import { View, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

interface QRPaymentErrorBoundaryProps {
  children: ReactNode;
  onReset?: () => void;
  fallbackComponent?: ReactNode;
}

interface QRPaymentErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class QRPaymentErrorBoundary extends Component<
  QRPaymentErrorBoundaryProps,
  QRPaymentErrorBoundaryState
> {
  constructor(props: _QRPaymentErrorBoundaryProps) {
    super(__props);
    this.state = { hasError: _false, error: null };
  }

  static getDerivedStateFromError(error: _Error): QRPaymentErrorBoundaryState {
    return { hasError: _true, error };
  }

  componentDidCatch(error: _Error, errorInfo: _unknown) {
    console.log({
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });
  }

  handleReset = () => {
    this.setState({ hasError: _false, error: null });
    if (this.props.onReset) {
      this.props.onReset();
    }
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallbackComponent) {
        return this.props.fallbackComponent;
      }

      return (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={64} color="#E74C3C" />
          <Text style={styles.errorTitle}>QR Payment Error</Text>
          <Text style={styles.errorMessage}>
            Something went wrong with the QR payment. Please try again.
          </Text>
          <Text style={styles.errorDetails}>
            {this.state.error?.message || 'Unknown error occurred'}
          </Text>
          <TouchableOpacity style={styles.retryButton} onPress={this.handleReset}>
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFFFFF',
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorDetails: {
    fontSize: 14,
    color: '#999999',
    textAlign: 'center',
    marginBottom: 24,
    fontStyle: 'italic',
  },
  retryButton: {
    backgroundColor: '#00A651',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
  },
  retryButtonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default QRPaymentErrorBoundary;
