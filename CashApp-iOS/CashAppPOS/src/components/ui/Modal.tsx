import React, { useEffect, useRef } from 'react';
import type { ViewStyle } from 'react-native';
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
  ScrollView,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import type { Theme } from '../../design-system/theme';
import { useTheme } from '../../design-system/ThemeProvider';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

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
  const slideAnim = useRef(new Animated.Value(0)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      Animated.parallel([
        Animated.timing(slideAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 0,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  // Get size styles
  const getSizeStyles = (): ViewStyle => {
    switch (size) {
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
          width: screenWidth,
          height: screenHeight,
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
      opacity: opacityAnim,
    };
  };

  const sizeStyles = getSizeStyles();

  const modalContentStyle: ViewStyle = [
    styles.modalContent,
    {
      backgroundColor: theme.colors.white,
      borderRadius: theme.borderRadius['2xl'],
      ...theme.shadows.xl,
    },
    sizeStyles,
    position === 'bottom' && styles.bottomModal,
    position === 'top' && styles.topModal,
    size === 'full' && styles.fullModal,
    style,
  ].filter(Boolean) as ViewStyle;

  const handleBackdropPress = () => {
    if (dismissOnBackdrop && closable) {
      onClose();
    }
  };

  const ContentComponent = scrollable ? ScrollView : View;
  const contentProps = scrollable
    ? {
        showsVerticalScrollIndicator: false,
        contentContainerStyle: [styles.scrollContent, { padding: theme.spacing[6] }],
      }
    : { style: [styles.content, { padding: theme.spacing[6] }] };

  return (
    <RNModal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        style={styles.container}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <TouchableWithoutFeedback onPress={handleBackdropPress}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        <Animated.View style={[modalContentStyle, getPositionTransform()]}>
          {/* Header */}
          {(title || closable) && (
            <View
              style={[
                styles.header,
                {
                  paddingHorizontal: theme.spacing[6],
                  paddingVertical: theme.spacing[4],
                  borderBottomColor: theme.colors.neutral[100],
                },
              ]}
            >
              {title && (
                <Text
                  style={[
                    styles.title,
                    {
                      fontSize: theme.typography.fontSize.lg,
                      fontWeight: theme.typography.fontWeight.semibold,
                      color: theme.colors.text,
                      marginRight: theme.spacing[4],
                    },
                  ]}
                  numberOfLines={1}
                >
                  {title}
                </Text>
              )}
              {closable && (
                <TouchableOpacity
                  style={[styles.closeButton, { padding: theme.spacing[1] }]}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Icon name="close" size={24} color={theme.colors.neutral[600]} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Body */}
          <ContentComponent {...contentProps}>{children}</ContentComponent>

          {/* Footer */}
          {footer && (
            <View
              style={[
                styles.footer,
                {
                  paddingHorizontal: theme.spacing[6],
                  paddingVertical: theme.spacing[4],
                  borderTopColor: theme.colors.neutral[100],
                },
              ]}
            >
              {footer}
            </View>
          )}
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
  variant = 'secondary',
  disabled = false,
  style,
}) => {
  const { theme } = useTheme();

  const getVariantStyle = (): ViewStyle => {
    switch (variant) {
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

  const getTextStyle = () => {
    switch (variant) {
      case 'primary':
      case 'danger':
        return { color: theme.colors.white };
      default:
        return { color: theme.colors.text };
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.actionButton,
        {
          paddingHorizontal: theme.spacing[4],
          paddingVertical: theme.spacing[3],
          borderRadius: theme.borderRadius.lg,
        },
        getVariantStyle(),
        disabled && styles.disabledAction,
        style,
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text
        style={[
          styles.actionText,
          {
            fontSize: theme.typography.fontSize.base,
            fontWeight: theme.typography.fontWeight.medium,
          },
          getTextStyle(),
        ]}
      >
        {children}
      </Text>
    </TouchableOpacity>
  );
};

// Modal Actions Container
export interface ModalActionsProps {
  children: React.ReactNode;
  style?: ViewStyle;
}

export const ModalActions: React.FC<ModalActionsProps> = ({ children, style }) => {
  const { theme } = useTheme();

  return <View style={[styles.actions, { gap: theme.spacing[3] }, style]}>{children}</View>;
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    overflow: 'hidden',
  },
  bottomModal: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    width: screenWidth,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
  },
  topModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    width: screenWidth,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },
  fullModal: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 0,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
  },
  title: {
    flex: 1,
  },
  closeButton: {
    // Theme styles will be applied inline
  },
  content: {
    // Theme styles will be applied inline
  },
  scrollContent: {
    // Theme styles will be applied inline
  },
  footer: {
    borderTopWidth: 1,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  actionButton: {
    minWidth: 80,
    alignItems: 'center',
  },
  actionText: {
    // Theme styles will be applied inline
  },

  disabledAction: {
    opacity: 0.5,
  },
});

export default Modal;
