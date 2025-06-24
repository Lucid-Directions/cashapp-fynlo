import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import SettingsScreen from '../screens/settings/SettingsScreen';

// Import actual screens
import BusinessSettingsScreen from '../screens/settings/BusinessSettingsScreen';
import BusinessInformationScreen from '../screens/settings/business/BusinessInformationScreen';
import TaxConfigurationScreen from '../screens/settings/business/TaxConfigurationScreen';
import PaymentMethodsScreen from '../screens/settings/business/PaymentMethodsScreen';
import PaymentMethodsInfoScreen from '../screens/settings/business/PaymentMethodsInfoScreen';
import ReceiptCustomizationScreen from '../screens/settings/business/ReceiptCustomizationScreen';
import OperatingHoursScreen from '../screens/settings/business/OperatingHoursScreen';

// Import Hardware screens
import HardwareSettingsScreen from '../screens/settings/HardwareSettingsScreen';
import PrinterSetupScreen from '../screens/settings/hardware/PrinterSetupScreen';
import CashDrawerScreen from '../screens/settings/hardware/CashDrawerScreen';
import BarcodeScannerScreen from '../screens/settings/hardware/BarcodeScannerScreen';
import CardReaderScreen from '../screens/settings/hardware/CardReaderScreen';
import HardwareDiagnosticsScreen from '../screens/settings/hardware/HardwareDiagnosticsScreen';

import UserSettingsScreen from '../screens/settings/UserSettingsScreen';
import UserProfileScreen from '../screens/settings/user/UserProfileScreen';
import NotificationSettingsScreen from '../screens/settings/user/NotificationSettingsScreen';
import ThemeOptionsScreen from '../screens/settings/user/ThemeOptionsScreen';
import LocalizationScreen from '../screens/settings/user/LocalizationScreen';
import AccessibilityScreen from '../screens/settings/user/AccessibilityScreen';

import AppSettingsScreen from '../screens/settings/AppSettingsScreen';
import MenuManagementScreen from '../screens/settings/app/MenuManagementScreen';
import PricingDiscountsScreen from '../screens/settings/app/PricingDiscountsScreen';
import BackupRestoreScreen from '../screens/settings/app/BackupRestoreScreen';
import DataExportScreen from '../screens/settings/app/DataExportScreen';
import SystemDiagnosticsScreen from '../screens/settings/app/SystemDiagnosticsScreen';
import DeveloperSettingsScreen from '../screens/settings/DeveloperSettingsScreen';
import XeroSettingsScreen from '../screens/settings/XeroSettingsScreen';
import XeroSyncDashboard from '../screens/xero/XeroSyncDashboard';
import RestaurantSetupScreen from '../screens/onboarding/RestaurantSetupScreen';
import RestaurantProfileScreen from '../screens/settings/RestaurantProfileScreen';
import RestaurantPlatformOverridesScreen from '../screens/settings/RestaurantPlatformOverridesScreen';

export type SettingsStackParamList = {
  SettingsMain: undefined;
  
  // Business Settings
  BusinessSettings: undefined;
  BusinessInformation: undefined;
  TaxConfiguration: undefined;
  PaymentMethods: undefined;
  PaymentMethodsInfo: undefined;
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
  SettingsMenuManagement: undefined;
  PricingDiscounts: undefined;
  BackupRestore: undefined;
  DataExport: undefined;
  SystemDiagnostics: undefined;
  DeveloperSettings: undefined;
  
  // Integrations
  XeroSettings: undefined;
  XeroSyncDashboard: undefined;
  
  // Onboarding
  RestaurantSetup: undefined;
  RestaurantProfile: undefined;
  
  // Platform Settings
  RestaurantPlatformOverrides: undefined;
};

const Stack = createStackNavigator<SettingsStackParamList>();


const SettingsNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="SettingsMain"
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: '#F5F5F5' },
      }}
    >
      {/* Main Settings Hub */}
      <Stack.Screen 
        name="SettingsMain" 
        component={SettingsScreen} 
      />
      
      {/* Business Settings */}
      <Stack.Screen 
        name="BusinessSettings" 
        component={BusinessSettingsScreen} 
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
        name="PaymentMethodsInfo" 
        component={PaymentMethodsInfoScreen} 
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
        component={HardwareSettingsScreen} 
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
        component={UserSettingsScreen} 
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
        component={AppSettingsScreen} 
      />
      <Stack.Screen 
        name="SettingsMenuManagement" 
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
      
      {/* Integrations */}
      <Stack.Screen 
        name="XeroSettings" 
        component={XeroSettingsScreen} 
      />
      <Stack.Screen 
        name="XeroSyncDashboard" 
        component={XeroSyncDashboard} 
      />
      
      {/* Onboarding */}
      <Stack.Screen 
        name="RestaurantSetup" 
        component={RestaurantSetupScreen} 
      />
      <Stack.Screen 
        name="RestaurantProfile" 
        component={RestaurantProfileScreen} 
      />
      
      {/* Platform Settings */}
      <Stack.Screen 
        name="RestaurantPlatformOverrides" 
        component={RestaurantPlatformOverridesScreen}
        options={{
          title: 'Platform Settings',
          headerStyle: { backgroundColor: '#F8F9FA' },
          headerTintColor: '#2C3E50',
          headerTitleStyle: { fontWeight: '600' },
        }}
      />
    </Stack.Navigator>
  );
};


export default SettingsNavigator;