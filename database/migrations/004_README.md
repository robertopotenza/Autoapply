# Migration 004: Jobs Table user_id Column

## Overview
This migration adds an optional `user_id` column to the `jobs` table to support both global and user-specific jobs.

## Business Logic

### Two Types of Jobs

1. **Global Jobs (user_id IS NULL)**
   - Jobs scraped from public job boards (Indeed, LinkedIn, Glassdoor, etc.)
   - Available to all users for viewing and application
   - Created by automated job scanning services
   - Core job discovery feature of the platform

2. **User-Specific Jobs (user_id is set)**
   - Jobs manually added or saved by individual users
   - Only visible to the user who created them
   - Used for custom job tracking

## Security & Privacy Model

The security model is designed to enable a shared job marketplace while maintaining application privacy:

- **Jobs Table**: Contains job postings (global or user-specific)
- **Applications Table**: Tracks which user applied to which job
- **User Isolation**: Users can only see their own application history
- **Global Access**: Global jobs (user_id IS NULL) are intentionally accessible to all users
- **Application Privacy**: The applications table ensures users only see their own applications

## Why user_id IS NULL is Intentional

The condition `WHERE j.user_id = $1 OR j.user_id IS NULL` in methods like `getStatistics()` and `getAnalytics()` is **intentional and secure**:

1. It allows users to see both:
   - Jobs they personally saved (user_id = userId)
   - Global jobs from job boards (user_id IS NULL)

2. Application privacy is maintained through the applications table:
   - Each user can only apply once per job (UNIQUE constraint)
   - Users only see their own application status
   - The JOIN condition `a.user_id = $1` ensures this

3. This enables the core functionality:
   - Job discovery from multiple sources
   - Shared job marketplace
   - Personal job tracking
   - Private application history

## Running the Migration

To apply this migration to your database:

```bash
# Using psql
psql $DATABASE_URL -f database/migrations/004_add_user_id_to_jobs.sql

# Or using the migration script
node scripts/run-migration.js 004
```

## Database Changes

### Columns Added
- `user_id` (INT, nullable, foreign key to users table)
- `source` (VARCHAR(100), nullable)
- `external_id` (VARCHAR(255), nullable)

### Indexes Created
- `idx_jobs_user_id` - For efficient user-specific job queries
- `idx_jobs_source_external_id` - Prevents duplicate jobs from external sources

### Comments Added
- Column comments explaining the nullable user_id field
- Column comments for source and external_id fields

## Impact on Existing Code

This migration supports existing code in `src/models/Job.js`:
- `create()` method can now insert user_id
- `findByUserId()` queries user-specific jobs
- `getStatistics()` queries both global and user-specific jobs
- `getAnalytics()` queries both global and user-specific jobs

## Backward Compatibility

This migration is backward compatible:
- Existing jobs will have user_id = NULL (global jobs)
- All existing functionality continues to work
- New functionality for user-specific jobs is now enabled
