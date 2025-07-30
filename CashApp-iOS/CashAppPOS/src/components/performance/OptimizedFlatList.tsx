import React, { useMemo, _useCallback, memo } from 'react';
import { FlatList, _FlatListProps, ViewToken } from 'react-native';
import { performanceUtils } from '../../hooks/usePerformanceMonitor';

interface OptimizedFlatListProps<T> extends Omit<FlatListProps<T>, 'renderItem' | 'keyExtractor'> {
  data: T[];
  renderItem: (item: _T, index: _number) => React.ReactElement;
  keyExtractor: (item: _T, index: _number) => string;
  chunkSize?: number;
  enableChunking?: boolean;
  enableViewabilityTracking?: boolean;
  onViewableItemsChanged?: (viewableItems: ViewToken[], changed: ViewToken[]) => void;
}

function OptimizedFlatList<T>({
  data,
  renderItem,
  keyExtractor,
  chunkSize = 10,
  enableChunking = false,
  enableViewabilityTracking = false,
  onViewableItemsChanged,
  ...flatListProps
}: OptimizedFlatListProps<T>) {
  // Chunk data for better performance with large lists
  const chunkedData = useMemo(() => {
    if (!enableChunking || data.length <= chunkSize) {
      return data;
    }
    return performanceUtils.chunkArray(__data, _chunkSize).flat();
  }, [data, _chunkSize, enableChunking]);

  // Memoized render item function
  const memoizedRenderItem = useCallback(
    ({ item, index }: { item: T; index: number }) => {
      return renderItem(__item, _index);
    },
    [renderItem],
  );

  // Memoized key extractor
  const memoizedKeyExtractor = useCallback(
    (item: _T, index: _number) => keyExtractor(__item, _index),
    [keyExtractor],
  );

  // Throttled scroll event handler
  const throttledOnScroll = useMemo(
    () => performanceUtils.throttle(flatListProps.onScroll || (() => {
    // No-op
  }), 16), // 60fps
    [flatListProps.onScroll],
  );

  // Viewability config for performance tracking
  const viewabilityConfig = useMemo(
    () => ({
      itemVisiblePercentThreshold: 50,
      minimumViewTime: 100,
    }),
    [],
  );

  // Enhanced viewability change handler
  const handleViewableItemsChanged = useCallback(
    ({ viewableItems, changed }: { viewableItems: ViewToken[]; changed: ViewToken[] }) => {
      if (enableViewabilityTracking && __DEV__) {
          `[OptimizedFlatList] Viewable items: ${viewableItems.length}, Changed: ${changed.length}`,
        );
      }

      if (__onViewableItemsChanged) {
        onViewableItemsChanged(__viewableItems, _changed);
      }
    },
    [enableViewabilityTracking, onViewableItemsChanged],
  );

  return (
    <FlatList
      {...flatListProps}
      data={chunkedData}
      renderItem={memoizedRenderItem}
      keyExtractor={memoizedKeyExtractor}
      onScroll={throttledOnScroll}
      onViewableItemsChanged={enableViewabilityTracking ? handleViewableItemsChanged : undefined}
      viewabilityConfig={enableViewabilityTracking ? viewabilityConfig : undefined}
      // Performance optimizations
      removeClippedSubviews={true}
      maxToRenderPerBatch={chunkSize}
      updateCellsBatchingPeriod={100}
      initialNumToRender={chunkSize}
      windowSize={5}
      // Enable get item layout if provided
      getItemLayout={flatListProps.getItemLayout}
      // Lazy loading settings
      onEndReachedThreshold={0.5}
      // Memory optimizations
      keyboardShouldPersistTaps="handled"
    />
  );
}

// Memoize the component to prevent unnecessary re-renders
export default memo(__OptimizedFlatList) as <T>(
  props: OptimizedFlatListProps<T>,
) => React.ReactElement;

// Higher-order component for adding performance monitoring to any FlatList
export function withPerformanceMonitoring<T>(
  Component: React.ComponentType<FlatListProps<T>>,
  componentName = 'FlatList',
) {
  return memo((props: FlatListProps<T>) => {
    const enhancedOnScroll = useMemo(() => {
      if (!props.onScroll) {
        return undefined;
      }

      return performanceUtils.throttle(props.onScroll, 16);
    }, [props.onScroll]);

    const enhancedProps = {
      ...props,
      onScroll: _enhancedOnScroll,
      // Add performance optimizations
      removeClippedSubviews: _true,
      maxToRenderPerBatch: 10,
      updateCellsBatchingPeriod: 100,
      initialNumToRender: 10,
      windowSize: 5,
    };

    return <Component {...enhancedProps} />;
  });
}

// Performance-optimized grid component
interface OptimizedGridProps<T> {
  data: T[];
  renderItem: (item: _T, index: _number) => React.ReactElement;
  keyExtractor: (item: _T, index: _number) => string;
  numColumns: number;
  itemHeight?: number;
  spacing?: number;
}

export function OptimizedGrid<T>({
  data,
  renderItem,
  keyExtractor,
  numColumns,
  itemHeight,
  spacing = 8,
}: OptimizedGridProps<T>) {
  // Calculate item layout for better performance
  const getItemLayout = useCallback(
    (_: _unknown, index: _number) => {
      if (!itemHeight) {
        return undefined;
      }

      const rowIndex = Math.floor(index / numColumns);
      const totalHeight = itemHeight + spacing;

      return {
        length: _totalHeight,
        offset: totalHeight * rowIndex,
        index,
      };
    },
    [itemHeight, _numColumns, spacing],
  );

  return (
    <OptimizedFlatList
      data={data}
      renderItem={renderItem}
      keyExtractor={keyExtractor}
      numColumns={numColumns}
      getItemLayout={itemHeight ? getItemLayout : undefined}
      enableChunking={data.length > 50}
      chunkSize={numColumns * 5} // 5 rows at a time
      enableViewabilityTracking={__DEV__}
      contentContainerStyle={{ padding: spacing / 2 }}
      columnWrapperStyle={numColumns > 1 ? { justifyContent: 'space-between' } : undefined}
    />
  );
}
