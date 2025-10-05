# Database Schema Fix for Password Reset Error

## Problem Summary

Your Auto-Apply application was experiencing a **"Error processing password reset request"** error because the database schema was incomplete. Specifically:

1. **Missing `password_reset_tokens` table** - The server tried to insert password reset tokens but the table didn't exist
2. **Missing `email` column** - Database initialization was failing due to missing columns
3. **Incomplete schema setup** - The database wasn't properly initialized with all required tables

## Root Cause Analysis

From your server logs, the specific errors were:
- `❌ Database initialization failed: column "email" does not exist`
- `relation "password_reset_tokens" does not exist`
- PostgreSQL error code `42P01` (relation does not exist)

## Solution Overview

I've created comprehensive database setup scripts that will:
1. ✅ Create all required tables in the correct order
2. ✅ Set up proper foreign key relationships
3. ✅ Create necessary indexes for performance
4. ✅ Verify the schema is working correctly

## Files Created

### 1. `scripts/fix-database-schema.js`
- **Purpose**: Complete database schema fix with detailed logging
- **Features**: 
  - Creates all missing tables
  - Sets up indexes and views
  - Tests password reset functionality
  - Provides detailed verification

### 2. `scripts/railway-db-setup.js`
- **Purpose**: Railway-optimized database setup
- **Features**:
  - Connection retry logic for Railway environment
  - Transaction-based setup for safety
  - Railway-specific configuration
  - Minimal logging for deployment

## Quick Fix Instructions

### Option 1: Run the Fix Script Locally

```bash
# Navigate to your project directory
cd /path/to/your/Autoapply

# Install dependencies if needed
npm install

# Run the database fix script
node scripts/fix-database-schema.js
```

### Option 2: Run on Railway (Recommended)

1. **Add the files to your repository:**
   ```bash
   git add scripts/fix-database-schema.js
   git add scripts/railway-db-setup.js
   git add DATABASE_FIX_README.md
   git commit -m "Add database schema fix scripts"
   git push origin main
   ```

2. **Run the setup script on Railway:**
   - Option A: Use Railway CLI
     ```bash
     railway run node scripts/railway-db-setup.js
     ```
   
   - Option B: Add as a build command in `railway.json`:
     ```json
     {
       "build": {
         "builder": "nixpacks",
         "buildCommand": "npm install && node scripts/railway-db-setup.js"
       }
     }
     ```

   - Option C: SSH into Railway and run manually:
     ```bash
     railway shell
     node scripts/railway-db-setup.js
     ```

### Option 3: Manual Database Setup

If you prefer to run the SQL directly:

```sql
-- 1. Create users table
CREATE TABLE IF NOT EXISTS users (
    user_id SERIAL PRIMARY KEY,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- 2. Create password reset tokens table (THE MISSING TABLE)
CREATE TABLE IF NOT EXISTS password_reset_tokens (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(64) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used_at TIMESTAMP DEFAULT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 3. Create magic link tokens table
CREATE TABLE IF NOT EXISTS magic_link_tokens (
    id SERIAL PRIMARY KEY,
    email VARCHAR(255) NOT NULL,
    token VARCHAR(255) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    used BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create indexes
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_password_reset_token ON password_reset_tokens(token);
CREATE INDEX IF NOT EXISTS idx_password_reset_email ON password_reset_tokens(email);
CREATE INDEX IF NOT EXISTS idx_magic_link_token ON magic_link_tokens(token);
CREATE INDEX IF NOT EXISTS idx_magic_link_email ON magic_link_tokens(email);
```

## Verification Steps

After running the fix, verify it worked:

1. **Check the server logs** - You should no longer see the database errors
2. **Test password reset** - Try the forgot password functionality again
3. **Run verification script**:
   ```bash
   node scripts/verify-database.js
   ```

## Expected Results

After the fix:
- ✅ Password reset will work without errors
- ✅ Server logs will show successful database initialization
- ✅ All user authentication features will function properly
- ✅ Database will have proper indexes for performance

## Troubleshooting

### If the fix doesn't work:

1. **Check environment variables:**
   ```bash
   echo $DATABASE_URL
   # Should show your PostgreSQL connection string
   ```

2. **Verify database connection:**
   ```bash
   node -e "
   const { Pool } = require('pg');
   const pool = new Pool({ connectionString: process.env.DATABASE_URL });
   pool.query('SELECT NOW()').then(() => console.log('✅ Connected')).catch(console.error);
   "
   ```

3. **Check table existence:**
   ```sql
   SELECT table_name FROM information_schema.tables 
   WHERE table_schema = 'public' 
   ORDER BY table_name;
   ```

### Common Issues:

- **Permission errors**: Ensure your database user has CREATE TABLE permissions
- **Connection timeouts**: Railway databases may need retry logic (included in scripts)
- **SSL errors**: Production environments require SSL (handled in scripts)

## Next Steps

1. **Run the fix** using one of the options above
2. **Test password reset** functionality
3. **Monitor server logs** to confirm no more database errors
4. **Consider setting up automated migrations** for future schema changes

## Support

If you continue to experience issues:
1. Check the server logs for specific error messages
2. Verify all environment variables are set correctly
3. Ensure your Railway database is accessible and has proper permissions
4. Run the verification script to identify any remaining issues

The password reset functionality should work perfectly after running these fixes!
