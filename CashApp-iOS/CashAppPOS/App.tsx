/**
 * Fynlo POS - Professional Restaurant Point of Sale System
 * Enhanced React Native App with Navigation and State Management
 */

import React, { useEffect, useState } from 'react';
import { LogBox, View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress specific warnings for development
LogBox.ignoreLogs([
  'Warning: React has detected a change in the order of Hooks',
  'Warning: Failed prop type',
  'VirtualizedLists should never be nested',
]);

const App: React.FC = () => {
  const [isAppReady, setIsAppReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const initializeApp = async () => {
      try {
        console.log('🚀 Clover POS App Starting...');
        
        // Add small delay to ensure all modules are loaded
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log('✅ App initialization complete');
        setIsAppReady(true);
      } catch (err) {
        console.error('❌ App initialization failed:', err);
        setError(err instanceof Error ? err.message : 'Unknown error');
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
        <Text style={styles.loadingText}>Loading Clover POS...</Text>
      </View>
    );
  }

  return <AppNavigator />;
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