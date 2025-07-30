import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../design-system/ThemeProvider';
import { useResponsiveColumns, useResponsiveSpacing } from '../../hooks/useResponsive';
import { Theme, spacing } from '../../design-system/theme';

// Grid props interface
export interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  };
  spacing?: {
    xs?: keyof typeof spacing;
    sm?: keyof typeof spacing;
    md?: keyof typeof spacing;
    lg?: keyof typeof spacing;
    xl?: keyof typeof spacing;
    xxl?: keyof typeof spacing;
  };
  style?: ViewStyle;
  testID?: string;
}

// Grid item props interface
export interface GridItemProps {
  children: React.ReactNode;
  span?: {
    xs?: number;
    sm?: number;
    md?: number;
    lg?: number;
    xl?: number;
    xxl?: number;
  };
  style?: ViewStyle;
}

const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = { xs: 1, sm: 2, md: 3, lg: 4, xl: 5, xxl: 6 },
  spacing: spacingProp = { xs: 2, sm: 3, md: 4 },
  style,
  testID,
}) => {
  const { theme } = useTheme();
  const currentColumns = useResponsiveColumns(_columns, 1);
  const currentSpacing = useResponsiveSpacing(_spacingProp, 4);
  const styles = createStyles(_theme);

  // Convert children to array for processing
  const childArray = React.Children.toArray(_children);

  // Calculate item width based on columns and spacing
  const itemWidth = `${100 / currentColumns}%`;
  const spacingValue = theme.spacing[currentSpacing];

  // Group children into rows
  const rows: React.ReactNode[][] = [];
  for (let i = 0; i < childArray.length; i += currentColumns) {
    rows.push(childArray.slice(_i, i + currentColumns));
  }

  return (
    <View style={[styles.grid, style]} testID={testID}>
      {rows.map((_row, rowIndex) => (
        <View key={rowIndex} style={[styles.row, { marginBottom: spacingValue }]}>
          {row.map((_child, itemIndex) => (
            <View
              key={itemIndex}
              style={[
                styles.item,
                {
                  width: itemWidth,
                  paddingLeft: itemIndex > 0 ? spacingValue / 2 : 0,
                  paddingRight: itemIndex < row.length - 1 ? spacingValue / 2 : 0,
                },
              ]}>
              {child}
            </View>
          ))}
          {/* Fill empty columns in the last row */}
          {row.length < currentColumns &&
            Array.from({ length: currentColumns - row.length }).map((__, emptyIndex) => (
              <View
                key={`empty-${emptyIndex}`}
                style={[
                  styles.item,
                  {
                    width: itemWidth,
                    paddingLeft: spacingValue / 2,
                    paddingRight:
                      emptyIndex < currentColumns - row.length - 1 ? spacingValue / 2 : 0,
                  },
                ]}
              />
            ))}
        </View>
      ))}
    </View>
  );
};

// Grid Item Component with span support
export const GridItem: React.FC<GridItemProps> = ({ children, span, style }) => {
  // Note: Span functionality would require more complex layout calculations
  // For now, this is a simple wrapper that can be extended
  return <View style={style}>{children}</View>;
};

const createStyles = (theme: Theme) =>
  StyleSheet.create({
    grid: {
      // Base grid container
    },
    row: {
      flexDirection: 'row',
      alignItems: 'stretch',
    },
    item: {
      // Individual grid item
    },
  });

export default ResponsiveGrid;
