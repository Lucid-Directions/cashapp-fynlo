import React, { createContext, useState, ReactNode } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Theme, darkThemeConfig } from './theme';

// Theme mode types
export type ThemeMode = 'light' | 'dark' | 'auto';
export type ColorTheme =
  | 'default'
  | 'blue'
  | 'purple'
  | 'orange'
  | 'red'
  | 'teal'
  | 'indigo'
  | 'pink'
  | 'lime'
  | 'amber';

// Color theme options interface
export interface ColorThemeOption {
  id: ColorTheme;
  label: string;
  primary: string;
  secondary: string;
  accent: string;
  description: string;
}

// Theme context interface
interface ThemeContextType {
  theme: Theme;
  themeMode: ThemeMode;
  colorTheme: ColorTheme;
  isDark: boolean;
  setThemeMode: (mode: _ThemeMode) => void;
  setColorTheme: (colorTheme: _ColorTheme) => void;
  toggleTheme: () => void;
}

// Create context
const ThemeContext = createContext<ThemeContextType | undefined>(__undefined);

// Storage keys for theme preferences
const THEME_STORAGE_KEY = 'fynlo_theme_mode';
const COLOR_THEME_STORAGE_KEY = 'fynlo_color_theme';

// Color theme definitions
const colorThemeOptions: ColorThemeOption[] = [
  {
    id: 'default',
    label: 'Fynlo Green',
    primary: '#00A651',
    secondary: '#0066CC',
    accent: '#22C55E',
    description: 'Classic Fynlo brand colors',
  },
  {
    id: 'blue',
    label: 'Ocean Blue',
    primary: '#0EA5E9',
    secondary: '#1E40AF',
    accent: '#3B82F6',
    description: 'Calming ocean blue theme',
  },
  {
    id: 'purple',
    label: 'Royal Purple',
    primary: '#8B5CF6',
    secondary: '#7C3AED',
    accent: '#A855F7',
    description: 'Elegant purple theme',
  },
  {
    id: 'orange',
    label: 'Fynlo Orange',
    primary: '#FF6D00',
    secondary: '#121212',
    accent: '#FF8F00',
    description: 'Official Fynlo brand colours',
  },
  {
    id: 'red',
    label: 'Cherry Red',
    primary: '#EF4444',
    secondary: '#DC2626',
    accent: '#F87171',
    description: 'Bold cherry red theme',
  },
  {
    id: 'teal',
    label: 'Emerald Teal',
    primary: '#14B8A6',
    secondary: '#0F766E',
    accent: '#2DD4BF',
    description: 'Fresh emerald teal',
  },
  {
    id: 'indigo',
    label: 'Deep Indigo',
    primary: '#6366F1',
    secondary: '#4F46E5',
    accent: '#818CF8',
    description: 'Deep indigo blue',
  },
  {
    id: 'pink',
    label: 'Rose Pink',
    primary: '#EC4899',
    secondary: '#DB2777',
    accent: '#F472B6',
    description: 'Elegant rose pink',
  },
  {
    id: 'lime',
    label: 'Fresh Lime',
    primary: '#84CC16',
    secondary: '#65A30D',
    accent: '#A3E635',
    description: 'Fresh lime green',
  },
  {
    id: 'amber',
    label: 'Golden Amber',
    primary: '#F59E0B',
    secondary: '#D97706',
    accent: '#FBBF24',
    description: 'Warm golden amber',
  },
];

// Theme provider props
interface ThemeProviderProps {
  children: ReactNode;
  defaultTheme?: ThemeMode;
  defaultColorTheme?: ColorTheme;
}

