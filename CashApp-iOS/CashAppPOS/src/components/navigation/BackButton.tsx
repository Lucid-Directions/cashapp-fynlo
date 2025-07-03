import React from 'react';
import { TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import Colors from '../../constants/Colors';

interface BackButtonProps {
  onPress?: () => void;
  color?: string;
  size?: number;
  style?: any;
  backgroundColor?: string;
}

const BackButton: React.FC<BackButtonProps> = ({
  onPress,
  color = Colors.white,
  size = 24,
  style,
  backgroundColor = 'rgba(255, 255, 255, 0.1)',
}) => {
  const navigation = useNavigation();

  const handlePress = () => {
    try {
      if (onPress) {
        onPress();
      } else {
        // Add debugging
        console.log('BackButton: Attempting to go back...');
        
        if (navigation.canGoBack()) {
          navigation.goBack();
          console.log('BackButton: Successfully navigated back');
        } else {
          console.warn('BackButton: Cannot go back, navigation stack may be empty');
          Alert.alert(
            'Navigation Error',
            'Cannot go back. Please use the menu to navigate.',
            [{ text: 'OK' }]
          );
        }
      }
    } catch (error) {
      console.error('BackButton: Navigation error:', error);
      Alert.alert(
        'Navigation Error',
        'There was a problem navigating back. Please try again.',
        [{ text: 'OK' }]
      );
    }
  };

  return (
    <TouchableOpacity 
      style={[styles.backButton, { backgroundColor }, style]}
      onPress={handlePress}
      activeOpacity={0.7}
      accessibilityLabel="Go back"
      accessibilityRole="button"
    >
      <Icon name="arrow-back" size={size} color={color} />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  backButton: {
    padding: 12,
    marginRight: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

export default BackButton;