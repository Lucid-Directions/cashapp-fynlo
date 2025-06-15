import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { MainTabParamList, RootStackParamList } from '../types';
import POSScreen from '../screens/main/POSScreen';
import OrdersScreen from '../screens/main/OrdersScreen';
import ReportsScreen from '../screens/main/ReportsScreen';
import SettingsScreen from '../screens/main/SettingsScreen';
import ProfileScreen from '../screens/main/ProfileScreen';
import OrderDetailsScreen from '../screens/main/OrderDetailsScreen';
import useAppStore from '../store/useAppStore';

const Tab = createBottomTabNavigator<MainTabParamList>();
const Drawer = createDrawerNavigator();
const Stack = createStackNavigator<RootStackParamList>();

// Colors
const Colors = {
  primary: '#2C3E50',
  secondary: '#3498DB',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  text: '#2C3E50',
  tabActive: '#3498DB',
  tabInactive: '#95A5A6',
};

const MainTabNavigator: React.FC = () => {
  const cartItemCount = useAppStore((state) => state.cartItemCount());

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'POS':
              iconName = 'point-of-sale';
              break;
            case 'Orders':
              iconName = 'receipt';
              break;
            case 'Reports':
              iconName = 'analytics';
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
          borderTopColor: Colors.lightGray,
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
        name="POS"
        component={POSScreen}
        options={{
          tabBarBadge: cartItemCount > 0 ? cartItemCount : undefined,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersScreen}
      />
      <Tab.Screen
        name="Reports"
        component={ReportsScreen}
      />
    </Tab.Navigator>
  );
};

const DrawerNavigator: React.FC = () => {
  return (
    <Drawer.Navigator
      screenOptions={{
        headerShown: false,
        drawerStyle: {
          backgroundColor: Colors.background,
          width: 280,
        },
        drawerLabelStyle: {
          fontSize: 16,
          fontWeight: '600',
          color: Colors.text,
        },
        drawerActiveTintColor: Colors.primary,
        drawerInactiveTintColor: Colors.text,
      }}
    >
      <Drawer.Screen
        name="MainTabs"
        component={MainTabNavigator}
        options={{
          drawerLabel: 'Point of Sale',
          drawerIcon: ({ color }) => (
            <Icon name="store" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Profile"
        component={ProfileScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Icon name="person" size={24} color={color} />
          ),
        }}
      />
      <Drawer.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          drawerIcon: ({ color }) => (
            <Icon name="settings" size={24} color={color} />
          ),
        }}
      />
    </Drawer.Navigator>
  );
};

const MainNavigator: React.FC = () => {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
      }}
    >
      <Stack.Screen
        name="Main"
        component={DrawerNavigator}
      />
      <Stack.Screen
        name="OrderDetails"
        component={OrderDetailsScreen}
        options={{
          presentation: 'modal',
          gestureEnabled: true,
        }}
      />
    </Stack.Navigator>
  );
};

export default MainNavigator;