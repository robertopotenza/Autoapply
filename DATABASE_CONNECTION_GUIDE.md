# Database Connection Guide

## Overview

This project now uses a **robust, environment-aware database connection system** that eliminates the "ENOTFOUND postgres.railway.internal" error and works seamlessly across:

- 🏠 **Local Development** (localhost)
- 🧪 **Staging** (Railway public endpoints)
- 🚀 **Production** (Railway internal endpoints)

---

## Quick Start

### Local Development

1. **Install PostgreSQL locally** (if not already installed):
   ```bash
   # macOS
   brew install postgresql@16
   brew services start postgresql@16

   # Ubuntu/Debian
   sudo apt-get install postgresql postgresql-contrib
   sudo systemctl start postgresql

   # Windows
   # Download from https://www.postgresql.org/download/windows/
   ```

2. **Create the database**:
   ```bash
   createdb autoapply
   ```

3. **Update `.env.development`** (already configured):
   ```bash
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoapply
   ```

4. **Test the connection**:
   ```bash
   npm run check-db
   ```
   or
   ```bash
   node scripts/check-db-connection.js
   ```

5. **Run migrations**:
   ```bash
   node scripts/run-all-migrations.js
   ```

---

### Railway Production

1. **Set environment variables in Railway**:
   - Go to Railway Dashboard → Your Service → Variables
   - Ensure `DATABASE_URL` is set (Railway usually auto-injects this)
   - Verify it uses `postgres.railway.internal` (not the public `.app` hostname)

2. **Test the connection on Railway**:
   ```bash
   railway run node scripts/check-db-connection.js
   ```

3. **Deploy**:
   ```bash
   railway up
   ```

---

## Environment Configuration

### How It Works

The system uses **dotenv-flow** which automatically loads the correct `.env` file based on `NODE_ENV`:

| Environment | File Loaded | Database | SSL |
|------------|-------------|----------|-----|
| Development | `.env.development` | localhost:5432 | Disabled |
| Staging | `.env.staging` | Railway public or internal | Enabled |
| Production | `.env.production` | Railway internal | Enabled |

### Environment Files

#### `.env.development` (Local)
```bash
NODE_ENV=development
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/autoapply
```

#### `.env.production` (Railway)
```bash
NODE_ENV=production
# Railway auto-injects DATABASE_URL with internal hostname
# DATABASE_URL=postgresql://postgres:PASSWORD@postgres.railway.internal:5432/railway
```

#### `.env.staging` (Optional)
```bash
NODE_ENV=staging
# Use public endpoint for external testing
DATABASE_URL=postgresql://postgres:PASSWORD@containers-us-west-xyz.railway.app:5432/railway
```

---

## Key Features

### 1. Automatic Environment Detection

The `src/database/pool.js` module:
- ✅ Detects `NODE_ENV` automatically
- ✅ Loads the correct `.env` file
- ✅ Configures SSL appropriately
- ✅ Uses internal Railway hostname in production
- ✅ Provides detailed connection logging

### 2. Connection Pool Management

```javascript
const { pool, testConnection, closePool } = require('./src/database/pool');

// Test connection
await testConnection();

// Use the pool
const result = await pool.query('SELECT NOW()');

// Graceful shutdown
await closePool();
```

### 3. Error Handling

The pool automatically:
- 🔍 Detects `ENOTFOUND` errors and provides troubleshooting hints
- 🔄 Retries connections with configurable timeouts
- 📝 Logs detailed error messages
- 🛡️ Prevents SSL handshake errors in development

---

## Troubleshooting

### "ENOTFOUND postgres.railway.internal"

**Cause**: This error occurs when:
1. You're running locally but DATABASE_URL points to Railway's internal hostname
2. NODE_ENV is set to "production" on your local machine

**Solution**:
```bash
# Check your NODE_ENV
echo $NODE_ENV

# If it's "production" locally, unset it:
unset NODE_ENV

# Or explicitly set it to development:
export NODE_ENV=development

# Then run your script
node scripts/check-db-connection.js
```

