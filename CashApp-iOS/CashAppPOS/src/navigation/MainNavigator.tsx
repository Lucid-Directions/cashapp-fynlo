import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../design-system/ThemeProvider';
import { MainTabParamList, MainStackParamList } from '../types';
import POSScreen from '../screens/main/POSScreen';
import OrdersScreen from '../screens/orders/OrdersScreen';
import ReportsScreen from '../screens/reports/ReportsScreenSimple';
import SalesReportDetailScreen from '../screens/reports/SalesReportDetailScreen';
import InventoryReportDetailScreen from '../screens/reports/InventoryReportDetailScreen';
import StaffReportDetailScreen from '../screens/reports/StaffReportDetailScreen';
import FinancialReportDetailScreen from '../screens/reports/FinancialReportDetailScreen';
import MoreScreen from '../screens/more/MoreScreen';
import EmployeesScreen from '../screens/employees/EmployeesScreen';
import EnhancedEmployeeScheduleScreen from '../screens/employees/EnhancedEmployeeScheduleScreen';
import QRScannerScreen from '../screens/scanner/QRScannerScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import MenuManagementScreen from '../screens/settings/app/MenuManagementScreen';
import DashboardScreen from '../screens/main/DashboardScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import HelpScreen from '../screens/support/HelpScreen';
import SettingsNavigator from './SettingsNavigator';
import useAppStore from '../store/useAppStore';
import EnhancedPaymentScreen from '../screens/payment/EnhancedPaymentScreen';
import ServiceChargeSelectionScreen from '../screens/payment/ServiceChargeSelectionScreen';
import QRCodePaymentScreen from '../screens/payments/QRCodePaymentScreen';
import SquareCardPaymentScreen from '../screens/payments/SquareCardPaymentScreen';
import SquareContactlessPaymentScreen from '../screens/payments/SquareContactlessPaymentScreen';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<MainStackParamList>();

const MainTabNavigator: React.FC = () => {
  const { theme } = useTheme();
  const cartItemCount = useAppStore((state) => state.cartItemCount());

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Home':
              iconName = 'home';
              break;
            case 'Orders':
              iconName = 'receipt';
              break;
            case 'More':
              iconName = 'more-horiz';
              break;
            default:
              iconName = 'home';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.colors.background,
          borderTopWidth: 1,
          borderTopColor: theme.colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 80,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '600',
          marginTop: 4,
        },
        headerShown: false,
      })}
    >
      <Tab.Screen
        name="Home"
        component={POSScreen}
        options={{
          tabBarLabel: 'POS',
          tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
        options={{
          tabBarLabel: 'Orders',
        }}
      />
      <Tab.Screen
        name="More"
        component={MoreScreen}
        options={{
          tabBarLabel: 'More',
        }}
      />
    </Tab.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  const { theme } = useTheme();
  
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="MainTabs"
        component={MainTabNavigator}
      />
      <Stack.Screen
        name="Reports"
        component={ReportsScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SalesReport"
        component={SalesReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="InventoryReport"
        component={InventoryReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="StaffReport"
        component={StaffReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="FinancialReport"
        component={FinancialReportDetailScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Employees"
        component={EmployeesScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EmployeeSchedule"
        component={EnhancedEmployeeScheduleScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QRScanner"
        component={QRScannerScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Customers"
        component={CustomersScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Inventory"
        component={InventoryScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MenuManagement"
        component={MenuManagementScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsNavigator}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="ServiceChargeSelection"
        component={ServiceChargeSelectionScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="EnhancedPayment"
        component={EnhancedPaymentScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="QRCodePayment"
        component={QRCodePaymentScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SquareCardPayment"
        component={SquareCardPaymentScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="SquareContactlessPayment"
        component={SquareContactlessPaymentScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;