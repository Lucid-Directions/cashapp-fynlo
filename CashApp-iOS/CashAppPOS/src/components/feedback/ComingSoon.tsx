import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

import Colors from '../../constants/Colors'; // Assuming Colors are centralized

const ComingSoon: React.FC = () => {
  return (
    <View style={styles.container}>
      <Icon name="hourglass-empty" size={64} color={Colors.primary} />
      <Text style={styles.title}>Coming Soon!</Text>
      <Text style={styles.message}>This feature is currently under development.</Text>
      <Text style={styles.message}>Please check back later.</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    padding: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginTop: 20,
    marginBottom: 10,
  },
  message: {
    fontSize: 16,
    color: Colors.darkGray,
    textAlign: 'center',
    marginBottom: 5,
  },
});

export default ComingSoon;
