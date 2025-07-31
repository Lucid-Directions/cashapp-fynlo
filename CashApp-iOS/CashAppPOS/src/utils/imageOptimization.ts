import { Dimensions, PixelRatio } from 'react-native';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');
const pixelRatio = PixelRatio.get();

interface ImageOptimizationOptions {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  cache?: boolean;
}

interface OptimizedImageSource {
  uri: string;
  width?: number;
  height?: number;
  cache?: 'default' | 'reload' | 'force-cache' | 'only-if-cached';
}

export class ImageOptimizer {
  private static cache = new Map<string, OptimizedImageSource>();

  // Optimize image dimensions based on screen size and pixel ratio
  static optimizeDimensions(
    originalWidth: number,
    originalHeight: number,
    targetWidth?: number,
    targetHeight?: number
  ): { width: number; height: number } {
    const maxWidth = targetWidth || screenWidth;
    const maxHeight = targetHeight || screenHeight;

    // Calculate aspect ratio
    const aspectRatio = originalWidth / originalHeight;

    // Calculate optimal dimensions
    let optimizedWidth = maxWidth;
    let optimizedHeight = maxWidth / aspectRatio;

    // Ensure height doesn't exceed maximum
    if (optimizedHeight > maxHeight) {
      optimizedHeight = maxHeight;
      optimizedWidth = maxHeight * aspectRatio;
    }

    // Account for pixel ratio
    optimizedWidth *= pixelRatio;
    optimizedHeight *= pixelRatio;

    return {
      width: Math.round(optimizedWidth),
      height: Math.round(optimizedHeight),
    };
  }

  // Generate optimized image URL (for CDN or image service)
  static generateOptimizedUrl(originalUrl: string, options: ImageOptimizationOptions = {}): string {
    const { width, height, quality = 80, format = 'jpeg' } = options;

    // For demonstration - in real app, this would integrate with your image CDN
    const params = new URLSearchParams();

    if (width) params.append('w', width.toString());
    if (height) params.append('h', height.toString());
    params.append('q', quality.toString());
    params.append('f', format);

    // Example CDN URL format (adjust for your image service)
    if (originalUrl.includes('://')) {
      return `${originalUrl}?${params.toString()}`;
    }

    return originalUrl;
  }

  // Create optimized image source for React Native Image component
  static createOptimizedSource(
    uri: string,
    options: ImageOptimizationOptions = {}
  ): OptimizedImageSource {
    const cacheKey = `${uri}_${JSON.stringify(options)}`;

    // Check cache first
    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const optimizedUri = this.generateOptimizedUrl(uri, options);

    const source: OptimizedImageSource = {
      uri: optimizedUri,
      width: options.width,
      height: options.height,
      cache: options.cache ? 'force-cache' : 'default',
    };

    // Cache the result
    this.cache.set(cacheKey, source);

    // Limit cache size
    if (this.cache.size > 100) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }

    return source;
  }

  // Preload images for better performance
  static async preloadImages(urls: string[]): Promise<void> {
    const preloadPromises = urls.map((url) => {
      return new Promise<void>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve();
        image.onerror = () => reject(new Error(`Failed to preload ${url}`));
        image.src = url;
      });
    });

    try {
      await Promise.all(preloadPromises);
      logger.info(`Successfully preloaded ${urls.length} images`);
    } catch (error) {
      logger.warn('Some images failed to preload:', error);
    }
  }

  // Get optimal image size for different use cases
  static getOptimalSize(useCase: 'thumbnail' | 'card' | 'hero' | 'fullscreen'): {
    width: number;
    height: number;
  } {
    switch (useCase) {
      case 'thumbnail':
        return { width: 80, height: 80 };
      case 'card':
        return { width: 200, height: 150 };
      case 'hero':
        return { width: screenWidth, height: screenWidth * 0.6 };
      case 'fullscreen':
        return { width: screenWidth, height: screenHeight };
      default:
        return { width: 200, height: 200 };
    }
  }

  // Clear image cache
  static clearCache(): void {
    this.cache.clear();
  }
}

// Utility functions for common image operations
export const imageUtils = {
  // Calculate aspect ratio
  getAspectRatio: (width: number, height: number): number => {
    return width / height;
  },

  // Check if image needs optimization
  needsOptimization: (
    originalWidth: number,
    originalHeight: number,
    targetWidth: number,
    targetHeight: number
  ): boolean => {
    const originalSize = originalWidth * originalHeight;
    const targetSize = targetWidth * targetHeight;

    // Optimize if original is more than 2x the target size
    return originalSize > targetSize * 2;
  },

  // Get responsive image sizes for different screen densities
  getResponsiveSizes: (): Array<{ density: number; width: number; height: number }> => {
    const baseWidth = screenWidth;
    const baseHeight = screenHeight;

    return [
      { density: 1, width: baseWidth, height: baseHeight },
      { density: 2, width: baseWidth * 2, height: baseHeight * 2 },
      { density: 3, width: baseWidth * 3, height: baseHeight * 3 },
    ];
  },

  // Generate placeholder for loading images
  generatePlaceholder: (
    width: number,
    height: number,
    backgroundColor: string = '#E5E5E5'
  ): string => {
    return `data:image/svg+xml,${encodeURIComponent(`
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="${backgroundColor}"/>
        <text x="50%" y="50%" text-anchor="middle" dy=".3em" fill="#999" font-family="Arial, sans-serif" font-size="14">
          Loading...
        </text>
      </svg>
    `)}`;
  },
};

// React Native Image component props with optimization
export interface OptimizedImageProps {
  source: { uri: string };
  width?: number;
  height?: number;
  useCase?: 'thumbnail' | 'card' | 'hero' | 'fullscreen';
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  placeholder?: string;
  cache?: boolean;
}

// Helper function to create optimized image props
export const createOptimizedImageProps = (props: OptimizedImageProps): unknown => {
  const { source, width, height, useCase, quality, format, cache } = props;

  let optimalSize = { width: width || 200, height: height || 200 };

  if (useCase) {
    optimalSize = ImageOptimizer.getOptimalSize(useCase);
  }

  const optimizedSource = ImageOptimizer.createOptimizedSource(source.uri, {
    width: optimalSize.width,
    height: optimalSize.height,
    quality,
    format,
    cache,
  });

  return {
    source: optimizedSource,
    style: {
      width: optimalSize.width / pixelRatio,
      height: optimalSize.height / pixelRatio,
    },
    resizeMode: 'cover',
    defaultSource: props.placeholder ? { uri: props.placeholder } : undefined,
  };
};

export default ImageOptimizer;
