# Logging & Performance Cleanup Guide

**Priority**: HIGH (Performance Impact)  
**Timeline**: 3-5 days  
**Platforms**: Mobile App (947 statements) + Backend (2,223 statements)  
**Impact**: Improved performance, reduced memory usage, better debugging

---

## Overview

Your codebase currently has excessive logging statements that impact performance and create security risks. This guide provides a systematic approach to clean up logging while implementing proper, environment-aware logging services.

## Problems Being Solved

### 1. Mobile App: 947 Console Statements
**Current State**: Excessive console.log/warn/error throughout codebase
```bash
grep -r "console.log\|console.warn\|console.error" CashApp-iOS/CashAppPOS/src --include="*.ts" --include="*.tsx" | wc -l
947
```

**Performance Impact:**
- Memory leaks in production builds
- Slower app performance
- Potential security information exposure
- App Store review issues

### 2. Backend: 2,223 Debug Statements
**Current State**: Excessive print/debug statements in Python code
```bash
grep -r "print(\|console\|TODO\|FIXME" backend --include="*.py" | wc -l
2223
```

**Production Impact:**
- Log file bloat on DigitalOcean
- Performance degradation
- Disk space consumption
- Potential sensitive data exposure

---

## Solution Implementation

### Part 1: Mobile App Logging Service

#### Step 1: Create Centralized Logging Service

Create `src/services/LoggingService.ts`:
```typescript
import Config from 'react-native-config';
import AsyncStorage from '@react-native-async-storage/async-storage';

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  NONE = 4,
}

interface LogEntry {
  level: string;
  message: string;
  timestamp: string;
  data?: any;
  source?: string;
}

class LoggingService {
  private static instance: LoggingService;
  private logLevel: LogLevel;
  private logBuffer: LogEntry[] = [];
  private maxBufferSize = 100;
  private isProduction: boolean;

  private constructor() {
    this.isProduction = Config.NODE_ENV === 'production';
    
    // Set log level based on environment
    if (this.isProduction) {
      this.logLevel = LogLevel.WARN; // Only warnings and errors in production
    } else {
      this.logLevel = LogLevel.DEBUG; // All logs in development
    }
  }

  static getInstance(): LoggingService {
    if (!LoggingService.instance) {
      LoggingService.instance = new LoggingService();
    }
    return LoggingService.instance;
  }

  private shouldLog(level: LogLevel): boolean {
    return level >= this.logLevel;
  }

  private formatMessage(level: string, message: string, source?: string): string {
    const timestamp = new Date().toISOString();
    const sourcePrefix = source ? `[${source}] ` : '';
    return `${timestamp} [${level}] ${sourcePrefix}${message}`;
  }

  private addToBuffer(entry: LogEntry): void {
    this.logBuffer.push(entry);
    
    // Keep buffer size manageable
    if (this.logBuffer.length > this.maxBufferSize) {
      this.logBuffer.shift();
    }
  }

  debug(message: string, data?: any, source?: string): void {
    if (!this.shouldLog(LogLevel.DEBUG)) return;

    const formattedMessage = this.formatMessage('DEBUG', message, source);
    console.log(formattedMessage, data);

    this.addToBuffer({
      level: 'DEBUG',
      message,
      timestamp: new Date().toISOString(),
      data,
      source,
    });
  }

  info(message: string, data?: any, source?: string): void {
    if (!this.shouldLog(LogLevel.INFO)) return;

    const formattedMessage = this.formatMessage('INFO', message, source);
    console.log(formattedMessage, data);

    this.addToBuffer({
      level: 'INFO',
      message,
      timestamp: new Date().toISOString(),
      data,
      source,
    });
  }

  warn(message: string, data?: any, source?: string): void {
    if (!this.shouldLog(LogLevel.WARN)) return;

    const formattedMessage = this.formatMessage('WARN', message, source);
    console.warn(formattedMessage, data);

    this.addToBuffer({
      level: 'WARN',
      message,
      timestamp: new Date().toISOString(),
      data,
      source,
    });
  }

  error(message: string, error?: any, source?: string): void {
    if (!this.shouldLog(LogLevel.ERROR)) return;

    const formattedMessage = this.formatMessage('ERROR', message, source);
    console.error(formattedMessage, error);

    this.addToBuffer({
      level: 'ERROR',
      message,
      timestamp: new Date().toISOString(),
      data: error,
      source,
    });

    // In production, send critical errors to crash reporting
    if (this.isProduction) {
      this.reportError(message, error, source);
    }
  }

  private async reportError(message: string, error?: any, source?: string): Promise<void> {
    try {
      // Send to crash reporting service (Sentry, Crashlytics, etc.)
      // For now, store locally for later upload
      const errorReport = {
        message,
        error: error?.toString(),
        source,
        timestamp: new Date().toISOString(),
        userId: await AsyncStorage.getItem('user_id'),
        appVersion: Config.APP_VERSION || 'unknown',
      };

      const existingReports = await AsyncStorage.getItem('error_reports');
      const reports = existingReports ? JSON.parse(existingReports) : [];
      reports.push(errorReport);

      // Keep only last 50 error reports
      if (reports.length > 50) {
        reports.splice(0, reports.length - 50);
      }

      await AsyncStorage.setItem('error_reports', JSON.stringify(reports));
    } catch (e) {
      // Fail silently to avoid infinite error loops
    }
  }

  // Get recent logs for debugging
  getRecentLogs(): LogEntry[] {
    return [...this.logBuffer];
  }

  // Clear log buffer
  clearLogs(): void {
    this.logBuffer = [];
  }

  // Export logs for debugging
  async exportLogs(): Promise<string> {
    const logs = this.getRecentLogs();
    return JSON.stringify(logs, null, 2);
  }
}

// Export singleton instance
export const logger = LoggingService.getInstance();

// Export for specific use cases
export { LogLevel, LoggingService };
```

