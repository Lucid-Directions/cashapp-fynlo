import React from 'react';
import {
  StyleSheet,
  Text,
  View,
  SafeAreaView,
  StatusBar,
  ScrollView,
  TouchableOpacity,
  Linking,
  Alert,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { useRestaurantConfig, useOnboardingStatus } from '../../hooks/useRestaurantConfig';

const Colors = {
  primary: '#00A651', // Clover Green
  secondary: '#0066CC', // Clover Blue
  success: '#27AE60',
  warning: '#F39C12',
  danger: '#E74C3C',
  background: '#F8F9FA',
  white: '#FFFFFF',
  lightGray: '#ECF0F1',
  darkGray: '#2C3E50',
  text: '#2C3E50',
  lightText: '#95A5A6',
  border: '#BDC3C7',
};

interface HelpSection {
  id: string;
  title: string;
  description: string;
  icon: string;
  color: string;
  items: HelpItem[];
}

interface HelpItem {
  id: string;
  question: string;
  answer: string;
}

interface ContactMethod {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  color: string;
  action: () => void;
}

const HelpScreen: React.FC = () => {
  const navigation = useNavigation();
  const { config } = useRestaurantConfig();
  const onboardingStatus = useOnboardingStatus();

  const helpSections: HelpSection[] = [
    {
      id: 'restaurant-setup',
      title: 'Restaurant Setup',
      description: 'Configure your restaurant details and branding',
      icon: 'store',
      color: Colors.primary,
      items: [
        {
          id: '1',
          question: 'How do I set up my restaurant information?',
          answer:
            'Go to Settings → Business Settings → Business Information to enter your restaurant name, address, and contact details. This information will appear throughout your POS system.',
        },
        {
          id: '2',
          question: 'How do I customize my restaurant name in headers?',
          answer:
            'Your restaurant name is automatically displayed in headers once you save it in Business Information. The name will replace "Fynlo POS" while maintaining "Powered by Fynlo" branding.',
        },
        {
          id: '3',
          question: 'Can I restart the setup process?',
          answer:
            'Yes! Use the "Restaurant Setup" button below to go through the guided setup process again or complete any missing steps.',
        },
      ],
    },
    {
      id: 'getting-started',
      title: 'Getting Started',
      description: 'Basic setup and first steps',
      icon: 'play-circle-outline',
      color: Colors.secondary,
      items: [
        {
          id: '1',
          question: 'How do I process my first order?',
          answer:
            'Navigate to the POS screen, select items from the menu, add them to cart, and tap "Process Payment" to complete the transaction.',
        },
        {
          id: '2',
          question: 'How do I add new menu items?',
          answer:
            'Go to More → Menu Management to add, edit, or remove items from your menu. You can organize items by categories and set pricing.',
        },
        {
          id: '3',
          question: 'How do I view sales reports?',
          answer:
            'Access reports through More → Reports or Dashboard. View daily, weekly, and monthly sales data, top-selling items, and performance metrics.',
        },
      ],
    },
    {
      id: 'payments',
      title: 'Payment Processing',
      description: 'Payment methods and troubleshooting',
      icon: 'payment',
      color: Colors.secondary,
      items: [
        {
          id: '1',
          question: 'What payment methods are supported?',
          answer:
            'Fynlo supports cash, card payments, Apple Pay, and QR code payments. No additional hardware required for most payment types.',
        },
        {
          id: '2',
          question: 'How do I process a refund?',
          answer:
            'Find the original transaction in Orders or Reports, select it, and choose "Process Refund". Partial refunds are also supported.',
        },
        {
          id: '3',
          question: 'Can customers pay with QR codes?',
          answer:
            'Yes! Generate a QR code for any order that customers can scan with their banking app or digital wallet to pay instantly.',
        },
      ],
    },
    {
      id: 'staff',
      title: 'Staff Management',
      description: 'Employee accounts and permissions',
      icon: 'people',
      color: Colors.warning,
      items: [
        {
          id: '1',
          question: 'How do I add new staff members?',
          answer:
            'Go to More → Employees → Add Employee. Set their role, permissions, and PIN for quick login during shifts.',
        },
        {
          id: '2',
          question: 'What are the different user roles?',
          answer:
            'Owner (full access), Manager (_reports, staff, settings), Employee (_POS, basic functions). Each role has specific permissions.',
        },
        {
          id: '3',
          question: 'How does time tracking work?',
          answer:
            'Staff can clock in/out using their PIN. View hours worked, calculate wages, and export timesheet data in the Employees section.',
        },
      ],
    },
    {
      id: 'troubleshooting',
      title: 'Troubleshooting',
      description: 'Common issues and solutions',
      icon: 'build',
      color: Colors.danger,
      items: [
        {
          id: '1',
          question: 'App is running slowly or crashing',
          answer:
            'Try closing and reopening the app. If issues persist, restart your device or contact support for assistance.',
        },
        {
          id: '2',
          question: 'Cannot sign out of my account',
          answer:
            "Use the Sign Out option in More → Sign Out. If this doesn't work, force close the app and reopen it.",
        },
        {
          id: '3',
          question: 'Some features show "Coming Soon"',
          answer:
            'Fynlo is actively being developed. Features with mock data will be fully functional once connected to the backend system.',
        },
      ],
    },
  ];

  const contactMethods: ContactMethod[] = [
    {
      id: 'email',
      title: 'Email Support',
      subtitle: 'support@fynlopos.com',
      icon: 'email',
      color: Colors.secondary,
      action: () => Linking.openURL('mailto:support@fynlopos.com'),
    },
    {
      id: 'phone',
      title: 'Phone Support',
      subtitle: '+44 20 1234 5678',
      icon: 'phone',
      color: Colors.success,
      action: () => Linking.openURL('tel:+442012345678'),
    },
    {
      id: 'chat',
      title: 'Live Chat',
      subtitle: 'Available 9AM - 6PM GMT',
      icon: 'chat',
      color: Colors.primary,
      action: () => Alert.alert('Live Chat', 'Live chat will be available in a future update.'),
    },
    {
      id: 'docs',
      title: 'Documentation',
      subtitle: 'User guides and tutorials',
      icon: 'library-books',
      color: Colors.warning,
      action: () =>
        Alert.alert('Documentation', 'Comprehensive documentation will be available soon.'),
    },
  ];

  const [expandedSections, setExpandedSections] = React.useState<string[]>([]);

  const toggleSection = (sectionId: string) => {
    setExpandedSections(prev =>
      prev.includes(_sectionId) ? prev.filter(id => id !== sectionId) : [...prev, sectionId],
    );
  };

  const toggleItem = (sectionId: string, itemId: string) => {
    const key = `${sectionId}-${itemId}`;
    setExpandedSections(prev =>
      prev.includes(_key) ? prev.filter(id => id !== key) : [...prev, key],
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor={Colors.primary} />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={Colors.white} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Restaurant Setup Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Restaurant Setup</Text>
          <View style={styles.setupCard}>
            <View style={styles.setupInfo}>
              <View style={styles.setupHeader}>
                <Icon name="store" size={24} color={Colors.primary} />
                <Text style={styles.setupTitle}>
                  {config?.restaurantName || 'Complete Your Restaurant Setup'}
                </Text>
              </View>
              <Text style={styles.setupDescription}>
                {onboardingStatus.completed
                  ? 'Your restaurant is set up and ready to go! You can update your information anytime.'
                  : `Complete your restaurant setup to customize your POS system. ${onboardingStatus.progress}% complete.`}
              </Text>
              {!onboardingStatus.completed && (
                <View style={styles.setupProgress}>
                  <View style={styles.progressBar}>
                    <View
                      style={[styles.progressFill, { width: `${onboardingStatus.progress}%` }]}
                    />
                  </View>
                  <Text style={styles.progressText}>{onboardingStatus.progress}% Complete</Text>
                </View>
              )}
            </View>
            <TouchableOpacity
              style={[
                styles.setupButton,
                onboardingStatus.completed && styles.setupButtonSecondary,
              ]}
              onPress={() => {
                // Navigate to Settings first, then to RestaurantSetup
                navigation.navigate(
                  'Settings' as never,
                  {
                    screen: 'RestaurantSetup',
                  } as never,
                );
              }}
              activeOpacity={0.7}>
              <Icon
                name={onboardingStatus.completed ? 'edit' : 'arrow-forward'}
                size={20}
                color={Colors.white}
              />
              <Text style={styles.setupButtonText}>
                {onboardingStatus.completed ? 'Edit Setup' : 'Continue Setup'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Contact */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Get Help</Text>
          <View style={styles.contactGrid}>
            {contactMethods.map(method => (
              <TouchableOpacity
                key={method.id}
                style={styles.contactCard}
                onPress={method.action}
                activeOpacity={0.7}>
                <View style={[styles.contactIcon, { backgroundColor: method.color }]}>
                  <Icon name={method.icon} size={24} color={Colors.white} />
                </View>
                <Text style={styles.contactTitle}>{method.title}</Text>
                <Text style={styles.contactSubtitle}>{method.subtitle}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQ Sections */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Frequently Asked Questions</Text>
          {helpSections.map(section => (
            <View key={section.id} style={styles.faqSection}>
              <TouchableOpacity
                style={styles.faqSectionHeader}
                onPress={() => toggleSection(section.id)}
                activeOpacity={0.7}>
                <View style={[styles.faqSectionIcon, { backgroundColor: section.color }]}>
                  <Icon name={section.icon} size={20} color={Colors.white} />
                </View>
                <View style={styles.faqSectionInfo}>
                  <Text style={styles.faqSectionTitle}>{section.title}</Text>
                  <Text style={styles.faqSectionDescription}>{section.description}</Text>
                </View>
                <Icon
                  name={expandedSections.includes(section.id) ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={Colors.lightText}
                />
              </TouchableOpacity>

              {expandedSections.includes(section.id) && (
                <View style={styles.faqItems}>
                  {section.items.map(item => (
                    <View key={item.id} style={styles.faqItem}>
                      <TouchableOpacity
                        style={styles.faqQuestion}
                        onPress={() => toggleItem(section.id, item.id)}
                        activeOpacity={0.7}>
                        <Text style={styles.faqQuestionText}>{item.question}</Text>
                        <Icon
                          name={
                            expandedSections.includes(`${section.id}-${item.id}`)
                              ? 'expand-less'
                              : 'expand-more'
                          }
                          size={20}
                          color={Colors.lightText}
                        />
                      </TouchableOpacity>

                      {expandedSections.includes(`${section.id}-${item.id}`) && (
                        <View style={styles.faqAnswer}>
                          <Text style={styles.faqAnswerText}>{item.answer}</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          ))}
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.appInfoCard}>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Version</Text>
              <Text style={styles.appInfoValue}>1.0.0 (Build 1)</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Developer</Text>
              <Text style={styles.appInfoValue}>Fynlo Ltd.</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Last Updated</Text>
              <Text style={styles.appInfoValue}>January 2025</Text>
            </View>
            <View style={styles.appInfoRow}>
              <Text style={styles.appInfoLabel}>Platform</Text>
              <Text style={styles.appInfoValue}>iOS (React Native)</Text>
            </View>
          </View>
        </View>

        {/* Backend Notice */}
        <View style={styles.section}>
          <View style={styles.backendNotice}>
            <Icon name="info" size={24} color={Colors.secondary} />
            <View style={styles.backendNoticeContent}>
              <Text style={styles.backendNoticeTitle}>Development Status</Text>
              <Text style={styles.backendNoticeText}>
                This app is currently in development mode with mock data. Some features may show
                placeholder content until the backend system is fully integrated.
              </Text>
            </View>
          </View>
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.white,
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 16,
  },
  contactGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  contactCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  contactIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  contactTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
    textAlign: 'center',
  },
  contactSubtitle: {
    fontSize: 12,
    color: Colors.lightText,
    textAlign: 'center',
  },
  faqSection: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  faqSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  faqSectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  faqSectionInfo: {
    flex: 1,
  },
  faqSectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  faqSectionDescription: {
    fontSize: 14,
    color: Colors.lightText,
  },
  faqItems: {
    borderTopWidth: 1,
    borderTopColor: Colors.lightGray,
  },
  faqItem: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  faqQuestion: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    paddingLeft: 24,
  },
  faqQuestionText: {
    fontSize: 15,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
    marginRight: 8,
  },
  faqAnswer: {
    paddingHorizontal: 24,
    paddingBottom: 16,
  },
  faqAnswerText: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
  appInfoCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  appInfoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  appInfoLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
  },
  appInfoValue: {
    fontSize: 14,
    color: Colors.lightText,
  },
  backendNotice: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'flex-start',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backendNoticeContent: {
    flex: 1,
    marginLeft: 12,
  },
  backendNoticeTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  backendNoticeText: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
  },
  // Restaurant Setup Styles
  setupCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  setupInfo: {
    flex: 1,
    marginRight: 16,
  },
  setupHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  setupTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginLeft: 8,
    flex: 1,
  },
  setupDescription: {
    fontSize: 14,
    color: Colors.lightText,
    lineHeight: 20,
    marginBottom: 12,
  },
  setupProgress: {
    marginTop: 8,
  },
  progressBar: {
    height: 4,
    backgroundColor: Colors.lightGray,
    borderRadius: 2,
    marginBottom: 4,
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: 2,
  },
  progressText: {
    fontSize: 12,
    color: Colors.lightText,
  },
  setupButton: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  setupButtonSecondary: {
    backgroundColor: Colors.secondary,
  },
  setupButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default HelpScreen;
