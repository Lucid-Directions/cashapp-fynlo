import React, { useMemo, useCallback, useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import useAppStore from '../../store/useAppStore';
import { usePerformanceMonitor, performanceUtils } from '../../hooks/usePerformanceMonitor';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',      // Clover Green
  secondary: '#0066CC',    // Clover Blue
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

interface MenuOption {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route?: string;
  color?: string;
  badge?: number;
}

interface MenuSection {
  title: string;
  options: MenuOption[];
}

// Error Boundary Component
class ErrorBoundary extends React.Component<
  { children: React.ReactNode; fallback?: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('MoreScreen Error Boundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <View style={styles.errorContainer}>
          <Icon name="error-outline" size={48} color={Colors.danger} />
          <Text style={styles.errorTitle}>Something went wrong</Text>
          <Text style={styles.errorText}>Please restart the app</Text>
        </View>
      );
    }

    return this.props.children;
  }
}

// Memoized Option Card Component
const OptionCard = React.memo<{
  option: MenuOption;
  onPress: (option: MenuOption) => void;
  isLast: boolean;
}>(({ option, onPress, isLast }) => {
  const handlePress = useCallback(() => {
    onPress(option);
  }, [option, onPress]);

  return (
    <TouchableOpacity
      style={[styles.optionCard, isLast && styles.lastOptionCard]}
      onPress={handlePress}
      activeOpacity={0.7}
    >
      <View style={[styles.optionIcon, { backgroundColor: `${option.color}15` }]}>
        <Icon name={option.icon} size={24} color={option.color || Colors.primary} />
      </View>
      
      <View style={styles.optionContent}>
        <Text style={styles.optionTitle}>{option.title}</Text>
        <Text style={styles.optionSubtitle}>{option.subtitle}</Text>
      </View>
      
      <View style={styles.optionRight}>
        {option.badge && (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{option.badge}</Text>
          </View>
        )}
        <Icon name="chevron-right" size={24} color={Colors.lightGray} />
      </View>
    </TouchableOpacity>
  );
});

