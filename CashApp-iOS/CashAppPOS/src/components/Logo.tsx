import React from 'react';
import { Image, StyleSheet, View, Text, ImageStyle, TextStyle, ViewStyle, Platform } from 'react-native';

interface LogoProps {
  size?: 'small' | 'medium' | 'large';
  showText?: boolean;
  style?: ViewStyle;
  imageStyle?: ImageStyle;
  textStyle?: TextStyle;
}

const Colors = {
  primary: '#2C3E50',        // Professional dark blue-gray
  secondary: '#3498DB',      // Modern blue
  accent: '#E74C3C',         // Accent red
  gold: '#F39C12',           // Professional orange
  lightText: '#7F8C8D',      // Modern gray
  white: '#FFFFFF',
};

const Logo: React.FC<LogoProps> = ({
  size = 'medium',
  showText = true,
  style,
  imageStyle,
  textStyle,
}) => {
  const getSizeStyles = () => {
    switch (size) {
      case 'small':
        return {
          width: 40,
          height: 40,
          fontSize: 20,
          subFontSize: 12,
        };
      case 'large':
        return {
          width: 120,
          height: 120,
          fontSize: 48,
          subFontSize: 16,
        };
      case 'medium':
      default:
        return {
          width: 80,
          height: 80,
          fontSize: 32,
          subFontSize: 14,
        };
    }
  };

  const sizeStyles = getSizeStyles();

  // Try different approaches to load the logo
  let logoSource;
  try {
    logoSource = require('../../assets/fynlo-logo.png');
  } catch (error) {
    console.log('Failed to load logo from assets folder');
    try {
      logoSource = require('../../../assets/fynlo-logo.png');
    } catch (error2) {
      console.log('Failed to load logo from app assets, using fallback');
      logoSource = null;
    }
  }

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
          onError={() => console.log('Logo failed to load')}
        />
      ) : (
        <View
          style={[
            styles.logoFallback,
            {
              width: sizeStyles.width,
              height: sizeStyles.height,
            },
          ]}
        >
          <Text style={styles.logoFallbackText}>F</Text>
        </View>
      )}
      {showText && (
        <View style={styles.textContainer}>
          <Text
            style={[
              styles.logoText,
              { fontSize: sizeStyles.fontSize },
              textStyle,
            ]}
          >
            Fynlo
          </Text>
          <Text
            style={[
              styles.logoSubtext,
              { fontSize: sizeStyles.subFontSize },
            ]}
          >
            Payment Solutions
          </Text>
        </View>
      )}
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
  logoFallback: {
    backgroundColor: Colors.primary,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
    borderWidth: 1,
    borderColor: Colors.secondary,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  logoFallbackText: {
    color: Colors.white,
    fontWeight: 'bold',
    fontSize: 32,
  },
  textContainer: {
    alignItems: 'center',
  },
  logoText: {
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: -1,
  },
  logoSubtext: {
    color: Colors.lightText,
    marginTop: 4,
    letterSpacing: 0.5,
  },
});

export default Logo;