/**
 * Badge component to indicate that an item supports modifications
 * Shows on menu items that can be customized (coffee, tea, etc.)
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';

interface ModificationBadgeProps {
  compact?: boolean;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'inline';
  showText?: boolean;
  size?: 'small' | 'medium' | 'large';
}

export default function ModificationBadge({
  compact = false,
  position = 'top-right',
  showText = true,
  size = 'medium',
}: ModificationBadgeProps) {
  const { theme } = useTheme();

  const getIconSize = () => {
    switch (size) {
      case 'small':
        return 12;
      case 'large':
        return 20;
      default:
        return 16;
    }
  };

  const getTextSize = () => {
    switch (size) {
      case 'small':
        return 10;
      case 'large':
        return 14;
      default:
        return 12;
    }
  };

  const getPositionStyles = () => {
    const basePosition = { position: 'absolute' as const };
    switch (position) {
      case 'top-left':
        return { ...basePosition, top: 4, left: 4 };
      case 'bottom-right':
        return { ...basePosition, bottom: 4, right: 4 };
      case 'bottom-left':
        return { ...basePosition, bottom: 4, left: 4 };
      case 'inline':
        return {}; // No absolute positioning for inline
      case 'top-right':
      default:
        return { ...basePosition, top: 4, right: 4 };
    }
  };

  const containerStyles = [
    styles.container,
    {
      backgroundColor: theme.colors.primaryLight,
      borderColor: theme.colors.primary,
    },
    compact && styles.compact,
    position !== 'inline' && getPositionStyles(),
    size === 'small' && styles.smallContainer,
    size === 'large' && styles.largeContainer,
  ];

  return (
    <View style={containerStyles}>
      <Icon
        name="tune"
        size={getIconSize()}
        color={theme.colors.primary}
        style={styles.icon}
      />
      {showText && !compact && (
        <Text
          style={[
            styles.text,
            { 
              color: theme.colors.primary,
              fontSize: getTextSize(),
            },
          ]}
        >
          Customizable
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    zIndex: 1,
  },
  compact: {
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 10,
  },
  smallContainer: {
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 8,
  },
  largeContainer: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
  },
  icon: {
    marginRight: 2,
  },
  text: {
    fontWeight: '600',
    marginLeft: 2,
  },
});