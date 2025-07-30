import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ViewStyle,
  GestureResponderEvent,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';
import { Theme } from '../../design-system/theme';

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
  const styles = createStyles(theme);

  const Component = onPress ? TouchableOpacity : View;

  return (
    <Component
      style={[styles.listItem, disabled && styles.listItemDisabled, style]}
      onPress={onPress}
      disabled={disabled}
      activeOpacity={onPress ? 0.7 : 1}
      testID={testID}>
      {/* Left Content */}
      <View style={styles.leftSection}>
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
  const styles = createStyles(theme);

  return (
    <View style={[styles.listHeader, style]}>
      <View style={styles.headerMainContent}>
        <Text style={styles.headerTitle}>{title}</Text>
        {subtitle && <Text style={styles.headerSubtitle}>{subtitle}</Text>}
      </View>
      {rightContent && <View style={styles.headerRightContent}>{rightContent}</View>}
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
  const styles = createStyles(theme);

  return (
    <View style={[styles.listSection, style]}>
      {header && <Text style={styles.sectionHeader}>{header}</Text>}
      <View style={styles.sectionContent}>{children}</View>
      {footer && <Text style={styles.sectionFooter}>{footer}</Text>}
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
  const styles = createStyles(theme);

  const getVariantStyles = (): ViewStyle => {
    switch (variant) {
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

  const variantStyles = getVariantStyles();

  // Add dividers between children if showDividers is true
  const childrenWithDividers = React.Children.map(children, (child, index) => {
    const isLastChild = index === React.Children.count(children) - 1;

    return (
      <React.Fragment key={index}>
        {child}
        {showDividers && !isLastChild && <View style={styles.divider} />}
      </React.Fragment>
    );
  });

  return (
    <View style={[styles.list, variantStyles, style]} testID={testID}>
      {childrenWithDividers}
    </View>
  );
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    list: {
      // Base list styles
    },
    listItem: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[3],
      minHeight: 56,
    },
    listItemDisabled: {
      opacity: 0.5,
    },
    leftSection: {
      marginRight: theme.spacing[3],
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
      fontSize: theme.typography.fontSize.base,
      fontWeight: theme.typography.fontWeight.medium,
      color: theme.colors.text,
      lineHeight: theme.typography.lineHeight.tight * theme.typography.fontSize.base,
    },
    titleDisabled: {
      color: theme.colors.neutral[400],
    },
    subtitle: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[600],
      marginTop: theme.spacing[1],
      lineHeight: theme.typography.lineHeight.tight * theme.typography.fontSize.sm,
    },
    subtitleDisabled: {
      color: theme.colors.neutral[300],
    },
    description: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[500],
      marginTop: theme.spacing[1],
      lineHeight: theme.typography.lineHeight.normal * theme.typography.fontSize.sm,
    },
    descriptionDisabled: {
      color: theme.colors.neutral[300],
    },
    rightSection: {
      marginLeft: theme.spacing[3],
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
      backgroundColor: theme.colors.neutral[100],
      marginLeft: theme.spacing[4] + 32 + theme.spacing[3], // Align with main content
    },
    listHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[4],
      backgroundColor: theme.colors.neutral[50],
    },
    headerMainContent: {
      flex: 1,
    },
    headerTitle: {
      fontSize: theme.typography.fontSize.lg,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.text,
    },
    headerSubtitle: {
      fontSize: theme.typography.fontSize.sm,
      color: theme.colors.neutral[600],
      marginTop: theme.spacing[1],
    },
    headerRightContent: {
      marginLeft: theme.spacing[4],
    },
    listSection: {
      marginVertical: theme.spacing[2],
    },
    sectionHeader: {
      fontSize: theme.typography.fontSize.sm,
      fontWeight: theme.typography.fontWeight.semibold,
      color: theme.colors.neutral[600],
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[2],
      backgroundColor: theme.colors.neutral[50],
    },
    sectionContent: {
      backgroundColor: theme.colors.white,
    },
    sectionFooter: {
      fontSize: theme.typography.fontSize.xs,
      color: theme.colors.neutral[500],
      paddingHorizontal: theme.spacing[4],
      paddingVertical: theme.spacing[2],
      backgroundColor: theme.colors.neutral[50],
    },
  });

export default List;
