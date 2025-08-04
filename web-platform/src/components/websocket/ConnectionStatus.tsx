import React from 'react';
import { useWebSocketConnection } from '../../hooks/useWebSocketConnection';
import { 
  CheckCircle, 
  XCircle, 
  AlertCircle, 
  RefreshCw, 
  Loader,
  WifiOff,
  Wifi
} from 'lucide-react';

export const ConnectionStatus: React.FC = () => {
  const {
    status,
    isConnected,
    isConnecting,
    isReconnecting,
    reconnectAttempts,
    maxReconnectAttempts,
    reconnectCountdown,
    canManualReconnect,
    lastError,
    reconnect,
  } = useWebSocketConnection();

  // Determine status color and icon
  const getStatusConfig = () => {
    switch (status) {
      case 'connected':
        return {
          icon: <CheckCircle className="w-4 h-4" />,
          text: 'Connected',
          className: 'text-green-500 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800',
          iconClassName: 'text-green-500'
        };
      case 'connecting':
      case 'authenticated':
        return {
          icon: <Loader className="w-4 h-4 animate-spin" />,
          text: 'Connecting',
          className: 'text-yellow-500 bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800',
          iconClassName: 'text-yellow-500'
        };
      case 'reconnecting':
        return {
          icon: <RefreshCw className="w-4 h-4 animate-spin" />,
          text: `Reconnecting`,
          className: 'text-orange-500 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800',
          iconClassName: 'text-orange-500'
        };
      case 'disconnected':
      case 'error':
        return {
          icon: <XCircle className="w-4 h-4" />,
          text: 'Disconnected',
          className: 'text-red-500 bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800',
          iconClassName: 'text-red-500'
        };
      default:
        return {
          icon: <AlertCircle className="w-4 h-4" />,
          text: 'Unknown',
          className: 'text-gray-500 bg-gray-50 border-gray-200 dark:bg-gray-900/20 dark:border-gray-800',
          iconClassName: 'text-gray-500'
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="flex items-center gap-2">
      {/* Status Badge */}
      <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full border text-sm font-medium transition-all duration-300
                      ${config.className}`}>
        <span className={config.iconClassName}>
          {config.icon}
        </span>
        <span className="capitalize">
          {config.text}
        </span>
        
        {/* Reconnect Countdown */}
        {isReconnecting && reconnectCountdown > 0 && (
          <span className="text-xs opacity-75">
            ({reconnectCountdown}s)
          </span>
        )}
        
        {/* Attempt Counter */}
        {isReconnecting && reconnectAttempts > 0 && (
          <span className="text-xs opacity-75">
            Attempt {reconnectAttempts}/{maxReconnectAttempts}
          </span>
        )}
      </div>

      {/* Manual Reconnect Button */}
      {canManualReconnect && \!isConnecting && \!isReconnecting && (
        <button
          onClick={reconnect}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg transition-all duration-200
                     bg-gray-100 hover:bg-gray-200 text-gray-700
                     dark:bg-gray-800 dark:hover:bg-gray-700 dark:text-gray-300
                     focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          title="Reconnect to server"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          <span>Reconnect</span>
        </button>
      )}

      {/* Connection Quality Indicator */}
      {isConnected && (
        <div className="flex items-center gap-1 text-green-500" title="Real-time connection active">
          <Wifi className="w-4 h-4" />
        </div>
      )}

      {/* Error Tooltip */}
      {lastError && \!isConnected && \!isConnecting && (
        <div className="group relative">
          <AlertCircle className="w-4 h-4 text-red-500 cursor-help" />
          <div className="absolute bottom-full right-0 mb-2 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg shadow-lg
                          opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                          dark:bg-gray-800">
            <div className="font-semibold mb-1">Connection Error</div>
            <div className="opacity-90">{lastError}</div>
            <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900 dark:bg-gray-800"></div>
          </div>
        </div>
      )}
    </div>
  );
};

// Compact version for smaller spaces
export const ConnectionStatusCompact: React.FC = () => {
  const { status, isConnected, isConnecting, isReconnecting } = useWebSocketConnection();

  const getIcon = () => {
    if (isConnected) return <Wifi className="w-4 h-4 text-green-500" />;
    if (isConnecting || isReconnecting) return <Loader className="w-4 h-4 text-yellow-500 animate-spin" />;
    return <WifiOff className="w-4 h-4 text-red-500" />;
  };

  const getTooltip = () => {
    if (isConnected) return 'Connected to server';
    if (isConnecting) return 'Connecting...';
    if (isReconnecting) return 'Reconnecting...';
    return 'Disconnected from server';
  };

  return (
    <div className="relative group">
      <div className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-help">
        {getIcon()}
      </div>
      <div className="absolute bottom-full right-0 mb-2 px-2 py-1 bg-gray-900 text-white text-xs rounded whitespace-nowrap
                      opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200
                      dark:bg-gray-800">
        {getTooltip()}
      </div>
    </div>
  );
};

export default ConnectionStatus;
EOF < /dev/null