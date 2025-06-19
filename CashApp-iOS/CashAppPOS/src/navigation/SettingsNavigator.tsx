import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Import actual screens
import BusinessInformationScreen from '../screens/settings/business/BusinessInformationScreen';
import TaxConfigurationScreen from '../screens/settings/business/TaxConfigurationScreen';
import PaymentMethodsScreen from '../screens/settings/business/PaymentMethodsScreen';
import ReceiptCustomizationScreen from '../screens/settings/business/ReceiptCustomizationScreen';
import OperatingHoursScreen from '../screens/settings/business/OperatingHoursScreen';

// Import Hardware screens
import PrinterSetupScreen from '../screens/settings/hardware/PrinterSetupScreen';
import CashDrawerScreen from '../screens/settings/hardware/CashDrawerScreen';
import BarcodeScannerScreen from '../screens/settings/hardware/BarcodeScannerScreen';
import CardReaderScreen from '../screens/settings/hardware/CardReaderScreen';
import HardwareDiagnosticsScreen from '../screens/settings/hardware/HardwareDiagnosticsScreen';

import UserProfileScreen from '../screens/settings/user/UserProfileScreen';
import NotificationSettingsScreen from '../screens/settings/user/NotificationSettingsScreen';
import ThemeOptionsScreen from '../screens/settings/user/ThemeOptionsScreen';
import LocalizationScreen from '../screens/settings/user/LocalizationScreen';
import AccessibilityScreen from '../screens/settings/user/AccessibilityScreen';

import MenuManagementScreen from '../screens/settings/app/MenuManagementScreen';
import PricingDiscountsScreen from '../screens/settings/app/PricingDiscountsScreen';
import BackupRestoreScreen from '../screens/settings/app/BackupRestoreScreen';
import DataExportScreen from '../screens/settings/app/DataExportScreen';
import SystemDiagnosticsScreen from '../screens/settings/app/SystemDiagnosticsScreen';
import DeveloperSettingsScreen from '../screens/settings/DeveloperSettingsScreen';

export type SettingsStackParamList = {
  Settings: undefined;
  
  // Business Settings
  BusinessSettings: undefined;
  BusinessInformation: undefined;
  TaxConfiguration: undefined;
  PaymentMethods: undefined;
  ReceiptCustomization: undefined;
  OperatingHours: undefined;
  
  // Hardware Configuration
  HardwareSettings: undefined;
  PrinterSetup: undefined;
  CashDrawer: undefined;
  BarcodeScanner: undefined;
  CardReader: undefined;
  HardwareDiagnostics: undefined;
  
  // User Preferences
  UserSettings: undefined;
  UserProfile: undefined;
  NotificationSettings: undefined;
  ThemeOptions: undefined;
  Localization: undefined;
  Accessibility: undefined;
  
  // App Configuration
  AppSettings: undefined;
  MenuManagement: undefined;
  PricingDiscounts: undefined;
  BackupRestore: undefined;
  DataExport: undefined;
  SystemDiagnostics: undefined;
  DeveloperSettings: undefined;
};

const Stack = createStackNavigator<SettingsStackParamList>();

