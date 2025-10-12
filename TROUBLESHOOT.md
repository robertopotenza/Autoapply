# Troubleshoot Guide

Use this reference to debug AutoApply backend issues quickly in development, staging, or production environments.

## 🔍 Quick Checks

1. **Is the server running?**
   - Start locally with `npm start` or `node src/server.js`.
   - Verify the health endpoint: `curl http://localhost:3000/health`.
2. **Is the database reachable?**
   - Confirm `DATABASE_URL` is set correctly.
   - Run `psql <connection string>` to test manual access.

## 🧪 Diagnostics Toolkit

| Command | Description |
| --- | --- |
| `node diagnostics/verify-database.js` | Validates required tables & columns exist. Fails on missing schema. |
| `node diagnostics/check-env.js` | Ensures critical environment variables are set. |
| `node scripts/predeploy.js` | Runs all preflight checks before deployment. |

## 🪵 Logs

- Info logs: `logs/info.log`
- Error logs: `logs/errors.log`
- Old logs rotate automatically into `logs/archive/` (older than 7 days).

View tail locally:
```
tail -n 50 logs/errors.log
```

### Frontend Debug Mode

The frontend wizard (`app.js`) and test harness support a DEBUG_MODE that can be enabled for troubleshooting:

**Enable Debug Mode:**
```javascript
// In browser console:
localStorage.setItem('DEBUG_MODE', 'true');
// Reload the page
location.reload();
```

Or set the global flag before page load:
```javascript
window.AUTOAPPLY_DEBUG = true;
```

**Disable Debug Mode:**
```javascript
// In browser console:
localStorage.removeItem('DEBUG_MODE');
// Reload the page
location.reload();
```

When enabled, DEBUG_MODE shows detailed logging for:
- Remote countries selection updates
- Form state synchronization
- Multi-select field changes
- Hidden input updates

This is particularly useful when debugging form submission issues or data persistence problems.

## 🧰 Common Fixes

### Database connection errors
```
❌ DB Connection Failed
1️⃣ Check DATABASE_URL in .env or Railway Variables
2️⃣ Confirm Railway DB is active
3️⃣ Run 'psql <connection string>' manually
```

### Migrations missing
- Run `node diagnostics/verify-database.js` to check schema.
- Execute SQL migrations in `database/migrations/` if needed.

### ENV variable issues
- Inspect `.env` (local) or Railway dashboard (cloud).
- Use `node diagnostics/check-env.js` to check required variables.

## 🔄 When Things Fail

1. Check `logs/errors.log` for stack traces.
2. Validate environment with diagnostics commands above.
3. Restart the server after addressing issues.
4. Contact maintainers with log snippets and failing commands if the issue persists.
