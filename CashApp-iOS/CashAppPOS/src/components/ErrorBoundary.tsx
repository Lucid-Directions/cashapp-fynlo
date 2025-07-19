import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import ErrorTrackingService from '../services/ErrorTrackingService';
import { error as logError } from '../services/LoggingService';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

class ErrorBoundary extends Component<Props, State> {
  private errorTrackingService: ErrorTrackingService;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
    this.errorTrackingService = ErrorTrackingService.getInstance();
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    logError('ErrorBoundary caught an error', error, {
      context: {
        source: 'ErrorBoundary',
        componentStack: errorInfo.componentStack,
      }
    });
    
    this.setState({
      errorInfo,
    });

    // Track the error with Sentry
    this.errorTrackingService.captureError(error, {
      action: 'react_error_boundary',
      additionalData: {
        componentStack: errorInfo.componentStack,
        errorBoundary: true,
        errorName: error.name,
        errorMessage: error.message,
        errorStack: error.stack,
      }
    });

    // Call the onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
    // Track error recovery
    this.errorTrackingService.trackEvent('error_boundary_reset');
  };

  handleReportError = () => {
    this.errorTrackingService.showUserFeedbackDialog();
  };

  handleRestartApp = () => {
    Alert.alert(
      'Restart App',
      'This will close and restart the app. Any unsaved data will be lost.',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Restart', 
          style: 'destructive',
          onPress: () => {
            this.errorTrackingService.trackEvent('app_restart_requested');
            this.handleReset();
          }
        },
      ]
    );
  };

  render() {
    if (this.state.hasError) {
      // Custom fallback provided
      if (this.props.fallback) {
        return <>{this.props.fallback}</>;
      }

      // Default error UI
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.errorContainer}>
              <Icon name="error-outline" size={64} color="#E74C3C" />
              <Text style={styles.title}>Oops! Something went wrong</Text>
              <Text style={styles.message}>
                We encountered an unexpected error. Please try again.
              </Text>

              {__DEV__ && this.state.error && (
                <View style={styles.debugInfo}>
                  <Text style={styles.debugTitle}>Debug Information:</Text>
                  <Text style={styles.errorText}>{this.state.error.toString()}</Text>
                  {this.state.errorInfo && (
                    <Text style={styles.stackTrace}>
                      {this.state.errorInfo.componentStack}
                    </Text>
                  )}
                </View>
              )}

              <TouchableOpacity
                style={styles.resetButton}
                onPress={this.handleReset}
                activeOpacity={0.8}
              >
                <Icon name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.resetButtonText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F9FA',
  },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 20,
  },
  errorContainer: {
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 20,
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 20,
  },
  resetButton: {
    flexDirection: 'row',
    backgroundColor: '#00A651',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 20,
  },
  resetButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  debugInfo: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 8,
    marginTop: 20,
    marginBottom: 20,
    width: '100%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 12,
    color: '#856404',
    marginBottom: 10,
    fontFamily: 'monospace',
  },
  stackTrace: {
    fontSize: 10,
    color: '#666666',
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;