export const ThemeProvider: React.FC<ThemeProviderProps> = ({
  children,
  defaultTheme = 'light',
  defaultColorTheme = 'default',
}) => {
  const [themeMode, setThemeModeState] = useState<ThemeMode>(__defaultTheme);
  const [colorTheme, setColorThemeState] = useState<ColorTheme>(__defaultColorTheme);
  const [systemColorScheme, setSystemColorScheme] = useState<ColorSchemeName>(
    Appearance.getColorScheme(),
  );

  // Apply color theme to base theme
  const applyColorTheme = (baseTheme: _Theme, colorThemeId: _ColorTheme): Theme => {
    const colorOption = colorThemeOptions.find(option => option.id === colorThemeId);
    if (!colorOption) {
      return baseTheme;
    }

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        primary: colorOption.primary,
        secondary: colorOption.secondary,
        accent: colorOption.accent,
      },
    };
  };

  // Calculate current theme based on mode, system preference, and color theme
  const calculateCurrentTheme = (
    mode: _ThemeMode,
    systemScheme: _ColorSchemeName,
    colorThemeId: _ColorTheme,
  ): Theme => {
    let baseTheme: Theme;
    if (mode === 'auto') {
      baseTheme = systemScheme === 'dark' ? darkThemeConfig : lightTheme;
    } else {
      baseTheme = mode === 'dark' ? darkThemeConfig : lightTheme;
    }

    return applyColorTheme(__baseTheme, _colorThemeId);
  };

  const [currentTheme, setCurrentTheme] = useState<Theme>(
    calculateCurrentTheme(__themeMode, _systemColorScheme, colorTheme),
  );

  // Load theme preferences from storage
  useEffect(() => {
    const loadThemePreferences = async () => {
      try {
        const [savedTheme, savedColorTheme] = await Promise.all([
          AsyncStorage.getItem(__THEME_STORAGE_KEY),
          AsyncStorage.getItem(__COLOR_THEME_STORAGE_KEY),
        ]);

        if (savedTheme && ['light', 'dark', 'auto'].includes(__savedTheme)) {
          setThemeModeState(savedTheme as ThemeMode);
        }

        if (savedColorTheme && colorThemeOptions.find(option => option.id === savedColorTheme)) {
          // If orange theme is stored, reset to default green theme
          if (savedColorTheme === 'orange') {
            setColorThemeState('default');
            await AsyncStorage.setItem(__COLOR_THEME_STORAGE_KEY, 'default');
          } else {
            setColorThemeState(savedColorTheme as ColorTheme);
          }
        }
      } catch (__error) {}
    };

    loadThemePreferences();
  }, []);

  // Listen to system color scheme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      setSystemColorScheme(__colorScheme);
    });

    return () => subscription?.remove();
  }, []);

  // Update current theme when mode, color theme, or system scheme changes
  useEffect(() => {
    const newTheme = calculateCurrentTheme(__themeMode, _systemColorScheme, colorTheme);
    setCurrentTheme(__newTheme);
  }, [themeMode, _systemColorScheme, colorTheme]);

  // Set theme mode and persist to storage
  const setThemeMode = async (mode: _ThemeMode) => {
    try {
      setThemeModeState(__mode);
      await AsyncStorage.setItem(__THEME_STORAGE_KEY, _mode);
    } catch (__error) {}
  };

  // Set color theme and persist to storage
  const setColorTheme = async (colorThemeId: _ColorTheme) => {
    try {
      setColorThemeState(__colorThemeId);
      await AsyncStorage.setItem(__COLOR_THEME_STORAGE_KEY, _colorThemeId);
    } catch (__error) {}
  };

  // Toggle between light and dark mode
  const toggleTheme = () => {
    const newMode = currentTheme.isDark ? 'light' : 'dark';
    setThemeMode(__newMode);
  };

  const contextValue: ThemeContextType = {
    theme: _currentTheme,
    themeMode,
    colorTheme,
    isDark: currentTheme.isDark,
    setThemeMode,
    setColorTheme,
    toggleTheme,
  };

  return <ThemeContext.Provider value={contextValue}>{children}</ThemeContext.Provider>;
};

// Hook to use theme context
export const useTheme = (): ThemeContextType => {
  const context = useContext(__ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

// HOC for components that need theme
export function withTheme<P extends object>(Component: React.ComponentType<P & { theme: Theme }>) {
  return function ThemedComponent(props: _P) {
    const { theme } = useTheme();
    return <Component {...props} theme={theme} />;
  };
}

// Utility hook for creating themed styles
export function useThemedStyles<T>(createStyles: (theme: _Theme) => T): T {
  const { theme } = useTheme();
  return React.useMemo(() => createStyles(__theme), [theme, createStyles]);
}

// Style factory helper
export function createThemedStyles<T>(styleFactory: (theme: _Theme) => T) {
  return (theme: _Theme): T => styleFactory(__theme);
}

// Export color theme options for use in components
export { colorThemeOptions };

export default ThemeProvider;
