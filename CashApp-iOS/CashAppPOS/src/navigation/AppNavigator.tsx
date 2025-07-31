import React from 'react';

import { View, ActivityIndicator, StyleSheet } from 'react-native';

import { logger } from '../utils/logger';

import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';

// TODO: Unused import - import { isFeatureEnabled } from '../config/featureFlags';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../design-system/ThemeProvider';
import AuthScreen from '../screens/auth/AuthScreen';
import ComprehensiveRestaurantOnboardingScreen from '../screens/onboarding/ComprehensiveRestaurantOnboardingScreen';
import { useAuthStore } from '../store/useAuthStore';

import MainNavigator from './MainNavigator';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, isPlatformOwner, user } = useAuth();
  const authStoreUser = useAuthStore((state) => state.user);
  const { theme } = useTheme();

  // Check if user needs onboarding
  const needsOnboarding =
    authStoreUser?.needs_onboarding ||
    (!authStoreUser?.restaurant_id && authStoreUser?.role !== 'platform_owner');

  logger.info(
    'AppNavigator - User:',
    user?.email,
    'Role:',
    user?.role,
    'isPlatformOwner:',
    isPlatformOwner,
    'needsOnboarding:',
    needsOnboarding
  );

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerShown: false,
        }}
      >
        {!isAuthenticated ? (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{
              animationTypeForReplace: 'pop',
            }}
          />
        ) : needsOnboarding ? (
          <Stack.Screen
            name="Onboarding"
            component={ComprehensiveRestaurantOnboardingScreen}
            options={{
              animationTypeForReplace: 'push',
              gestureEnabled: false, // Prevent swipe back during onboarding
            }}
          />
        ) : (
          <Stack.Screen
            name="Main"
            component={MainNavigator}
            options={{
              animationTypeForReplace: 'push',
            }}
          />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
  },
});

export default AppNavigator;