#### Step 2: Create Logging Utilities

Create `src/utils/loggingUtils.ts`:
```typescript
import { logger } from '../services/LoggingService';

// Utility functions for common logging patterns

export const logApiCall = (endpoint: string, method: string, duration?: number) => {
  const message = `API ${method} ${endpoint}`;
  if (duration) {
    logger.info(`${message} completed in ${duration}ms`, { endpoint, method, duration }, 'API');
  } else {
    logger.debug(`${message} started`, { endpoint, method }, 'API');
  }
};

export const logApiError = (endpoint: string, method: string, error: any) => {
  logger.error(`API ${method} ${endpoint} failed`, error, 'API');
};

export const logAuthEvent = (event: string, data?: any) => {
  logger.info(`Auth: ${event}`, data, 'AUTH');
};

export const logAuthError = (event: string, error: any) => {
  logger.error(`Auth: ${event} failed`, error, 'AUTH');
};

export const logWebSocketEvent = (event: string, data?: any) => {
  logger.debug(`WebSocket: ${event}`, data, 'WEBSOCKET');
};

export const logWebSocketError = (event: string, error: any) => {
  logger.error(`WebSocket: ${event} failed`, error, 'WEBSOCKET');
};

export const logPaymentEvent = (event: string, data?: any) => {
  // Be careful not to log sensitive payment data
  const sanitizedData = data ? { 
    amount: data.amount, 
    currency: data.currency,
    status: data.status 
  } : undefined;
  logger.info(`Payment: ${event}`, sanitizedData, 'PAYMENT');
};

export const logPaymentError = (event: string, error: any) => {
  logger.error(`Payment: ${event} failed`, error, 'PAYMENT');
};

// Performance logging
export const logPerformance = (operation: string, duration: number) => {
  if (duration > 1000) {
    logger.warn(`Slow operation: ${operation} took ${duration}ms`, { operation, duration }, 'PERFORMANCE');
  } else {
    logger.debug(`Performance: ${operation} took ${duration}ms`, { operation, duration }, 'PERFORMANCE');
  }
};

// User action logging (for analytics)
export const logUserAction = (action: string, data?: any) => {
  logger.info(`User: ${action}`, data, 'USER');
};
```

