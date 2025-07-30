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
import { useAuth } from '../../contexts/AuthContext';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import useAppStore from '../../store/useAppStore';

interface _MenuOption {
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
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);
  const { user } = useAppStore();
  const { signOut } = useAuth();

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
          color: theme.colors.secondary,
        },
        {
          id: 'customers',
          title: 'Customers',
          subtitle: 'Customer database and loyalty',
          icon: 'person-pin',
          route: 'Customers',
          color: theme.colors.warning,
        },
        {
          id: 'inventory',
          title: 'Inventory',
          subtitle: 'Stock levels and suppliers',
          icon: 'inventory',
          route: 'Inventory',
          color: theme.colors.success,
        },
        {
          id: 'dining-room',
          title: 'Dining Room',
          subtitle: 'Floor plan, _tables, and reservations',
          icon: 'table-restaurant',
          route: 'TableManagement',
          color: theme.colors.primary,
        },
      ],
    },
    {
      title: 'Reports & Analytics',
      options: [
        {
          id: 'reports',
          title: 'Reports',
          subtitle: 'Sales, _financial, and business reports',
          icon: 'bar-chart',
          route: 'Reports',
          color: theme.colors.secondary,
          badge: 3,
        },
        {
          id: 'dashboard',
          title: 'Dashboard',
          subtitle: 'Business overview and KPIs',
          icon: 'dashboard',
          route: 'Dashboard',
          color: theme.colors.primary,
        },
      ],
    },
    {
      title: 'Settings & Configuration',
      options: [
        {
          id: 'settings',
          title: 'Settings',
          subtitle: 'Business, _hardware, and app configuration',
          icon: 'settings',
          route: 'Settings',
          color: theme.colors.darkGray,
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
          color: theme.colors.darkGray,
        },
        {
          id: 'help',
          title: 'Help & Support',
          subtitle: 'Guides, _tutorials, and contact',
          icon: 'help',
          route: 'Help',
          color: theme.colors.darkGray,
        },
        {
          id: 'logout',
          title: 'Sign Out',
          subtitle: 'End current session',
          icon: 'logout',
          color: theme.colors.danger,
        },
      ],
    },
  ];

  const handleOptionPress = async (option: _MenuOption) => {
    if (option.id === 'logout') {
      // Handle logout using AuthContext
      try {
        await signOut();
      } catch (__error) {
        // Error handled silently
      }
    } else if (option.route) {
      // Navigate to the route
      navigation.navigate(option.route as never);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar backgroundColor={theme.colors.primary} barStyle="light-content" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>More</Text>
          <Text style={styles.headerSubtitle}>{user?.name || 'Restaurant Manager'}</Text>
        </View>
      </View>

      {/* Deprecation Notice */}
      <View style={styles.deprecationNotice}>
        <Icon name="info" size={20} color={theme.colors.warning[500]} />
        <View style={styles.deprecationContent}>
          <Text style={styles.deprecationTitle}>New Hub Available!</Text>
          <Text style={styles.deprecationText}>
            This page will be replaced soon. Find all features in the new Hub on the home tab.
          </Text>
        </View>
        <TouchableOpacity
          style={styles.goToHubButton}
          onPress={() => navigation.navigate('Home' as never)}>
          <Text style={styles.goToHubText}>Go to Hub</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* User Info Card */}
        <View style={styles.userCard}>
          <View style={styles.userAvatar}>
            <Icon name="account-circle" size={60} color={theme.colors.primary} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{user?.name || 'Manager'}</Text>
            <Text style={styles.userRole}>{user?.role || 'Admin'}</Text>
            <Text style={styles.userEmail}>{user?.email || 'manager@cloverpos.com'}</Text>
          </View>
        </View>

        {/* Menu Sections */}
        {menuSections.map((__section, _sectionIndex) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.optionsContainer}>
              {section.options.map((__option, _index) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionCard,
                    index === section.options.length - 1 && styles.lastOptionCard,
                  ]}
                  onPress={() => handleOptionPress(__option)}
                  activeOpacity={0.7}>
                  <View style={[styles.optionIcon, { backgroundColor: `${option.color}15` }]}>
                    <Icon
                      name={option.icon}
                      size={24}
                      color={option.color || theme.colors.primary}
                    />
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
                    <Icon name="chevron-right" size={24} color={theme.colors.lightGray} />
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

const __createStyles = (theme: _unknown) =>
  StyleSheet.create({
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2
    },
      shadowOpacity: 0.05,
      shadowRadius: 4,
      elevation: 2,
    }
  });

export default MoreScreen;
