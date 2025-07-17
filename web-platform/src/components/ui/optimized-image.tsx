import React, { useState, useRef, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { getLazyImageProps, generateImageSizes } from '@/utils/imageOptimization';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  alt: string;
  sizes?: 'thumbnail' | 'medium' | 'large' | 'original';
  fallback?: string;
  className?: string;
  lazy?: boolean;
}

export const OptimizedImage = ({
  src,
  alt,
  sizes = 'medium',
  fallback = '/placeholder.svg',
  className,
  lazy = true,
  ...props
}: OptimizedImageProps) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [isInView, setIsInView] = useState(!lazy);
  const imgRef = useRef<HTMLImageElement>(null);

  // Intersection Observer for lazy loading
  useEffect(() => {
    if (!lazy || isInView) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsInView(true);
          observer.disconnect();
        }
      },
      { threshold: 0.1, rootMargin: '50px' }
    );

    if (imgRef.current) {
      observer.observe(imgRef.current);
    }

    return () => observer.disconnect();
  }, [lazy, isInView]);

  // Generate optimized image URL
  const optimizedSrc = React.useMemo(() => {
    if (!src || hasError) return fallback;
    
    const imageSizes = generateImageSizes(src);
    return imageSizes[sizes];
  }, [src, sizes, fallback, hasError]);

  const handleLoad = () => {
    setIsLoaded(true);
  };

  const handleError = () => {
    setHasError(true);
    setIsLoaded(true);
  };

  const imageProps = lazy 
    ? { ...getLazyImageProps(optimizedSrc, alt), style: undefined }
    : { src: optimizedSrc, alt };

  return (
    <div className={cn('relative overflow-hidden', className)}>
      {/* Loading placeholder */}
      {!isLoaded && (
        <div className="absolute inset-0 bg-muted animate-pulse" />
      )}
      
      {/* Actual image */}
      {isInView && (
        <img
          ref={imgRef}
          {...imageProps}
          {...props}
          onLoad={handleLoad}
          onError={handleError}
          className={cn(
            'transition-opacity duration-200',
            isLoaded ? 'opacity-100' : 'opacity-0',
            className
          )}
        />
      )}
    </div>
  );
};