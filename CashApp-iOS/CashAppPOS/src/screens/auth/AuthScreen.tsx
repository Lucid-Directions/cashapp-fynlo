import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  StatusBar,
} from 'react-native';
import SignInScreen from './SignInScreen';
import SignUpScreen from './SignUpScreen';

// Clover POS Color Scheme
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

const AuthScreen: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);

  const switchToSignUp = () => setIsSignUp(true);
  const switchToSignIn = () => setIsSignUp(false);

  return (
    <View style={styles.container}>
      <StatusBar
        backgroundColor={Colors.primary}
        barStyle="light-content"
        translucent={false}
      />
      
      {isSignUp ? (
        <SignUpScreen onSwitchToSignIn={switchToSignIn} />
      ) : (
        <SignInScreen onSwitchToSignUp={switchToSignUp} />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});

export default AuthScreen;