# Observability & Runtime Context Implementation

## Overview
This document describes the observability features added to the Apply Autonomously platform to improve debugging, monitoring, and operational visibility.

## Features Implemented

### 1. Request TraceId Middleware
**File:** `src/middleware/traceId.js`

Every HTTP request now gets a unique trace ID that:
- Uses `crypto.randomUUID()` for unique identification
- Is accessible via `req.traceId` in route handlers
- Is returned to clients via the `X-Trace-Id` response header
- Is logged with every incoming request

**Usage:**
```javascript
// In route handlers, traceId is available on req object
app.get('/api/endpoint', (req, res) => {
  logger.info('Processing request', { traceId: req.traceId });
  res.json({ traceId: req.traceId });
});
```

**Example Log Output:**
```
2025-10-06T00:37:52.757Z INFO [Server] Incoming request {
  "traceId": "3c8e919e-39bd-4331-b539-2cfdab78ec01",
  "method": "GET",
  "path": "/test",
  "ip": "::1"
}
```

### 2. Diagnostics Endpoint
**File:** `src/routes/diagnostics.js`
**Endpoint:** `GET /api/diagnostics`

Returns comprehensive system diagnostics:

```json
{
  "status": "operational",
  "uptime_seconds": 123,
  "schema_version": "005_enhanced_autoapply_tables.sql",
  "envMode": "production",
  "activeMigrations": [
    "002_autoapply_tables.sql",
    "003_add_email_to_profile.sql",
    "003_add_password_reset.sql",
    "004_add_user_id_to_jobs.sql",
    "005_enhanced_autoapply_tables.sql"
  ],
  "timestamp": "2025-10-06T00:37:52.771Z",
  "dbConnection": true,
  "schemaVerification": "valid",
  "traceId": "c6323164-97fb-42cc-8af9-cbe44ee25fda"
}
```

**Use Cases:**
- Health checks and monitoring
- Deployment verification
- Database migration status
- Quick troubleshooting

### 3. DEBUG_MODE Logging
**Files:** `src/utils/logger.js`, `src/database/db.js`

Enhanced logging with environment-based verbosity control:

**Enable Debug Mode:**
```bash
DEBUG_MODE=true npm start
```

**Features:**
- Automatically sets Winston log level to 'debug'
- Enables SQL query logging with duration tracking
- Masks sensitive data in SQL parameters (passwords, tokens, secrets)
- Console output only shows debug logs when DEBUG_MODE is enabled

**Example SQL Log Output (DEBUG_MODE=true):**
```
2025-10-06T00:37:52.757Z DEBUG [Database] SQL Query {
  "query": "SELECT * FROM users WHERE email = $1",
  "params": ["user@example.com"],
  "duration": "5ms"
}
```

**Sensitive Data Masking:**
```javascript
// Passwords and tokens are automatically masked
query: "UPDATE users SET password = $1"
params: ["[REDACTED]"]
```

### 4. Frontend Debug Mode
**Files:** `public/app.js`, `public/autoapply-integration.js`, `public/dashboard.html`

Frontend console logging is now controlled by DEBUG_MODE:

**Enable in Browser:**
```javascript
// Via localStorage
localStorage.setItem('DEBUG_MODE', 'true');
window.location.reload();

// Or via global variable
window.AUTOAPPLY_DEBUG = true;

// Or use helper functions
window.autoApplyDebug.enableDebug();  // Sets localStorage and reloads
window.autoApplyDebug.disableDebug(); // Removes DEBUG_MODE
```

**Benefits:**
- Cleaner production browser console
- On-demand debugging without code changes
- Preserves critical error messages always

## Testing Instructions

### 1. Test TraceId Middleware

```bash
# Start server
npm start

# Make a request and check headers
curl -v http://localhost:3000/health

# Look for:
# < X-Trace-Id: [UUID]
# And in server logs:
# Incoming request { traceId: [...], method: 'GET', path: '/health' }
```

### 2. Test Diagnostics Endpoint

```bash
curl http://localhost:3000/api/diagnostics | jq

# Expected response includes:
# - status: "operational"
# - uptime_seconds: [number]
# - schema_version: [latest migration file]
# - dbConnection: true/false
# - activeMigrations: [array of migration files]
```

### 3. Test DEBUG_MODE

**Backend:**
```bash
# Without DEBUG_MODE
npm start
# Should see: INFO, WARN, ERROR logs only

# With DEBUG_MODE
DEBUG_MODE=true npm start
# Should see: DEBUG logs including SQL queries
```

**Frontend:**
```javascript
// Open browser console
localStorage.setItem('DEBUG_MODE', 'true');
window.location.reload();

// Now all debug logs appear
// To disable:
localStorage.removeItem('DEBUG_MODE');
window.location.reload();
```

### 4. Test SQL Logging

```bash
# Start with DEBUG_MODE
DEBUG_MODE=true npm start

# Trigger database operations
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Check logs for SQL queries with timing
```

## Deployment Configuration

**Railway Configuration** (`railway.json`):
```json
{
  "deploy": {
    "releaseCommand": "node scripts/run-all-migrations.js",
    "startCommand": "node src/server.js"
  }
}
```

This ensures:
- Migrations run before each deployment
- Deployment fails if migrations fail
- Server starts only after successful migration

## Environment Variables

| Variable | Purpose | Default | Example |
|----------|---------|---------|---------|
| `DEBUG_MODE` | Enable verbose logging | `false` | `true` |
| `LOG_LEVEL` | Winston log level | `info` | `debug`, `warn`, `error` |
| `NODE_ENV` | Environment mode | `development` | `production` |

## Best Practices

1. **TraceId in Logs**: Always include `req.traceId` when logging within request handlers
2. **Debug Mode**: Use `DEBUG_MODE=true` during development, disable in production
3. **Diagnostics Monitoring**: Set up monitoring to poll `/api/diagnostics` regularly
4. **Frontend Debugging**: Enable browser DEBUG_MODE only when troubleshooting

## File Changes Summary

| File | Type | Description |
|------|------|-------------|
| `src/middleware/traceId.js` | NEW | TraceId middleware implementation |
| `src/routes/diagnostics.js` | NEW | Diagnostics endpoint |
| `src/utils/logger.js` | MODIFIED | Added DEBUG_MODE and SQL logging |
| `src/database/db.js` | MODIFIED | Integrated SQL logging |
| `src/server.js` | MODIFIED | Mount middleware and routes |
| `public/app.js` | MODIFIED | Frontend debug guards |
| `public/autoapply-integration.js` | MODIFIED | Frontend debug guards |
| `public/dashboard.html` | MODIFIED | Frontend debug guards |

## Troubleshooting

### TraceId Not Appearing in Logs
- Ensure middleware is mounted before route handlers
- Check that logger is properly imported
- Verify `req.traceId` is being used in log calls

### Diagnostics Endpoint Returns Errors
- Check database connection
- Ensure migrations directory exists
- Verify filesystem permissions

### DEBUG_MODE Not Working
- Check environment variable spelling (case-sensitive)
- For frontend, verify localStorage or window.AUTOAPPLY_DEBUG
- Clear cache if changes not reflecting

### SQL Logs Not Showing
- Ensure `DEBUG_MODE=true` is set
- Check that database queries are going through `db.query()`
- Verify logger level is set to 'debug'

## Future Enhancements

Potential improvements:
- Distributed tracing integration (OpenTelemetry)
- Performance metrics collection
- Request/response size tracking
- Error rate monitoring
- Custom log aggregation
