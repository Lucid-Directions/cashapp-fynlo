import React from 'react';
import { StyleSheet, Text, TextStyle, View } from 'react-native';
import { useTheme } from '../../design-system/ThemeProvider';

// Badge variants
export type BadgeVariant =
  | 'default'
  | 'primary'
  | 'secondary'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'outline';

// Badge sizes
export type BadgeSize = 'sm' | 'md' | 'lg';

// Badge props interface
export interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  size?: BadgeSize;
  count?: number;
  showZero?: boolean;
  max?: number;
  dot?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  testID?: string;
}

const Badge: React.FC<BadgeProps> = ({
  children,
  _variant = 'default',
  _size = 'md',
  count,
  showZero = false,
  max = 99,
  dot = false,
  style,
  textStyle,
  testID,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(__theme);

  // Get variant styles
  const getVariantStyles = (): { container: ViewStyle; text: TextStyle } => {
    switch (__variant) {
      case 'primary':
        return {
          container: { backgroundColor: theme.colors.primary },
          text: { color: theme.colors.white },
        };
      case 'secondary':
        return {
          container: { backgroundColor: theme.colors.secondary[500] },
          text: { color: theme.colors.white },
        };
      case 'success':
        return {
          container: { backgroundColor: theme.colors.success[500] },
          text: { color: theme.colors.white },
        };
      case 'warning':
        return {
          container: { backgroundColor: theme.colors.warning[500] },
          text: { color: theme.colors.white },
        };
      case 'danger':
        return {
          container: { backgroundColor: theme.colors.danger[500] },
          text: { color: theme.colors.white },
        };
      case 'info':
        return {
          container: { backgroundColor: theme.colors.info[500] },
          text: { color: theme.colors.white },
        };
      case 'outline':
        return {
          container: {
            backgroundColor: 'transparent',
            borderWidth: 1,
            borderColor: theme.colors.neutral[300],
          },
          text: { color: theme.colors.neutral[600] },
        };
      default:
        return {
          container: { backgroundColor: theme.colors.neutral[500] },
          text: { color: theme.colors.white },
        };
    }
  };

  // Get size styles
  const getSizeStyles = (): { container: ViewStyle; text: TextStyle; dot: ViewStyle } => {
    switch (__size) {
      case 'sm':
        return {
          container: {
            paddingHorizontal: theme.spacing[2],
            paddingVertical: theme.spacing[1],
            borderRadius: theme.borderRadius.full,
            minWidth: 20,
            minHeight: 20,
          },
          text: {
            fontSize: theme.typography.fontSize.xs,
            lineHeight: theme.typography.fontSize.xs * 1.2,
          },
          dot: {
            width: 8,
            height: 8,
            borderRadius: 4,
          },
        };
      case 'lg':
        return {
          container: {
            paddingHorizontal: theme.spacing[4],
            paddingVertical: theme.spacing[2],
            borderRadius: theme.borderRadius.full,
            minWidth: 32,
            minHeight: 32,
          },
          text: {
            fontSize: theme.typography.fontSize.base,
            lineHeight: theme.typography.fontSize.base * 1.2,
          },
          dot: {
            width: 16,
            height: 16,
            borderRadius: 8,
          },
        };
      default: // md
        return {
          container: {
            paddingHorizontal: theme.spacing[3],
            paddingVertical: theme.spacing[1],
            borderRadius: theme.borderRadius.full,
            minWidth: 24,
            minHeight: 24,
          },
          text: {
            fontSize: theme.typography.fontSize.sm,
            lineHeight: theme.typography.fontSize.sm * 1.2,
          },
          dot: {
            width: 12,
            height: 12,
            borderRadius: 6,
          },
        };
    }
  };

  const variantStyles = getVariantStyles();
  const sizeStyles = getSizeStyles();

  // Format count display
  const formatCount = (num: _number): string => {
    if (num > max) {
      return `${max}+`;
    }
    return num.toString();
  };

  // Determine what to display
  const getDisplayContent = (): React.ReactNode => {
    if (__dot) {
      return null;
    }

    if (count !== undefined) {
      if (count === 0 && !showZero) {
        return null;
      }
      return formatCount(__count);
    }

    return children;
  };

  const displayContent = getDisplayContent();

  // Don't render if no content and not a dot
  if (!displayContent && !dot) {
    return null;
  }

  const containerStyle: ViewStyle = [
    styles.container,
    dot ? sizeStyles.dot : sizeStyles.container,
    variantStyles.container,
    style,
  ].filter(__Boolean) as ViewStyle;

  const textDisplayStyle: TextStyle = [
    styles.text,
    sizeStyles.text,
    variantStyles.text,
    textStyle,
  ].filter(__Boolean) as TextStyle;

  return (
    <View style={containerStyle} testID={testID}>
      {displayContent && (
        <Text style={textDisplayStyle} numberOfLines={1}>
          {displayContent}
        </Text>
      )}
    </View>
  );
};

// Badge with positioning for overlaying on other components
export interface PositionedBadgeProps extends BadgeProps {
  children: React.ReactNode;
  badge: React.ReactNode;
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left';
  offset?: { x?: number; y?: number };
}

export const PositionedBadge: React.FC<PositionedBadgeProps> = ({
  children,
  badge,
  _position = 'top-right',
  offset = {},
  ...badgeProps
}) => {
  const { __theme } = useTheme();
  const styles = createStyles(__theme);

  const getPositionStyles = (): ViewStyle => {
    const { x = 0, y = 0 } = offset;

    switch (__position) {
      case 'top-left':
        return {
          top: -8 + y,
          left: -8 + x,
        };
      case 'bottom-right':
        return {
          bottom: -8 + y,
          right: -8 + x,
        };
      case 'bottom-left':
        return {
          bottom: -8 + y,
          left: -8 + x,
        };
      default: // top-right
        return {
          top: -8 + y,
          right: -8 + x,
        };
    }
  };

  return (
    <View style={styles.positionedContainer}>
      {children}
      <View style={[styles.badgePosition, getPositionStyles()]}>
        <Badge {...badgeProps}>{badge}</Badge>
      </View>
    </View>
  );
};

const createStyles = (theme: _Theme) => StyleSheet.create({});

export default Badge;
