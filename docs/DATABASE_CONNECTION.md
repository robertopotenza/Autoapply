# Database Connection Configuration

This document explains how the Autoapply project handles database connections across different environments (local, staging, and production).

## Overview

The database connection system uses **dotenv-flow** to automatically load environment-specific configuration files and a centralized **pool.js** module to manage the PostgreSQL connection pool.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Entry Point (server.js, railway-server.js, scripts/*)     │
│  └── require('dotenv-flow').config()                        │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  Environment Files (.env.*)                                  │
│  ├── .env.development  (local development)                   │
│  ├── .env.staging      (public Railway endpoint)             │
│  └── .env.production   (internal Railway endpoint)           │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  src/database/pool.js                                        │
│  ├── Auto-detects NODE_ENV                                   │
│  ├── Configures SSL (prod only)                              │
│  ├── Creates shared Pool instance                            │
│  └── Logs connection details                                 │
└────────────────────┬────────────────────────────────────────┘
                     │
                     ▼
┌─────────────────────────────────────────────────────────────┐
│  src/database/db.js                                          │
│  └── Uses pool from pool.js                                  │
│      Provides query helpers                                  │
└─────────────────────────────────────────────────────────────┘
```

## Environment Files

### .env.development (Local Development)
- Database: `postgres://postgres:postgres@localhost:5432/autoapply`
- SSL: **Disabled**
- Use: Local PostgreSQL instance

### .env.staging (Optional - Testing)
- Database: Public Railway endpoint (e.g., `tramway.proxy.rlwy.net`)
- SSL: **Disabled** (for compatibility)
- Use: External testing with Railway database

### .env.production (Production)
- Database: Internal Railway endpoint (`postgres.railway.internal`)
- SSL: **Enabled** with `rejectUnauthorized: false`
- Use: Production deployment on Railway

## Configuration Priority

dotenv-flow loads environment files in this order (later files override earlier ones):

1. `.env` - Base configuration (committed to repo as `.env.example`)
2. `.env.local` - Local overrides (not committed, in .gitignore)
3. `.env.[NODE_ENV]` - Environment-specific (e.g., `.env.production`)
4. `.env.[NODE_ENV].local` - Local environment overrides (not committed)
5. Actual environment variables (highest priority)

On Railway, the environment variables set in the dashboard take precedence over all file-based configurations.

## Key Features

### 1. Automatic Environment Detection
```javascript
const NODE_ENV = process.env.NODE_ENV || 'development';
const isProduction = NODE_ENV === 'production';
```

### 2. SSL Configuration
- **Production**: SSL enabled to work with Railway's internal PostgreSQL endpoint
- **Development/Staging**: SSL disabled to avoid handshake errors with local/public endpoints

### 3. Connection Logging
On startup, the pool logs:
- Current environment (development/staging/production)
- Database host being connected to
- SSL status (enabled/disabled)
- Connection verification timestamp

### 4. Error Handling
- Clear error messages for connection failures
- Helpful troubleshooting tips for common issues (ENOTFOUND, authentication, SSL)

## Usage

### Setting up Local Development

1. Ensure PostgreSQL is installed and running locally
2. Create a database: `createdb autoapply`
3. The `.env.development` file is already configured for `localhost:5432`
4. Start the server: `npm run dev`

### Setting up Railway Production

1. Ensure these variables are set in Railway dashboard:
   ```
   NODE_ENV=production
   DATABASE_URL=postgres://postgres:PASSWORD@postgres.railway.internal:5432/railway
   ```
2. The `.env.production` file provides defaults but Railway variables take precedence
3. Deploy: Railway automatically uses the correct configuration

### Testing Database Connection

Use the included verification script:

```bash
# Local (development)
NODE_ENV=development node scripts/check-db-connection.js

# Production (on Railway)
railway shell
node scripts/check-db-connection.js
```

The script will:
- ✅ Verify connection to the database
- ✅ Display environment and SSL configuration
- ✅ Test read and write operations
- ✅ List existing tables
- ❌ Show clear error messages if connection fails

## Troubleshooting

### Error: ENOTFOUND postgres.railway.internal

**Cause**: Trying to connect to internal Railway endpoint from outside Railway

**Solution**: 
- Local development: Use `.env.development` with localhost
- External testing: Use `.env.staging` with public Railway endpoint
- Production: Only works inside Railway environment

### Error: SSL handshake failed

**Cause**: SSL mismatch between environment and configuration

**Solution**:
- Ensure NODE_ENV matches your environment
- Development: Set `NODE_ENV=development` (SSL disabled)
- Production: Set `NODE_ENV=production` (SSL enabled)

### Error: Connection refused

**Cause**: PostgreSQL server is not running or not accessible

**Solution**:
- Local: Start PostgreSQL service
- Railway: Check database service is running in Railway dashboard

## Migration to This System

All existing scripts have been updated to use dotenv-flow:

- ✅ `server.js` - Updated to use dotenv-flow
- ✅ `railway-server.js` - Updated to use dotenv-flow
- ✅ All scripts in `/scripts` - Updated to use dotenv-flow
- ✅ `src/database/db.js` - Now uses shared pool from pool.js

## Best Practices

1. **Never commit sensitive credentials** - Use .gitignore for local environment files
2. **Use Railway dashboard for production secrets** - Don't hardcode production credentials
3. **Test locally first** - Use check-db-connection.js before deploying
4. **Monitor connection logs** - Watch for connection errors in Railway logs
5. **Use DATABASE_URL** - Single variable is simpler than individual PG* variables

## Files Modified/Created

### New Files
- `src/database/pool.js` - Centralized connection pool
- `scripts/check-db-connection.js` - Connection verification tool
- `.env.development` - Local development configuration
- `.env.production` - Production configuration
- `.env.staging` - Staging configuration (optional)

### Updated Files
- `src/server.js` - Uses dotenv-flow
- `src/railway-server.js` - Uses dotenv-flow
- `src/database/db.js` - Uses pool from pool.js
- All scripts in `/scripts` - Updated to use dotenv-flow
- `.gitignore` - Added environment file patterns

## Summary

This implementation ensures:
- ✅ No more "ENOTFOUND postgres.railway.internal" errors
- ✅ Correct SSL configuration per environment
- ✅ Clear connection logging and error messages
- ✅ Single source of truth for database connection (pool.js)
- ✅ Environment-specific configuration without code changes
- ✅ Easy testing and troubleshooting with check-db-connection.js
