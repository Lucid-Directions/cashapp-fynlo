/**
 * Fynlo POS - Professional Restaurant Point of Sale System
 * Enhanced React Native App with Navigation and State Management
 */

import React, { useEffect, useState } from 'react';
import { LogBox, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-gesture-handler';
import { AuthProvider } from './src/contexts/AuthContext';
import { ThemeProvider } from './src/design-system/ThemeProvider';
import AppNavigator from './src/navigation/AppNavigator';
import ErrorTrackingService from './src/services/ErrorTrackingService';
import ErrorBoundary from './src/components/ErrorBoundary';
import SumUpNativeService from './src/services/SumUpNativeService';
import { supabase } from './src/lib/supabase';
import { useAuthStore } from './src/store/useAuthStore';

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
        console.log('📱 BUNDLE VERSION: 2025-01-08-v7 - MINIMAL INPUTS');
        
        // Initialize error tracking service
        const errorTrackingService = ErrorTrackingService.getInstance();
        errorTrackingService.initialize();
        
        // Initialize SumUp Native SDK
        console.log('🔧 Initializing SumUp Native SDK...');
        const sumUpService = SumUpNativeService.getInstance();
        const sumUpInitialized = await sumUpService.initialize('sup_sk_XqquMi732f2WDCqvnkV4xoVxx54oGAQRU');
        
        if (sumUpInitialized) {
          console.log('✅ SumUp Native SDK initialized successfully');
        } else {
          console.warn('⚠️ SumUp Native SDK initialization failed - continuing without SumUp');
        }
        
        // Check Supabase auth state
        console.log('🔐 Checking authentication state...');
        const authStore = useAuthStore.getState();
        await authStore.checkAuth();
        
        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(
          async (event, session) => {
            console.log('🔐 Auth state changed:', event);
            if (event === 'SIGNED_OUT') {
              // Clear any stored data
              authStore.clearError();
            }
          }
        );
        
        // Add small delay to ensure all modules are loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
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
            errorType: 'app_startup_failure'
          }
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