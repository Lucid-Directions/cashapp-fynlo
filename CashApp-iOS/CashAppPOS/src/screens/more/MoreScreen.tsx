import React from 'react';

/* eslint-disable react-native/no-unused-styles */
// This file uses useThemedStyles pattern which ESLint cannot statically analyze

import {
  StyleSheet,
  Text,
  View,
  StatusBar,
  SafeAreaView,
  TouchableOpacity,
  ScrollView,
} from 'react-native';

import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useAuth } from '../../contexts/AuthContext';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';
import useAppStore from '../../store/useAppStore';

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
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
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
          subtitle: 'Floor plan, tables, and reservations',
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
          subtitle: 'Sales, financial, and business reports',
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
          subtitle: 'Business, hardware, and app configuration',
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
          subtitle: 'Guides, tutorials, and contact',
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

  const handleOptionPress = async (option: MenuOption) => {
    if (option.id === 'logout') {
      // Handle logout using AuthContext
      try {
        await signOut();
      } catch (error) {
        logger.error('Error signing out:', error);
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
          onPress={() => navigation.navigate('Home' as never)}
        >
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
        {menuSections.map((section, _sectionIndex) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>

            <View style={styles.optionsContainer}>
              {section.options.map((option, index) => (
                <TouchableOpacity
                  key={option.id}
                  style={[
                    styles.optionCard,
                    index === section.options.length - 1 && styles.lastOptionCard,
                  ]}
                  onPress={() => handleOptionPress(option)}
                  activeOpacity={0.7}
                >
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

const createStyles = (theme: unknown) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    header: {
      backgroundColor: theme.colors.primary,
      paddingHorizontal: 20,
      paddingVertical: 16,
    },
    headerContent: {
      alignItems: 'center',
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
    content: {
      flex: 1,
    },
    deprecationNotice: {
      backgroundColor: theme.colors.warning[50],
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      marginHorizontal: 16,
      marginTop: 16,
      borderRadius: 12,
      borderWidth: 1,
      borderColor: theme.colors.warning[200],
    },
    deprecationContent: {
      flex: 1,
      marginLeft: 12,
    },
    deprecationTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.warning[700],
      marginBottom: 2,
    },
    deprecationText: {
      fontSize: 12,
      color: theme.colors.warning[600],
      lineHeight: 16,
    },
    goToHubButton: {
      backgroundColor: theme.colors.warning[500],
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      marginLeft: 8,
    },
    goToHubText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.white,
    },
    userCard: {
      backgroundColor: theme.colors.white,
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
      color: theme.colors.text,
    },
    userRole: {
      fontSize: 14,
      color: theme.colors.primary,
      marginTop: 2,
    },
    userEmail: {
      fontSize: 12,
      color: theme.colors.darkGray,
      marginTop: 4,
    },
    section: {
      marginTop: 24,
    },
    sectionTitle: {
      fontSize: 14,
      fontWeight: '600',
      color: theme.colors.darkGray,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 12,
      marginHorizontal: 20,
    },
    optionsContainer: {
      backgroundColor: theme.colors.white,
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
      borderBottomColor: theme.colors.border,
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
      color: theme.colors.text,
    },
    optionSubtitle: {
      fontSize: 13,
      color: theme.colors.darkGray,
      marginTop: 2,
    },
    optionRight: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    badge: {
      backgroundColor: theme.colors.danger,
      borderRadius: 12,
      paddingHorizontal: 8,
      paddingVertical: 2,
      marginRight: 8,
    },
    badgeText: {
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.white,
    },
    footer: {
      alignItems: 'center',
      paddingVertical: 32,
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

export default MoreScreen;
