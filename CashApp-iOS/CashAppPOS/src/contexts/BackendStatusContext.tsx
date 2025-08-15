/**
 * Backend Status Context
 * Monitors backend health and provides user notifications
 */

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { logger } from '../utils/logger';
import DataService from '../services/DataService';
import { useTheme } from '../design-system/ThemeProvider';
import type { Theme } from '../design-system/theme';

interface BackendStatus {
  isOnline: boolean;
  lastSuccessfulSync: Date | null;
  currentErrors: string[];
  isUsingMockData: boolean;
  retryCount: number;
  lastCheckTime: Date | null;
}

interface BackendStatusContextType {
  status: BackendStatus;
  checkBackendHealth: () => Promise<void>;
  retry: () => Promise<void>;
  clearErrors: () => void;
  isChecking: boolean;
}

const BackendStatusContext = createContext<BackendStatusContextType | undefined>(undefined);

export const useBackendStatus = () => {
  const context = useContext(BackendStatusContext);
  if (!context) {
    throw new Error('useBackendStatus must be used within BackendStatusProvider');
  }
  return context;
};

interface BackendStatusProviderProps {
  children: ReactNode;
  checkInterval?: number; // milliseconds
  showBanners?: boolean;
}

export const BackendStatusProvider: React.FC<BackendStatusProviderProps> = ({ 
  children,
  checkInterval = 30000, // 30 seconds default
  showBanners = true,
}) => {
  const [status, setStatus] = useState<BackendStatus>({
    isOnline: true,
    lastSuccessfulSync: null,
    currentErrors: [],
    isUsingMockData: false,
    retryCount: 0,
    lastCheckTime: null,
  });
  
  const [isChecking, setIsChecking] = useState(false);
  const dataService = DataService.getInstance();

  const checkBackendHealth = useCallback(async () => {
    if (isChecking) {
      logger.debug('Backend health check already in progress, skipping');
      return;
    }
    
    setIsChecking(true);
    
    try {
      logger.debug('Checking backend health...');
      
      // Check backend availability
      const isAvailable = await dataService.checkBackendAvailability();
      
      setStatus(prev => ({
        ...prev,
        isOnline: isAvailable,
        lastCheckTime: new Date(),
        lastSuccessfulSync: isAvailable ? new Date() : prev.lastSuccessfulSync,
        isUsingMockData: !isAvailable,
        currentErrors: isAvailable ? [] : ['Backend unavailable'],
        retryCount: isAvailable ? 0 : prev.retryCount,
      }));
      
      if (isAvailable) {
        logger.info('✅ Backend is online');
      } else {
        logger.warn('⚠️ Backend is offline, using fallback mode');
      }
    } catch (error) {
      logger.error('Failed to check backend health:', error);
      
      setStatus(prev => ({
        ...prev,
        isOnline: false,
        lastCheckTime: new Date(),
        isUsingMockData: true,
        currentErrors: [...prev.currentErrors, String(error)].slice(-5), // Keep last 5 errors
        retryCount: prev.retryCount + 1,
      }));
    } finally {
      setIsChecking(false);
    }
  }, [isChecking, dataService]);

  const retry = useCallback(async () => {
    logger.info('Manual retry requested');
    setStatus(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
    await checkBackendHealth();
  }, [checkBackendHealth]);

  const clearErrors = useCallback(() => {
    setStatus(prev => ({ ...prev, currentErrors: [] }));
  }, []);

  // Initial check on mount
  useEffect(() => {
    checkBackendHealth();
  }, []);

  // Periodic health checks
  useEffect(() => {
    const interval = setInterval(checkBackendHealth, checkInterval);
    return () => clearInterval(interval);
  }, [checkBackendHealth, checkInterval]);

  // Check when app comes to foreground
  useEffect(() => {
    const handleAppStateChange = (nextAppState: string) => {
      if (nextAppState === 'active') {
        checkBackendHealth();
      }
    };
    
    // This would need AppState import and listener setup
    // Simplified for now
    return () => {};
  }, [checkBackendHealth]);

  return (
    <BackendStatusContext.Provider value={{ 
      status, 
      checkBackendHealth, 
      retry, 
      clearErrors,
      isChecking 
    }}>
      {children}
      {showBanners && (
        <>
          {status.isUsingMockData && <MockDataBanner />}
          {!status.isOnline && <OfflineBanner />}
        </>
      )}
    </BackendStatusContext.Provider>
  );
};

// Mock Data Banner Component
const MockDataBanner: React.FC = () => {
  const theme = useTheme();
  const styles = createBannerStyles(theme);
  const { retry } = useBackendStatus();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.banner, styles.warningBanner, { opacity: fadeAnim }]}>
      <View style={styles.bannerContent}>
        <Icon name="warning" size={20} color={theme.colors.warning} />
        <Text style={styles.bannerText}>Using demo data - Backend temporarily unavailable</Text>
      </View>
      <TouchableOpacity style={styles.retryButton} onPress={retry}>
        <Text style={styles.retryButtonText}>Retry</Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

// Offline Banner Component  
const OfflineBanner: React.FC = () => {
  const theme = useTheme();
  const styles = createBannerStyles(theme);
  const { status } = useBackendStatus();
  const [fadeAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, []);

  const formatRelativeTime = (date: Date | null) => {
    if (!date) return 'Never';
    
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    
    if (seconds < 60) return 'Just now';
    if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)} hours ago`;
    return `${Math.floor(seconds / 86400)} days ago`;
  };

  return (
    <Animated.View style={[styles.banner, styles.offlineBanner, { opacity: fadeAnim }]}>
      <View style={styles.bannerContent}>
        <Icon name="cloud-off" size={20} color={theme.colors.error} />
        <View style={styles.bannerTextContainer}>
          <Text style={styles.bannerText}>Offline Mode</Text>
          {status.lastSuccessfulSync && (
            <Text style={styles.bannerSubtext}>
              Last sync: {formatRelativeTime(status.lastSuccessfulSync)}
            </Text>
          )}
        </View>
      </View>
    </Animated.View>
  );
};

const createBannerStyles = (theme: Theme) => StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  warningBanner: {
    backgroundColor: theme.colors.warning + '20',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.warning,
  },
  offlineBanner: {
    backgroundColor: theme.colors.error + '20',
    borderBottomWidth: 1,
    borderBottomColor: theme.colors.error,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  bannerTextContainer: {
    marginLeft: theme.spacing.sm,
    flex: 1,
  },
  bannerText: {
    fontSize: 14,
    fontWeight: '500',
    color: theme.colors.text,
  },
  bannerSubtext: {
    fontSize: 12,
    color: theme.colors.textSecondary,
    marginTop: 2,
  },
  retryButton: {
    paddingHorizontal: theme.spacing.md,
    paddingVertical: theme.spacing.xs,
    backgroundColor: theme.colors.primary,
    borderRadius: theme.spacing.xs,
  },
  retryButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: theme.colors.onPrimary,
  },
});

export default BackendStatusProvider;