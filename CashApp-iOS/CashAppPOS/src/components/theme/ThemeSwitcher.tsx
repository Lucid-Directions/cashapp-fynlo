import React, { useState, useCallback, useMemo } from 'react';

import type { ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme, _ColorTheme, colorThemeOptions } from '../../design-system/ThemeProvider';
import { logger } from '../../utils/logger';

import type { Theme } from '../../design-system/theme';
import type { ThemeMode, ColorThemeOption } from '../../design-system/ThemeProvider';

// Remove duplicate interface since it's imported from ThemeProvider

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
  const { theme, themeMode, colorTheme, setThemeMode, setColorTheme, isDark } = useTheme();
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

  // colorThemeOptions is now imported from ThemeProvider

  // Safe theme switching with error handling
  const handleThemeToggle = useCallback(async () => {
    if (isAnimating) return;

    try {
      setIsAnimating(true);
      const newTheme = isDark ? 'light' : 'dark';

      // Add animation delay for smooth transition
      await new Promise((resolve) => setTimeout(resolve, 100));

      await setThemeMode(newTheme);

      // Additional delay to ensure theme is fully applied
      await new Promise((resolve) => setTimeout(resolve, 200));
    } catch (error) {
      logger.error('Theme switching error:', error);
      // Fallback to default theme if switching fails
      try {
        await setThemeMode('light');
      } catch (fallbackError) {
        logger.error('Fallback theme setting failed:', fallbackError);
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
          neutral: {
            50: '#F9F9F9',
            100: '#F5F5F5',
            200: '#E5E5E5',
            400: '#A3A3A3',
            600: '#525252',
          },
          white: '#FFFFFF',
          text: '#000000',
          background: '#FFFFFF',
        },
        spacing: { 1: 4, 2: 8, 3: 12, 4: 16 },
        borderRadius: { sm: 4, md: 8, lg: 12, xl: 16 },
        typography: {
          fontSize: { xs: 10, sm: 12, base: 14, lg: 16 },
          fontWeight: { medium: '500', semibold: '600' },
        },
        isDark: false,
      };
    }
    return theme;
  }, [theme]);

  // Using static styles with inline theme values

  const handleColorThemeChange = useCallback(
    async (colorThemeOption: ColorThemeOption) => {
      if (isAnimating) return;

      try {
        setIsAnimating(true);
        await setColorTheme(colorThemeOption.id);

        // Add animation delay for smooth transition
        await new Promise((resolve) => setTimeout(resolve, 200));
      } catch (error) {
        logger.error('Color theme switching error:', error);
      } finally {
        setIsAnimating(false);
      }
    },
    [setColorTheme, isAnimating]
  );

  // Colors variant - color theme grid
  if (variant === 'colors') {
    return (
      <View style={[styles.colorsContainer, { backgroundColor: safeTheme.colors.white }, style]} testID={testID}>
        <View style={styles.colorsGrid}>
          {colorThemeOptions.map((colorThemeOption) => (
            <TouchableOpacity
            key={colorThemeOption.id}
            style={[
            styles.colorCard,
            { backgroundColor: safeTheme.colors.neutral[50], borderColor: safeTheme.colors.neutral[200] },
              colorTheme === colorThemeOption.id && { borderColor: safeTheme.colors.primary, backgroundColor: safeTheme.colors.primary[50] || safeTheme.colors.neutral[50] },
                ]}
              onPress={() => handleColorThemeChange(colorThemeOption)}
              accessibilityRole="button"
              accessibilityLabel={colorThemeOption.label}
              accessibilityHint={colorThemeOption.description}
              accessibilityState={{ selected: colorTheme === colorThemeOption.id }}
            >
              <View style={styles.colorPreview}>
                <View style={[styles.colorSwatch, { backgroundColor: colorThemeOption.primary }]} />
                <View
                  style={[styles.colorSwatch, { backgroundColor: colorThemeOption.secondary }]}
                />
                <View style={[styles.colorSwatch, { backgroundColor: colorThemeOption.accent }]} />
              </View>
              {showLabels && (
                <>
                  <Text
                    style={[
                      styles.colorLabel,
                      { color: safeTheme.colors.text },
                      colorTheme === colorThemeOption.id && { color: safeTheme.colors.primary },
                    ]}
                  >
                    {colorThemeOption.label}
                  </Text>
                  <Text style={[styles.colorDescription, { color: safeTheme.colors.neutral[600] }]}>{colorThemeOption.description}</Text>
                </>
              )}
              {colorTheme === colorThemeOption.id && (
                <View style={styles.colorCheckmark}>
                  <Icon name="check-circle" size={16} color={safeTheme.colors.primary} />
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
      <View style={[styles.compactContainer, { backgroundColor: safeTheme.colors.neutral[100] }, style]} testID={testID}>
        {themeOptions.map((option) => (
          <TouchableOpacity
            key={option.mode}
            style={[
              styles.compactButton,
              themeMode === option.mode && { backgroundColor: safeTheme.colors.primary },
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
                themeMode === option.mode ? safeTheme.colors.white : safeTheme.colors.neutral[600]
              }
            />
            {showLabels && (
              <Text
                style={[
                  styles.compactLabel,
                  { color: safeTheme.colors.neutral[600] },
                  themeMode === option.mode && { color: safeTheme.colors.white },
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
              { backgroundColor: safeTheme.colors.white, borderColor: safeTheme.colors.neutral[200] },
              themeMode === option.mode && { borderColor: safeTheme.colors.primary, backgroundColor: safeTheme.colors.primary[50] || safeTheme.colors.neutral[50] },
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
                { color: safeTheme.colors.text },
                themeMode === option.mode && { color: safeTheme.colors.primary },
              ]}
            >
              {option.label}
            </Text>
            <Text style={[styles.expandedDescription, { color: safeTheme.colors.neutral[600] }]}>{option.description}</Text>
            {themeMode === option.mode && (
              <View style={styles.expandedCheckmark}>
                <Icon name="check-circle" size={20} color={safeTheme.colors.primary} />
              </View>
            )}
          </TouchableOpacity>
        ))}
      </View>
    );
  }

  // List variant - menu-style options
  return (
    <View style={[styles.listContainer, { backgroundColor: safeTheme.colors.white }, style]} testID={testID}>
      {themeOptions.map((option) => (
        <TouchableOpacity
          key={option.mode}
          style={[
            styles.listItem,
            { borderBottomColor: safeTheme.colors.neutral[100] },
            themeMode === option.mode && { backgroundColor: safeTheme.colors.primary[50] || safeTheme.colors.neutral[50] },
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
                themeMode === option.mode ? safeTheme.colors.primary : safeTheme.colors.neutral[600]
              }
            />
          </View>
          <View style={styles.listContent}>
            <Text
              style={[
                styles.listTitle,
                { color: safeTheme.colors.text },
                themeMode === option.mode && { color: safeTheme.colors.primary },
              ]}
            >
              {option.label}
            </Text>
            <Text style={[styles.listDescription, { color: safeTheme.colors.neutral[600] }]}>{option.description}</Text>
          </View>
          <View style={styles.listTrailing}>
            {themeMode === option.mode && (
              <Icon name="radio-button-checked" size={20} color={safeTheme.colors.primary} />
            )}
            {themeMode !== option.mode && (
              <Icon name="radio-button-unchecked" size={20} color={safeTheme.colors.neutral[400]} />
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
  // Using static styles with inline theme values

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
        { padding, backgroundColor: theme.colors.neutral[100] },
        isDark && { backgroundColor: theme.colors.neutral[800] },
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
      {showLabels && <Text style={[styles.toggleLabel, { color: theme.colors.text }]}>{isDark ? 'Light' : 'Dark'}</Text>}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
    // Compact variant styles
    compactContainer: {
      flexDirection: 'row',
      borderRadius: 12,
      padding: 4,
    },
    compactButton: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 8,
      gap: 8,
    },
    compactLabel: {
      fontSize: 12,
      fontWeight: '500',
    },

    // Expanded variant styles
    expandedContainer: {
      gap: 12,
    },
    expandedCard: {
      borderRadius: 16,
      padding: 16,
      borderWidth: 2,
      alignItems: 'center',
      position: 'relative',
    },
    expandedIconContainer: {
      marginBottom: 12,
    },
    expandedTitle: {
      fontSize: 16,
      fontWeight: '600',
      marginBottom: 4,
    },
    expandedDescription: {
      fontSize: 12,
      textAlign: 'center',
    },
    expandedCheckmark: {
      position: 'absolute',
      top: 8,
      right: 8,
    },

    // List variant styles
    listContainer: {
      borderRadius: 16,
      overflow: 'hidden',
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderBottomWidth: 1,
    },
    listIconContainer: {
      marginRight: 12,
      width: 32,
      alignItems: 'center',
    },
    listContent: {
      flex: 1,
    },
    listTitle: {
      fontSize: 14,
      fontWeight: '500',
      marginBottom: 4,
    },
    listDescription: {
      fontSize: 12,
    },
    listTrailing: {
      marginLeft: 12,
    },

    // Toggle styles
    toggleButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 9999,
      gap: 8,
    },
    toggleLabel: {
      fontSize: 12,
      fontWeight: '500',
    },

    // Colors variant styles
    colorsContainer: {
      borderRadius: 16,
      padding: 16,
    },
    colorsGrid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 12,
      justifyContent: 'space-between',
    },
    colorCard: {
      width: '48%',
      borderRadius: 12,
      padding: 12,
      borderWidth: 2,
      alignItems: 'center',
      position: 'relative',
      minHeight: 120,
    },
    colorPreview: {
      flexDirection: 'row',
      marginBottom: 8,
      gap: 4,
    },
    colorSwatch: {
      width: 16,
      height: 16,
      borderRadius: 4,
      borderWidth: 1,
      borderColor: '#E5E5E5',
    },
    colorLabel: {
      fontSize: 12,
      fontWeight: '600',
      textAlign: 'center',
      marginBottom: 4,
    },
    colorDescription: {
      fontSize: 10,
      textAlign: 'center',
      lineHeight: 16,
    },
    colorCheckmark: {
      position: 'absolute',
      top: 8,
      right: 8,
    },
  });

export default ThemeSwitcher;
