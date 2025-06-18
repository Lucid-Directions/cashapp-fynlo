import React, { useState } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  ScrollView,
  Switch,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import ThemeSwitcher, { ThemeToggle } from '../../../components/theme/ThemeSwitcher';
import { useTheme } from '../../../design-system/ThemeProvider';

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

const ThemeOptionsScreen: React.FC = () => {
  const navigation = useNavigation();
  const { theme, themeMode, isDark } = useTheme();
  
  // Display preferences
  const [highContrast, setHighContrast] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [largeText, setLargeText] = useState(false);
  const [showAnimations, setShowAnimations] = useState(true);
  const [screenTimeout, setScreenTimeout] = useState('5min');

  const displayOptions = [
    { id: '30sec', label: '30 seconds' },
    { id: '1min', label: '1 minute' },
    { id: '2min', label: '2 minutes' },
    { id: '5min', label: '5 minutes' },
    { id: '10min', label: '10 minutes' },
    { id: 'never', label: 'Never' },
  ];

  const handleScreenTimeoutChange = (timeout: string) => {
    setScreenTimeout(timeout);
  };

  return (
    <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
      {/* Header */}
      <View style={[styles.header, { backgroundColor: theme.colors.primary }]}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Icon name="arrow-back" size={24} color={theme.colors.white} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.white }]}>Theme & Display</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Theme Selection */}
        <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Theme Selection
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.neutral[600] }]}>
            Choose how the app appears. Auto mode follows your device settings.
          </Text>
          
          <View style={styles.themeContainer}>
            <ThemeSwitcher variant="expanded" showLabels={true} />
          </View>
        </View>

        {/* Quick Theme Toggle */}
        <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Quick Toggle
          </Text>
          <View style={styles.quickToggleContainer}>
            <View style={styles.quickToggleInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                Dark Mode
              </Text>
              <Text style={[styles.settingDescription, { color: theme.colors.neutral[600] }]}>
                Toggle between light and dark themes
              </Text>
            </View>
            <ThemeToggle size="lg" showLabels={true} />
          </View>
        </View>

        {/* Display Preferences */}
        <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Display Preferences
          </Text>
          
          <View style={styles.settingsCard}>
            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  High Contrast
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.neutral[600] }]}>
                  Increase contrast for better visibility
                </Text>
              </View>
              <Switch
                value={highContrast}
                onValueChange={setHighContrast}
                trackColor={{ false: theme.colors.neutral[300], true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Large Text
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.neutral[600] }]}>
                  Use larger font sizes throughout the app
                </Text>
              </View>
              <Switch
                value={largeText}
                onValueChange={setLargeText}
                trackColor={{ false: theme.colors.neutral[300], true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Reduce Motion
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.neutral[600] }]}>
                  Minimize animations and transitions
                </Text>
              </View>
              <Switch
                value={reducedMotion}
                onValueChange={setReducedMotion}
                trackColor={{ false: theme.colors.neutral[300], true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Text style={[styles.settingLabel, { color: theme.colors.text }]}>
                  Show Animations
                </Text>
                <Text style={[styles.settingDescription, { color: theme.colors.neutral[600] }]}>
                  Enable smooth animations and effects
                </Text>
              </View>
              <Switch
                value={showAnimations && !reducedMotion}
                onValueChange={setShowAnimations}
                disabled={reducedMotion}
                trackColor={{ false: theme.colors.neutral[300], true: theme.colors.primary }}
                thumbColor={theme.colors.white}
              />
            </View>
          </View>
        </View>

        {/* Screen Timeout */}
        <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Screen Timeout
          </Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.neutral[600] }]}>
            Automatically turn off the screen after inactivity
          </Text>
          
          <View style={styles.timeoutOptions}>
            {displayOptions.map(option => (
              <TouchableOpacity
                key={option.id}
                style={[
                  styles.timeoutOption,
                  {
                    backgroundColor: screenTimeout === option.id 
                      ? theme.colors.primary + '20' 
                      : theme.colors.neutral[50],
                    borderColor: screenTimeout === option.id 
                      ? theme.colors.primary 
                      : theme.colors.neutral[200],
                  }
                ]}
                onPress={() => handleScreenTimeoutChange(option.id)}
              >
                <Text style={[
                  styles.timeoutOptionText,
                  {
                    color: screenTimeout === option.id 
                      ? theme.colors.primary 
                      : theme.colors.text
                  }
                ]}>
                  {option.label}
                </Text>
                {screenTimeout === option.id && (
                  <Icon 
                    name="check-circle" 
                    size={20} 
                    color={theme.colors.primary} 
                  />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Theme Preview */}
        <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Current Theme Preview
          </Text>
          
          <View style={styles.previewContainer}>
            <View style={[styles.previewCard, { backgroundColor: theme.colors.neutral[50] }]}>
              <View style={[styles.previewHeader, { backgroundColor: theme.colors.primary }]}>
                <Text style={[styles.previewHeaderText, { color: theme.colors.white }]}>
                  Sample Screen
                </Text>
              </View>
              <View style={styles.previewContent}>
                <Text style={[styles.previewTitle, { color: theme.colors.text }]}>
                  This is how text appears
                </Text>
                <Text style={[styles.previewSubtitle, { color: theme.colors.neutral[600] }]}>
                  Secondary text and descriptions
                </Text>
                <View style={styles.previewButtons}>
                  <View style={[styles.previewButton, { backgroundColor: theme.colors.primary }]}>
                    <Text style={[styles.previewButtonText, { color: theme.colors.white }]}>
                      Primary
                    </Text>
                  </View>
                  <View style={[styles.previewButton, { 
                    backgroundColor: 'transparent',
                    borderWidth: 1,
                    borderColor: theme.colors.primary,
                  }]}>
                    <Text style={[styles.previewButtonText, { color: theme.colors.primary }]}>
                      Secondary
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        </View>

        {/* Theme Information */}
        <View style={[styles.section, { backgroundColor: theme.colors.white }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Theme Information
          </Text>
          
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.neutral[600] }]}>
                Current Theme:
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {themeMode.charAt(0).toUpperCase() + themeMode.slice(1)}
                {themeMode === 'auto' && ` (${isDark ? 'Dark' : 'Light'})`}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.neutral[600] }]}>
                Color Scheme:
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {isDark ? 'Dark Mode' : 'Light Mode'}
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={[styles.infoLabel, { color: theme.colors.neutral[600] }]}>
                High Contrast:
              </Text>
              <Text style={[styles.infoValue, { color: theme.colors.text }]}>
                {highContrast ? 'Enabled' : 'Disabled'}
              </Text>
            </View>
          </View>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
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
  },
  headerSpacer: {
    width: 40,
  },
  content: {
    flex: 1,
  },
  section: {
    marginVertical: 8,
    paddingVertical: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    paddingHorizontal: 16,
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    paddingHorizontal: 16,
    marginBottom: 16,
    lineHeight: 20,
  },
  themeContainer: {
    paddingHorizontal: 16,
  },
  quickToggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  quickToggleInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingsCard: {
    paddingHorizontal: 16,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 14,
  },
  timeoutOptions: {
    paddingHorizontal: 16,
    gap: 8,
  },
  timeoutOption: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  timeoutOptionText: {
    fontSize: 16,
    fontWeight: '500',
  },
  previewContainer: {
    paddingHorizontal: 16,
  },
  previewCard: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewHeader: {
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  previewHeaderText: {
    fontSize: 16,
    fontWeight: '600',
  },
  previewContent: {
    padding: 16,
  },
  previewTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  previewSubtitle: {
    fontSize: 14,
    marginBottom: 16,
  },
  previewButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  previewButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
  },
  previewButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  infoCard: {
    paddingHorizontal: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.lightGray,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default ThemeOptionsScreen;