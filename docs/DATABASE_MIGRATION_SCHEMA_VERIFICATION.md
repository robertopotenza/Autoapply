# Database Migration & Schema Verification System

## Overview

This document describes the automated database migration and schema verification system implemented to prevent runtime errors related to missing database tables or columns.

## Components

### 1. Enhanced Migration Script (`scripts/run-all-migrations.js`)

**Features:**
- **Timestamped Logging**: All migration operations are logged with ISO 8601 timestamps
- **File Logging**: Logs are written to `/logs/migrations.log` for debugging
- **Schema Migrations Table**: Tracks which migrations have been applied
- **Idempotent**: Safe to run multiple times - skips already applied migrations
- **Clear Error Messages**: Provides specific error messages when migrations fail

**Usage:**
```bash
node scripts/run-all-migrations.js
```

**Log Output Example:**
```
2025-10-06T00:15:32.123Z 🚀 Running migration schema.sql
2025-10-06T00:15:32.789Z ✅ Completed schema.sql at 2025-10-06T00:15:32.789Z (666ms)
```

**Exit Codes:**
- `0`: All migrations completed successfully
- `1`: Migration failed or completed with warnings

### 2. Schema Verification Utility (`src/utils/verifySchema.js`)

**Purpose:**
Validates that all required tables and columns exist in the database before the application starts.

**Required Tables & Columns:**
- `users`: user_id, email, password_hash, created_at
- `profile`: user_id, full_name, email, phone
- `job_preferences`: user_id, job_titles, locations, employment_type
- `jobs`: job_id, user_id, job_title, company_name, job_url, created_at
- `applications`: application_id, user_id, job_id, status, applied_at
- `eligibility`: user_id, work_authorization, security_clearance
- `screening_answers`: user_id, experience_summary, languages

**Error Messages:**
```
❌ Missing column jobs.user_id — run migrations or check schema.sql
❌ Missing table applications — run migrations or check schema.sql
```

**Functions:**
- `verifySchema(pool)`: Throws error if schema is invalid
- `verifySchemaGraceful(pool)`: Returns false if schema is invalid (doesn't throw)

### 3. Railway Configuration (`railway.json`)

**Release Command:**
```json
{
  "deploy": {
    "releaseCommand": "node scripts/run-all-migrations.js",
    "startCommand": "node src/server.js"
  }
}
```

This ensures migrations run **before** the application starts accepting traffic.

### 4. Server Integration (`src/server.js`)

The server now verifies the schema during initialization:

```javascript
// After database connection and migrations
await verifySchema(pool);
console.log("✅ Schema verified — starting server...");
```

If verification fails, the server will **not start** and will log the specific missing table/column.

### 5. CI/CD Integration (`.github/workflows/deploy.yml`)

**Pre-Deploy Check:**
```yaml
- name: Verify Database Schema
  run: node tests/verify-database.js
  continue-on-error: true
```

**Post-Deploy Check:**
```yaml
- name: Verify Database Schema (Post-Deploy)
  run: npx -y railway run node tests/verify-database.js
```

The post-deploy check will **fail the pipeline** if schema verification fails after deployment.

## Migration Tracking

### schema_migrations Table

The system automatically creates a `schema_migrations` table to track applied migrations:

```sql
CREATE TABLE IF NOT EXISTS schema_migrations (
    id SERIAL PRIMARY KEY,
    filename TEXT NOT NULL UNIQUE,
    applied_at TIMESTAMP DEFAULT NOW()
);
```

**Benefits:**
- Prevents re-applying migrations
- Provides audit trail of database changes
- Enables safe rollbacks if needed

## Error Prevention

This system prevents the following production errors:

✅ `column "j.user_id" does not exist`  
✅ `relation "applications" does not exist`  
✅ `column "profile.email" does not exist`  
✅ Any missing critical table or column

## Testing

### Run Schema Verification Test
```bash
node tests/verify-database.js
```

### Run Unit Tests
```bash
npm test
# or
npx jest tests/verifySchema.test.js
```

### Test Migration Script
```bash
node scripts/run-all-migrations.js
```

### View Migration Logs
```bash
cat logs/migrations.log
```

## Local Development

When running locally without a database:
1. Migration script will exit gracefully with a warning
2. Schema verification will skip if no database is configured
3. Server will start in limited mode without database features

## Production Deployment

On Railway:
1. **Release Command** runs migrations before deployment
2. **Server Start** verifies schema before accepting traffic
3. **CI/CD** verifies schema post-deployment
4. **Logs** are available in `/logs/migrations.log`

## Troubleshooting

### Migration Fails

**Check logs:**
```bash
cat logs/migrations.log
```

**Common issues:**
- Missing migration file
- SQL syntax error
- Database connection issues
- Insufficient permissions

### Schema Verification Fails

**Error message will indicate:**
- Which table is missing
- Which column is missing
- Recommended action (run migrations)

**Fix:**
```bash
node scripts/run-all-migrations.js
```

### Rollback a Migration

1. Check `schema_migrations` table to see applied migrations
2. Manually remove the migration record
3. Re-run the migration script

```sql
DELETE FROM schema_migrations WHERE filename = 'migration_file.sql';
```

## Best Practices

1. **Always test migrations locally first**
2. **Review migration logs after deployment**
3. **Keep migration files in version control**
4. **Use IF NOT EXISTS for idempotent migrations**
5. **Don't modify applied migrations - create new ones**

## Future Enhancements

Potential improvements:
- [ ] Migration rollback support
- [ ] Migration checksums for integrity validation
- [ ] Parallel migration execution for faster deployment
- [ ] Migration preview/dry-run mode
- [ ] Automated migration generation from schema changes
