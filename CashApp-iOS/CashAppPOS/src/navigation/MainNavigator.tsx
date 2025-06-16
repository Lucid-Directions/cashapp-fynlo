import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabParamList, MainStackParamList } from '../types';
import POSScreen from '../screens/main/POSScreen';
import OrdersScreen from '../screens/main/OrdersScreen';
import ReportsScreen from '../screens/reports/ReportsScreen';
import MoreScreen from '../screens/more/MoreScreen';
import EmployeesScreen from '../screens/employees/EmployeesScreen';
import CustomersScreen from '../screens/customers/CustomersScreen';
import InventoryScreen from '../screens/inventory/InventoryScreen';
import useAppStore from '../store/useAppStore';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Stack = createStackNavigator<MainStackParamList>();

// Clover POS Colors
const Colors = {
  primary: '#00A651',      // Clover Green
  secondary: '#0066CC',    // Clover Blue
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  text: '#333333',
  tabActive: '#00A651',
  tabInactive: '#666666',
  border: '#DDDDDD',
};

const MainTabNavigator: React.FC = () => {
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
        tabBarActiveTintColor: Colors.tabActive,
        tabBarInactiveTintColor: Colors.tabInactive,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
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
          tabBarLabel: 'Home',
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
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: Colors.background },
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
        name="Employees"
        component={EmployeesScreen}
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
    </Stack.Navigator>
  );
};

export default MainNavigator;