# Sync Status Components

This directory contains UI components for displaying offline/sync status in the Fynlo POS app.

## Components

### SyncStatusBar
A minimal status bar showing connection state and queue count. Always visible at the top or bottom of screens.

**Props:**
- `position`: 'top' | 'bottom' (default: 'top')
- `compact`: boolean (default: true)
- `showDetails`: boolean (default: false)
- `onPress`: () => void (optional)
- `style`: any (optional custom styles)

**Usage:**
```tsx
import { SyncStatusBar } from '../components/sync';

// Minimal indicator
<SyncStatusBar position="top" compact={true} />

// Detailed status with action
<SyncStatusBar 
  position="bottom" 
  compact={false} 
  showDetails={true}
  onPress={() => navigation.navigate('SyncDetails')}
/>
```

### NetworkAlertBanner
A prominent alert banner that appears when offline or when sync errors occur.

**Props:**
- `position`: 'top' | 'bottom' (default: 'top')
- `autoHide`: boolean (default: false)
- `autoHideDelay`: number in ms (default: 5000)
- `onDismiss`: () => void (optional)
- `style`: any (optional custom styles)

**Usage:**
```tsx
import { NetworkAlertBanner } from '../components/sync';

// Auto-hiding banner
<NetworkAlertBanner 
  position="top"
  autoHide={true}
  autoHideDelay={5000}
/>

// Persistent banner with dismiss callback
<NetworkAlertBanner 
  position="top"
  onDismiss={() => console.log('Banner dismissed')}
/>
```

## Hooks

### useSyncStatus
React hook providing comprehensive sync status and control functions.

**Returns:**
```typescript
{
  // Status
  isOnline: boolean;
  isSyncing: boolean;
  queueSize: number;
  failedCount: number;
  conflictCount: number;
  canSync: boolean;
  
  // Actions
  triggerSync: () => Promise<void>;
  clearQueue: () => Promise<void>;
  retryFailed: () => Promise<void>;
}
```

### useNetworkStatus
Simple hook for network connectivity status.

**Returns:**
```typescript
{
  isOnline: boolean;
  networkType: string | null;
}
```

## Integration Examples

### Basic Integration in POSScreen
```tsx
import { SyncStatusBar, NetworkAlertBanner } from '../components/sync';

const POSScreen = () => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Alert banner for critical notifications */}
      <NetworkAlertBanner position="top" autoHide={true} />
      
      {/* Always visible sync status */}
      <SyncStatusBar position="top" compact={true} />
      
      {/* Your screen content */}
      <View style={styles.content}>
        {/* ... */}
      </View>
    </SafeAreaView>
  );
};
```

### Advanced Integration with Custom Actions
```tsx
import { useSyncStatus } from '../hooks/useSyncStatus';

const SettingsScreen = () => {
  const { queueSize, failedCount, triggerSync, clearQueue } = useSyncStatus();
  
  return (
    <View>
      <Text>Pending: {queueSize} items</Text>
      <Text>Failed: {failedCount} items</Text>
      
      <Button title="Sync Now" onPress={triggerSync} />
      <Button title="Clear Queue" onPress={clearQueue} />
    </View>
  );
};
```

## Visual States

### Online & Synced
- Green cloud icon with checkmark
- No badge or minimal indicator
- Hidden in compact mode when everything is synced

### Offline
- Red cloud-off icon
- Shows count of pending items
- Prominent warning message

### Syncing
- Blue sync icon with animation
- Progress indicator
- Shows item count being synced

### Sync Failed
- Orange warning icon
- Shows count of failed items
- Retry action available

### Conflicts
- Red error icon
- Shows conflict count
- Navigate to resolution screen

## Styling

Components follow the app's theme system and automatically adapt to light/dark modes. Custom styles can be passed via the `style` prop.

## Performance

- Updates every 2 seconds via polling
- Minimal re-renders using React.memo
- Efficient queue statistics calculation
- Network state changes trigger immediate updates

## Dependencies

- `@react-native-community/netinfo` - Network state monitoring
- `react-native-vector-icons/MaterialIcons` - Icons
- `OfflineQueueService` - Queue management
- Theme system - Consistent styling
EOF < /dev/null