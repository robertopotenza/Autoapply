# 🔍 Observability Features - README

## What You Get

Your Apply Autonomously platform now has **enterprise-grade observability** built in:

- 🏷️ **Request Tracing**: Every request gets a unique UUID
- 📊 **System Diagnostics**: Real-time health and status monitoring
- 🐛 **Debug Mode**: On-demand verbose logging (backend & frontend)
- 🧹 **Clean Production**: No console noise unless you want it

## 🚀 Quick Start (3 commands)

```bash
# 1. Start your server
npm start

# 2. Check system health
curl http://localhost:3000/api/diagnostics | jq

# 3. Run automated tests
./test_observability.sh
```

**Expected Result:** ✅ All tests pass, diagnostics shows "operational"

## 📖 Documentation

| Document | Purpose | Time to Read |
|----------|---------|--------------|
| [QUICKSTART_OBSERVABILITY.md](QUICKSTART_OBSERVABILITY.md) | Get started in 5 minutes | 5 min |
| [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md) | Complete technical guide | 15 min |
| [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md) | What changed and why | 10 min |

## ✨ Key Features

### 1. TraceId on Every Request

**What it does:** Every HTTP request gets a unique identifier

**How to use:**
```bash
curl -v http://localhost:3000/health | grep -i trace
```

**What you see:**
```
< X-Trace-Id: a3f7c8e9-4d2b-4a1e-9f3c-8b7a6c5d4e3f
```

**In logs:**
```
2025-10-06 INFO [Server] Incoming request {
  "traceId": "a3f7c8e9-4d2b-4a1e-9f3c-8b7a6c5d4e3f",
  "method": "GET",
  "path": "/health"
}
```

### 2. System Diagnostics Endpoint

**What it does:** Check system health and status

**How to use:**
```bash
curl http://localhost:3000/api/diagnostics
```

**What you get:**
```json
{
  "status": "operational",
  "uptime_seconds": 3456,
  "schema_version": "005_enhanced_autoapply_tables.sql",
  "dbConnection": true,
  "activeMigrations": [...],
  "traceId": "..."
}
```

**Use for:**
- Health checks
- Monitoring alerts
- Deployment verification
- Quick troubleshooting

### 3. DEBUG_MODE Logging

**What it does:** Control log verbosity with a single environment variable

**How to enable:**
```bash
DEBUG_MODE=true npm start
```

**What you see:**
- All INFO, WARN, ERROR logs (always shown)
- Plus DEBUG logs including SQL queries:

```
2025-10-06 DEBUG [Database] SQL Query {
  "query": "SELECT * FROM users WHERE email = $1",
  "params": ["user@example.com"],
  "duration": "5ms"
}
```

**Security:** Passwords and tokens are automatically masked:
```
"query": "UPDATE users SET password_hash = $1",
"params": ["[REDACTED]"]
```

### 4. Frontend Debug Mode

**What it does:** Control browser console output

**How to enable:**
```javascript
// In browser console:
localStorage.setItem('DEBUG_MODE', 'true')
window.location.reload()

// Or use helper:
window.autoApplyDebug.enableDebug()
```

**What you see:**
```
🔄 Loading existing user data...
✅ Auth token found
📡 Response status: 200 OK
✅ Form populated successfully
```

**To disable:**
```javascript
localStorage.removeItem('DEBUG_MODE')
window.location.reload()
// Or: window.autoApplyDebug.disableDebug()
```

## 🧪 Testing

### Automated Tests

We provide a comprehensive test script:

```bash
./test_observability.sh
```

**Tests:**
- ✅ TraceId middleware functionality
- ✅ X-Trace-Id header presence
- ✅ Diagnostics endpoint response
- ✅ TraceId uniqueness across requests
- ✅ UUID format validation

**Expected output:**
```
🧪 Testing Observability Features
==================================
✓ All tests passed!
```

### Manual Testing

**Test TraceId:**
```bash
curl -v http://localhost:3000/health 2>&1 | grep -i x-trace-id
```

**Test Diagnostics:**
```bash
curl http://localhost:3000/api/diagnostics | jq
```

**Test DEBUG_MODE:**
```bash
DEBUG_MODE=true npm start
# Watch for DEBUG logs in output
```

**Test Frontend:**
1. Open http://localhost:3000 in browser
2. Open console (F12)
3. Run: `localStorage.setItem('DEBUG_MODE', 'true')`
4. Reload page
5. Watch for debug logs

