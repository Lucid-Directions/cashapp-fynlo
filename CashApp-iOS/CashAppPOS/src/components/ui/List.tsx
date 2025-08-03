import React from 'react';

import type { ViewStyle, GestureResponderEvent } from 'react-native';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme } from '../../design-system/ThemeProvider';

import type { Theme } from '../../design-system/theme';

// List variants
export type ListVariant = 'default' | 'card' | 'inset';

// List item props
export interface ListItemProps {
  title: string;
  subtitle?: string;
  description?: string;
  leftIcon?: string;
  rightIcon?: string;
  leftContent?: React.ReactNode;
  rightContent?: React.ReactNode;
  onPress?: (event: GestureResponderEvent) => void;
  disabled?: boolean;
  style?: ViewStyle;
  testID?: string;
}

// List props
export interface ListProps {
  children: React.ReactNode;
  variant?: ListVariant;
  showDividers?: boolean;
  style?: ViewStyle;
  testID?: string;
}

// List Item Component
export const ListItem: React.FC<ListItemProps> = ({
  title,
  subtitle,
  description,
  leftIcon,
  rightIcon,
  leftContent,
  rightContent,
  onPress,
  disabled = false,
  style,
  testID,
}) => {
  const { theme } = useTheme();

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[
        styles.listItem,
        {
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
        },
        disabled && styles.listItemDisabled,
        style
      ]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}
    >
      {/* Left Content */}
      <View style={[styles.leftSection, { marginRight: theme.spacing[3] }]}>
        {leftContent && <View style={styles.leftContent}>{leftContent}</View>}
        {leftIcon && !leftContent && (
          <View style={styles.leftIconContainer}>
            <Icon
              name={leftIcon}
              size={24}
              color={disabled ? theme.colors.neutral[300] : theme.colors.neutral[600]}
            />
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={[
          styles.title,
          {
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.medium,
            color: theme.colors.text,
            lineHeight: theme.typography.lineHeight.tight * theme.typography.fontSize.base,
          },
          disabled && { color: theme.colors.neutral[400] }
        ]} numberOfLines={1}>
          {title}
        </Text>

        {subtitle && (
          <Text style={[
            styles.subtitle,
            {
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.neutral[600],
              marginTop: theme.spacing[1],
              lineHeight: theme.typography.lineHeight.tight * theme.typography.fontSize.sm,
            },
            disabled && { color: theme.colors.neutral[300] }
          ]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {description && (
          <Text
            style={[
              styles.description,
              {
                fontSize: theme.typography.fontSize.sm,
                color: theme.colors.neutral[500],
                marginTop: theme.spacing[1],
                lineHeight: theme.typography.lineHeight.normal * theme.typography.fontSize.sm,
              },
              disabled && { color: theme.colors.neutral[300] }
            ]}
            numberOfLines={2}
          >
            {description}
          </Text>
        )}
      </View>

      {/* Right Content */}
      <View style={[styles.rightSection, { marginLeft: theme.spacing[3] }]}>
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
        {rightIcon && !rightContent && (
          <View style={styles.rightIconContainer}>
            <Icon
              name={rightIcon}
              size={20}
              color={disabled ? theme.colors.neutral[300] : theme.colors.neutral[400]}
            />
          </View>
        )}
      </View>
    </Component>
  );
};

// List Header Component
export interface ListHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  style?: ViewStyle;
}

export const ListHeader: React.FC<ListHeaderProps> = ({ title, subtitle, rightContent, style }) => {
  const { theme } = useTheme();

  return (
    <View style={[
      styles.listHeader,
      {
        paddingHorizontal: theme.spacing[4],
        paddingVertical: theme.spacing[4],
        backgroundColor: theme.colors.neutral[50],
      },
      style
    ]}>
      <View style={styles.headerMainContent}>
        <Text style={[
          styles.headerTitle,
          {
            fontSize: theme.typography.fontSize.lg,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.text,
          }
        ]}>{title}</Text>
        {subtitle && (
          <Text style={[
            styles.headerSubtitle,
            {
              fontSize: theme.typography.fontSize.sm,
              color: theme.colors.neutral[600],
              marginTop: theme.spacing[1],
            }
          ]}>{subtitle}</Text>
        )}
      </View>
      {rightContent && (
        <View style={[styles.headerRightContent, { marginLeft: theme.spacing[4] }]}>
          {rightContent}
        </View>
      )}
    </View>
  );
};

// List Section Component
export interface ListSectionProps {
  children: React.ReactNode;
  header?: string;
  footer?: string;
  style?: ViewStyle;
}

export const ListSection: React.FC<ListSectionProps> = ({ children, header, footer, style }) => {
  const { theme } = useTheme();

  return (
    <View style={[styles.listSection, { marginVertical: theme.spacing[2] }, style]}>
      {header && (
        <Text style={[
          styles.sectionHeader,
          {
            fontSize: theme.typography.fontSize.sm,
            fontWeight: theme.typography.fontWeight.semibold,
            color: theme.colors.neutral[600],
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[2],
            backgroundColor: theme.colors.neutral[50],
          }
        ]}>{header}</Text>
      )}
      <View style={[styles.sectionContent, { backgroundColor: theme.colors.white }]}>{children}</View>
      {footer && (
        <Text style={[
          styles.sectionFooter,
          {
            fontSize: theme.typography.fontSize.xs,
            color: theme.colors.neutral[500],
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[2],
            backgroundColor: theme.colors.neutral[50],
          }
        ]}>{footer}</Text>
      )}
    </View>
  );
};

// Main List Component
const List: React.FC<ListProps> = ({
  children,
  variant = 'default',
  showDividers = true,
  style,
  testID,
}) => {
  const { theme } = useTheme();

  const getVariantStyle = () => {
    switch (variant) {
      case 'card':
        return {
          ...styles.listVariantCard,
          backgroundColor: theme.colors.white,
          borderRadius: theme.borderRadius.xl,
          ...theme.shadows.md,
        };
      case 'inset':
        return {
          ...styles.listVariantInset,
          backgroundColor: theme.colors.white,
          marginHorizontal: theme.spacing[4],
          borderRadius: theme.borderRadius.xl,
          ...theme.shadows.sm,
        };
      default:
        return {
          backgroundColor: theme.colors.white,
        };
    }
  };

  const variantStyle = getVariantStyle();

  // Add dividers between children if showDividers is true
  const childrenWithDividers = React.Children.map(children, (child, index) => {
    const isLastChild = index === React.Children.count(children) - 1;

    return (
      <React.Fragment key={index}>
        {child}
        {showDividers && !isLastChild && (
          <View style={[
            styles.divider,
            {
              backgroundColor: theme.colors.neutral[100],
              marginLeft: theme.spacing[4] + 32 + theme.spacing[3], // Align with main content
            }
          ]} />
        )}
      </React.Fragment>
    );
  });

  return (
    <View style={[styles.list, variantStyle, style]} testID={testID}>
      {childrenWithDividers}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {
    // Base list styles
  },
  listVariantDefault: {
    // Theme styles will be applied inline
  },
  listVariantCard: {
    overflow: 'hidden',
  },
  listVariantInset: {
    overflow: 'hidden',
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
  },
  listItemDisabled: {
    opacity: 0.5,
  },
  leftSection: {
    // Theme styles will be applied inline
  },
  leftContent: {
    // Custom left content container
  },
  leftIconContainer: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  mainContent: {
    flex: 1,
    justifyContent: 'center',
  },
  title: {
    // Theme styles will be applied inline
  },
  titleDisabled: {
    // Theme styles will be applied inline
  },
  subtitle: {
    // Theme styles will be applied inline
  },
  subtitleDisabled: {
    // Theme styles will be applied inline
  },
  description: {
    // Theme styles will be applied inline
  },
  descriptionDisabled: {
    // Theme styles will be applied inline
  },
  rightSection: {
    // Theme styles will be applied inline
  },
  rightContent: {
    alignItems: 'flex-end',
  },
  rightIconContainer: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    // Theme styles will be applied inline
  },
  listHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerMainContent: {
    flex: 1,
  },
  headerTitle: {
    // Theme styles will be applied inline
  },
  headerSubtitle: {
    // Theme styles will be applied inline
  },
  headerRightContent: {
    // Theme styles will be applied inline
  },
  listSection: {
    // Theme styles will be applied inline
  },
  sectionHeader: {
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionContent: {
    // Theme styles will be applied inline
  },
  sectionFooter: {
    // Theme styles will be applied inline
  },
});

export default List;
