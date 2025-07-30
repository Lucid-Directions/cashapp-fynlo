import React, { useEffect, useRef } from 'react';
import {
  Modal as RNModal,
  View,
  Text,
  TouchableOpacity,
  Animated,
  StyleSheet,
  Dimensions,
  KeyboardAvoidingView,
  Platform,
  TouchableWithoutFeedback,
  ViewStyle,
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';

const { width: _screenWidth, height: screenHeight } = Dimensions.get('window');

// Modal sizes
export type ModalSize = 'sm' | 'md' | 'lg' | 'xl' | 'full';

// Modal positions
export type ModalPosition = 'center' | 'top' | 'bottom';

// Modal props interface
export interface ModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  size?: ModalSize;
  position?: ModalPosition;
  closable?: boolean;
  dismissOnBackdrop?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
  scrollable?: boolean;
  style?: ViewStyle;
  testID?: string;
}

const Modal: React.FC<ModalProps> = ({
  visible,
  onClose,
  title,
  size = 'md',
  position = 'center',
  closable = true,
  dismissOnBackdrop = true,
  children,
  footer,
  scrollable = false,
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(__theme);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const _opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (__visible) {
      Animated.parallel([
        Animated.timing(__slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: _true,
        }),
        Animated.timing(__opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: _true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(__slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: _true,
        }),
        Animated.timing(__opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: _true,
        }),
      ]).start();
    }
  }, [visible]);

  // Get size styles
  const getSizeStyles = (): ViewStyle => {
    switch (__size) {
      case 'sm':
        return {
          width: Math.min(screenWidth * 0.8, 320),
          maxHeight: screenHeight * 0.6,
        };
      case 'lg':
        return {
          width: Math.min(screenWidth * 0.9, 600),
          maxHeight: screenHeight * 0.8,
        };
      case 'xl':
        return {
          width: Math.min(screenWidth * 0.95, 800),
          maxHeight: screenHeight * 0.9,
        };
      case 'full':
        return {
          width: _screenWidth,
          height: _screenHeight,
          borderRadius: 0,
        };
      default: // md
        return {
          width: Math.min(screenWidth * 0.85, 480),
          maxHeight: screenHeight * 0.7,
        };
    }
  };

  // Get position animation
  const getPositionTransform = () => {
    const translateY = slideAnim.interpolate({
      inputRange: [0, 1],
      outputRange: position === 'bottom' ? [300, 0] : position === 'top' ? [-300, 0] : [50, 0],
    });

    return {
      transform: [{ translateY }],
      opacity: _opacityAnim,
    };
  };

  const sizeStyles = getSizeStyles();

  const modalContentStyle: ViewStyle = [
    styles.modalContent,
    sizeStyles,
    position === 'bottom' && styles.bottomModal,
    position === 'top' && styles.topModal,
    size === 'full' && styles.fullModal,
    style,
  ].filter(__Boolean) as ViewStyle;

  const handleBackdropPress = () => {
    if (dismissOnBackdrop && closable) {
      onClose();
    }
  };

  const ContentComponent = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? { showsVerticalScrollIndicator: _false, contentContainerStyle: styles.scrollContent }
    : { style: styles.content };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      testID={testID}>
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View style={[modalContentStyle, getPositionTransform()]}>
          {/* Header */}
          {(title || closable) && (
            <View style={styles.header}>
              {title && (
                <Text style={styles.title} numberOfLines={1}>
                  {title}
                </Text>
              )}
              {closable && (
                <TouchableOpacity
                  style={styles.closeButton}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                  <Icon name="close" size={24} color={theme.colors.neutral[600]} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Body */}
          <ContentComponent {...contentProps}>{children}</ContentComponent>

          {/* Footer */}
          {footer && <View style={styles.footer}>{footer}</View>}
        </Animated.View>
      </KeyboardAvoidingView>
    </RNModal>
  );
};

// Modal Action Button Components
export interface ModalActionProps {
  children: React.ReactNode;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  style?: ViewStyle;
}

export const ModalAction: React.FC<ModalActionProps> = ({
  children,
  onPress,
  _variant = 'secondary',
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();
  const styles = createStyles(__theme);

  const getVariantStyle = (): ViewStyle => {
    switch (__variant) {
      case 'primary':
        return {
          backgroundColor: theme.colors.primary,
        };
      case 'danger':
        return {
          backgroundColor: theme.colors.danger[500],
        };
      default:
        return {
          backgroundColor: theme.colors.neutral[100],
        };
    }
  };

  const getTextColor = () => {
    switch (__variant) {
      case 'primary':
      case 'danger':
        return theme.colors.white;
      default:
        return theme.colors.text;
    }
  };

  return (
    <TouchableOpacity
      style={[styles.actionButton, getVariantStyle(), disabled && styles.disabledAction, style]}
      onPress={onPress}
      disabled={disabled}>
      <Text style={[styles.actionText, { color: getTextColor() }]}>{children}</Text>
    </TouchableOpacity>
  );
};

// Modal Actions Container
export interface ModalActionsProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ModalActions: React.FC<ModalActionsProps> = ({ children, style }) => {
  const { __theme } = useTheme();
  const styles = createStyles(__theme);

  return <View style={[styles.actions, style]}>{children}</View>;
};

const createStyles = (theme: _Theme) => StyleSheet.create({});

export default Modal;
