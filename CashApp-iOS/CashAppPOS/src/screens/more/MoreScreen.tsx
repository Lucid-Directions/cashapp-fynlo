import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import useAppStore from '../../store/useAppStore';

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

const MoreScreen: React.FC = () => {
  const navigation = useNavigation();
  const { user } = useAppStore();

  const menuSections = [
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
  ];

  const handleOptionPress = (option: MenuOption) => {
    if (option.id === 'logout') {
      // Handle logout
      const logout = useAppStore.getState().logout;
      logout();
    } else if (option.route) {
      // Navigate to the route
      navigation.navigate(option.route as never);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={Colors.primary} barStyle="light-content" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSubtitle}>
            {user?.name || 'Restaurant Manager'}
          </Text>
        </View>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Icon name="account-circle" size={60} color={Colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Manager'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Admin'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'manager@cloverpos.com'}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((section, sectionIndex) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            <View style={styles.optionsContainer}>
              {section.options.map((option, index) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionCard,
                    index === section.options.length - 1 && styles.lastOptionCard
                  ]}
                  onPress={() => handleOptionPress(option)}
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
              ))}
            </View>
          </View>
        ))}

        {/* App Version */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>Fynlo POS v1.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 Fynlo Ltd.</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
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
});

export default MoreScreen;