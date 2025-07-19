import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { NavigationProp } from '@react-navigation/native';
import { error as logError, info } from '../services/LoggingService';
import ErrorTrackingService from '../services/ErrorTrackingService';

interface Props {
  children: ReactNode;
  screenName: string;
  navigation?: NavigationProp<any>;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  canGoBack?: boolean;
  fallbackScreen?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isRecovering: boolean;
  retryCount: number;
}

/**
 * Screen-specific error boundary with navigation-aware recovery
 * 
 * Features:
 * - Navigation integration for better recovery options
 * - Screen-specific error tracking
 * - Automatic retry with exponential backoff
 * - Graceful degradation to previous screen
 */
class ScreenErrorBoundary extends Component<Props, State> {
  private errorTrackingService: ErrorTrackingService;
  private retryTimeoutId: NodeJS.Timeout | null = null;

  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: false,
      retryCount: 0,
    };
    this.errorTrackingService = ErrorTrackingService.getInstance();
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    const { screenName } = this.props;
    
    logError(`Screen error in ${screenName}`, error, {
      action: 'screen_error_boundary',
      context: {
        screenName,
        componentStack: errorInfo.componentStack,
        retryCount: this.state.retryCount,
      }
    });

    this.setState({ errorInfo });

    // Track with enhanced context
    this.errorTrackingService.captureError(error, {
      action: 'screen_error_boundary',
      screenName,
      additionalData: {
        componentStack: errorInfo.componentStack,
        screenName,
        retryCount: this.state.retryCount,
        canGoBack: this.props.canGoBack,
        hasNavigation: !!this.props.navigation,
      }
    });

    // Call custom error handler
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Auto-retry for transient errors
    if (this.shouldAutoRetry(error)) {
      this.scheduleRetry();
    }
  }

  componentWillUnmount() {
    if (this.retryTimeoutId) {
      clearTimeout(this.retryTimeoutId);
    }
  }

  shouldAutoRetry(error: Error): boolean {
    // Only retry network errors and certain types
    const retryableErrors = [
      'Network request failed',
      'timeout',
      'fetch error',
    ];
    
    const errorMessage = error.message.toLowerCase();
    const isRetryable = retryableErrors.some(msg => errorMessage.includes(msg));
    
    return isRetryable && this.state.retryCount < 3;
  }

  scheduleRetry() {
    const delay = Math.pow(2, this.state.retryCount) * 1000; // Exponential backoff
    
    info(`Scheduling automatic retry in ${delay}ms`, {
      screenName: this.props.screenName,
      retryCount: this.state.retryCount,
    });

    this.retryTimeoutId = setTimeout(() => {
      this.handleRetry();
    }, delay);
  }

  handleRetry = () => {
    this.setState(prevState => ({
      hasError: false,
      error: null,
      errorInfo: null,
      isRecovering: true,
      retryCount: prevState.retryCount + 1,
    }));

    // Give React time to re-render
    setTimeout(() => {
      this.setState({ isRecovering: false });
    }, 100);

    this.errorTrackingService.trackEvent('screen_error_retry', {
      screenName: this.props.screenName,
      retryCount: this.state.retryCount + 1,
    });
  };

  handleGoBack = () => {
    const { navigation, screenName } = this.props;
    
    if (navigation && navigation.canGoBack()) {
      this.errorTrackingService.trackEvent('screen_error_go_back', {
        screenName,
      });
      navigation.goBack();
    }
  };

  handleNavigateToFallback = () => {
    const { navigation, fallbackScreen, screenName } = this.props;
    
    if (navigation && fallbackScreen) {
      this.errorTrackingService.trackEvent('screen_error_fallback_navigation', {
        from: screenName,
        to: fallbackScreen,
      });
      navigation.navigate(fallbackScreen as never);
    }
  };

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      retryCount: 0,
    });
    
    this.errorTrackingService.trackEvent('screen_error_reset', {
      screenName: this.props.screenName,
    });
  };

  renderErrorUI() {
    const { navigation, canGoBack, fallbackScreen, screenName } = this.props;
    const { error, isRecovering } = this.state;
    
    if (isRecovering) {
      return (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#00A651" />
          <Text style={styles.loadingText}>Recovering...</Text>
        </View>
      );
    }

    const showGoBack = navigation && (canGoBack !== false) && navigation.canGoBack();
    const showFallback = navigation && fallbackScreen;

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <Icon name="error-outline" size={64} color="#E74C3C" />
          <Text style={styles.title}>Screen Error</Text>
          <Text style={styles.screenName}>{screenName}</Text>
          <Text style={styles.message}>
            This screen encountered an error and cannot be displayed properly.
          </Text>

          {__DEV__ && error && (
            <View style={styles.debugInfo}>
              <Text style={styles.debugTitle}>Error Details:</Text>
              <Text style={styles.errorText} numberOfLines={3}>
                {error.toString()}
              </Text>
            </View>
          )}

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.primaryButton]}
              onPress={this.handleRetry}
              activeOpacity={0.8}
            >
              <Icon name="refresh" size={20} color="#FFFFFF" />
              <Text style={styles.primaryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {showGoBack && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={this.handleGoBack}
                activeOpacity={0.8}
              >
                <Icon name="arrow-back" size={20} color="#2C3E50" />
                <Text style={styles.secondaryButtonText}>Go Back</Text>
              </TouchableOpacity>
            )}

            {showFallback && (
              <TouchableOpacity
                style={[styles.button, styles.secondaryButton]}
                onPress={this.handleNavigateToFallback}
                activeOpacity={0.8}
              >
                <Icon name="home" size={20} color="#2C3E50" />
                <Text style={styles.secondaryButtonText}>Go Home</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </SafeAreaView>
    );
  }

  render() {
    if (this.state.hasError) {
      return this.renderErrorUI();
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
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: '#7F8C8D',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#2C3E50',
    marginTop: 20,
    marginBottom: 5,
  },
  screenName: {
    fontSize: 14,
    color: '#95A5A6',
    marginBottom: 15,
    fontStyle: 'italic',
  },
  message: {
    fontSize: 16,
    color: '#7F8C8D',
    textAlign: 'center',
    marginBottom: 30,
    paddingHorizontal: 40,
    lineHeight: 22,
  },
  buttonContainer: {
    width: '100%',
    paddingHorizontal: 20,
  },
  button: {
    flexDirection: 'row',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  primaryButton: {
    backgroundColor: '#00A651',
  },
  secondaryButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
    marginLeft: 8,
  },
  secondaryButtonText: {
    color: '#2C3E50',
    fontSize: 16,
    fontWeight: '500',
    marginLeft: 8,
  },
  debugInfo: {
    backgroundColor: '#FFF3CD',
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    width: '90%',
  },
  debugTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#856404',
    marginBottom: 5,
  },
  errorText: {
    fontSize: 12,
    color: '#856404',
    fontFamily: 'monospace',
  },
});

export default ScreenErrorBoundary;