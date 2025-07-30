import React from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

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

interface SettingsCardProps {
  title: string;
  description?: string;
  icon?: string;
  iconColor?: string;
  value?: string;
  showChevron?: boolean;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string | number;
  style?: ViewStyle;
  children?: React.ReactNode;
}

const SettingsCard: React.FC<SettingsCardProps> = ({
  title,
  description,
  icon,
  iconColor = Colors.primary,
  value,
  showChevron = true,
  onPress,
  disabled = false,
  badge,
  style,
  children,
}) => {
  const cardContent = (
    <View style={[styles.container, disabled && styles.disabled, style]}>
      {/* Left side with icon */}
      {icon && (
        <View style={[styles.iconContainer, { backgroundColor: `${iconColor}15` }]}>
          <Icon name={icon} size={24} color={iconColor} />
        </View>
      )}

      {/* Main content */}
      <View style={styles.content}>
        <View style={styles.titleRow}>
          <Text style={[styles.title, disabled && styles.disabledText]}>{title}</Text>
          {badge && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge}</Text>
            </View>
          )}
        </View>

        {description && (
          <Text style={[styles.description, disabled && styles.disabledText]}>{description}</Text>
        )}

        {value && <Text style={[styles.value, disabled && styles.disabledText]}>{value}</Text>}

        {children}
      </View>

      {/* Right side with chevron or value */}
      {(showChevron || value) && (
        <View style={styles.rightSection}>
          {showChevron && onPress && (
            <Icon
              name="chevron-right"
              size={24}
              color={disabled ? Colors.lightGray : Colors.mediumGray}
            />
          )}
        </View>
      )}
    </View>
  );

  if (onPress && !disabled) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.7} style={styles.touchable}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return <View style={styles.touchable}>{cardContent}</View>;
};

const styles = StyleSheet.create({
  touchable: {
    marginBottom: 1, // Small gap between cards
  },
  container: {
    backgroundColor: Colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    minHeight: 60,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 16,
  },
  content: {
    flex: 1,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text,
    flex: 1,
  },
  description: {
    fontSize: 14,
    color: Colors.lightText,
    marginTop: 2,
    lineHeight: 20,
  },
  value: {
    fontSize: 14,
    color: Colors.primary,
    marginTop: 4,
    fontWeight: '500',
  },
  disabledText: {
    color: Colors.lightGray,
  },
  rightSection: {
    marginLeft: 16,
    justifyContent: 'center',
  },
  badge: {
    backgroundColor: Colors.danger,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginLeft: 8,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.white,
  },
});

export default SettingsCard;