#### Step 3: Replace Console Statements Systematically

Create a script to help with the replacement process:

Create `scripts/replace-console-logs.js`:
```javascript
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, '../src');

// Mapping of console methods to logger methods
const replacements = [
  {
    pattern: /console\.log\(/g,
    replacement: 'logger.debug(',
    import: "import { logger } from '../services/LoggingService';"
  },
  {
    pattern: /console\.info\(/g,
    replacement: 'logger.info(',
    import: "import { logger } from '../services/LoggingService';"
  },
  {
    pattern: /console\.warn\(/g,
    replacement: 'logger.warn(',
    import: "import { logger } from '../services/LoggingService';"
  },
  {
    pattern: /console\.error\(/g,
    replacement: 'logger.error(',
    import: "import { logger } from '../services/LoggingService';"
  }
];

function processFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  let newContent = content;
  let hasChanges = false;
  let needsImport = false;

  // Apply replacements
  replacements.forEach(({ pattern, replacement }) => {
    if (pattern.test(newContent)) {
      newContent = newContent.replace(pattern, replacement);
      hasChanges = true;
      needsImport = true;
    }
  });

  // Add import if needed and not already present
  if (needsImport && !newContent.includes("from '../services/LoggingService'") && !newContent.includes("from '../../services/LoggingService'")) {
    // Determine correct import path
    const relativePath = path.relative(path.dirname(filePath), path.join(srcDir, 'services/LoggingService'));
    const importPath = relativePath.startsWith('.') ? relativePath : `./${relativePath}`;
    const importStatement = `import { logger } from '${importPath.replace(/\\/g, '/')}';\n`;
    
    // Add import after existing imports
    const importRegex = /^(import.*?;\s*\n)*/m;
    const match = newContent.match(importRegex);
    if (match) {
      newContent = newContent.replace(importRegex, match[0] + importStatement);
    } else {
      newContent = importStatement + newContent;
    }
  }

  if (hasChanges) {
    fs.writeFileSync(filePath, newContent);
    console.log(`Updated: ${filePath}`);
  }
}

function processDirectory(dir) {
  const files = fs.readdirSync(dir);
  
  files.forEach(file => {
    const filePath = path.join(dir, file);
    const stat = fs.statSync(filePath);
    
    if (stat.isDirectory()) {
      processDirectory(filePath);
    } else if (file.endsWith('.ts') || file.endsWith('.tsx')) {
      processFile(filePath);
    }
  });
}

console.log('Starting console.log replacement...');
processDirectory(srcDir);
console.log('Console.log replacement complete!');
```

Run the script:
```bash
cd CashApp-iOS/CashAppPOS
node scripts/replace-console-logs.js
```

#### Step 4: Manual Review and Cleanup

After running the script, manually review and improve specific cases:

**Example: Authentication Service**
```typescript
// BEFORE
console.log('🔐 Attempting Supabase sign in for:', email);
console.log('✅ Supabase sign in successful');
console.error('❌ Supabase sign in error:', error);

// AFTER
import { logAuthEvent, logAuthError } from '../utils/loggingUtils';

logAuthEvent('Sign in attempt', { email });
logAuthEvent('Sign in successful', { email, userId: data.user?.id });
logAuthError('Sign in failed', error);
```

**Example: API Service**
```typescript
// BEFORE
console.log('📡 Making API request to:', endpoint);
console.log('✅ API response received:', response);
console.error('❌ API request failed:', error);

// AFTER
import { logApiCall, logApiError } from '../utils/loggingUtils';

const startTime = Date.now();
logApiCall(endpoint, method);

// ... make request ...

const duration = Date.now() - startTime;
logApiCall(endpoint, method, duration);

// On error:
logApiError(endpoint, method, error);
```

