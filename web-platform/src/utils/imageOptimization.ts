/**
 * Image optimization utilities for better performance
 */

export interface ImageUploadOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'webp' | 'jpeg' | 'png';
}

/**
 * Compress and resize an image file
 */
export const compressImage = async (
  file: File,
  options: ImageUploadOptions = {}
): Promise<File> => {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.8,
    format = 'webp'
  } = options;

  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();

    img.onload = () => {
      // Calculate new dimensions
      let { width, height } = img;
      
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width *= ratio;
        height *= ratio;
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx?.drawImage(img, 0, 0, width, height);
      
      canvas.toBlob(
        (blob) => {
          if (blob) {
            const compressedFile = new File([blob], file.name, {
              type: `image/${format}`,
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            reject(new Error('Image compression failed'));
          }
        },
        `image/${format}`,
        quality
      );
    };

    img.onerror = () => reject(new Error('Image load failed'));
    img.src = URL.createObjectURL(file);
  });
};

/**
 * Generate optimized image URLs with different sizes
 */
export const generateImageSizes = (baseUrl: string) => {
  const sizes = {
    thumbnail: `${baseUrl}?width=150&height=150&fit=cover`,
    medium: `${baseUrl}?width=400&height=400&fit=cover`,
    large: `${baseUrl}?width=800&height=600&fit=cover`,
    original: baseUrl
  };

  return sizes;
};

/**
 * Lazy loading image component props
 */
export const getLazyImageProps = (src: string, alt: string) => ({
  src,
  alt,
  loading: 'lazy' as const,
  decoding: 'async' as const,
  style: { contentVisibility: 'auto' }
});

/**
 * Check if browser supports WebP format
 */
export const supportsWebP = (): Promise<boolean> => {
  return new Promise((resolve) => {
    const webp = new Image();
    webp.onload = webp.onerror = () => {
      resolve(webp.height === 2);
    };
    webp.src = 'data:image/webp;base64,UklGRjoAAABXRUJQVlA4IC4AAACyAgCdASoCAAIALmk0mk0iIiIiIgBoSygABc6WWgAA/veff/0PP8bA//LwYAAA';
  });
};

/**
 * Image caching utilities
 */
export class ImageCache {
  private static cache = new Map<string, string>();
  
  static async preloadImage(url: string): Promise<void> {
    if (this.cache.has(url)) return;
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        this.cache.set(url, url);
        resolve();
      };
      img.onerror = reject;
      img.src = url;
    });
  }
  
  static preloadImages(urls: string[]): Promise<void[]> {
    return Promise.all(urls.map(url => this.preloadImage(url)));
  }
  
  static isImageCached(url: string): boolean {
    return this.cache.has(url);
  }
  
  static clearCache(): void {
    this.cache.clear();
  }
}