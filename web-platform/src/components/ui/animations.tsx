import React from 'react';

interface AnimatedCardProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const AnimatedCard: React.FC<AnimatedCardProps> = ({ 
  children, 
  className = '', 
  delay = 0 
}) => {
  return (
    <div 
      className={`animate-fade-in hover:scale-[1.02] transition-all duration-300 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};

interface ShimmerProps {
  className?: string;
}

export const Shimmer: React.FC<ShimmerProps> = ({ className = '' }) => {
  return (
    <div className={`relative overflow-hidden bg-muted rounded ${className}`}>
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-shimmer" />
    </div>
  );
};

interface StaggeredListProps {
  children: React.ReactNode;
  className?: string;
}

export const StaggeredList: React.FC<StaggeredListProps> = ({ children, className = '' }) => {
  return (
    <div className={className}>
      {React.Children.map(children, (child, index) => (
        <div 
          className="animate-fade-in"
          style={{ animationDelay: `${index * 100}ms` }}
        >
          {child}
        </div>
      ))}
    </div>
  );
};

interface HoverScaleProps {
  children: React.ReactNode;
  className?: string;
  scale?: number;
}

export const HoverScale: React.FC<HoverScaleProps> = ({ 
  children, 
  className = '',
  scale = 1.05 
}) => {
  return (
    <div 
      className={`transition-transform duration-200 cursor-pointer ${className}`}
      style={{ 
        '--hover-scale': scale 
      } as React.CSSProperties}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = `scale(${scale})`;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {children}
    </div>
  );
};

interface PulseProps {
  children: React.ReactNode;
  className?: string;
}

export const Pulse: React.FC<PulseProps> = ({ children, className = '' }) => {
  return (
    <div className={`animate-pulse ${className}`}>
      {children}
    </div>
  );
};

interface SlideInProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down';
  className?: string;
  delay?: number;
}

export const SlideIn: React.FC<SlideInProps> = ({ 
  children, 
  direction = 'right',
  className = '',
  delay = 0 
}) => {
  const getAnimationClass = () => {
    switch (direction) {
      case 'right': return 'animate-slide-in-right';
      case 'left': return 'animate-slide-in-left';
      case 'up': return 'animate-slide-in-up';
      case 'down': return 'animate-slide-in-down';
      default: return 'animate-slide-in-right';
    }
  };

  return (
    <div 
      className={`${getAnimationClass()} ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {children}
    </div>
  );
};