# Database Scripts

This directory contains scripts for database initialization, migration, and verification.

## Available Scripts

### 1. init-database.js
**Purpose**: Initialize the database with the base schema from `database/schema.sql`

**Usage**:
```bash
npm run db:init
# or
node scripts/init-database.js
```

**What it does**:
- Tests database connection
- Creates all base tables (users, job_preferences, profile, eligibility, screening_answers)
- Sets up indexes and views
- Safe to run multiple times (uses `IF NOT EXISTS`)

---

### 2. run-migration-003.js
**Purpose**: Add email column to profile table (Migration 003)

**Usage**:
```bash
node scripts/run-migration-003.js
```

**What it does**:
- Tests database connection
- Adds `email` column to `profile` table
- Creates index on email column
- Verifies the column was added successfully

**Required for**: Saving email addresses entered in the wizard form

**See also**: `MIGRATION_003_GUIDE.md` for detailed instructions

---

### 3. run-migration-004.js
**Purpose**: Add user_id column to jobs table (Migration 004)

**Usage**:
```bash
node scripts/run-migration-004.js
```

**What it does**:
- Tests database connection
- Adds `user_id` column to `jobs` table (nullable, references users table)
- Adds `source` and `external_id` columns for job board tracking
- Creates indexes for performance
- Verifies all columns and indexes were added successfully

**Required for**: Supporting both user-specific and global job postings

**See also**: 
- `database/migrations/004_README.md` for detailed documentation
- `MIGRATION_004_VERIFICATION.md` for code compatibility verification

---

### 4. run-all-migrations.js
**Purpose**: Run all database migrations in order (comprehensive setup)

**Usage**:
```bash
node scripts/run-all-migrations.js
```

**What it does**:
- Tests database connection
- Runs all migrations in sequence:
  - Base schema (users, profile, preferences)
  - Migration 002 (jobs & applications tables)
  - Migration 003 (email to profile)
  - Migration 003b (password reset tokens)
  - Migration 004 (user_id to jobs)
  - Migration 005 (enhanced autoapply tables)
- Verifies all critical tables and views exist
- Shows detailed status for each migration

**When to use**: 
- Initial database setup
- Automated deployment (CI/CD)
- Database recovery or rebuild

**Note**: This script is called automatically during Railway deployment via the Procfile `release` command.

---

### 5. verify-database.js
**Purpose**: Verify database structure and check user data

**Usage**:
```bash
# Check database structure
node scripts/verify-database.js

# Check specific user's data
node scripts/verify-database.js --user user@example.com
```

**What it does**:
- Validates all required tables exist
- Checks all required columns in each table
- Shows user count
- (With --user flag) Displays complete user profile data

**When to use**:
- After running migrations
- To troubleshoot data storage issues
- To verify all fields are being saved

---

## Environment Setup

All scripts require database connection. Set these environment variables:

```bash
# Option 1: Using .env file
PGHOST=tramway.proxy.rlwy.net
PGUSER=postgres
PGPASSWORD=your_password_here
PGDATABASE=railway
PGPORT=5432
NODE_ENV=production

# Option 2: Using DATABASE_URL
DATABASE_URL=postgresql://postgres:password@host:5432/database
```

## Typical Workflow

### Initial Setup (Comprehensive):
```bash
# Run all migrations at once (recommended)
node scripts/run-all-migrations.js

# Verify structure
node scripts/verify-database.js
```

### Initial Setup (Step by Step):
```bash
# 1. Initialize database
npm run db:init

# 2. Run individual migrations
node scripts/run-migration-003.js
node scripts/run-migration-004.js

# 3. Verify structure
node scripts/verify-database.js
```

### Automated Deployment:
```bash
# Migrations run automatically via Procfile on Railway:
# release: node scripts/run-all-migrations.js
# 
# Or via GitHub Actions CI/CD:
# - name: Run database migrations
#   run: npx -y railway run node scripts/run-all-migrations.js
```

### After Form Submission:
```bash
# Check if user data was saved correctly
node scripts/verify-database.js --user test@example.com
```

### Troubleshooting:
```bash
# 1. Verify database structure
node scripts/verify-database.js

# 2. Check specific user's data
node scripts/verify-database.js --user user@example.com

# 3. Re-run specific migration if needed
node scripts/run-migration-004.js

# 4. Or re-run all migrations (safe to run multiple times)
node scripts/run-all-migrations.js
```

## Error Handling

If a script fails:
1. **Connection Error**: Check environment variables and network access
2. **Permission Error**: Verify database user has appropriate permissions
3. **Syntax Error**: Check PostgreSQL version compatibility

## Related Documentation

- `MIGRATION_003_GUIDE.md` - Detailed migration 003 instructions
- `database/migrations/004_README.md` - Migration 004 documentation
- `MIGRATION_004_VERIFICATION.md` - Code compatibility verification for migration 004
- `COMPLETE_FIX_SUMMARY.md` - Complete fix documentation
- `DATA_FLOW_DIAGRAM.md` - Visual data flow diagram
- `database/schema.sql` - Complete database schema
- `database/migrations/` - All migration files
