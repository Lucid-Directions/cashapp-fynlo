/**
 * Example Usage - Shows how to integrate sync status components
 * This file demonstrates different ways to use the sync components in screens
 */

import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
} from 'react-native';

import { SyncStatusBar, NetworkAlertBanner } from './index';

/**
 * Example 1: Minimal sync indicator at top of screen
 */
export const MinimalExample: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar position="top" compact={true} />
      <ScrollView style={styles.content}>
        <Text>Your main content here</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * Example 2: Full sync status with details
 */
export const DetailedExample: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar 
        position="top" 
        compact={false} 
        showDetails={true}
        onPress={() => console.log('Navigate to sync details')}
      />
      <ScrollView style={styles.content}>
        <Text>Your main content here</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

/**
 * Example 3: With network alert banner
 */
export const WithAlertBanner: React.FC = () => {
  return (
    <View style={styles.container}>
      <NetworkAlertBanner 
        position="top"
        autoHide={true}
        autoHideDelay={5000}
      />
      <SafeAreaView style={styles.container}>
        <SyncStatusBar position="top" compact={true} />
        <ScrollView style={styles.content}>
          <Text>Your main content here</Text>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

/**
 * Example 4: Bottom position for tablet/POS layouts
 */
export const BottomPositionExample: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.content}>
        <Text>Your main content here</Text>
      </ScrollView>
      <SyncStatusBar 
        position="bottom" 
        compact={false} 
        showDetails={true}
      />
    </SafeAreaView>
  );
};

/**
 * Example 5: Integration in existing screen (e.g., POSScreen)
 * Add this to your existing screen component:
 */
export const IntegrationExample = `
// In your existing screen component (e.g., POSScreen.tsx):

import { SyncStatusBar, NetworkAlertBanner } from '../components/sync';

const POSScreen = () => {
  // Your existing code...
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Network alert appears over everything when offline */}
      <NetworkAlertBanner position="top" />
      
      {/* Sync status bar always visible but minimal */}
      <SyncStatusBar position="top" compact={true} />
      
      {/* Your existing screen content */}
      <View style={styles.mainContent}>
        {/* ... */}
      </View>
    </SafeAreaView>
  );
};
`;

/**
 * Example 6: Custom styling
 */
export const CustomStyledExample: React.FC = () => {
  return (
    <SafeAreaView style={styles.container}>
      <SyncStatusBar 
        position="top"
        style={{
          backgroundColor: '#f0f0f0',
          borderBottomWidth: 2,
          borderBottomColor: '#ccc',
        }}
      />
      <ScrollView style={styles.content}>
        <Text>Your main content here</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flex: 1,
    padding: 16,
  },
  mainContent: {
    flex: 1,
  },
});

export default {
  MinimalExample,
  DetailedExample,
  WithAlertBanner,
  BottomPositionExample,
  CustomStyledExample,
};
EOF < /dev/null