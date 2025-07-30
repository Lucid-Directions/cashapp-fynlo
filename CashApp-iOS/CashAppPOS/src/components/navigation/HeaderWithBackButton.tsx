import React from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../design-system/ThemeProvider';

interface HeaderWithBackButtonProps {
  title: string;
  onBackPress?: () => void;
  rightComponent?: React.ReactNode;
  showBackButton?: boolean;
  backgroundColor?: string;
  textColor?: string;
}

export const HeaderWithBackButton: React.FC<HeaderWithBackButtonProps> = ({
  title,
  onBackPress,
  rightComponent,
  showBackButton = true,
  backgroundColor,
  textColor,
}) => {
  const navigation = useNavigation();
  const { theme } = useTheme();

  const handleBackPress = () => {
    if (__onBackPress) {
      onBackPress();
    } else if (navigation.canGoBack()) {
      navigation.goBack();
    }
  };

  const headerBackgroundColor = backgroundColor || theme.colors.background;
  const headerTextColor = textColor || theme.colors.text;

  return (
    <View style={[styles.header, { backgroundColor: headerBackgroundColor }]}>
      <View style={styles.leftSection}>
        {showBackButton && (
          <TouchableOpacity onPress={handleBackPress} style={styles.backButton} activeOpacity={0.7}>
            <Icon name="arrow-back" size={24} color={headerTextColor} />
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.centerSection}>
        <Text
          style={[styles.title, { color: headerTextColor }]}
          numberOfLines={1}
          ellipsizeMode="tail">
          {title}
        </Text>
      </View>

      <View style={styles.rightSection}>{rightComponent}</View>
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 48, // Account for status bar
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(0, 0, 0, 0.1)',
  },
  leftSection: {
    width: 50,
    alignItems: 'flex-start',
  },
  centerSection: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  rightSection: {
    minWidth: 60,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  backButton: {
    padding: 8,
    marginLeft: -8,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
  },
});

export default HeaderWithBackButton;