// Fynlo POS Colors
const Colors = {
  primary: '#00A651',
  secondary: '#0066CC',
  success: '#00A651',
  warning: '#FF6B35',
  danger: '#E74C3C',
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

// Temporary placeholder component for unimplemented screens
const PlaceholderScreen: React.FC<{ title: string }> = ({ title }) => {
  const navigation = useNavigation();
  
  return (
    <View style={styles.container}>
      {/* Header with back button */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{title}</Text>
        <View style={styles.headerSpacer} />
      </View>
      
      {/* Content */}
      <View style={styles.placeholder}>
        <Icon name="construction" size={64} color={Colors.lightGray} />
        <Text style={styles.placeholderTitle}>{title}</Text>
        <Text style={styles.placeholderText}>This feature is coming soon...</Text>
        <Text style={styles.placeholderSubtext}>
          We're working hard to bring you this functionality. 
          Check back in a future update!
        </Text>
        
        <TouchableOpacity 
          style={styles.backToSettingsButton}
          onPress={() => navigation.goBack()}
        >
          <Icon name="arrow-back" size={20} color={Colors.primary} />
          <Text style={styles.backToSettingsText}>Back to Settings</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const SettingsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F5F5F5' },
      }}
    >
      {/* Main Settings Hub */}
      <Stack.Screen 
        name="Settings" 
        component={SettingsScreen} 
      />
      
      {/* Business Settings */}
      <Stack.Screen 
        name="BusinessSettings" 
        component={() => <PlaceholderScreen title="Business Settings" />} 
      />
      <Stack.Screen 
        name="BusinessInformation" 
        component={BusinessInformationScreen} 
      />
      <Stack.Screen 
        name="TaxConfiguration" 
        component={TaxConfigurationScreen} 
      />
      <Stack.Screen 
        name="PaymentMethods" 
        component={PaymentMethodsScreen} 
      />
      <Stack.Screen 
        name="ReceiptCustomization" 
        component={ReceiptCustomizationScreen} 
      />
      <Stack.Screen 
        name="OperatingHours" 
        component={OperatingHoursScreen} 
      />
      
      {/* Hardware Configuration */}
      <Stack.Screen 
        name="HardwareSettings" 
        component={() => <PlaceholderScreen title="Hardware Configuration" />} 
      />
      <Stack.Screen 
        name="PrinterSetup" 
        component={PrinterSetupScreen} 
      />
      <Stack.Screen 
        name="CashDrawer" 
        component={CashDrawerScreen} 
      />
      <Stack.Screen 
        name="BarcodeScanner" 
        component={BarcodeScannerScreen} 
      />
      <Stack.Screen 
        name="CardReader" 
        component={CardReaderScreen} 
      />
      <Stack.Screen 
        name="HardwareDiagnostics" 
        component={HardwareDiagnosticsScreen} 
      />
      
      {/* User Preferences */}
      <Stack.Screen 
        name="UserSettings" 
        component={() => <PlaceholderScreen title="User Preferences" />} 
      />
      <Stack.Screen 
        name="UserProfile" 
        component={UserProfileScreen} 
      />
      <Stack.Screen 
        name="NotificationSettings" 
        component={NotificationSettingsScreen} 
      />
      <Stack.Screen 
        name="ThemeOptions" 
        component={ThemeOptionsScreen} 
      />
      <Stack.Screen 
        name="Localization" 
        component={LocalizationScreen} 
      />
      <Stack.Screen 
        name="Accessibility" 
        component={AccessibilityScreen} 
      />
      
      {/* App Configuration */}
      <Stack.Screen 
        name="AppSettings" 
        component={() => <PlaceholderScreen title="App Configuration" />} 
      />
      <Stack.Screen 
        name="MenuManagement" 
        component={MenuManagementScreen} 
      />
      <Stack.Screen 
        name="PricingDiscounts" 
        component={PricingDiscountsScreen} 
      />
      <Stack.Screen 
        name="BackupRestore" 
        component={BackupRestoreScreen} 
      />
      <Stack.Screen 
        name="DataExport" 
        component={DataExportScreen} 
      />
      <Stack.Screen 
        name="SystemDiagnostics" 
        component={SystemDiagnosticsScreen} 
      />
      <Stack.Screen 
        name="DeveloperSettings" 
        component={DeveloperSettingsScreen} 
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
    backgroundColor: Colors.background,
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 24,
    marginBottom: 16,
    textAlign: 'center',
  },
  placeholderText: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    marginBottom: 8,
  },
  placeholderSubtext: {
    fontSize: 14,
    color: Colors.mediumGray,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
  },
  backToSettingsButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.primary,
    gap: 8,
  },
  backToSettingsText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.primary,
  },
});

export default SettingsNavigator;