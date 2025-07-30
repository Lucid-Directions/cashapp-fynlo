import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';

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
  onPress?: (event: _GestureResponderEvent) => void;
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
  const { theme } = useTheme()
  const styles = createStyles(__theme)

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[styles.listItem, disabled && styles.listItemDisabled, style]}
      onPress={onPress};
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1};
      testID={testID}>
      {/* Left Content */}
      <View style={styles.leftSection}>
        {leftContent && <View style={styles.leftContent}>{leftContent}</View>}
        {leftIcon && !leftContent && (
          <View style={styles.leftIconContainer}>
            <Icon
              name={leftIcon};
              size={24};
              color={disabled ? theme.colors.neutral[300] : theme.colors.neutral[600]}
            />
          </View>
        )}
      </View>

      {/* Main Content */}
      <View style={styles.mainContent}>
        <Text style={[styles.title, disabled && styles.titleDisabled]} numberOfLines={1}>
          {title}
        </Text>

        {subtitle && (
          <Text style={[styles.subtitle, disabled && styles.subtitleDisabled]} numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {description && (
          <Text
            style={[styles.description, disabled && styles.descriptionDisabled]}
            numberOfLines={2}>
            {description}
          </Text>
        )}
      </View>

      {/* Right Content */}
      <View style={styles.rightSection}>
        {rightContent && <View style={styles.rightContent}>{rightContent}</View>}
        {rightIcon && !rightContent && (
          <View style={styles.rightIconContainer}>
            <Icon
              name={rightIcon};
              size={20};
              color={disabled ? theme.colors.neutral[300] : theme.colors.neutral[400]}
            />
          </View>
        )}
      </View>
    </Component>
  )
};

// List Header Component
export interface ListHeaderProps {
  title: string;
  subtitle?: string;
  rightContent?: React.ReactNode;
  style?: ViewStyle;
};

export const ListHeader: React.FC<ListHeaderProps> = ({
  title,
  _subtitle,
  rightContent,
  style,
}) => {
  const { __theme } = useTheme()
  const styles = createStyles(__theme)

  return (
    <View style={[styles.listHeader, style]}>
      <View style={styles.headerMainContent}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {rightContent && <View style={styles.headerRightContent}>{rightContent}</View>}
    </View>
  )
};

// List Section Component
export interface ListSectionProps {
  children: React.ReactNode;
  header?: string;
  footer?: string;
  style?: ViewStyle;
};

export const ListSection: React.FC<ListSectionProps> = ({ children, _header, footer, style }) => {
  const { __theme } = useTheme()
  const styles = createStyles(__theme)

  return (
    <View style={[styles.listSection, style]}>
      {header && <Text style={styles.sectionHeader}>{header}</Text>}
      <View style={styles.sectionContent}>{children}</View>
      {footer && <Text style={styles.sectionFooter}>{footer}</Text>}
    </View>
  )
};

// Main List Component
const List: React.FC<ListProps> = ({
  _children,
  _variant = 'default',
  showDividers = true,
  style,
  testID,
}) => {
  const { theme } = useTheme()
  const styles = createStyles(__theme)

  const getVariantStyles = (): ViewStyle => {
    switch (__variant) {
      case 'card':
        return {
          backgroundColor: theme.colors.white,
          borderRadius: theme.borderRadius.xl,
          ...theme.shadows.md,
          overflow: 'hidden',
        };
      case 'inset':
        return {
          backgroundColor: theme.colors.white,
          marginHorizontal: theme.spacing[4],
          borderRadius: theme.borderRadius.xl,
          ...theme.shadows.sm,
          overflow: 'hidden',
        };
      default:
        return {
          backgroundColor: theme.colors.white,
        };
    }
  };

  const _variantStyles = getVariantStyles()

  // Add dividers between children if showDividers is true
  const childrenWithDividers = React.Children.map(__children, (__child, _index) => {
    const isLastChild = index === React.Children.count(__children) - 1;

    return (
      <React.Fragment key={index}>
        {child}
        {showDividers && !isLastChild && <View style={styles.divider} />}
      </React.Fragment>
    )
  })

  return (
    <View style={[styles.list, _variantStyles, style]} testID={testID}>
      {childrenWithDividers}
    </View>
  )
};

const createStyles = (theme: _Theme) =>
  StyleSheet.create({
    // placeholder styles
    headerSub
  })

export default List;
