/**
 * SyncErrorBoundary - Error boundary wrapper for sync components
 * Catches and handles errors in offline sync operations
 */

import React, { Component, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../../utils/logger';
import { FynloException } from '../../utils/exceptions/FynloException';
import { offlineQueueService } from '../../services/offline';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  showDetails?: boolean;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  errorCount: number;
}

class SyncErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log error to monitoring service
    logger.error('SyncErrorBoundary caught error:', {
      error: error.toString(),
      componentStack: errorInfo.componentStack,
      errorBoundary: 'SyncErrorBoundary',
    });

    // Convert to FynloException if not already
    const fynloError = error instanceof FynloException 
      ? error 
      : FynloException.fromError(error, 'SYNC_COMPONENT_ERROR');

    // Update state
    this.setState(prevState => ({
      errorInfo,
      errorCount: prevState.errorCount + 1,
    }));

    // Call parent error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // If too many errors, suggest clearing the queue
    if (this.state.errorCount > 3) {
      Alert.alert(
        'Sync Issues Detected',
        'Multiple sync errors have occurred. Would you like to clear the offline queue and start fresh?',
        [
          {
            text: 'Cancel',
            style: 'cancel',
          },
          {
            text: 'Clear Queue',
            style: 'destructive',
            onPress: () => this.clearQueueAndReset(),
          },
        ]
      );
    }
  }

  clearQueueAndReset = async () => {
    try {
      await offlineQueueService.clearQueue();
      this.resetError();
      Alert.alert('Success', 'Offline queue cleared successfully');
    } catch (error) {
      logger.error('Failed to clear queue:', error);
      Alert.alert('Error', 'Failed to clear offline queue');
    }
  };

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.errorCard}>
            <Icon name="error-outline" size={48} color="#DC2626" />
            
            <Text style={styles.title}>Sync Error</Text>
            
            <Text style={styles.message}>
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>

            {this.props.showDetails && this.state.error && (
              <ScrollView style={styles.detailsContainer}>
                <Text style={styles.detailsTitle}>Error Details:</Text>
                <Text style={styles.details}>
                  {this.state.error instanceof FynloException 
                    ? JSON.stringify(this.state.error.toJSON(), null, 2)
                    : this.state.error.toString()}
                </Text>
                {this.state.errorInfo && (
                  <>
                    <Text style={styles.detailsTitle}>Component Stack:</Text>
                    <Text style={styles.details}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  </>
                )}
              </ScrollView>
            )}

            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.button, styles.retryButton]}
                onPress={this.resetError}
              >
                <Icon name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.buttonText}>Retry</Text>
              </TouchableOpacity>

              {this.state.errorCount > 2 && (
                <TouchableOpacity
                  style={[styles.button, styles.clearButton]}
                  onPress={this.clearQueueAndReset}
                >
                  <Icon name="clear" size={20} color="#FFFFFF" />
                  <Text style={styles.buttonText}>Clear Queue</Text>
                </TouchableOpacity>
              )}
            </View>

            <Text style={styles.errorCount}>
              Error count: {this.state.errorCount}
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F3F4F6',
    padding: 20,
  },
  errorCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 5,
    maxWidth: 400,
    width: '100%',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginTop: 16,
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 20,
  },
  detailsContainer: {
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    padding: 12,
    maxHeight: 200,
    width: '100%',
    marginBottom: 20,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 4,
  },
  details: {
    fontSize: 10,
    color: '#6B7280',
    fontFamily: 'monospace',
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    gap: 8,
  },
  retryButton: {
    backgroundColor: '#3B82F6',
  },
  clearButton: {
    backgroundColor: '#DC2626',
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
  errorCount: {
    fontSize: 11,
    color: '#9CA3AF',
    marginTop: 16,
  },
});

export default SyncErrorBoundary;

/**
 * HOC to wrap components with error boundary
 */
export function withSyncErrorBoundary<P extends object>(
  Component: React.ComponentType<P>,
  errorBoundaryProps?: Omit<Props, 'children'>
): React.ComponentType<P> {
  return (props: P) => (
    <SyncErrorBoundary {...errorBoundaryProps}>
      <Component {...props} />
    </SyncErrorBoundary>
  );
}
EOF < /dev/null