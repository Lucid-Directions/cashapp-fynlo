import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme, ThemeMode } from '../../design-system/ThemeProvider';
import { Theme } from '../../design-system/theme';

// Theme option interface
interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

// Theme switcher props
export interface ThemeSwitcherProps {
  variant?: 'compact' | 'expanded' | 'list';
  showLabels?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const ThemeSwitcher: React.FC<ThemeSwitcherProps> = ({
  variant = 'compact',
  showLabels = true,
  style,
  testID,
}) => {
  const { theme, themeMode, setThemeMode, isDark } = useTheme();
  const styles = createStyles(theme);

  const themeOptions: ThemeOption[] = [
    {
      mode: 'light',
      label: 'Light',
      icon: 'light-mode',
      description: 'Light theme with bright backgrounds',
    },
    {
      mode: 'dark',
      label: 'Dark',
      icon: 'dark-mode',
      description: 'Dark theme with dark backgrounds',
    },
    {
      mode: 'auto',
      label: 'Auto',
      icon: 'brightness-auto',
      description: 'Follow system theme preference',
    },
  ];

  const handleThemeChange = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  // Compact variant - horizontal buttons
  if (variant === 'compact') {
    return (
      <View style={[styles.compactContainer, style]} testID={testID}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[
              styles.compactButton,
              themeMode === option.mode && styles.compactButtonActive,
            ]}
            onPress={() => handleThemeChange(option.mode)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected: themeMode === option.mode }}
          >
            <Icon
              name={option.icon}
              size={20}
              color={
                themeMode === option.mode
                  ? theme.colors.white
                  : theme.colors.neutral[600]
              }
            />
            {showLabels && (
              <Text
                style={[
                  styles.compactLabel,
                  themeMode === option.mode && styles.compactLabelActive,
                ]}
              >
                {option.label}
              </Text>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // Expanded variant - card-like options
  if (variant === 'expanded') {
    return (
      <View style={[styles.expandedContainer, style]} testID={testID}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[
              styles.expandedCard,
              themeMode === option.mode && styles.expandedCardActive,
            ]}
            onPress={() => handleThemeChange(option.mode)}
            accessibilityRole="button"
            accessibilityLabel={option.label}
            accessibilityHint={option.description}
            accessibilityState={{ selected: themeMode === option.mode }}
          >
            <View style={styles.expandedIconContainer}>
              <Icon
                name={option.icon}
                size={32}
                color={
                  themeMode === option.mode
                    ? theme.colors.primary
                    : theme.colors.neutral[600]
                }
              />
            </View>
            <Text
              style={[
                styles.expandedTitle,
                themeMode === option.mode && styles.expandedTitleActive,
              ]}
            >
              {option.label}
            </Text>
            <Text style={styles.expandedDescription}>
              {option.description}
            </Text>
            {themeMode === option.mode && (
              <View style={styles.expandedCheckmark}>
                <Icon
                  name="check-circle"
                  size={20}
                  color={theme.colors.primary}
                />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // List variant - menu-style options
  return (
    <View style={[styles.listContainer, style]} testID={testID}>
      {themeOptions.map((option) => (
        <TouchableOpacity
          key={option.mode}
          style={[
            styles.listItem,
            themeMode === option.mode && styles.listItemActive,
          ]}
          onPress={() => handleThemeChange(option.mode)}
          accessibilityRole="button"
          accessibilityLabel={option.label}
          accessibilityHint={option.description}
          accessibilityState={{ selected: themeMode === option.mode }}
        >
          <View style={styles.listIconContainer}>
            <Icon
              name={option.icon}
              size={24}
              color={
                themeMode === option.mode
                  ? theme.colors.primary
                  : theme.colors.neutral[600]
              }
            />
          </View>
          <View style={styles.listContent}>
            <Text
              style={[
                styles.listTitle,
                themeMode === option.mode && styles.listTitleActive,
              ]}
            >
              {option.label}
            </Text>
            <Text style={styles.listDescription}>
              {option.description}
            </Text>
          </View>
          <View style={styles.listTrailing}>
            {themeMode === option.mode && (
              <Icon
                name="radio-button-checked"
                size={20}
                color={theme.colors.primary}
              />
            )}
            {themeMode !== option.mode && (
              <Icon
                name="radio-button-unchecked"
                size={20}
                color={theme.colors.neutral[400]}
              />
            )}
          </View>
        </TouchableOpacity>
      ))}
    </View>
  );
};

// Simple toggle switch for light/dark mode
export interface ThemeToggleProps {
  size?: 'sm' | 'md' | 'lg';
  showLabels?: boolean;
  style?: ViewStyle;
  testID?: string;
}

export const ThemeToggle: React.FC<ThemeToggleProps> = ({
  size = 'md',
  showLabels = false,
  style,
  testID,
}) => {
  const { theme, isDark, toggleTheme } = useTheme();
  const styles = createStyles(theme);

  const getSizeStyles = () => {
    switch (size) {
      case 'sm':
        return { iconSize: 18, padding: theme.spacing[2] };
      case 'lg':
        return { iconSize: 28, padding: theme.spacing[4] };
      default:
        return { iconSize: 24, padding: theme.spacing[3] };
    }
  };

  const { iconSize, padding } = getSizeStyles();

  return (
    <TouchableOpacity
      style={[
        styles.toggleButton,
        { padding },
        isDark && styles.toggleButtonDark,
        style,
      ]}
      onPress={toggleTheme}
      accessibilityRole="switch"
      accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      accessibilityState={{ checked: isDark }}
      testID={testID}
    >
      <Icon
        name={isDark ? 'light-mode' : 'dark-mode'}
        size={iconSize}
        color={isDark ? theme.colors.warning[500] : theme.colors.neutral[600]}
      />
      {showLabels && (
        <Text style={styles.toggleLabel}>
          {isDark ? 'Light' : 'Dark'}
        </Text>
      )}
    </TouchableOpacity>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    // Compact variant styles
    compactContainer: {
      flexDirection: 'row',
      backgroundColor: theme.colors.neutral[100],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[1],
    },
    compactButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: theme.spacing[2],
      paddingHorizontal: theme.spacing[3],
      borderRadius: theme.borderRadius.md,
      gap: theme.spacing[2],
    },
    compactButtonActive: {
      backgroundColor: theme.colors.primary,
    },
    compactLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.neutral[600],
    },
    compactLabelActive: {
      color: theme.colors.white,
    },

    // Expanded variant styles
    expandedContainer: {
      gap: theme.spacing[3],
    },
    expandedCard: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing[4],
      borderWidth: 2,
      borderColor: theme.colors.neutral[200],
      alignItems: 'center',
      position: 'relative',
    },
    expandedCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary[50] || theme.colors.neutral[50],
    },
    expandedIconContainer: {
      marginBottom: theme.spacing[3],
    },
    expandedTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      marginBottom: theme.spacing[1],
    },
    expandedTitleActive: {
      color: theme.colors.primary,
    },
    expandedDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[600],
      textAlign: 'center',
    },
    expandedCheckmark: {
      position: 'absolute',
      top: theme.spacing[2],
      right: theme.spacing[2],
    },

    // List variant styles
    listContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      overflow: 'hidden',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.neutral[100],
    },
    listItemActive: {
      backgroundColor: theme.colors.primary[50] || theme.colors.neutral[50],
    },
    listIconContainer: {
      marginRight: theme.spacing[3],
      width: 32,
      alignItems: 'center',
    },
    listContent: {
      flex: 1,
    },
    listTitle: {
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      marginBottom: theme.spacing[1],
    },
    listTitleActive: {
      color: theme.colors.primary,
    },
    listDescription: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[600],
    },
    listTrailing: {
      marginLeft: theme.spacing[3],
    },

    // Toggle styles
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.neutral[100],
      borderRadius: theme.borderRadius.full,
      gap: theme.spacing[2],
    },
    toggleButtonDark: {
      backgroundColor: theme.colors.neutral[800],
    },
    toggleLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
    },
  });

export default ThemeSwitcher;