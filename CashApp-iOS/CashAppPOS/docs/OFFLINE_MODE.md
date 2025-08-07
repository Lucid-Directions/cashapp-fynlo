# Offline Mode Implementation - Issue #392

## Overview

The Fynlo POS app now supports comprehensive offline mode with automatic sync queue functionality. This ensures the app remains operational during network disruptions and automatically syncs data when connectivity is restored.

## Architecture

### Core Components

1. **OfflineQueueService** (`src/services/offline/OfflineQueueService.ts`)
   - Manages offline API call queue with priority system
   - Handles conflict resolution with multiple strategies
   - Provides retry logic with exponential backoff
   - Persists queue to AsyncStorage

2. **DataService Integration** (`src/services/DataService.ts`)
   - Wraps critical API calls with offline support
   - Caches read operations for offline access
   - Queues write operations when offline

3. **UI Components** (`src/components/sync/`)
   - SyncStatusBar: Shows connection state and queue count
   - NetworkAlertBanner: Displays offline alerts
   - useSyncStatus: React hook for sync state

## Features

### 1. Offline Queue System
- **Priority Levels**: Critical, High, Medium, Low, Background
- **Automatic Retry**: Exponential backoff with jitter
- **Persistent Storage**: Survives app restarts
- **Batch Processing**: Efficient sync when online

### 2. Conflict Resolution
- **Strategies**: 
  - Last Write Wins
  - Server Wins
  - Client Wins
  - Manual Resolution
  - Smart Merge
  - Fail on Conflict
- **Entity-Specific**: Different strategies per data type

### 3. Data Caching
- **Menu Items**: 30-minute cache
- **Categories**: 30-minute cache
- **Products**: 15-minute cache
- **Orders**: 5-minute cache
- **Floor Plan**: 1-hour cache

### 4. Sync Status UI
- **Visual Indicators**:
  - ✅ Green: Online & Synced
  - 🔴 Red: Offline
  - 🔄 Blue: Syncing
  - ⚠️ Yellow: Conflicts
- **Queue Count Badge**: Shows pending items
- **Manual Sync**: User-triggered sync option

## Usage

### Basic Queue Operation
```typescript
// Order creation automatically queues when offline
await dataService.createOrder(orderData);
// Returns optimistic response with temporary ID

// Payment processing
await dataService.processPayment(orderId, 'cash', amount);
// Queues for later if offline
```

### React Component Integration
```tsx
import { SyncStatusBar, NetworkAlertBanner } from '../components/sync';
import { useSyncStatus } from '../hooks/useSyncStatus';

const POSScreen = () => {
  const { isOnline, queueSize, syncProgress } = useSyncStatus();
  
  return (
    <SafeAreaView>
      <NetworkAlertBanner />
      <SyncStatusBar compact={true} />
      {/* Your content */}
    </SafeAreaView>
  );
};
```

### Manual Control
```typescript
// Get queue statistics
const stats = await dataService.getOfflineQueueStats();

// Trigger manual sync
await dataService.triggerOfflineSync();

// Clear queue (use with caution!)
await dataService.clearOfflineQueue();
```

## Critical Operations Support

### Orders ✅
- Create orders offline with temporary IDs
- Queue for sync when online
- Conflict resolution: Server wins

### Payments ✅
- Cash payments queue offline
- Card payments require online (security)
- Automatic retry with priority

### Menu Data ✅
- Cached for offline viewing
- Background sync when online
- TTL-based cache expiration

### Inventory ⚠️
- Basic support (future enhancement)
- Updates queue for sync

## Testing

### Unit Tests
```bash
# Run offline mode tests
npm test -- DataService.offline.test
npm test -- OfflineQueueService.test
```

### Manual Testing
1. Enable airplane mode
2. Create orders and process payments
3. Check sync status indicator
4. Re-enable network
5. Verify automatic sync

## Configuration

### Feature Flags
```typescript
// Enable/disable offline mode
ENABLE_OFFLINE_MODE: true

// Adjust cache durations
MENU_ITEMS_CACHE_DURATION: 30 * 60 * 1000 // 30 minutes
```

### Queue Settings
```typescript
{
  maxQueueSize: 1000,
  maxRetries: 5,
  retryDelay: 1000,
  batchSize: 50
}
```

## Monitoring

### Logs
- Queue operations: `[OfflineQueue]`
- Sync progress: `[Sync]`
- Conflicts: `[Conflict]`
- Errors: `[OfflineError]`

### Metrics
- Queue size by priority
- Sync success/failure rates
- Average sync duration
- Conflict frequency

## Edge Cases Handled

1. **App Killed During Sync**: Queue persists and resumes
2. **Corrupt Queue**: Automatic recovery with error logging
3. **Storage Full**: Graceful degradation with warnings
4. **Clock Skew**: Timestamp validation
5. **Partial Sync Failure**: Individual retry per item

## Future Enhancements

1. **Advanced Conflict UI**: Side-by-side comparison
2. **Selective Sync**: Choose items to sync
3. **Data Compression**: Reduce storage usage
4. **Background Sync**: iOS/Android background tasks
5. **Sync Analytics**: Detailed sync reports

## Troubleshooting

### Queue Not Syncing
1. Check network status in Settings
2. Look for sync errors in logs
3. Try manual sync from menu
4. Clear queue and restart if persistent

### Conflicts Detected
1. Review conflict type in alert
2. Choose resolution strategy
3. Manual resolution for complex cases
4. Contact support if unclear

### Performance Issues
1. Check queue size (Settings > Sync Status)
2. Clear old cached data
3. Reduce cache durations if needed
4. Report if queue > 500 items

## Support

For issues or questions:
- Check logs: `logger.getRecentLogs()`
- Queue stats: `dataService.getOfflineQueueStats()`
- Manual sync: `dataService.triggerOfflineSync()`
- Clear queue: `dataService.clearOfflineQueue()`

---

*Implementation completed for Issue #392 - MEDIUM: Implement proper offline mode with sync queue*