**Example: WebSocket Service**
```typescript
// BEFORE
console.log('🔌 Connecting to WebSocket:', wsUrl);
console.log('✅ WebSocket connected');
console.error('❌ WebSocket connection failed:', error);

// AFTER
import { logWebSocketEvent, logWebSocketError } from '../utils/loggingUtils';

logWebSocketEvent('Connection attempt', { url: wsUrl });
logWebSocketEvent('Connected successfully');
logWebSocketError('Connection failed', error);
```

---

## Part 2: Backend Logging Cleanup

#### Step 1: Configure Python Logging

Update `backend/app/core/logging_config.py`:
```python
import logging
import logging.handlers
import sys
import os
from pathlib import Path
from app.core.config import settings

def setup_logging():
    """Configure application logging based on environment"""
    
    # Determine log level
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Create logs directory if it doesn't exist
    log_dir = Path("logs")
    log_dir.mkdir(exist_ok=True)
    
    # Configure root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)
    
    # Clear existing handlers
    root_logger.handlers.clear()
    
    # Create formatters
    detailed_formatter = logging.Formatter(
        '%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s'
    )
    
    simple_formatter = logging.Formatter(
        '%(asctime)s - %(levelname)s - %(message)s'
    )
    
    # Console handler (always present)
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    
    if settings.ENVIRONMENT == 'production':
        console_handler.setFormatter(simple_formatter)
    else:
        console_handler.setFormatter(detailed_formatter)
    
    root_logger.addHandler(console_handler)
    
    # File handler (only in development and staging)
    if settings.ENVIRONMENT != 'production':
        file_handler = logging.handlers.RotatingFileHandler(
            log_dir / 'app.log',
            maxBytes=10 * 1024 * 1024,  # 10MB
            backupCount=5
        )
        file_handler.setLevel(logging.DEBUG)
        file_handler.setFormatter(detailed_formatter)
        root_logger.addHandler(file_handler)
    
    # Error file handler (all environments)
    error_handler = logging.handlers.RotatingFileHandler(
        log_dir / 'error.log',
        maxBytes=10 * 1024 * 1024,  # 10MB
        backupCount=10
    )
    error_handler.setLevel(logging.ERROR)
    error_handler.setFormatter(detailed_formatter)
    root_logger.addHandler(error_handler)
    
    # Configure specific loggers
    
    # Reduce SQLAlchemy logging in production
    if settings.ENVIRONMENT == 'production':
        logging.getLogger('sqlalchemy.engine').setLevel(logging.WARNING)
        logging.getLogger('sqlalchemy.pool').setLevel(logging.WARNING)
    
    # Reduce uvicorn logging
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    
    # Set our app logger
    app_logger = logging.getLogger('fynlo')
    app_logger.setLevel(log_level)
    
    return app_logger

# Create app logger instance
logger = setup_logging()
```

#### Step 2: Create Logging Utilities

