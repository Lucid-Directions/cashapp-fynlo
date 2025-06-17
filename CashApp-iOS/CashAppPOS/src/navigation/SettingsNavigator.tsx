import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Import placeholder screens that will be created
// import BusinessInformationScreen from '../screens/settings/business/BusinessInformationScreen';
// import TaxConfigurationScreen from '../screens/settings/business/TaxConfigurationScreen';
// import PaymentMethodsScreen from '../screens/settings/business/PaymentMethodsScreen';
// import ReceiptCustomizationScreen from '../screens/settings/business/ReceiptCustomizationScreen';
// import OperatingHoursScreen from '../screens/settings/business/OperatingHoursScreen';

// import PrinterSetupScreen from '../screens/settings/hardware/PrinterSetupScreen';
// import CashDrawerScreen from '../screens/settings/hardware/CashDrawerScreen';
// import BarcodeScannerScreen from '../screens/settings/hardware/BarcodeScannerScreen';
// import CardReaderScreen from '../screens/settings/hardware/CardReaderScreen';
// import HardwareDiagnosticsScreen from '../screens/settings/hardware/HardwareDiagnosticsScreen';

// import UserProfileScreen from '../screens/settings/user/UserProfileScreen';
// import NotificationSettingsScreen from '../screens/settings/user/NotificationSettingsScreen';
// import ThemeOptionsScreen from '../screens/settings/user/ThemeOptionsScreen';
// import LocalizationScreen from '../screens/settings/user/LocalizationScreen';
// import AccessibilityScreen from '../screens/settings/user/AccessibilityScreen';

// import MenuManagementScreen from '../screens/settings/app/MenuManagementScreen';
// import PricingDiscountsScreen from '../screens/settings/app/PricingDiscountsScreen';
// import BackupRestoreScreen from '../screens/settings/app/BackupRestoreScreen';
// import DataExportScreen from '../screens/settings/app/DataExportScreen';
// import SystemDiagnosticsScreen from '../screens/settings/app/SystemDiagnosticsScreen';

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
};

const Stack = createStackNavigator<SettingsStackParamList>();

// Temporary placeholder component for unimplemented screens
const PlaceholderScreen: React.FC<{ title: string }> = ({ title }) => (
  <View style={styles.placeholder}>
    <Text style={styles.placeholderTitle}>{title}</Text>
    <Text style={styles.placeholderText}>This screen is coming soon...</Text>
  </View>
);

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
        component={() => <PlaceholderScreen title="Business Information" />} 
      />
      <Stack.Screen 
        name="TaxConfiguration" 
        component={() => <PlaceholderScreen title="Tax Configuration" />} 
      />
      <Stack.Screen 
        name="PaymentMethods" 
        component={() => <PlaceholderScreen title="Payment Methods" />} 
      />
      <Stack.Screen 
        name="ReceiptCustomization" 
        component={() => <PlaceholderScreen title="Receipt Customization" />} 
      />
      <Stack.Screen 
        name="OperatingHours" 
        component={() => <PlaceholderScreen title="Operating Hours" />} 
      />
      
      {/* Hardware Configuration */}
      <Stack.Screen 
        name="HardwareSettings" 
        component={() => <PlaceholderScreen title="Hardware Configuration" />} 
      />
      <Stack.Screen 
        name="PrinterSetup" 
        component={() => <PlaceholderScreen title="Printer Setup" />} 
      />
      <Stack.Screen 
        name="CashDrawer" 
        component={() => <PlaceholderScreen title="Cash Drawer" />} 
      />
      <Stack.Screen 
        name="BarcodeScanner" 
        component={() => <PlaceholderScreen title="Barcode Scanner" />} 
      />
      <Stack.Screen 
        name="CardReader" 
        component={() => <PlaceholderScreen title="Card Reader" />} 
      />
      <Stack.Screen 
        name="HardwareDiagnostics" 
        component={() => <PlaceholderScreen title="Hardware Diagnostics" />} 
      />
      
      {/* User Preferences */}
      <Stack.Screen 
        name="UserSettings" 
        component={() => <PlaceholderScreen title="User Preferences" />} 
      />
      <Stack.Screen 
        name="UserProfile" 
        component={() => <PlaceholderScreen title="User Profile" />} 
      />
      <Stack.Screen 
        name="NotificationSettings" 
        component={() => <PlaceholderScreen title="Notification Settings" />} 
      />
      <Stack.Screen 
        name="ThemeOptions" 
        component={() => <PlaceholderScreen title="Theme & Display" />} 
      />
      <Stack.Screen 
        name="Localization" 
        component={() => <PlaceholderScreen title="Language & Region" />} 
      />
      <Stack.Screen 
        name="Accessibility" 
        component={() => <PlaceholderScreen title="Accessibility" />} 
      />
      
      {/* App Configuration */}
      <Stack.Screen 
        name="AppSettings" 
        component={() => <PlaceholderScreen title="App Configuration" />} 
      />
      <Stack.Screen 
        name="MenuManagement" 
        component={() => <PlaceholderScreen title="Menu Management" />} 
      />
      <Stack.Screen 
        name="PricingDiscounts" 
        component={() => <PlaceholderScreen title="Pricing & Discounts" />} 
      />
      <Stack.Screen 
        name="BackupRestore" 
        component={() => <PlaceholderScreen title="Backup & Restore" />} 
      />
      <Stack.Screen 
        name="DataExport" 
        component={() => <PlaceholderScreen title="Data Export" />} 
      />
      <Stack.Screen 
        name="SystemDiagnostics" 
        component={() => <PlaceholderScreen title="System Diagnostics" />} 
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#F5F5F5',
  },
  placeholderTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 16,
  },
  placeholderText: {
    fontSize: 16,
    color: '#666666',
    textAlign: 'center',
  },
});

export default SettingsNavigator;