import React from 'react';
import { Text, StyleSheet, ActivityIndicator, SafeAreaView } from 'react-native';
import { useTheme } from '../../design-system/ThemeProvider';

interface LoadingViewProps {
  message?: string;
}

const LoadingView: React.FC<LoadingViewProps> = ({ message = 'Loading...' }) => {
  const { theme } = useTheme(); // Use theme if available

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <ActivityIndicator size="large" color={theme.colors.primary} />
      <Text style={[styles.loadingText, { color: theme.colors.text }]}>{message}</Text>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16, // Consider using getFontSize if used elsewhere
  },
});

export default LoadingView;
