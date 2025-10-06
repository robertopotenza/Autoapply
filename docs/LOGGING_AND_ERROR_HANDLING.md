# Centralized Logging and Error Handling Implementation

This document describes the implementation of structured logging and centralized error handling in the Apply Autonomously platform.

## Overview

The implementation includes:
1. **Structured JSON Logger** - Outputs all logs as JSON with ISO timestamps
2. **AppError Class** - Standardized error handling with context preservation
3. **Global Error Handlers** - Catches uncaught exceptions and unhandled rejections

## 1. Logger Implementation

### Location
`src/utils/logger.js`

### Features

#### Structured JSON Output
All logs are output as JSON objects with the following fields:
- `timestamp`: ISO 8601 format timestamp
- `level`: Log level (ERROR, WARN, INFO, DEBUG)
- `context`: Module/component name
- `message`: Log message
- Additional context fields merged from parameters

#### Log Levels
The logger supports four log levels in order of severity:
- `ERROR` (0) - Critical errors
- `WARN` (1) - Warning conditions
- `INFO` (2) - Informational messages (default)
- `DEBUG` (3) - Debug information

#### Environment Variable Support
- `DEBUG_MODE=true` - Sets logger level to DEBUG
- `LOG_LEVEL=<level>` - Sets custom log level (ERROR, WARN, INFO, DEBUG)

#### Programmatic Level Control
```javascript
const logger = new Logger('MyModule');
logger.level = 'debug';  // Change level at runtime
console.log(logger.level);  // Check current level
```

### Usage Examples

```javascript
const { Logger } = require('./utils/logger');
const logger = new Logger('JobScanner');

// Simple log
logger.info('Job scanning started');

// Log with context
logger.info('User logged in', {
    userId: 12345,
    traceId: 'xyz-789',
    module: 'AuthService'
});

// Multiple context objects (will be merged)
logger.info('Application submitted',
    { userId: 999, jobId: 777 },
    { status: 'pending', timestamp: new Date().toISOString() }
);

// Error logging
logger.error('Database connection failed', {
    module: 'Database',
    host: 'localhost',
    port: 5432,
    error: err.message
});
```

### Output Example
```json
{
  "timestamp": "2025-10-06T00:30:49.245Z",
  "level": "INFO",
  "context": "JobScanner",
  "message": "User logged in",
  "userId": 12345,
  "traceId": "xyz-789",
  "module": "AuthService"
}
```

## 2. AppError Class

### Location
`src/utils/AppError.js`

### Features

The `AppError` class provides structured error handling with:
- Error message
- Error code (e.g., 'DB_ERROR', 'API_ERROR')
- Context object for additional information
- ISO timestamp
- Cause error (original error that caused this one)
- Stack trace preservation
- JSON serialization via `toJSON()`

### Factory Methods

Convenience methods for common error types:
- `AppError.database(message, context, cause)` - Database errors (code: DB_ERROR)
- `AppError.api(message, context, cause)` - API/external service errors (code: API_ERROR)
- `AppError.validation(message, context)` - Validation errors (code: VALIDATION_ERROR)
- `AppError.auth(message, context)` - Authentication errors (code: AUTH_ERROR)

### Usage Examples

```javascript
const AppError = require('./utils/AppError');

// Basic usage
throw new AppError('User not found', 'USER_NOT_FOUND', {
    userId: 123,
    module: 'UserService'
});

// Database error with cause
try {
    await pool.query(sql, params);
} catch (error) {
    throw AppError.database('Failed to execute query', {
        module: 'JobModel',
        method: 'getAnalytics',
        userId: 789,
        sqlCode: error.code
    }, error);
}

// API error
throw AppError.api('External service unavailable', {
    endpoint: 'https://api.example.com/apply',
    userId: 123,
    traceId: 'app-456-def'
});

// Logging AppError
try {
    // ... some operation
} catch (error) {
    if (error instanceof AppError) {
        logger.error('Operation failed', error.toJSON());
    } else {
        logger.error('Operation failed', {
            message: error.message,
            stack: error.stack
        });
    }
}
```

### JSON Serialization Example

```json
{
  "name": "AppError",
  "message": "Failed to execute query",
  "code": "DB_ERROR",
  "context": {
    "module": "JobModel",
    "method": "getAnalytics",
    "userId": 789,
    "sqlCode": "ETIMEDOUT"
  },
  "timestamp": "2025-10-06T00:31:56.766Z",
  "stack": "AppError: Failed to execute query\n    at ...",
  "cause": {
    "message": "connection timeout",
    "name": "Error",
    "stack": "Error: connection timeout\n    at ..."
  }
}
```

## 3. Global Error Handlers

### Location
`src/server.js` (lines 29-48)

### Implementation

