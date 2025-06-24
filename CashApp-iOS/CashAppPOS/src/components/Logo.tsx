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
  primary: '#00A651',        // Clover Green
  secondary: '#0066CC',      // Clover Blue
  accent: '#FF6B35',         // Orange accent
  gold: '#F39C12',           // Professional orange
  lightText: '#666666',      // Medium gray
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
    logoSource = require('../assets/fynlo-logo.png');
  } catch (error) {
    console.log('Failed to load logo from src/assets folder');
    try {
      logoSource = require('../../assets/fynlo-logo.png');
    } catch (error2) {
      try {
        logoSource = require('../../../assets/fynlo-logo.png');
      } catch (error3) {
        console.log('Failed to load logo from all locations, using Fynlo text fallback');
        logoSource = null;
      }
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
        <View style={styles.logoTextContainer}>
          <Text style={[styles.logoMainText, { fontSize: sizeStyles.fontSize }]}>
            Fynl<Text style={[styles.logoMainText, styles.orangeO, { fontSize: sizeStyles.fontSize }]}>o</Text>
          </Text>
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
            Fynl<Text style={[styles.logoText, styles.orangeO, { fontSize: sizeStyles.fontSize }]}>o</Text>
          </Text>
          <Text
            style={[
              styles.logoSubtext,
              { fontSize: sizeStyles.subFontSize },
            ]}
          >
            Point of Sale
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
  logoTextContainer: {
    alignItems: 'center',
    marginBottom: 8,
  },
  logoMainText: {
    fontWeight: 'bold',
    color: Colors.primary,
    letterSpacing: -0.5,
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
  orangeO: {
    color: Colors.accent, // Orange color for the "o" in Fynlo
  },
});

export default Logo;