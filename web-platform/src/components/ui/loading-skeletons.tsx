import React from 'react';
import { Shimmer } from './animations';

interface LoadingSkeletonProps {
  className?: string;
  rows?: number;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({ 
  className = '', 
  rows = 3 
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {Array.from({ length: rows }, (_, i) => (
        <Shimmer key={i} className="h-4 w-full" />
      ))}
    </div>
  );
};

interface CardSkeletonProps {
  className?: string;
}

export const CardSkeleton: React.FC<CardSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`border rounded-lg p-6 space-y-4 ${className}`}>
      <Shimmer className="h-4 w-3/4" />
      <Shimmer className="h-8 w-1/2" />
      <div className="space-y-2">
        <Shimmer className="h-3 w-full" />
        <Shimmer className="h-3 w-5/6" />
      </div>
    </div>
  );
};

interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({ 
  rows = 5, 
  columns = 4,
  className = '' 
}) => {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Header */}
      <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
        {Array.from({ length: columns }, (_, i) => (
          <Shimmer key={i} className="h-4 w-full" />
        ))}
      </div>
      
      {/* Rows */}
      {Array.from({ length: rows }, (_, rowIndex) => (
        <div key={rowIndex} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}>
          {Array.from({ length: columns }, (_, colIndex) => (
            <Shimmer 
              key={colIndex} 
              className={`h-3 ${colIndex === 0 ? 'w-3/4' : 'w-full'}`} 
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface ChartSkeletonProps {
  className?: string;
}

export const ChartSkeleton: React.FC<ChartSkeletonProps> = ({ className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      <Shimmer className="h-4 w-1/3" />
      <div className="h-64 border rounded-lg p-4">
        <div className="h-full flex items-end justify-between space-x-2">
          {Array.from({ length: 12 }, (_, i) => (
            <div 
              key={i} 
              className={`bg-gray-200 rounded w-full animate-shimmer`}
              style={{ height: `${Math.random() * 80 + 20}%` }}
            />
          ))}
        </div>
      </div>
    </div>
  );
};