Create `backend/app/utils/logging_utils.py`:
```python
import logging
import time
import functools
from typing import Any, Dict, Optional
from contextlib import contextmanager

logger = logging.getLogger('fynlo')

def log_api_call(endpoint: str, method: str, user_id: Optional[str] = None, **kwargs):
    """Log API call with context"""
    extra_data = {
        'endpoint': endpoint,
        'method': method,
        'user_id': user_id,
        **kwargs
    }
    logger.info(f"API {method} {endpoint}", extra=extra_data)

def log_api_error(endpoint: str, method: str, error: Exception, user_id: Optional[str] = None):
    """Log API error with context"""
    extra_data = {
        'endpoint': endpoint,
        'method': method,
        'user_id': user_id,
        'error_type': type(error).__name__,
        'error_message': str(error)
    }
    logger.error(f"API {method} {endpoint} failed: {error}", extra=extra_data)

def log_database_operation(operation: str, table: str, duration: Optional[float] = None, **kwargs):
    """Log database operations"""
    extra_data = {
        'operation': operation,
        'table': table,
        'duration_ms': duration * 1000 if duration else None,
        **kwargs
    }
    
    if duration and duration > 1.0:  # Slow query threshold
        logger.warning(f"Slow DB operation: {operation} on {table} took {duration:.2f}s", extra=extra_data)
    else:
        logger.debug(f"DB {operation} on {table}", extra=extra_data)

def log_auth_event(event: str, user_id: Optional[str] = None, email: Optional[str] = None, **kwargs):
    """Log authentication events"""
    extra_data = {
        'event': event,
        'user_id': user_id,
        'email': email,
        **kwargs
    }
    logger.info(f"Auth: {event}", extra=extra_data)

def log_auth_error(event: str, error: Exception, email: Optional[str] = None, **kwargs):
    """Log authentication errors"""
    extra_data = {
        'event': event,
        'email': email,
        'error_type': type(error).__name__,
        'error_message': str(error),
        **kwargs
    }
    logger.error(f"Auth error: {event} - {error}", extra=extra_data)

def log_websocket_event(event: str, connection_id: Optional[str] = None, user_id: Optional[str] = None, **kwargs):
    """Log WebSocket events"""
    extra_data = {
        'event': event,
        'connection_id': connection_id,
        'user_id': user_id,
        **kwargs
    }
    logger.info(f"WebSocket: {event}", extra=extra_data)

def log_payment_event(event: str, amount: Optional[float] = None, currency: Optional[str] = None, **kwargs):
    """Log payment events (be careful with sensitive data)"""
    extra_data = {
        'event': event,
        'amount': amount,
        'currency': currency,
        **kwargs
    }
    logger.info(f"Payment: {event}", extra=extra_data)

@contextmanager
def log_performance(operation: str, **kwargs):
    """Context manager for performance logging"""
    start_time = time.time()
    extra_data = {'operation': operation, **kwargs}
    
    try:
        logger.debug(f"Starting: {operation}", extra=extra_data)
        yield
    except Exception as e:
        duration = time.time() - start_time
        extra_data['duration_ms'] = duration * 1000
        extra_data['error'] = str(e)
        logger.error(f"Failed: {operation} after {duration:.2f}s - {e}", extra=extra_data)
        raise
    else:
        duration = time.time() - start_time
        extra_data['duration_ms'] = duration * 1000
        
        if duration > 1.0:  # Slow operation threshold
            logger.warning(f"Slow operation: {operation} took {duration:.2f}s", extra=extra_data)
        else:
            logger.debug(f"Completed: {operation} in {duration:.2f}s", extra=extra_data)

def log_decorator(operation: str):
    """Decorator for automatic function logging"""
    def decorator(func):
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            with log_performance(f"{operation}: {func.__name__}"):
                return await func(*args, **kwargs)
        
        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            with log_performance(f"{operation}: {func.__name__}"):
                return func(*args, **kwargs)
        
        return async_wrapper if asyncio.iscoroutinefunction(func) else sync_wrapper
    return decorator
```

#### Step 3: Replace Print Statements

Create a script to replace print statements:

