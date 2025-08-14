/**
 * Fynlo POS - Professional Restaurant Point of Sale System
 * Enhanced React Native App with Navigation and State Management
 */

import React, { useEffect, useState } from 'react';
import { LogBox, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-gesture-handler';
// Install URLSearchParams polyfill before anything else
import './src/utils/urlSearchParamsPolyfill';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ErrorBoundary from './src/components/ErrorBoundary';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/design-system/ThemeProvider';
import { supabase } from './src/lib/supabase';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorTrackingService from './src/services/ErrorTrackingService';
import NativeSumUpService from './src/services/NativeSumUpService';
import sumUpConfigService from './src/services/SumUpConfigService';
import { useAuthStore } from './src/store/useAuthStore';
import { ensureComponentsLoaded } from './src/utils/componentRegistry';
import tokenManager from './src/utils/tokenManager';

// Suppress specific warnings for development
LogBox.ignoreLogs([
  'Warning: React has detected a change in the order of Hooks',
  'Warning: Failed prop type',
  'VirtualizedLists should never be nested',
  'UIViewController invalidate must be used from main thread only',
  'SumUp',
  'PassKit',
]);

const App: React.FC = () => {
  const [isAppReady, setIsAppReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Fynlo POS App Starting...');
        console.log('📱 BUNDLE VERSION: 2025-01-08-v10 - FIXED TextInput');

        // Ensure critical React Native components are not tree-shaken
        // This prevents ReferenceError in production iOS builds
        ensureComponentsLoaded();

        // Clear any stored authentication on app startup
        console.log('🧹 Clearing stored authentication...');
        await AsyncStorage.multiRemove([
          'auth-storage',
          'auth_token',
          'userInfo',
          'supabase_session',
          'mock_session',
          '@auth_user',
          '@auth_business',
        ]);

        // Initialize error tracking service
        const errorTrackingService = ErrorTrackingService.getInstance();
        errorTrackingService.initialize();

        // Initialize SumUp Native SDK with proper setup
        console.log('🔧 Initializing SumUp Native SDK...');
        try {
          // Check if native module is available
          if (NativeSumUpService.isAvailable()) {
            // Try to fetch config and setup SDK
            const config = await sumUpConfigService.initializeAndGetConfig();
            if (config.affiliateKey) {
              await NativeSumUpService.setupSDK(config.affiliateKey);
              console.log('✅ SumUp Native SDK setup completed with affiliate key');
              
              // Initialize after setup
              const sumUpInitialized = await NativeSumUpService.initialize();
              if (sumUpInitialized) {
                console.log('✅ SumUp Native SDK initialized successfully');
              } else {
                console.warn('⚠️ SumUp initialization returned false - user may need to login');
              }
            } else {
              console.warn('⚠️ No SumUp affiliate key available - SDK setup deferred');
            }
          } else {
            console.warn('⚠️ SumUp native module not available on this device');
          }
        } catch (error) {
          console.warn('⚠️ SumUp SDK initialization failed - continuing without SumUp:', error);
        }

        // Check Supabase auth state
        console.log('🔐 Checking authentication state...');
        const authStore = useAuthStore.getState();
        await authStore.checkAuth();

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(async (event, session) => {
          console.log('🔐 Auth state changed:', event);

          // Handle token refresh events
          if (event === 'TOKEN_REFRESHED' && session) {
            console.log('🔄 Token refreshed, updating stored token...');
            // The token manager will handle storing the new token
            // But we ensure it happens by calling getAuthToken which syncs storage
            await tokenManager.getAuthToken();
          }

          if (event === 'SIGNED_OUT') {
            // Clear any stored data
            authStore.clearError();
            await tokenManager.clearTokens();
          }

          if (event === 'SIGNED_IN' && session) {
            // Ensure token is stored for other services
            await tokenManager.getAuthToken();
          }
        });

        // Add small delay to ensure all modules are loaded
        await new Promise((resolve) => setTimeout(resolve, 100));

        console.log('✅ App initialization complete');
        setIsAppReady(true);

        // Cleanup function
        return () => {
          authListener?.subscription.unsubscribe();
        };
      } catch (err) {
        console.error('❌ App initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');

        // Track initialization error
        const errorTrackingService = ErrorTrackingService.getInstance();
        errorTrackingService.captureError(err instanceof Error ? err : new Error(`${err}`), {
          action: 'app_initialization',
          additionalData: {
            initializationError: true,
            errorType: 'app_startup_failure',
          },
        });
      }
    };

    initializeApp();
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>App Initialization Error</Text>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  if (!isAppReady) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#2C3E50" />
        <Text style={styles.loadingText}>Loading Fynlo POS...</Text>
      </View>
    );
  }

  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <AppNavigator />
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
  },
  loadingText: {
    marginTop: 20,
    fontSize: 16,
    color: '#2C3E50',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F9FA',
    padding: 20,
  },
  errorTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#E74C3C',
    marginBottom: 10,
  },
  errorText: {
    fontSize: 14,
    color: '#2C3E50',
    textAlign: 'center',
  },
});

export default App;
