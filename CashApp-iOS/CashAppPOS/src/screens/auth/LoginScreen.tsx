import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Dimensions,
  Image,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import Logo from '../../components/Logo';
import SimpleTextInput from '../../components/inputs/SimpleTextInput';

const { width, height } = Dimensions.get('window');

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',      // Clover Green
  secondary: '#0066CC',    // Clover Blue  
  success: '#00A651',
  background: '#F5F5F5',   // Light Gray Background
  white: '#FFFFFF',
  lightGray: '#E5E5E5',
  text: '#333333',         // Dark Gray Text
  lightText: '#666666',    // Medium Gray Text
  accent: '#0066CC',       // Clover Blue Accent
};

const LoginScreen: React.FC = () => {
  const navigation = useNavigation();
  const { signIn, isLoading: authLoading } = useAuth();
  
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async (quickUsername?: string, quickPassword?: string) => {
    const loginUsername = quickUsername || username;
    const loginPassword = quickPassword || password;
    
    if (!loginUsername.trim() || !loginPassword.trim()) {
      Alert.alert('Error', 'Please enter both username and password');
      return;
    }

    setIsLoading(true);

    try {
      console.log('🚀 Attempting login with:', loginUsername);
      const success = await signIn(loginUsername.trim(), loginPassword);
      
      if (success) {
        console.log('✅ Login successful, navigation will happen automatically');
        // Navigation happens automatically via AppNavigator
      } else {
        Alert.alert('Login Failed', 'Invalid username or password');
      }
    } catch (error) {
      console.error('Login error:', error);
      Alert.alert('Error', 'An error occurred during login. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgotPassword = () => {
    navigation.navigate('ForgotPassword' as never);
  };

  const handleQuickSignIn = async (username: string, password: string) => {
    if (isLoading) return;
    
    console.log('🚀 Quick sign-in attempt:', username);
    setUsername(username);
    setPassword(password);
    
    // Use the same login logic as manual login
    await handleLogin(username, password);
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor={Colors.background} />
      
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={styles.content}>
          {/* Logo Section */}
          <View style={styles.logoSection}>
            <Logo size="large" showText={false} />
            <Text style={styles.logoTitle}>Professional Point of Sale System</Text>
          </View>

          {/* Login Form */}
          <View style={styles.formSection}>
            <Text style={styles.welcomeText}>Welcome Back</Text>
            <Text style={styles.subtitleText}>Sign in to continue</Text>

            {/* Username Input */}
            <View style={styles.inputContainer}>
              <Icon name="person" size={20} color={Colors.lightText} style={styles.inputIcon} />
              <SimpleTextInput
                value={username}
                onValueChange={setUsername}
                placeholder="Username"
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
                style={styles.textInput}
              />
            </View>

            {/* Password Input */}
            <View style={styles.inputContainer}>
              <Icon name="lock" size={20} color={Colors.lightText} style={styles.inputIcon} />
              <SimpleTextInput
                value={password}
                onValueChange={setPassword}
                placeholder="Password"
                secureTextEntry={true}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
                style={styles.textInput}
              />
            </View>

            {/* Forgot Password */}
            <TouchableOpacity
              style={styles.forgotPasswordButton}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Login Button */}
            <TouchableOpacity
              style={[styles.loginButton, isLoading && styles.loginButtonDisabled]}
              onPress={handleLogin}
              disabled={isLoading}
            >
              {(isLoading || authLoading) ? (
                <Text style={styles.loginButtonText}>Signing In...</Text>
              ) : (
                <>
                  <Text style={styles.loginButtonText}>Sign In</Text>
                  <Icon name="arrow-forward" size={20} color={Colors.white} />
                </>
              )}
            </TouchableOpacity>

            {/* Demo Credentials */}
            <View style={styles.demoSection}>
              <Text style={styles.demoTitle}>Demo Credentials:</Text>
              <Text style={styles.demoText}>Username: demo</Text>
              <Text style={styles.demoText}>Password: demo123</Text>
            </View>

            {/* Quick Sign-In Buttons (Development Only) */}
            <View style={styles.quickSignInSection}>
              <Text style={styles.quickSignInTitle}>Quick Sign-In (Testing)</Text>
              <View style={styles.quickButtonsGrid}>
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: '#00A651' }]}
                  onPress={() => handleQuickSignIn('restaurant_owner', 'owner123')}
                >
                  <Text style={styles.quickButtonTitle}>Restaurant Owner</Text>
                  <Text style={styles.quickButtonSubtitle}>Maria Rodriguez</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: '#0066CC' }]}
                  onPress={() => handleQuickSignIn('platform_owner', 'platform123')}
                >
                  <Text style={styles.quickButtonTitle}>Platform Owner</Text>
                  <Text style={styles.quickButtonSubtitle}>Alex Thompson</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: '#FF6B35' }]}
                  onPress={() => handleQuickSignIn('manager', 'manager123')}
                >
                  <Text style={styles.quickButtonTitle}>Manager</Text>
                  <Text style={styles.quickButtonSubtitle}>Sofia Hernandez</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  style={[styles.quickButton, { backgroundColor: '#8E44AD' }]}
                  onPress={() => handleQuickSignIn('cashier', 'cashier123')}
                >
                  <Text style={styles.quickButtonTitle}>Cashier</Text>
                  <Text style={styles.quickButtonSubtitle}>Carlos Garcia</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              Fynlo POS System • Secure Payment Processing
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 30,
    justifyContent: 'center',
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 50,
  },
  logoTitle: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    marginTop: 16,
  },
  formSection: {
    marginBottom: 40,
  },
  welcomeText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitleText: {
    fontSize: 16,
    color: Colors.lightText,
    textAlign: 'center',
    marginBottom: 40,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 20,
    paddingHorizontal: 16,
    paddingVertical: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  inputIcon: {
    marginRight: 12,
  },
  textInput: {
    flex: 1,
    fontSize: 16,
    color: Colors.text,
    paddingVertical: 16,
  },
  passwordToggle: {
    padding: 4,
  },
  forgotPasswordButton: {
    alignSelf: 'flex-end',
    marginBottom: 30,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: Colors.secondary,
    fontWeight: '600',
  },
  loginButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 18,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
  loginButtonDisabled: {
    opacity: 0.7,
  },
  loginButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.white,
    marginRight: 8,
  },
  demoSection: {
    backgroundColor: Colors.lightGray,
    borderRadius: 12,
    padding: 20,
    marginTop: 30,
    alignItems: 'center',
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  demoText: {
    fontSize: 14,
    color: Colors.lightText,
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },
  footer: {
    alignItems: 'center',
    paddingBottom: 20,
  },
  footerText: {
    fontSize: 14,
    color: Colors.lightText,
    textAlign: 'center',
  },
  quickSignInSection: {
    marginTop: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  quickSignInTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
    marginBottom: 16,
  },
  quickButtonsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
  },
  quickButton: {
    width: '48%',
    backgroundColor: Colors.primary,
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  quickButtonTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
    marginBottom: 2,
  },
  quickButtonSubtitle: {
    fontSize: 10,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
  },
});

export default LoginScreen;