import React, { useState, useEffect, ReactNode } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

// Clover POS Color Scheme
const Colors = {
  primary: '#00A651',
  background: '#F5F5F5',
  white: '#FFFFFF',
};

interface LazyLoadingWrapperProps {
  children: ReactNode;
  delay?: number;
  placeholder?: ReactNode;
  condition?: boolean;
}

const LazyLoadingWrapper: React.FC<LazyLoadingWrapperProps> = ({
  children,
  delay = 100,
  placeholder,
  condition = true,
}) => {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (condition) {
      const timer = setTimeout(() => {
        setIsLoaded(true);
      }, delay);

      return () => clearTimeout(timer);
    }
  }, [delay, condition]);

  if (!condition || !isLoaded) {
    return (
      placeholder || (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color={Colors.primary} />
        </View>
      )
    );
  }

  return <>{children}</>;
};

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    minHeight: 100,
  },
});

export default LazyLoadingWrapper;