# Database Table Naming Fix - Issue Resolution

## Problem Statement
The repository had inconsistent table naming between health check scripts and actual database migrations, causing silent failures when checking database health.

## Issues Found

### 1. Database Health Check Script
**File**: `database-health-check.js`

**Problem**: Was checking for tables that don't exist:
- ❌ `job_opportunities` (should be `jobs`)
- ❌ `job_applications` (should be `applications`)
- ❌ `user_settings` (should be `autoapply_settings`)

**Impact**: Health check would report tables as missing even when they existed with correct names, causing confusion and making it appear that the database was not properly configured.

### 2. Outdated Documentation
**Files**: `README.md`, `README_DETAIL.md`, `ENHANCED_FEATURES.md`

**Problem**: Documentation referenced obsolete table names from an earlier version of the schema.

**Impact**: Developers and users would be confused about which table names to use, potentially writing queries against non-existent tables.

### 3. Obsolete Backup Files
**Files**: `autoapply_CONFLICT_BACKUP.js`, `server_CONFLICT_BACKUP.js`

**Problem**: These git conflict backup files contained old table references but lacked warnings that they were obsolete.

**Impact**: Could be accidentally used, causing runtime errors.

## Changes Made

### 1. Fixed Health Check Script ✅
```diff
- const tables = ['users', 'job_opportunities', 'job_applications', 'user_settings'];
+ const tables = ['users', 'jobs', 'applications', 'autoapply_settings'];
```

### 2. Updated Documentation ✅
Updated all references in:
- `README.md`
- `README_DETAIL.md`
- `ENHANCED_FEATURES.md`

### 3. Added Warnings to Obsolete Files ✅
Added prominent warnings to CONFLICT_BACKUP files to prevent accidental use.

## Verification

### Current State (All Correct ✅)

#### Database Migrations
All migrations use the correct unified table names:
- `002_autoapply_tables.sql` - Creates `jobs` and `applications` tables
- `004_add_user_id_to_jobs.sql` - Modifies `jobs` table
- `005_enhanced_autoapply_tables.sql` - References `jobs` and `applications`

#### Model Files
All models use correct table names:
- `src/models/Job.js` - Uses `jobs` table
- `src/models/Application.js` - Uses `applications` table
- `src/models/AutoApplySettings.js` - Uses `autoapply_settings` table

#### Service Files
All services use correct table names:
- `src/services/autoapply/JobScanner.js` - Uses `jobs` table
- `src/services/autoapply/ApplicationAutomator.js` - Uses `applications` table
- `src/services/autoapply/AutoApplyOrchestrator.js` - Uses `jobs` and `applications` tables

#### Scripts
- ✅ `scripts/verify-database.js` - Already correct
- ✅ `database-health-check.js` - Fixed in this PR

## Table Name Mapping

| Old Name (Obsolete) | New Name (Current) | Migration |
|---------------------|-------------------|-----------|
| `job_opportunities` | `jobs` | 002 |
| `job_applications` | `applications` | 002 |
| `user_settings` | `autoapply_settings` | 002 |

## Testing Recommendations

### 1. Database Health Check
```bash
node database-health-check.js
```
Expected output: All tables should show ✅ if database is configured correctly.

### 2. Database Verification
```bash
node scripts/verify-database.js
```
Expected output: Should verify all table structures are correct.

### 3. Migration Execution
The migrations are automatically run by `src/server.js` on startup:
```javascript
// Server.js runs all migrations from database/migrations/*.sql in alphabetical order
```

## Migration Execution Order

When deployed to Railway or any managed DB:
1. `database/schema.sql` (base tables: users, profiles, etc.)
2. `002_autoapply_tables.sql` (creates jobs, applications, etc.)
3. `003_add_email_to_profile.sql` (adds email column)
4. `003_add_password_reset.sql` (creates password_reset_tokens)
5. `004_add_user_id_to_jobs.sql` (adds user_id to jobs table)
6. `005_enhanced_autoapply_tables.sql` (creates autoapply_sessions, etc.)

## Related Documentation

See `DATABASE_SCHEMA_UNIFICATION.md` for the full history of table naming unification and why `jobs` and `applications` were chosen as the standard naming convention.

## Conclusion

✅ All table naming inconsistencies resolved
✅ Health check now uses correct table names
✅ Documentation updated to reflect current schema
✅ Obsolete files marked with warnings
✅ All code verified to use unified naming convention

The database schema is now consistent throughout the codebase. The health check script will correctly identify when tables exist or are missing, preventing silent failures.
