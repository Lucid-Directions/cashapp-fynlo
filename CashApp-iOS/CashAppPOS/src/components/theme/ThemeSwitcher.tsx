import React, { useState, useCallback, useMemo } from 'react';
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

// Color theme option interface
interface ColorThemeOption {
  id: string;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

// Theme option interface
interface ThemeOption {
  mode: ThemeMode;
  label: string;
  icon: string;
  description: string;
}

// Theme switcher props
export interface ThemeSwitcherProps {
  variant?: 'compact' | 'expanded' | 'list' | 'colors';
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
  const [isAnimating, setIsAnimating] = useState(false);

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

  const colorThemeOptions: ColorThemeOption[] = [
    {
      id: 'default',
      label: 'Fynlo Green',
      primary: '#00A651',
      secondary: '#0066CC',
      accent: '#22C55E',
      description: 'Classic Fynlo brand colors',
    },
    {
      id: 'blue',
      label: 'Ocean Blue',
      primary: '#0EA5E9',
      secondary: '#1E40AF',
      accent: '#3B82F6',
      description: 'Calming ocean blue theme',
    },
    {
      id: 'purple',
      label: 'Royal Purple',
      primary: '#8B5CF6',
      secondary: '#7C3AED',
      accent: '#A855F7',
      description: 'Elegant purple theme',
    },
    {
      id: 'orange',
      label: 'Sunset Orange',
      primary: '#F97316',
      secondary: '#EA580C',
      accent: '#FB923C',
      description: 'Vibrant sunset orange',
    },
    {
      id: 'red',
      label: 'Cherry Red',
      primary: '#EF4444',
      secondary: '#DC2626',
      accent: '#F87171',
      description: 'Bold cherry red theme',
    },
    {
      id: 'teal',
      label: 'Emerald Teal',
      primary: '#14B8A6',
      secondary: '#0F766E',
      accent: '#2DD4BF',
      description: 'Fresh emerald teal',
    },
    {
      id: 'indigo',
      label: 'Deep Indigo',
      primary: '#6366F1',
      secondary: '#4F46E5',
      accent: '#818CF8',
      description: 'Deep indigo blue',
    },
    {
      id: 'pink',
      label: 'Rose Pink',
      primary: '#EC4899',
      secondary: '#DB2777',
      accent: '#F472B6',
      description: 'Elegant rose pink',
    },
    {
      id: 'lime',
      label: 'Fresh Lime',
      primary: '#84CC16',
      secondary: '#65A30D',
      accent: '#A3E635',
      description: 'Fresh lime green',
    },
    {
      id: 'amber',
      label: 'Golden Amber',
      primary: '#F59E0B',
      secondary: '#D97706',
      accent: '#FBBF24',
      description: 'Warm golden amber',
    },
  ];

  // Safe theme switching with error handling
  const handleThemeToggle = useCallback(async () => {
    if (isAnimating) return;
    
    try {
      setIsAnimating(true);
      const newTheme = isDark ? 'light' : 'dark';
      
      // Add animation delay for smooth transition
      await new Promise(resolve => setTimeout(resolve, 100));
      
      await setThemeMode(newTheme);
      
      // Additional delay to ensure theme is fully applied
      await new Promise(resolve => setTimeout(resolve, 200));
      
    } catch (error) {
      console.error('Theme switching error:', error);
      // Fallback to default theme if switching fails
      try {
        await setThemeMode('light');
      } catch (fallbackError) {
        console.error('Fallback theme setting failed:', fallbackError);
      }
    } finally {
      setIsAnimating(false);
    }
  }, [isDark, setThemeMode, isAnimating]);

  // Safe theme access with fallbacks
  const safeTheme = useMemo(() => {
    if (!theme || !theme.colors) {
      // Return default light theme if theme is corrupted
      return {
        colors: {
          primary: '#00A651',
          background: '#FFFFFF',
          card: '#FFFFFF',
          text: '#000000',
          border: '#E1E1E1',
          notification: '#FF3B30',
        },
        dark: false,
      };
    }
    return theme;
  }, [theme]);

