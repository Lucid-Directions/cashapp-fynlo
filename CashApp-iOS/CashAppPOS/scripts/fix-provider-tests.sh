#!/bin/bash

echo "🔧 Fixing Component Tests with Provider Issues"
echo "============================================="
echo ""

# Create a comprehensive test wrapper utility
cat > src/__tests__/utils/testWrapper.tsx << 'EOF'
import React from 'react';
import { render, RenderOptions } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { ThemeProvider } from '../../design-system/ThemeProvider';
import { AuthProvider } from '../../contexts/AuthContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Mock navigation
const mockNavigation = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  dispatch: jest.fn(),
  setOptions: jest.fn(),
  addListener: jest.fn(),
  removeListener: jest.fn(),
};

// Mock route
const mockRoute = {
  params: {},
  name: 'TestScreen',
};

interface CustomRenderOptions extends Omit<RenderOptions, 'wrapper'> {
  initialAuth?: any;
  initialRoute?: any;
  navigation?: any;
}

const AllTheProviders = ({ children, auth, navigation, route }: any) => {
  return (
    <SafeAreaProvider>
      <NavigationContainer>
        <ThemeProvider>
          <AuthProvider value={auth}>
            {React.cloneElement(children, { navigation, route })}
          </AuthProvider>
        </ThemeProvider>
      </NavigationContainer>
    </SafeAreaProvider>
  );
};

export function renderWithAllProviders(
  ui: React.ReactElement,
  options?: CustomRenderOptions
) {
  const auth = options?.initialAuth || {
    isAuthenticated: true,
    user: { id: '1', email: 'test@test.com' },
    login: jest.fn(),
    logout: jest.fn(),
    isLoading: false,
  };

  const navigation = options?.navigation || mockNavigation;
  const route = options?.initialRoute || mockRoute;

  return render(ui, {
    wrapper: ({ children }) => (
      <AllTheProviders auth={auth} navigation={navigation} route={route}>
        {children}
      </AllTheProviders>
    ),
    ...options,
  });
}

export * from '@testing-library/react-native';
export { mockNavigation, mockRoute };
EOF

echo "✅ Created comprehensive test wrapper"
echo ""

# Fix all screen tests
echo "📱 Fixing Screen Tests..."
find src/screens -name "*.test.tsx" | while read file; do
  echo "  Fixing: $file"
  
  # Check if it needs fixing
  if grep -q "render(" "$file" && ! grep -q "renderWith" "$file"; then
    # Add import
    IMPORT_LINE=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
    if [ ! -z "$IMPORT_LINE" ]; then
      sed -i '' "${IMPORT_LINE}a\\
import { renderWithAllProviders, mockNavigation, mockRoute } from '@/src/__tests__/utils/testWrapper';
" "$file"
    fi
    
    # Replace render calls
    sed -i '' 's/render(/renderWithAllProviders(/g' "$file"
    
    # Fix navigation prop issues
    sed -i '' 's/<\([A-Za-z]*Screen\) \/>/<\1 navigation={mockNavigation} route={mockRoute} \/>/g' "$file"
  fi
done

echo ""

# Fix all component tests
echo "🧩 Fixing Component Tests..."
find src/components -name "*.test.tsx" | while read file; do
  echo "  Fixing: $file"
  
  # For components that don't need navigation
  if grep -q "render(" "$file" && ! grep -q "renderWith" "$file"; then
    # Check if component uses navigation/theme
    if grep -q "useNavigation\|useTheme" "$file"; then
      # Use full provider wrapper
      IMPORT_LINE=$(grep -n "^import" "$file" | tail -1 | cut -d: -f1)
      if [ ! -z "$IMPORT_LINE" ]; then
        sed -i '' "${IMPORT_LINE}a\\
import { renderWithAllProviders } from '@/src/__tests__/utils/testWrapper';
" "$file"
      fi
      sed -i '' 's/render(/renderWithAllProviders(/g' "$file"
    fi
  fi
done

echo ""
echo "✅ Provider fixes applied!"
echo ""
echo "Run 'npm test' to see improvements"