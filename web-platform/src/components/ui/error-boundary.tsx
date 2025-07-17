import React from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallback?: React.ComponentType<{ error?: Error }>;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        const FallbackComponent = this.props.fallback;
        return <FallbackComponent error={this.state.error} />;
      }

      return (
        <div className="p-6">
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Something went wrong</AlertTitle>
            <AlertDescription>
              We encountered an error while loading this component. Please refresh the page or try again.
              {this.state.error && (
                <details className="mt-2">
                  <summary className="cursor-pointer">Error details</summary>
                  <pre className="mt-2 text-xs">{this.state.error.message}</pre>
                </details>
              )}
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    return this.props.children;
  }
}

export const ErrorFallback: React.FC<{ error?: Error }> = ({ error }) => (
  <div className="flex flex-col items-center justify-center p-8 text-center">
    <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
    <h2 className="text-xl font-semibold mb-2">Oops! Something went wrong</h2>
    <p className="text-muted-foreground mb-4">
      We're sorry, but something unexpected happened. Please try refreshing the page.
    </p>
    {error && (
      <details className="text-sm text-left max-w-md">
        <summary className="cursor-pointer">Technical details</summary>
        <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-auto">
          {error.message}
        </pre>
      </details>
    )}
  </div>
);