const MoreScreenOptimized: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAppStore();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState(false);
  
  // Performance monitoring
  const metrics = usePerformanceMonitor({
    componentName: 'MoreScreenOptimized',
    enableMemoryTracking: true,
    logToConsole: __DEV__,
  });

  // Memoized menu sections to prevent unnecessary re-renders
  const menuSections = useMemo<MenuSection[]>(() => [
    {
      title: 'Business Management',
      options: [
        {
          id: 'employees',
          title: 'Employees',
          subtitle: 'Manage staff and time clock',
          icon: 'people',
          route: 'Employees',
          color: Colors.secondary,
        },
        {
          id: 'customers',
          title: 'Customers',
          subtitle: 'Customer database and loyalty',
          icon: 'person-pin',
          route: 'Customers',
          color: Colors.warning,
        },
        {
          id: 'inventory',
          title: 'Inventory',
          subtitle: 'Stock levels and suppliers',
          icon: 'inventory',
          route: 'Inventory',
          color: Colors.success,
        },
        {
          id: 'menu',
          title: 'Menu Management',
          subtitle: 'Items, categories, and modifiers',
          icon: 'restaurant-menu',
          route: 'MenuManagement',
          color: Colors.primary,
        },
      ],
    },
    {
      title: 'Reports & Analytics',
      options: [
        {
          id: 'reports',
          title: 'Reports',
          subtitle: 'Sales, financial, and business reports',
          icon: 'bar-chart',
          route: 'Reports',
          color: Colors.secondary,
          badge: 3,
        },
        {
          id: 'dashboard',
          title: 'Dashboard',
          subtitle: 'Business overview and KPIs',
          icon: 'dashboard',
          route: 'Dashboard',
          color: Colors.primary,
        },
      ],
    },
    {
      title: 'Settings & Configuration',
      options: [
        {
          id: 'settings',
          title: 'Settings',
          subtitle: 'Business, hardware, and app configuration',
          icon: 'settings',
          route: 'Settings',
          color: Colors.darkGray,
        },
      ],
    },
    {
      title: 'Account',
      options: [
        {
          id: 'profile',
          title: 'My Profile',
          subtitle: 'Personal information and password',
          icon: 'account-circle',
          route: 'Profile',
          color: Colors.darkGray,
        },
        {
          id: 'help',
          title: 'Help & Support',
          subtitle: 'Guides, tutorials, and contact',
          icon: 'help',
          route: 'Help',
          color: Colors.darkGray,
        },
        {
          id: 'logout',
          title: 'Sign Out',
          subtitle: 'End current session',
          icon: 'logout',
          color: Colors.danger,
        },
      ],
    },
  ], []);

  // Optimized option press handler with error boundary
  const handleOptionPress = useCallback(async (option: MenuOption) => {
    if (loading) return; // Prevent multiple simultaneous actions

    try {
      setLoading(true);

      if (option.id === 'logout') {
        // Show confirmation dialog for logout
        Alert.alert(
          'Sign Out',
          'Are you sure you want to sign out?',
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Sign Out',
              style: 'destructive',
              onPress: async () => {
                try {
                  await signOut();
                } catch (error) {
                  console.error('Logout error:', error);
                  Alert.alert('Error', 'Failed to sign out. Please try again.');
                }
              },
            },
          ]
        );
      } else if (option.route) {
        // Validate navigation state before navigating
        if (navigation.canGoBack() || navigation.getState().index === 0) {
          navigation.navigate(option.route as never);
        } else {
          console.warn('Navigation state is invalid');
          Alert.alert('Error', 'Unable to navigate. Please try again.');
        }
      } else {
        console.warn(`No route defined for option: ${option.id}`);
        Alert.alert('Coming Soon', `${option.title} feature is coming soon!`);
      }
    } catch (error) {
      console.error('Error handling option press:', error);
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [navigation, signOut, loading]);

  // Memoized user info to prevent unnecessary re-renders
  const userInfo = useMemo(() => ({
    name: user?.name || 'Manager',
    role: user?.role || 'Admin',
    email: user?.email || 'manager@fynlopos.com',
  }), [user]);

  return (
    <ErrorBoundary>
      <SafeAreaView style={styles.container}>
        <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
        
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Text style={styles.headerTitle}>More</Text>
            <Text style={styles.headerSubtitle}>
              {userInfo.name}
            </Text>
          </View>
        </View>

        <ScrollView 
          style={styles.content} 
          showsVerticalScrollIndicator={false}
          removeClippedSubviews={true} // Performance optimization
          keyboardShouldPersistTaps="handled"
        >
          {/* User Info Card */}
          <View style={styles.userCard}>
            <View style={styles.userAvatar}>
              <Icon name="account-circle" size={60} color={Colors.primary} />
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.userName}>{userInfo.name}</Text>
              <Text style={styles.userRole}>{userInfo.role}</Text>
              <Text style={styles.userEmail}>{userInfo.email}</Text>
            </View>
          </View>

          {/* Menu Sections */}
          {menuSections.map((section) => (
            <View key={section.title} style={styles.section}>
              <Text style={styles.sectionTitle}>{section.title}</Text>
              
              <View style={styles.optionsContainer}>
                {section.options.map((option, index) => (
                  <OptionCard
                    key={option.id}
                    option={option}
                    onPress={handleOptionPress}
                    isLast={index === section.options.length - 1}
                  />
                ))}
              </View>
            </View>
          ))}

          {/* App Version */}
          <View style={styles.footer}>
            <Text style={styles.versionText}>Fynlo POS v1.0.0</Text>
            <Text style={styles.copyrightText}>© 2024 Fynlo Ltd.</Text>
            {__DEV__ && (
              <Text style={styles.performanceText}>
                Render: {metrics.renderTime}ms | Ready: {metrics.isReady ? 'Yes' : 'No'}
              </Text>
            )}
          </View>
        </ScrollView>

        {/* Loading Overlay */}
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        )}
      </SafeAreaView>
    </ErrorBoundary>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  content: {
    flex: 1,
  },
  userCard: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    marginTop: 16,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  userAvatar: {
    marginRight: 16,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
  },
  userRole: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 2,
  },
  userEmail: {
    fontSize: 12,
    color: Colors.darkGray,
    marginTop: 4,
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  optionsContainer: {
    backgroundColor: Colors.white,
    marginHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  optionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  lastOptionCard: {
    borderBottomWidth: 0,
  },
  optionIcon: {
    width: 48,
    height: 48,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  optionContent: {
    flex: 1,
  },
  optionTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
  },
  optionSubtitle: {
    fontSize: 13,
    color: Colors.darkGray,
    marginTop: 2,
  },
  optionRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  badge: {
    backgroundColor: Colors.danger,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    marginRight: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
  },
  versionText: {
    fontSize: 14,
    color: Colors.darkGray,
  },
  copyrightText: {
    fontSize: 12,
    color: Colors.lightText,
    marginTop: 4,
  },
  performanceText: {
    fontSize: 10,
    color: Colors.lightText,
    marginTop: 4,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  errorTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.danger,
    marginTop: 16,
  },
  errorText: {
    fontSize: 14,
    color: Colors.darkGray,
    marginTop: 8,
    textAlign: 'center',
  },
});

export default MoreScreenOptimized;