Create `backend/scripts/replace_print_statements.py`:
```python
import os
import re
import sys
from pathlib import Path

def replace_print_statements(file_path):
    """Replace print statements with proper logging"""
    with open(file_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original_content = content
    
    # Patterns to replace
    patterns = [
        # Simple print statements
        (r'print\(([^)]+)\)', r'logger.info(\1)'),
        
        # Print with f-strings
        (r'print\(f"([^"]+)"\)', r'logger.info(f"\1")'),
        (r"print\(f'([^']+)'\)", r"logger.info(f'\1')"),
        
        # Debug prints
        (r'print\("DEBUG:', r'logger.debug("'),
        (r"print\('DEBUG:", r"logger.debug('"),
        
        # Error prints
        (r'print\("ERROR:', r'logger.error("'),
        (r"print\('ERROR:", r"logger.error('"),
        
        # Warning prints
        (r'print\("WARNING:', r'logger.warning("'),
        (r"print\('WARNING:", r"logger.warning('"),
    ]
    
    # Apply replacements
    for pattern, replacement in patterns:
        content = re.sub(pattern, replacement, content)
    
    # Add logger import if we made changes and it's not already imported
    if content != original_content:
        if 'import logging' not in content and 'from app.utils.logging_utils import' not in content:
            # Add import at the top after existing imports
            import_lines = []
            other_lines = []
            in_imports = True
            
            for line in content.split('\n'):
                if in_imports and (line.startswith('import ') or line.startswith('from ') or line.strip() == '' or line.startswith('#')):
                    import_lines.append(line)
                else:
                    in_imports = False
                    other_lines.append(line)
            
            # Add our import
            import_lines.append('import logging')
            import_lines.append('')
            import_lines.append('logger = logging.getLogger(__name__)')
            import_lines.append('')
            
            content = '\n'.join(import_lines + other_lines)
    
    # Write back if changed
    if content != original_content:
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f"Updated: {file_path}")
        return True
    
    return False

def process_directory(directory):
    """Process all Python files in directory"""
    updated_files = 0
    
    for root, dirs, files in os.walk(directory):
        # Skip certain directories
        if any(skip in root for skip in ['__pycache__', '.git', 'venv', 'env']):
            continue
            
        for file in files:
            if file.endswith('.py'):
                file_path = os.path.join(root, file)
                if replace_print_statements(file_path):
                    updated_files += 1
    
    return updated_files

if __name__ == '__main__':
    backend_dir = Path(__file__).parent.parent
    app_dir = backend_dir / 'app'
    
    print(f"Processing Python files in {app_dir}")
    updated = process_directory(app_dir)
    print(f"Updated {updated} files")
```

Run the script:
```bash
cd backend
python scripts/replace_print_statements.py
```

---

## Testing and Verification

### Mobile App Testing

1. **Verify logging service works:**
```typescript
// Add to App.tsx temporarily
import { logger } from './src/services/LoggingService';

logger.debug('App starting');
logger.info('App initialized');
logger.warn('Test warning');
logger.error('Test error');
```

2. **Check console output reduction:**
```bash
# Before cleanup
grep -r "console\." src/ | wc -l

# After cleanup (should be significantly reduced)
grep -r "console\." src/ | wc -l
```

3. **Test in production mode:**
```bash
# Build in release mode and verify minimal logging
npx react-native run-ios --configuration Release
```

### Backend Testing

1. **Verify logging configuration:**
```python
# Add to main.py temporarily
import logging
logger = logging.getLogger('fynlo')

logger.debug('Debug message')
logger.info('Info message')
logger.warning('Warning message')
logger.error('Error message')
```

2. **Check print statement reduction:**
```bash
# Before cleanup
grep -r "print(" app/ | wc -l

# After cleanup (should be significantly reduced)
grep -r "print(" app/ | wc -l
```

3. **Test log file creation:**
```bash
# Start the app and check log files are created
ls -la logs/
tail -f logs/app.log
```

---

## Performance Monitoring

### Mobile App Metrics

Monitor these metrics before and after cleanup:

1. **App startup time**
2. **Memory usage over time**
3. **CPU usage during normal operation**
4. **Bundle size (if logging affects it)**

### Backend Metrics

Monitor these metrics on DigitalOcean:

1. **Log file sizes**
2. **Disk usage**
3. **Memory usage**
4. **Response times**

---

## Maintenance

### Regular Tasks

1. **Weekly**: Review error logs and address issues
2. **Monthly**: Check log file sizes and rotation
3. **Quarterly**: Review logging levels and adjust if needed

### Log Rotation

Ensure log rotation is configured:

```python
# In logging_config.py - already included
logging.handlers.RotatingFileHandler(
    'logs/app.log',
    maxBytes=10 * 1024 * 1024,  # 10MB
    backupCount=5
)
```

### Monitoring Alerts

Set up alerts for:
- Error rate spikes
- Log file size growth
- Performance degradation

---

## Next Steps

After completing this cleanup:

1. **Monitor performance improvements**
2. **Set up proper error tracking** (Sentry, etc.)
3. **Implement structured logging** for better analysis
4. **Create logging dashboards** for monitoring

This cleanup will significantly improve your app's performance and provide better debugging capabilities while maintaining security.