  const styles = createStyles(safeTheme);

  const handleColorThemeChange = (colorTheme: ColorThemeOption) => {
    // For now, we'll just show an alert since full implementation requires theme provider changes
    // In a full implementation, this would update the theme colors
    console.log('Color theme selected:', colorTheme.label);
  };

  // Colors variant - color theme grid
  if (variant === 'colors') {
    return (
      <View style={[styles.colorsContainer, style]} testID={testID}>
        <View style={styles.colorsGrid}>
          {colorThemeOptions.map((colorTheme) => (
            <TouchableOpacity
              key={colorTheme.id}
              style={[
                styles.colorCard,
                colorTheme.id === 'default' && styles.colorCardActive,
              ]}
              onPress={() => handleColorThemeChange(colorTheme)}
              accessibilityRole="button"
              accessibilityLabel={colorTheme.label}
              accessibilityHint={colorTheme.description}
              accessibilityState={{ selected: colorTheme.id === 'default' }}
            >
              <View style={styles.colorPreview}>
                <View style={[styles.colorSwatch, { backgroundColor: colorTheme.primary }]} />
                <View style={[styles.colorSwatch, { backgroundColor: colorTheme.secondary }]} />
                <View style={[styles.colorSwatch, { backgroundColor: colorTheme.accent }]} />
              </View>
              {showLabels && (
                <>
                  <Text style={[
                    styles.colorLabel,
                    colorTheme.id === 'default' && styles.colorLabelActive,
                  ]}>
                    {colorTheme.label}
                  </Text>
                  <Text style={styles.colorDescription}>
                    {colorTheme.description}
                  </Text>
                </>
              )}
              {colorTheme.id === 'default' && (
                <View style={styles.colorCheckmark}>
                  <Icon
                    name="check-circle"
                    size={16}
                    color={safeTheme.colors.primary}
                  />
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>
      </View>
    );
  }

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
            onPress={() => handleThemeToggle()}
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
                  ? safeTheme.colors.white
                  : safeTheme.colors.neutral[600]
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
            onPress={() => handleThemeToggle()}
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
                    ? safeTheme.colors.primary
                    : safeTheme.colors.neutral[600]
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
                  color={safeTheme.colors.primary}
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
          onPress={() => handleThemeToggle()}
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
                  ? safeTheme.colors.primary
                  : safeTheme.colors.neutral[600]
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
                color={safeTheme.colors.primary}
              />
            )}
            {themeMode !== option.mode && (
              <Icon
                name="radio-button-unchecked"
                size={20}
                color={safeTheme.colors.neutral[400]}
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

    // Colors variant styles
    colorsContainer: {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius.xl,
      padding: theme.spacing[4],
    },
    colorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing[3],
      justifyContent: 'space-between',
    },
    colorCard: {
      width: '48%',
      backgroundColor: theme.colors.neutral[50],
      borderRadius: theme.borderRadius.lg,
      padding: theme.spacing[3],
      borderWidth: 2,
      borderColor: theme.colors.neutral[200],
      alignItems: 'center',
      position: 'relative',
      minHeight: 120,
    },
    colorCardActive: {
      borderColor: theme.colors.primary,
      backgroundColor: theme.colors.primary[50] || theme.colors.neutral[50],
    },
    colorPreview: {
      flexDirection: 'row',
      marginBottom: theme.spacing[2],
      gap: theme.spacing[1],
    },
    colorSwatch: {
      width: 16,
      height: 16,
      borderRadius: theme.borderRadius.sm,
      borderWidth: 1,
      borderColor: theme.colors.neutral[200],
    },
    colorLabel: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: theme.spacing[1],
    },
    colorLabelActive: {
      color: theme.colors.primary,
    },
    colorDescription: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.neutral[600],
      textAlign: 'center',
      lineHeight: 16,
    },
    colorCheckmark: {
      position: 'absolute',
      top: theme.spacing[2],
      right: theme.spacing[2],
    },
  });

export default ThemeSwitcher;