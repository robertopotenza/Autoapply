# Database Setup and Migration Guide

## Overview

This repository uses a unified table naming convention for job and application tracking:
- **`jobs`** table: Stores job postings (both global and user-specific)
- **`applications`** table: Tracks user applications to jobs

The previous naming scheme (`job_opportunities`/`job_applications`) has been deprecated in favor of this unified approach.

## Table Naming Convention

### Core Tables (from migrations 002 and 004)
- `jobs` - Job postings with user_id support (NULL for global jobs, set for user-specific jobs), source, and external_id for deduplication
- `applications` - Application tracking and status
- `autoapply_settings` - User autoapply preferences
- `job_queue` - Application task queue
- `application_status_history` - Status change tracking
- `ats_logs` - ATS interaction logs

### Enhanced Tables (from migration 005)
- `autoapply_sessions` - Active autoapply session tracking
- `user_autoapply_status` - Current autoapply on/off status per user
- `autoapply_config` - User-specific autoapply configuration
- `application_templates` - Cover letter and response templates
- `job_board_cookies` - Stored job board authentication
- `application_logs` - Detailed application attempt logs

### User Profile Tables (from base schema)
- `users` - User accounts
- `job_preferences` - Job search preferences
- `profile` - User profile information
- `eligibility` - Work eligibility and authorization
- `screening_answers` - Additional screening questions

## Running Migrations

### Option 1: Automatic Initialization (Recommended) ✨ NEW

**The database now initializes automatically when the server starts!**

When you run `npm start`, the `initializeDatabase()` function in `src/database/db.js` automatically:
1. Loads base schema (users, profile, preferences)
2. Runs migration 002 (jobs & applications tables)
3. Runs migration 003 (email to profile + password reset)
4. Runs migration 004 (user_id to jobs table)
5. Runs migration 005 (enhanced autoapply tables)

**Benefits:**
- ✅ No manual migration steps needed
- ✅ Idempotent (safe to run multiple times)
- ✅ Consistent with deployment scripts
- ✅ Clear logging of each step

**Verification:**
```bash
# Run the verification script to confirm implementation
node scripts/verify-db-initialization.js

# Check documentation for detailed testing
cat docs/DATABASE_INITIALIZATION_VERIFICATION.md
```

### Option 2: Manual Migration Script

You can also run all migrations manually:

```bash
node scripts/run-all-migrations.js
```

This script:
1. Tests database connection
2. Runs base schema (users, profile, preferences)
3. Runs migration 002 (jobs & applications tables)
4. Runs migration 003 (email to profile + password reset)
5. Runs migration 004 (user_id to jobs table)
6. Runs migration 005 (enhanced autoapply tables)
7. Verifies all critical tables exist

### Option 3: Run Individual Migrations

If you need to run specific migrations:

```bash
# Initialize base database (users, profile, etc.)
npm run db:init

# Run migration 003 (profile email field)
node scripts/run-migration-003.js

# Run migration 005 (enhanced autoapply tables)
node scripts/run-migration-005.js
```

### Option 4: Using psql directly

```bash
# Set your DATABASE_URL environment variable
export DATABASE_URL="postgresql://user:password@host:port/database"

# Run all migrations
psql $DATABASE_URL -f database/schema.sql
psql $DATABASE_URL -f database/migrations/002_autoapply_tables.sql
psql $DATABASE_URL -f database/migrations/003_add_email_to_profile.sql
psql $DATABASE_URL -f database/migrations/003_add_password_reset.sql
psql $DATABASE_URL -f database/migrations/004_add_user_id_to_jobs.sql
psql $DATABASE_URL -f database/migrations/005_enhanced_autoapply_tables.sql
```

## Verifying Database Structure

After running migrations, verify the database structure:

```bash
# Verify all tables and columns
node scripts/verify-database.js

# Verify specific user data
node scripts/verify-database.js --user user@example.com
```

The verification script will check:
- ✅ All required tables exist
- ✅ All required columns exist in each table
- ✅ Database views are created
- ✅ User data integrity (when using --user flag)

## Environment Variables

Set these environment variables before running migrations:

```bash
# Option 1: Use DATABASE_URL (recommended)
export DATABASE_URL="postgresql://user:password@host:port/database"

# Option 2: Use individual variables
export PGHOST="hostname"
export PGUSER="username"
export PGPASSWORD="password"
export PGDATABASE="database_name"
export PGPORT="5432"
```

## Migration Files

### Base Schema
- **database/schema.sql**: Creates users, profile, eligibility, screening_answers tables

### Migration 002
- **database/migrations/002_autoapply_tables.sql**: Creates jobs (with user_id, source, external_id), applications, autoapply_settings, job_queue, application_status_history, ats_logs tables

### Migration 003
- **database/migrations/003_add_email_to_profile.sql**: Adds email column to profile table
- **database/migrations/003_add_password_reset.sql**: Creates password_reset_tokens table

### Migration 004
- **database/migrations/004_add_user_id_to_jobs.sql**: Adds user_id, source, external_id columns to jobs table (idempotent - skips if columns exist from migration 002)

### Migration 005
- **database/migrations/005_enhanced_autoapply_tables.sql**: Creates enhanced autoapply tables (sessions, config, templates, cookies, logs)

## Code Updates

All code has been updated to use the unified naming convention:

### Updated Files
- `src/services/autoapply/AutoApplyOrchestrator.js` - Uses jobs/applications tables
- `src/services/autoapply/JobScanner.js` - Uses jobs table
- `src/services/autoapply/ApplicationAutomator.js` - Uses applications table
- `src/enhanced-integration.js` - Uses jobs/applications tables
- `src/database/enhanced_autoapply_schema.sql` - Creates supplementary tables only

### Legacy Models (Already Using Correct Names)
- `src/models/Job.js` - Uses jobs table
- `src/models/Application.js` - Uses applications table
- `src/models/AutoApplySettings.js` - Uses autoapply_settings table

## Troubleshooting

### "column does not exist" errors

If you see errors like `column "user_id" does not exist` in the jobs table:

1. Run migration 004: `psql $DATABASE_URL -f database/migrations/004_add_user_id_to_jobs.sql`
2. Verify with: `node scripts/verify-database.js`

### "relation does not exist" errors

If you see errors about missing tables:

1. Run all migrations: `node scripts/run-all-migrations.js`
2. Check which tables exist: `psql $DATABASE_URL -c "\dt"`
3. Verify with: `node scripts/verify-database.js`

### "already exists" warnings

These are normal if you've run migrations before. The `IF NOT EXISTS` clauses prevent errors when tables already exist.

## Testing

Run tests to ensure code works with the database schema:

```bash
npm test
```

All 74 tests should pass, including:
- Job model tests
- Application model tests
- Schema compatibility tests
- API endpoint tests

## Summary

The database now uses a unified naming convention where:
- ✅ **`jobs`** table stores all job postings (global and user-specific)
- ✅ **`applications`** table tracks all job applications
- ✅ Enhanced services use the same tables as legacy models
- ✅ No duplicate or conflicting table definitions
- ✅ All migrations can be run idempotently (safe to run multiple times)
