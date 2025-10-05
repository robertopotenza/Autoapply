# Database Initialization Verification Guide

## Overview

The `initializeDatabase()` function in `src/database/db.js` has been updated to automatically run migration files after loading the base schema. This ensures that all AutoApply tables (jobs, applications, job_queue, autoapply_settings, etc.) are created when the database is initialized.

## What Changed

### Before
The function only loaded `database/schema.sql`, which contained:
- Base tables: users, profile, eligibility, screening_answers, job_preferences
- **Missing**: AutoApply tables defined in migration files

### After
The function now:
1. Loads `database/schema.sql` (base schema)
2. Runs all migration files in order:
   - `002_autoapply_tables.sql` - Creates jobs, applications, job_queue, autoapply_settings, etc.
   - `003_add_email_to_profile.sql` - Adds email column to profile
   - `003_add_password_reset.sql` - Creates password_reset_tokens table
   - `004_add_user_id_to_jobs.sql` - Adds user_id column to jobs (idempotent)
   - `005_enhanced_autoapply_tables.sql` - Creates enhanced autoapply tables

## How to Verify

### Method 1: Check the Code

Review the implementation in `src/database/db.js`:

```javascript
// The runSqlFile() helper function
async function runSqlFile(filePath, label) {
    // Loads and executes SQL file
    // Handles existing tables gracefully
}

// The updated initializeDatabase() function
async function initializeDatabase() {
    // 1. Load base schema
    await runSqlFile(schemaPath, 'Base schema');
    
    // 2. Run migrations
    for (const migration of migrations) {
        await runSqlFile(migration.path, migration.label);
    }
}
```

### Method 2: Test with a PostgreSQL Database

If you have a PostgreSQL database configured:

```bash
# Set database credentials
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run a simple test
node -e "
const db = require('./src/database/db');
db.initializeDatabase()
    .then(() => console.log('✅ Database initialized successfully'))
    .catch(err => console.error('❌ Error:', err.message));
"
```

### Method 3: Check Server Startup Logs

When the server starts, `initializeDatabase()` is automatically called. Check the logs:

```bash
npm start
```

Expected log output:
```
✅ Database configured using DATABASE_URL
Connected to PostgreSQL database
Database connection successful
✅ Base schema executed successfully
✅ Migration 002: AutoApply tables (jobs, applications, etc.) executed successfully
✅ Migration 003: Add email to profile executed successfully
✅ Migration 003b: Password reset tokens executed successfully
✅ Migration 004: Add user_id to jobs executed successfully
✅ Migration 005: Enhanced autoapply tables executed successfully
✅ Database initialization completed successfully
```

### Method 4: Verify Tables in PostgreSQL

Connect to your PostgreSQL database and verify tables exist:

```sql
-- Check critical AutoApply tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN (
    'users',
    'jobs',
    'applications',
    'job_queue',
    'autoapply_settings',
    'autoapply_sessions',
    'user_autoapply_status',
    'autoapply_config'
)
ORDER BY table_name;
```

Expected output should include all 8 tables.

## Error Handling

The function is idempotent and handles these scenarios:

1. **Tables already exist**: Logs info message and continues
2. **Migration file missing**: Logs warning and skips that migration
3. **Database error**: Throws error with details
4. **No database configured**: Logs warning and exits gracefully

## Testing

Run the test suite to verify the changes don't break existing functionality:

```bash
npm test
```

All 86 tests should pass. (Note: One unrelated test has a syntax issue but doesn't affect this change)

## Consistency with Other Scripts

This implementation follows the same pattern as:
- `scripts/run-all-migrations.js` - Comprehensive migration script
- `scripts/railway-db-setup.js` - Railway deployment setup
- Both scripts run migrations after base schema in the same order

## Benefits

1. **Complete Database Setup**: Single function call initializes entire database
2. **Idempotent**: Safe to run multiple times
3. **Consistent**: Same migration order as deployment scripts
4. **Well-Logged**: Clear feedback on what's happening
5. **Error-Tolerant**: Handles existing tables gracefully

## When This Runs

The `initializeDatabase()` function is called:
- When the server starts (`src/server.js`)
- When explicitly called by setup scripts
- During testing (if database is configured)

## Troubleshooting

### Issue: "Migration file not found"
**Solution**: Verify migration files exist in `database/migrations/` directory

### Issue: "Database not configured"
**Solution**: Set `DATABASE_URL` or individual `PG*` environment variables

### Issue: "Permission denied"
**Solution**: Ensure database user has CREATE TABLE permissions

### Issue: "Duplicate key error"
**Solution**: Normal if tables exist - check logs for "already exist (skipped)" messages

## Next Steps

After deployment:
1. Monitor server logs for successful initialization
2. Verify AutoApply features work correctly
3. Check that jobs can be created and applications tracked
4. Test autoapply functionality

## References

- Problem Statement: Update database initialization to include AutoApply tables
- Solution: Modified `initializeDatabase` to run migrations (Option 2)
- Related Files:
  - `src/database/db.js` - Main implementation
  - `database/schema.sql` - Base schema
  - `database/migrations/*.sql` - Migration files
  - `scripts/run-all-migrations.js` - Reference implementation