### Connection Refused (ECONNREFUSED)

**Cause**: PostgreSQL is not running locally.

**Solution**:
```bash
# macOS
brew services start postgresql@16

# Linux
sudo systemctl start postgresql

# Windows
# Start PostgreSQL service from Services panel
```

### Authentication Failed

**Cause**: Wrong username/password in DATABASE_URL.

**Solution**:
```bash
# Check your .env.development file
cat .env.development

# Update DATABASE_URL with correct credentials
DATABASE_URL=postgresql://YOUR_USER:YOUR_PASSWORD@localhost:5432/autoapply
```

### Tables Missing

**Cause**: Migrations haven't been run.

**Solution**:
```bash
# Run all migrations
node scripts/run-all-migrations.js

# Or use the diagnostic script
node scripts/diagnose-and-fix-db.js
```

---

## NPM Scripts

Add these to `package.json` for convenience:

```json
{
  "scripts": {
    "check-db": "node scripts/check-db-connection.js",
    "migrate": "node scripts/run-all-migrations.js",
    "diagnose-db": "node scripts/diagnose-and-fix-db.js"
  }
}
```

Then run:
```bash
npm run check-db
npm run migrate
npm run diagnose-db
```

---

## Railway Deployment Checklist

Before deploying to Railway:

- [ ] Ensure `NODE_ENV=production` in Railway environment variables
- [ ] Verify `DATABASE_URL` uses `postgres.railway.internal` hostname
- [ ] Test connection: `railway run node scripts/check-db-connection.js`
- [ ] Run migrations: `railway run node scripts/run-all-migrations.js`
- [ ] Check server logs for successful database connection
- [ ] Verify no "ENOTFOUND" errors in logs

---

## Advanced Configuration

### Custom Pool Settings

You can override pool settings via environment variables:

```bash
# Maximum number of clients in the pool
DB_POOL_MAX=20

# Minimum number of clients in the pool
DB_POOL_MIN=5

# Connection timeout (milliseconds)
DB_CONNECTION_TIMEOUT=10000

# Idle client timeout (milliseconds)
DB_IDLE_TIMEOUT=30000

# Query timeout (milliseconds)
DB_QUERY_TIMEOUT=30000
```

### Connection Monitoring

The pool emits events for monitoring:

```javascript
const { pool } = require('./src/database/pool');

pool.on('connect', () => {
  console.log('New client connected');
});

pool.on('error', (err) => {
  console.error('Idle client error:', err);
});
```

---

## Migration to New System

If you have an existing project using the old db.js:

1. ✅ **No changes needed!** The old `src/database/db.js` now uses the new robust pool internally.

2. ✅ All existing code using `require('./database/db')` continues to work.

3. ✅ You can optionally migrate to the new API:
   ```javascript
   // Old way (still works)
   const db = require('./database/db');
   await db.query('SELECT * FROM users');

   // New way (recommended)
   const { pool } = require('./database/pool');
   await pool.query('SELECT * FROM users');
   ```

---

## Support

If you encounter issues:

1. **Run the diagnostic script**:
   ```bash
   node scripts/check-db-connection.js
   ```

2. **Check the output** for specific error codes and troubleshooting hints

3. **Verify environment variables**:
   ```bash
   echo $NODE_ENV
   echo $DATABASE_URL
   ```

4. **Check Railway logs** if deployed:
   ```bash
   railway logs
   ```

---

## Summary

✅ **Environment-aware** - Automatically detects dev/staging/prod
✅ **Robust error handling** - Detailed error messages and troubleshooting
✅ **SSL configuration** - Correct SSL settings per environment
✅ **Connection pooling** - Optimized pool settings
✅ **Migration support** - All scripts updated to use dotenv-flow
✅ **Railway optimized** - Uses internal hostname for production

**No more ENOTFOUND errors!** 🎉
