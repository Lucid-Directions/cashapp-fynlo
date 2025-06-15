/**
 * Fynlo POS - Professional Restaurant Point of Sale System
 * Enhanced React Native App with Navigation and State Management
 */

import React, { useEffect } from 'react';
import { LogBox } from 'react-native';
import 'react-native-gesture-handler';
import AppNavigator from './src/navigation/AppNavigator';

// Suppress specific warnings for development
LogBox.ignoreLogs([
  'Warning: React has detected a change in the order of Hooks',
  'Warning: Failed prop type',
  'VirtualizedLists should never be nested',
]);

const App: React.FC = () => {
  useEffect(() => {
    // Initialize app-level configurations
    console.log('🚀 Fynlo POS App Starting...');
    
    // You can add any app initialization logic here
    // - Firebase initialization
    // - Crash reporting setup
    // - Analytics setup
    // etc.
  }, []);

  return <AppNavigator />;
};

export default App;