Global handlers are set up early in the server initialization:

```javascript
// Global error handlers - must be set up early
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code
    });
    // Give logger time to flush, then exit
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? {
            message: reason.message,
            stack: reason.stack,
            name: reason.name
        } : reason,
        promise: promise.toString()
    });
});
```

### What They Do

1. **Uncaught Exception Handler**: Catches any synchronous errors that escape try/catch blocks
   - Logs the error with full context
   - Gracefully shuts down the process after 1 second (allows logs to flush)

2. **Unhandled Rejection Handler**: Catches rejected promises that aren't handled
   - Logs the rejection reason
   - Continues running (doesn't crash the server)

## 4. Usage in Models

### Example: Job Model

```javascript
const AppError = require('../utils/AppError');

static async getAnalytics(userId, period = '30') {
    try {
        const periodDays = parseInt(period) || 30;
        const result = await db.query(query, [userId, periodDays]);
        return result.rows[0];
    } catch (error) {
        throw AppError.database(
            'Failed to get job analytics',
            {
                module: 'Job',
                method: 'getAnalytics',
                userId,
                period,
                query: 'job_analytics'
            },
            error
        );
    }
}
```

### Example: Application Model

```javascript
const AppError = require('../utils/AppError');

static async create(applicationData) {
    try {
        const result = await db.query(query, params);
        return result.rows[0];
    } catch (error) {
        throw AppError.database(
            'Failed to create application',
            {
                module: 'Application',
                method: 'create',
                userId: applicationData.userId,
                jobId: applicationData.jobId,
                sqlCode: error.code
            },
            error
        );
    }
}
```

## 5. Testing

### Test Files
- `tests/logger.test.js` - 16 tests covering logger functionality
- `tests/AppError.test.js` - 21 tests covering AppError functionality

### Running Tests

```bash
# Run all tests
npm test

# Run specific test files
npm test -- tests/logger.test.js
npm test -- tests/AppError.test.js
```

### Test Coverage

**Logger Tests:**
- Structured JSON output validation
- ISO timestamp format verification
- Context object merging
- Log level filtering
- Programmatic level changes
- DEBUG_MODE environment variable support

**AppError Tests:**
- Basic error creation
- Error chaining (cause preservation)
- JSON serialization
- Factory methods
- Context preservation
- Stack trace handling

## 6. Migration Notes

### For Existing Code

1. **Import AppError**: Add to files that throw errors
   ```javascript
   const AppError = require('../utils/AppError');
   ```

2. **Replace Error throws**: Wrap database/API errors
   ```javascript
   // Before
   throw new Error(`Error getting analytics: ${error.message}`);
   
   // After
   throw AppError.database('Failed to get analytics', {
       module: 'Job',
       method: 'getAnalytics',
       userId,
       sqlCode: error.code
   }, error);
   ```

3. **Update error logging**: Use structured logging
   ```javascript
   // Before
   logger.error('Error:', error);
   
   // After
   logger.error('Operation failed', error.toJSON());
   ```

## 7. Benefits

1. **Better Debugging**: Structured logs with context make it easier to track down issues
2. **Consistent Format**: All logs follow the same JSON structure
3. **Error Context**: AppError preserves full error context and cause chains
4. **Production Safety**: Global handlers prevent silent crashes
5. **Easy Filtering**: JSON logs can be easily parsed and filtered by log aggregation tools
6. **Traceability**: Support for trace IDs and user IDs enables request tracking

## 8. Best Practices

1. **Always include context**: Add relevant context (userId, traceId, module, method) to logs
2. **Use appropriate log levels**: 
   - ERROR for failures that need attention
   - WARN for potential issues
   - INFO for normal operations
   - DEBUG for detailed troubleshooting
3. **Preserve error causes**: Always pass the original error as cause to AppError
4. **Structure over strings**: Use context objects instead of string concatenation
5. **Module naming**: Use descriptive context names that indicate the source

## 9. Acceptance Criteria Status

✅ **All server logs are JSON with timestamp and level fields**
- Logger outputs structured JSON
- Every log includes ISO timestamp and level

✅ **logger.info/error used in code produce consistent output including any passed context**
- Context objects are merged into log output
- Multiple context objects are supported

✅ **Setting DEBUG_MODE=true sets logger.level='debug'**
- DEBUG_MODE environment variable support implemented
- Programmatic level change also supported

✅ **AppError exists and is used in at least 3 critical areas**
- Job.getAnalytics
- Application.create
- User.create
- User.getCompleteProfile

✅ **Logged AppError includes context field**
- AppError.toJSON() returns full context
- Logger merges AppError context into logs

✅ **Handlers are present and log using logger.error**
- Uncaught exception handler implemented
- Unhandled rejection handler implemented
- Both use structured logging
