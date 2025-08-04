import React, { useState, useRef } from 'react';

import { View, Text, TouchableOpacity, TextInput, StyleSheet, Keyboard } from 'react-native';

import Icon from 'react-native-vector-icons/MaterialIcons';

import { useTheme, useThemedStyles } from '../../design-system/ThemeProvider';

interface Props {
  onSearchChange: (query: string) => void;
  onFocus?: () => void; // Optional: if specific actions needed on focus (e.g., scroll)
  style?: object; // Allow passing custom styles for the container
}

const CategorySearchBubble: React.FC<Props> = ({ onSearchChange, onFocus, style }) => {
  const { theme } = useTheme();
  // Styles are now static - theme values applied inline where needed
  const [isFocused, setIsFocused] = useState(false);
  const [query, setQuery] = useState('');
  const inputRef = useRef<TextInput>(null);

  const handleFocus = () => {
    setIsFocused(true);
    if (onFocus) {
      onFocus();
    }
  };

  const handleBlur = () => {
    // Don't blur if there's a query, keep it visible
    if (!query) {
      setIsFocused(false);
    }
  };

  const handleChangeText = (text: string) => {
    setQuery(text);
    onSearchChange(text);
  };

  const handleClear = () => {
    setQuery('');
    onSearchChange('');
    inputRef.current?.blur(); // Optionally blur on clear
    setIsFocused(false); // Collapse bubble on clear
  };

  const handleBubblePress = () => {
    setIsFocused(true);
    inputRef.current?.focus();
  };

  if (!isFocused && !query) {
    return (
      <TouchableOpacity
        style={[
          styles.bubble,
          { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
          style,
        ]}
        onPress={handleBubblePress}
        testID="category-search-bubble-inactive"
      >
        <Icon name="search" size={20} color={theme.colors.textSecondary} style={styles.iconStyle} />
        <Text style={[styles.placeholderText, { color: theme.colors.textSecondary }]}>
          Search food...
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <View
      style={[
        styles.searchContainer,
        styles.bubbleActive,
        { backgroundColor: theme.colors.surface, borderColor: theme.colors.primary },
        style,
      ]}
      testID="category-search-bubble-active"
    >
      <Icon name="search" size={20} color={theme.colors.primary} style={styles.iconStyle} />
      <TextInput
        ref={inputRef}
        style={[styles.input, { color: theme.colors.text }]}
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
          testID="clear-search-button"
        >
          <Icon name="close" size={20} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  bubble: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginRight: 8,
    height: 44,
    borderWidth: 1,
  },
  bubbleActive: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 24,
    paddingVertical: 0,
    paddingHorizontal: 16,
    marginRight: 8,
    height: 44,
    borderWidth: 1,
  },
  searchContainer: {
    flex: 1, // Take available space in the category scroll view
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconStyle: {
    marginRight: 8,
  },
  placeholderText: {
    fontSize: 16,
    flex: 1,
  },
  input: {
    flex: 1,
    fontSize: 16,
    paddingVertical: 10,
    height: '100%',
  },
  clearButton: {
    padding: 4, // Make it easier to tap
    marginLeft: 8,
  },
});

export default CategorySearchBubble;
