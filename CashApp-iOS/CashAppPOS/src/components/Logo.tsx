import React from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { Image, StyleSheet, View, Text, Platform } from 'react-native';

import { logger } from '../utils/logger';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  textStyle?: TextStyle;
}

const Colors = {
  primary: '#00A651', // Clover Green
  secondary: '#0066CC', // Clover Blue
  accent: '#FF6B35', // Orange accent
  gold: '#F39C12', // Professional orange
  lightText: '#666666', // Medium gray
  white: '#FFFFFF',
  // Fynlo brand colors
  fynloBlue: '#1E3A8A', // Deep blue like in the logo
  fynloOrange: '#F97316', // Orange for the 'o'
};

const Logo: React.FC<LogoProps> = ({
  size = 'medium',
  showText = true,
  style,
  imageStyle,
  textStyle,
}) => {
  const [imageError, setImageError] = React.useState(false);
  
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          width: 60,
          height: 60,
          fontSize: 20,
          subFontSize: 12,
        };
      case 'large':
        return {
          width: 180,
          height: 180,
          fontSize: 56,
          subFontSize: 16,
        };
      case 'medium':
      default:
        return {
          width: 120,
          height: 120,
          fontSize: 32,
          subFontSize: 14,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Use the actual Fynlo logo image - require() happens at build time
  // If the image doesn't exist, the build will fail, so no try-catch needed
  const logoSource = !imageError ? require('../assets/fynlo-logo.png') : null;

  return (
    <View style={[styles.container, style]}>
      {logoSource ? (
        <Image
          source={logoSource}
          style={[
            styles.logoImage,
            {
              width: sizeStyles.width,
              height: sizeStyles.height,
            },
            imageStyle,
          ]}
          resizeMode="contain"
          onError={() => {
            logger.info('Logo image failed to load, falling back to text');
            setImageError(true);
          }}
        />
      ) : (
        // Fallback to text if image fails to load
        <View style={styles.logoTextContainer}>
          <Text style={[styles.logoMainText, { fontSize: sizeStyles.fontSize }]}>
            fynl
            <Text style={[styles.logoMainText, styles.orangeO, { fontSize: sizeStyles.fontSize }]}>
              o
            </Text>
          </Text>
        </View>
      )}
      {/* Don't show text below logo since the image already contains the text */}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  logoImage: {
    marginBottom: 8,
  },
  logoTextContainer: {
    alignItems: 'center',
    marginBottom: 4,
  },
  logoMainText: {
    fontWeight: '700',
    color: Colors.fynloBlue,
    letterSpacing: -2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  textContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontWeight: '700',
    color: Colors.fynloBlue,
    letterSpacing: -2,
    fontFamily: Platform.OS === 'ios' ? 'System' : 'Roboto',
  },
  logoSubtext: {
    color: Colors.lightText,
    marginTop: 4,
    letterSpacing: 0.5,
  },
  orangeO: {
    color: Colors.fynloOrange, // Orange color for the "o" in fynlo
  },
});

export default Logo;