## 🚢 Production Deployment

### Railway Configuration

Already configured! Your `railway.json`:
```json
{
  "deploy": {
    "releaseCommand": "node scripts/run-all-migrations.js",
    "startCommand": "node src/server.js"
  }
}
```

### Environment Variables

Add these in Railway dashboard if needed:

| Variable | Purpose | Recommended Value |
|----------|---------|-------------------|
| `DEBUG_MODE` | Enable verbose logging | `false` (production) |
| `LOG_LEVEL` | Winston log level | `info` (production) |

### Monitoring Setup

Poll the diagnostics endpoint:

```bash
# Check every 30 seconds
watch -n 30 'curl -s https://your-app.railway.app/api/diagnostics | jq'
```

**Alert on:**
- `status !== "operational"`
- `dbConnection === false`
- High uptime (means no recent restarts)

## 📊 Example Outputs

See complete examples in demo output:

```bash
# View example outputs
cat docs/DEMO_OUTPUT.txt
```

## 🛠️ Troubleshooting

### Issue: No TraceId in headers

**Solution:** Ensure server is running with latest code
```bash
git pull
npm install
npm start
```

### Issue: Diagnostics endpoint 404

**Solution:** Check route mounting in server.js
```bash
curl http://localhost:3000/api/diagnostics
# Should return JSON, not 404
```

### Issue: DEBUG_MODE not working

**Check:**
1. Environment variable spelling: `DEBUG_MODE=true` (case-sensitive)
2. Server restart after setting variable
3. Check logs for "DEBUG" level messages

**Frontend:**
1. Check localStorage: `localStorage.getItem('DEBUG_MODE')`
2. Try: `window.AUTOAPPLY_DEBUG = true`
3. Hard refresh (Ctrl+Shift+R)

### Issue: SQL logs not appearing

**Check:**
1. `DEBUG_MODE=true` is set
2. Database queries are happening
3. Using db.query() wrapper (not raw pool.query())

## 🎯 Best Practices

### Development
- ✅ Enable DEBUG_MODE for development
- ✅ Use traceIds when reporting bugs
- ✅ Check diagnostics before troubleshooting

### Production
- ✅ Keep DEBUG_MODE disabled
- ✅ Monitor /api/diagnostics endpoint
- ✅ Use traceIds for error tracking
- ✅ Enable DEBUG_MODE only when debugging issues

### Frontend
- ✅ Keep DEBUG_MODE disabled by default
- ✅ Enable only when troubleshooting
- ✅ Use helper functions for team members

## 📈 Benefits

### For Developers
- 🔍 Trace requests end-to-end
- 🐛 Debug issues faster
- 📊 Monitor system health
- 🧹 Clean logs in production

### For Operations
- 📊 Real-time health monitoring
- 🚨 Easy alerting setup
- 🔍 Quick troubleshooting
- 📈 Deployment verification

### For Users
- ⚡ Better support (traceIds for tickets)
- 🛡️ More secure (sensitive data masked)
- 🚀 Faster issue resolution

## 📝 What Changed

**New Files:**
- `src/middleware/traceId.js` - TraceId middleware
- `src/routes/diagnostics.js` - Diagnostics endpoint
- `docs/OBSERVABILITY.md` - Technical docs
- `QUICKSTART_OBSERVABILITY.md` - Quick guide
- `test_observability.sh` - Test script

**Modified Files:**
- `src/server.js` - Mount new middleware/routes
- `src/utils/logger.js` - Add DEBUG_MODE support
- `src/database/db.js` - Add SQL logging
- `public/*.js`, `public/*.html` - Frontend debug guards

**No Breaking Changes!** All features are additive.

## 🎓 Learn More

1. **Quick Start**: [QUICKSTART_OBSERVABILITY.md](QUICKSTART_OBSERVABILITY.md)
2. **Full Technical Guide**: [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)
3. **Implementation Details**: [IMPLEMENTATION_SUMMARY.md](IMPLEMENTATION_SUMMARY.md)
4. **Run Tests**: `./test_observability.sh`

## 🤝 Support

Need help?
1. Check the [troubleshooting section](#-troubleshooting)
2. Review [docs/OBSERVABILITY.md](docs/OBSERVABILITY.md)
3. Use traceIds when reporting issues
4. Enable DEBUG_MODE to see detailed logs

---

**Status:** ✅ Production Ready  
**Version:** 1.0  
**Last Updated:** October 6, 2025  
**Tests:** ✅ All Passing  
