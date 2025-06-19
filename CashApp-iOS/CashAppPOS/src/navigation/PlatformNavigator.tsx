import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Platform } from 'react-native';

// Platform Owner Screens
import PlatformDashboardScreen from '../screens/platform/PlatformDashboardScreen';
import RestaurantsScreen from '../screens/platform/RestaurantsScreen';
import PlatformAnalyticsScreen from '../screens/platform/PlatformAnalyticsScreen';
import SystemMonitoringScreen from '../screens/platform/SystemMonitoringScreen';
import UserManagementScreen from '../screens/platform/UserManagementScreen';

// Fynlo POS Color Scheme
const Colors = {
  primary: '#00A651',      // Fynlo Green
  secondary: '#0066CC',    // Fynlo Blue
  background: '#F5F5F5',
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  mediumGray: '#999999',
  darkGray: '#666666',
  text: '#333333',
  lightText: '#666666',
  border: '#DDDDDD',
};

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// Stack navigators for each tab
const DashboardStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="PlatformDashboard" component={PlatformDashboardScreen} />
  </Stack.Navigator>
);

const RestaurantsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="RestaurantsList" component={RestaurantsScreen} />
  </Stack.Navigator>
);

const AnalyticsStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="PlatformAnalytics" component={PlatformAnalyticsScreen} />
  </Stack.Navigator>
);

const MonitoringStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="SystemMonitoring" component={SystemMonitoringScreen} />
  </Stack.Navigator>
);

const ManagementStack = () => (
  <Stack.Navigator
    screenOptions={{
      headerShown: false,
    }}
  >
    <Stack.Screen name="UserManagement" component={UserManagementScreen} />
  </Stack.Navigator>
);

const PlatformNavigator: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: string;

          switch (route.name) {
            case 'Dashboard':
              iconName = 'dashboard';
              break;
            case 'Restaurants':
              iconName = 'store';
              break;
            case 'Analytics':
              iconName = 'analytics';
              break;
            case 'Monitoring':
              iconName = 'monitor-heart';
              break;
            case 'Management':
              iconName = 'people';
              break;
            default:
              iconName = 'help';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.mediumGray,
        tabBarStyle: {
          backgroundColor: Colors.white,
          borderTopColor: Colors.border,
          borderTopWidth: 1,
          paddingBottom: Platform.OS === 'ios' ? 20 : 5,
          height: Platform.OS === 'ios' ? 85 : 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
          marginTop: 4,
        },
        tabBarIconStyle: {
          marginTop: 4,
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStack}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarBadge: undefined,
        }}
      />
      <Tab.Screen
        name="Restaurants"
        component={RestaurantsStack}
        options={{
          tabBarLabel: 'Restaurants',
          tabBarBadge: undefined,
        }}
      />
      <Tab.Screen
        name="Analytics"
        component={AnalyticsStack}
        options={{
          tabBarLabel: 'Analytics',
          tabBarBadge: undefined,
        }}
      />
      <Tab.Screen
        name="Monitoring"
        component={MonitoringStack}
        options={{
          tabBarLabel: 'Monitoring',
          tabBarBadge: 3, // Alert count
        }}
      />
      <Tab.Screen
        name="Management"
        component={ManagementStack}
        options={{
          tabBarLabel: 'Users',
          tabBarBadge: undefined,
        }}
      />
    </Tab.Navigator>
  );
};

export default PlatformNavigator;