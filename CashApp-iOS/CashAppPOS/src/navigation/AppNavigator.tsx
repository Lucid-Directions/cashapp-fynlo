import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../design-system/ThemeProvider';
import { isFeatureEnabled } from '../config/featureFlags';
import AuthScreen from '../screens/auth/AuthScreen';
import MainNavigator from './MainNavigator';
import PlatformNavigator from './PlatformNavigator';

const Stack = createStackNavigator();

const AppNavigator: React.FC = () => {
  const { isAuthenticated, isLoading, isPlatformOwner, user } = useAuth();
  const { theme } = useTheme();
  
  console.log('AppNavigator - User:', user?.email, 'Role:', user?.role, 'isPlatformOwner:', isPlatformOwner);

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
        {isAuthenticated ? (
          isFeatureEnabled('PLATFORM_OWNER_ENABLED') && isPlatformOwner ? (
            <Stack.Screen
              name="Platform"
              component={PlatformNavigator}
              options={{
                animationTypeForReplace: 'push',
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
          )
        ) : (
          <Stack.Screen
            name="Auth"
            component={AuthScreen}
            options={{
              animationTypeForReplace: 'pop',
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