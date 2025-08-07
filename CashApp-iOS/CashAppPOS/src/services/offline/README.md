# OfflineQueueService

A robust offline queue management service for the Fynlo POS app that handles API request queuing, conflict resolution, and automatic synchronization.

## Features

- **Priority-based queue management** - Critical operations like payments are processed first
- **Automatic retry with exponential backoff** - Failed requests are retried intelligently
- **Conflict detection and resolution** - Multiple strategies for handling data conflicts
- **Entity-specific sync strategies** - Different handling for orders, payments, inventory, etc.
- **Persistent storage** - Queue survives app restarts
- **Real-time sync** - Automatic synchronization when coming back online
- **Comprehensive error handling** - Graceful degradation and recovery

## Usage

### Basic Usage

```typescript
import { offlineQueueService, EntityType, ActionType, Priority } from '@/services/offline';

// Queue a request for offline execution
const requestId = await offlineQueueService.queueRequest(
  EntityType.ORDER,
  ActionType.CREATE,
  'POST',
  '/orders',
  { items: [...], total: 100 },
  { priority: Priority.HIGH }
);

// Execute with offline fallback
const result = await offlineQueueService.executeWithFallback(
  EntityType.PRODUCT,
  ActionType.UPDATE,
  'PUT',
  '/products/123',
  { name: 'Updated Product' },
  {
    offlineResponse: { success: true, id: 'offline_123' },
    cacheKey: 'product_123',
    cacheDuration: 3600000 // 1 hour
  }
);
```

### React Hook Usage

```tsx
import { useOfflineQueue } from '@/services/offline';

function OfflineStatusComponent() {
  const { stats, isOnline, syncQueue } = useOfflineQueue();
  
  return (
    <View>
      <Text>Status: {isOnline ? 'Online' : 'Offline'}</Text>
      <Text>Queued Requests: {stats.totalQueued}</Text>
      <Button onPress={syncQueue} title="Sync Now" />
    </View>
  );
}
```

### Integration with DataService

```typescript
import { offlineQueueService, EntityType, ActionType } from '@/services/offline';

class EnhancedDataService extends DataService {
  async createOrder(order: unknown): Promise<unknown> {
    return offlineQueueService.executeWithFallback(
      EntityType.ORDER,
      ActionType.CREATE,
      'POST',
      '/orders',
      order,
      {
        priority: Priority.HIGH,
        offlineResponse: { 
          ...order, 
          id: `offline_${Date.now()}`,
          isOffline: true 
        }
      }
    );
  }
}
```

## Entity Types

- `ORDER` - Orders and order updates
- `PAYMENT` - Payment processing
- `PRODUCT` - Product catalog
- `CATEGORY` - Product categories
- `CUSTOMER` - Customer data
- `INVENTORY` - Stock levels
- `EMPLOYEE` - Staff information
- `TABLE` - Table management
- `SESSION` - POS sessions
- `REPORT` - Analytics and reports
- `SETTINGS` - Configuration

## Priority Levels

1. `CRITICAL` (0) - Payment processing, order completion
2. `HIGH` (1) - Order creation, inventory updates
3. `MEDIUM` (2) - Customer updates, settings
4. `LOW` (3) - Analytics, reports
5. `BACKGROUND` (4) - Logs, telemetry

## Conflict Resolution Strategies

- `SERVER_WINS` - Server version takes precedence
- `CLIENT_WINS` - Local version takes precedence
- `LAST_WRITE_WINS` - Most recent timestamp wins
- `FIRST_WRITE_WINS` - First write is preserved
- `MERGE` - Attempt to merge changes
- `MANUAL` - Queue for manual resolution

## Configuration

The service can be configured by modifying the `config` object in `OfflineQueueService`:

```typescript
{
  maxQueueSize: 500,           // Maximum items in queue
  maxRetries: 5,               // Max retry attempts
  retryBaseDelay: 1000,        // Initial retry delay (ms)
  retryMaxDelay: 60000,        // Maximum retry delay (ms)
  batchSize: 10,               // Items per sync batch
  syncInterval: 30000,         // Auto-sync interval (ms)
  enableCompression: true,     // Compress stored queue
  enableChecksum: true,        // Generate checksums
}
```

## Statistics and Monitoring

```typescript
const stats = offlineQueueService.getStatistics();
console.log({
  totalQueued: stats.totalQueued,
  byStatus: stats.byStatus,
  byPriority: stats.byPriority,
  byEntityType: stats.byEntityType,
  averageRetryCount: stats.averageRetryCount,
  oldestItemAge: stats.oldestItemAge,
  estimatedSyncTime: stats.estimatedSyncTime
});
```

## Manual Conflict Resolution

```typescript
// Get pending conflicts
const conflicts = await offlineQueueService.getConflicts();

// Resolve a conflict
await offlineQueueService.resolveManualConflict(
  conflictId,
  'local', // or 'server' or 'custom'
  customData // optional, for 'custom' resolution
);
```

## Debugging

```typescript
// Export queue for debugging
const queueData = await offlineQueueService.exportQueue();
console.log(JSON.parse(queueData));

// Clear the queue
await offlineQueueService.clearQueue();

// Cancel a specific request
await offlineQueueService.cancelRequest(requestId);
```

## Error Handling

The service integrates with the app's error handling system:

- Network errors trigger automatic retries
- Storage errors are logged and reported
- Conflicts are tracked for resolution
- Failed requests are retained with error details

## Testing

See `__tests__/OfflineQueueService.test.ts` for comprehensive test coverage.

