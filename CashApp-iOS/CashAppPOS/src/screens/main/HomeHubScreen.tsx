import React, { useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  Animated,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import useAppStore from '../../store/useAppStore';
import { SubscriptionStatusBadge } from '../../components/subscription/SubscriptionStatusBadge';
import { useWebSocket } from '../../hooks/useWebSocket';

const { width: screenWidth } = Dimensions.get('window');
const isTablet = screenWidth > 768;

interface HubIcon {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  route?: string;
  color: string;
  category: 'core' | 'business' | 'analytics' | 'account';
  requiredRoles: string[];
  badge?: number;
}

const HomeHubScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const { user, signOut } = useAuth();
  const { cartItemCount } = useAppStore();
  const { connected: wsConnected } = useWebSocket({ autoConnect: true });

  // Hub icons configuration with role-based visibility
  const hubIcons: HubIcon[] = [
    // Core Operations
    {
      id: 'pos',
      title: 'POS',
      subtitle: 'Point of Sale',
      icon: 'point-of-sale',
      route: 'POS',
      color: theme.colors.primary,
      category: 'core',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager', 'employee'],
    },
    {
      id: 'orders',
      title: 'Orders',
      subtitle: 'Order management',
      icon: 'receipt',
      route: 'Orders',
      color: theme.colors.secondary,
      category: 'core',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager', 'employee'],
    },
    // Business Management
    {
      id: 'employees',
      title: 'Employees',
      subtitle: 'Staff management',
      icon: 'people',
      route: 'Employees',
      color: theme.colors.info[500],
      category: 'business',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager'],
    },
    {
      id: 'customers',
      title: 'Customers',
      subtitle: 'Customer database',
      icon: 'person-pin',
      route: 'Customers',
      color: theme.colors.warning[500],
      category: 'business',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager', 'employee'],
    },
    {
      id: 'inventory',
      title: 'Inventory',
      subtitle: 'Stock management',
      icon: 'inventory',
      route: 'Inventory',
      color: theme.colors.success[500],
      category: 'business',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager'],
    },
    {
      id: 'menu',
      title: 'Menu',
      subtitle: 'Menu management',
      icon: 'restaurant-menu',
      route: 'MenuManagement',
      color: theme.colors.primary,
      category: 'business',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager'],
    },
    // Analytics & Reports
    {
      id: 'reports',
      title: 'Reports',
      subtitle: 'Business reports',
      icon: 'bar-chart',
      route: 'Reports',
      color: theme.colors.secondary,
      category: 'analytics',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager'],
      badge: 3,
    },
    {
      id: 'dashboard',
      title: 'Dashboard',
      subtitle: 'Business overview',
      icon: 'dashboard',
      route: 'Dashboard',
      color: theme.colors.primary,
      category: 'analytics',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager'],
    },
    // Account & Settings
    {
      id: 'settings',
      title: 'Settings',
      subtitle: 'App configuration',
      icon: 'settings',
      route: 'Settings',
      color: theme.colors.darkGray,
      category: 'account',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager', 'employee'],
    },
    {
      id: 'profile',
      title: 'Profile',
      subtitle: 'Personal settings',
      icon: 'account-circle',
      route: 'Profile',
      color: theme.colors.darkGray,
      category: 'account',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager', 'employee'],
    },
    {
      id: 'help',
      title: 'Help',
      subtitle: 'Support & guides',
      icon: 'help',
      route: 'Help',
      color: theme.colors.darkGray,
      category: 'account',
      requiredRoles: ['platform_owner', 'restaurant_owner', 'manager', 'employee'],
    },
  ];

  // Filter icons based on user role
  const getVisibleIcons = () => {
    if (!user?.role) return [];
    return hubIcons.filter(icon => icon.requiredRoles.includes(user.role));
  };

  const visibleIcons = getVisibleIcons();

  // Calculate grid dimensions - FIXED: Ensure proper 2-column layout
  const numColumns = isTablet ? 4 : 2;
  const iconSize = isTablet ? 48 : 64;
  const horizontalSpacing = 16;
  const cardMargin = 8; // Proper margin for 2-column layout
  // Fixed width calculation for exact 2-column layout
  const cardWidth = (screenWidth - (horizontalSpacing * 2) - (cardMargin * 4)) / numColumns;

  const handleIconPress = (icon: HubIcon) => {
    // Analytics tracking for icon tap
    console.log('📊 Analytics: HomeHubIconTapped', {
      iconId: icon.id,
      iconTitle: icon.title,
      iconCategory: icon.category,
      userId: user?.id,
      userRole: user?.role,
      timestamp: new Date().toISOString(),
    });
    
    if (icon.route) {
      navigation.navigate(icon.route as never);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  // Track analytics for hub view
  useEffect(() => {
    // Analytics tracking for HomeHubViewed event
    console.log('📊 Analytics: HomeHubViewed', {
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      visibleIconsCount: visibleIcons.length,
      timestamp: new Date().toISOString(),
    });
    // TODO: Integrate with actual analytics service (Firebase, Mixpanel, etc.)
  }, [user, visibleIcons.length]);

  const IconCard: React.FC<{ icon: HubIcon }> = ({ icon }) => {
    const scaleValue = new Animated.Value(1);

    const handlePressIn = () => {
      Animated.spring(scaleValue, {
        toValue: 0.95,
        useNativeDriver: true,
      }).start();
    };

    const handlePressOut = () => {
      Animated.spring(scaleValue, {
        toValue: 1,
        friction: 3,
        useNativeDriver: true,
      }).start();
    };

    return (
      <Animated.View style={[{ transform: [{ scale: scaleValue }] }]}>
        <TouchableOpacity
          style={[styles.iconCard, { width: cardWidth }]}
          onPress={() => handleIconPress(icon)}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          activeOpacity={1}
          accessibilityRole="button"
          accessibilityLabel={`${icon.title}, ${icon.subtitle}`}
        >
          <View style={[styles.iconContainer, { backgroundColor: `${icon.color}15` }]}>
            <Icon name={icon.icon} size={iconSize} color={icon.color} />
            {icon.badge && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{icon.badge}</Text>
              </View>
            )}
          </View>
          <Text style={styles.iconTitle}>{icon.title}</Text>
          <Text style={styles.iconSubtitle}>{icon.subtitle}</Text>
        </TouchableOpacity>
      </Animated.View>
    );
  };

  const CategorySection: React.FC<{ category: string; icons: HubIcon[] }> = ({ category, icons }) => {
    const categoryTitles = {
      core: 'Core Operations',
      business: 'Business Management',
      analytics: 'Reports & Analytics',
      account: 'Account & Settings',
    };

    if (icons.length === 0) return null;

    return (
      <View style={styles.categorySection}>
        <Text style={styles.categoryTitle}>{categoryTitles[category as keyof typeof categoryTitles]}</Text>
        <View style={styles.iconGrid}>
          {icons.map(icon => (
            <IconCard key={icon.id} icon={icon} />
          ))}
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Welcome</Text>
          <Text style={styles.headerSubtitle}>
            {user?.firstName || 'User'} • {user?.role?.replace('_', ' ') || 'Staff'}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <SubscriptionStatusBadge />
          {wsConnected && (
            <View style={styles.connectionDot} />
          )}
          <TouchableOpacity
            style={styles.signOutButton}
            onPress={handleSignOut}
            accessibilityRole="button"
            accessibilityLabel="Sign out"
          >
            <Icon name="logout" size={24} color={theme.colors.white} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Quick Stats */}
        <View style={styles.quickStats}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{cartItemCount()}</Text>
            <Text style={styles.statLabel}>Cart Items</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{visibleIcons.length}</Text>
            <Text style={styles.statLabel}>Available Features</Text>
          </View>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{user?.role === 'manager' ? 'Manager' : 'Staff'}</Text>
            <Text style={styles.statLabel}>Access Level</Text>
          </View>
        </View>

        {/* Icon Categories */}
        <CategorySection 
          category="core" 
          icons={visibleIcons.filter(icon => icon.category === 'core')} 
        />
        <CategorySection 
          category="business" 
          icons={visibleIcons.filter(icon => icon.category === 'business')} 
        />
        <CategorySection 
          category="analytics" 
          icons={visibleIcons.filter(icon => icon.category === 'analytics')} 
        />
        <CategorySection 
          category="account" 
          icons={visibleIcons.filter(icon => icon.category === 'account')} 
        />

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Fynlo POS v1.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 Fynlo Ltd.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const createStyles = (theme: any) => StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: theme.colors.background,
  },
  header: {
    backgroundColor: theme.colors.primary,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: theme.colors.white,
  },
  headerSubtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 4,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  connectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#4CAF50',
    marginLeft: -4,
  },
  signOutButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    marginLeft: 8,
  },
  content: {
    flex: 1,
  },
  quickStats: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: theme.colors.white,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  statItem: {
    alignItems: 'center',
  },
  statValue: {
    fontSize: 20,
    fontWeight: 'bold',
    color: theme.colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: theme.colors.darkGray,
    marginTop: 4,
  },
  categorySection: {
    marginTop: 24,
  },
  categoryTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: theme.colors.darkGray,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 12,
    marginHorizontal: 20,
  },
  iconGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    justifyContent: 'flex-start',
  },
  iconCard: {
    backgroundColor: theme.colors.white,
    borderRadius: 12,
    padding: 16,
    marginHorizontal: 8,
    marginBottom: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 120,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    borderWidth: 1,
    borderColor: theme.colors.border,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: theme.colors.danger[500],
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.white,
  },
  iconTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: theme.colors.text,
    textAlign: 'center',
    marginBottom: 4,
  },
  iconSubtitle: {
    fontSize: 12,
    color: theme.colors.darkGray,
    textAlign: 'center',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    marginTop: 24,
  },
  versionText: {
    fontSize: 14,
    color: theme.colors.darkGray,
  },
  copyrightText: {
    fontSize: 12,
    color: theme.colors.lightText,
    marginTop: 4,
  },
});

export default HomeHubScreen;