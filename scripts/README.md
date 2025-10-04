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

### 2. railway-db-setup.js
**Purpose**: Railway-optimized database setup for production deployment

**Usage**:
```bash
# Using Railway CLI (recommended for Railway deployments)
railway run npm run db:railway-setup
# or
railway run node scripts/railway-db-setup.js

# Or locally with environment variables set
npm run db:railway-setup
# or
node scripts/railway-db-setup.js
```

**What it does**:
- Tests database connection with retry logic (5 attempts)
- Creates all required tables in a transaction
- Sets up authentication tables (users, magic_link_tokens, password_reset_tokens)
- Creates user profile tables (job_preferences, profile, eligibility, screening_answers)
- Creates indexes for performance
- Creates database views
- Verifies critical tables exist
- Safe to run multiple times (uses `IF NOT EXISTS` and `CREATE OR REPLACE`)

**When to use**:
- Initial Railway deployment setup
- After database reset or migration
- When database schema needs to be recreated
- For fixing missing tables or schema issues

**Features**:
- Railway-specific connection settings
- Automatic retry on connection failure
- Transaction-based setup for data safety
- Detailed logging for debugging
- SSL support for production environments

---

### 3. run-migration-003.js
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

### 4. verify-database.js
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

### 5. fix-database-schema.js
**Purpose**: Comprehensive database schema fix with detailed verification and testing

**Usage**:
```bash
node scripts/fix-database-schema.js
```

**What it does**:
- Creates all required tables with detailed logging
- Sets up indexes for all tables
- Creates database views
- Tests password reset token functionality
- Provides comprehensive verification
- Detailed error reporting and debugging information

**When to use**:
- When database schema has issues or missing tables
- For comprehensive database setup with verification
- When troubleshooting database-related errors
- For testing password reset functionality

**Features**:
- Step-by-step logging
- Comprehensive table verification
- Password reset token testing
- Detailed error messages
- Safe to run multiple times

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

### Initial Setup (Local Development):
```bash
# 1. Initialize database
npm run db:init

# 2. Run migrations
node scripts/run-migration-003.js

# 3. Verify structure
node scripts/verify-database.js
```

### Initial Setup (Railway Production):
```bash
# 1. Use Railway-optimized setup
railway run npm run db:railway-setup

# 2. Verify deployment
railway logs

# 3. Check database structure (optional)
railway run node scripts/verify-database.js
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

# 3. Re-run migration if needed
node scripts/run-migration-003.js
```

## Error Handling

If a script fails:
1. **Connection Error**: Check environment variables and network access
2. **Permission Error**: Verify database user has appropriate permissions
3. **Syntax Error**: Check PostgreSQL version compatibility

## Related Documentation

- `MIGRATION_003_GUIDE.md` - Detailed migration instructions
- `COMPLETE_FIX_SUMMARY.md` - Complete fix documentation
- `DATA_FLOW_DIAGRAM.md` - Visual data flow diagram
- `database/schema.sql` - Complete database schema
- `database/migrations/` - All migration files
