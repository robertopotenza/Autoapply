# Quick Start Guide - Observability Features

## What's New?

Your Apply Autonomously platform now has enhanced observability and debugging capabilities:

1. **Request Tracing**: Every HTTP request gets a unique trace ID
2. **System Diagnostics**: New `/api/diagnostics` endpoint for health checks
3. **Debug Mode**: Control log verbosity with `DEBUG_MODE`
4. **Clean Frontend**: Browser console logs only appear when needed

## Quick Tests

### 1. Test TraceId (Takes 10 seconds)

```bash
# Start your server
npm start

# In another terminal, make a request and check the header
curl -v http://localhost:3000/health 2>&1 | grep -i x-trace-id

# Expected output:
# < X-Trace-Id: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

### 2. Test Diagnostics Endpoint (Takes 5 seconds)

```bash
# Check system status
curl http://localhost:3000/api/diagnostics

# You'll see:
# {
#   "status": "operational",
#   "uptime_seconds": 123,
#   "schema_version": "005_enhanced_autoapply_tables.sql",
#   "dbConnection": true,
#   ...
# }
```

### 3. Test DEBUG_MODE (Takes 30 seconds)

```bash
# Start server with debug logging
DEBUG_MODE=true npm start

# You'll now see SQL queries in the logs:
# 2025-10-06T00:37:52.757Z DEBUG [Database] SQL Query {
#   "query": "SELECT * FROM users WHERE email = $1",
#   "duration": "5ms"
# }
```

### 4. Test Frontend Debug Mode (Takes 30 seconds)

```bash
# 1. Start server
npm start

# 2. Open browser to http://localhost:3000

# 3. Open browser console (F12) and run:
localStorage.setItem('DEBUG_MODE', 'true')
window.location.reload()

# Now you'll see debug logs in the browser console

# To disable:
localStorage.removeItem('DEBUG_MODE')
window.location.reload()
```

## Automated Test Script

We've included a test script that runs all checks automatically:

```bash
# Start your server first
npm start

# In another terminal, run the test script
./test_observability.sh

# Expected output:
# 🧪 Testing Observability Features
# ==================================
# ✓ All tests passed!
```

## Using in Production

### Monitor Your Application

Set up monitoring to poll the diagnostics endpoint:

```bash
# Check every 30 seconds
watch -n 30 'curl -s http://your-app.railway.app/api/diagnostics | jq'
```

### Troubleshoot Issues

When debugging issues:

```bash
# 1. Check diagnostics
curl https://your-app.railway.app/api/diagnostics | jq

# 2. Enable DEBUG_MODE via Railway dashboard:
#    Add environment variable: DEBUG_MODE=true
#    Redeploy

# 3. Check logs for SQL queries and detailed traces
```

### Track Request Flows

Every request now has a unique trace ID that appears in:
- Response headers: `X-Trace-Id`
- Server logs: `Incoming request { traceId: ... }`
- Diagnostics endpoint: `{ traceId: ... }`

Use these IDs to correlate requests across services and logs.

## Need Help?

- **Full Documentation**: See `docs/OBSERVABILITY.md`
- **Test Script**: Run `./test_observability.sh`
- **Issue Tracking**: Use traceIds when reporting bugs

## Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `DEBUG_MODE` | Enable verbose logging | `true` or `false` |
| `LOG_LEVEL` | Set specific log level | `debug`, `info`, `warn`, `error` |

## Railway Deployment

Your Railway configuration is already set up correctly:
- Migrations run before each deployment
- Server starts after successful migrations
- All observability features work automatically

## What to Expect

With these changes:
- ✅ Better debugging with trace IDs
- ✅ Easier troubleshooting with diagnostics
- ✅ Cleaner production logs
- ✅ On-demand verbose logging
- ✅ Better production monitoring

Enjoy your enhanced observability! 🎉
