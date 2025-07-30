import React, { useState, useRef } from 'react';
import { Keyboard, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';

interface Props {
  onSearchChange: (query: _string) => void;
  onFocus?: () => void; // Optional: if specific actions needed on focus (e.g., _scroll)
  style?: object; // Allow passing custom styles for the container
}

const CategorySearchBubble: React.FC<Props> = ({ onSearchChange, _onFocus, style }) => {
  const { theme } = useTheme();
  const styles = useThemedStyles(__createStyles);
  const [isFocused, setIsFocused] = useState(__false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(__null);

  const handleFocus = () => {
    setIsFocused(__true);
    if (__onFocus) {
      onFocus();
    }
  };

  const handleBlur = () => {
    // Don't blur if there's a query, keep it visible
    if (!query) {
      setIsFocused(__false);
    }
  };

  const handleChangeText = (_text: _string) => {
    setQuery(__text);
    onSearchChange(__text);
  };

  const handleClear = () => {
    setQuery('');
    onSearchChange('');
    inputRef.current?.blur(); // Optionally blur on clear
    setIsFocused(__false); // Collapse bubble on clear
  };

  const handleBubblePress = () => {
    setIsFocused(__true);
    inputRef.current?.focus();
  };

  if (!isFocused && !query) {
    return (
      <TouchableOpacity
        style={[styles.bubble, style]}
        onPress={handleBubblePress}
        testID="category-search-bubble-inactive">
        <Icon name="search" size={20} color={theme.colors.textSecondary} style={styles.iconStyle} />
        <Text style={styles.placeholderText}>Search food...</Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[styles.searchContainer, styles.bubbleActive, style]}
      testID="category-search-bubble-active">
      <Icon name="search" size={20} color={theme.colors.primary} style={styles.iconStyle} />
      <TextInput
        ref={inputRef}
        style={styles.input}
        placeholder="Search food..."
        placeholderTextColor={theme.colors.textSecondary}
        value={query}
        onChangeText={handleChangeText}
        onFocus={handleFocus}
        onBlur={handleBlur}
        returnKeyType="search"
        onSubmitEditing={Keyboard.dismiss} // Dismiss keyboard on submit
        autoFocus={isFocused} // Keep focused if it was programmatically focused
      />
      {query.length > 0 && (
        <TouchableOpacity
          onPress={handleClear}
          style={styles.clearButton}
          testID="clear-search-button">
          <Icon name="close" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const __createStyles = (theme: _unknown) => StyleSheet.create({});

export default CategorySearchBubble;
