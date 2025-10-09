# Database Schema Documentation Index

This directory contains comprehensive documentation about the Auto-Apply platform's database schema, with special focus on the screening data storage architecture.

## Quick Links

### 📚 Start Here
- **[SCREENING_DATA_RESOLUTION.md](SCREENING_DATA_RESOLUTION.md)** - Complete resolution report and summary
- **[FAQ_SCREENING_DATA.md](FAQ_SCREENING_DATA.md)** - Answers to common questions

### 🏗️ Architecture
- **[SCHEMA_ARCHITECTURE.md](SCHEMA_ARCHITECTURE.md)** - Detailed architecture documentation
- **[database/schema.sql](database/schema.sql)** - SQL schema with extensive comments

### 🔧 Tools & Scripts
- **[scripts/verify-screening-schema.js](scripts/verify-screening-schema.js)** - Verification script

### 🧪 Tests
- **[tests/wizard-screening.test.js](tests/wizard-screening.test.js)** - Unit tests
- **[tests/wizard-screening-e2e.test.js](tests/wizard-screening-e2e.test.js)** - E2E tests

## Common Questions

### Q: Where is screening data actually stored?

**A:** In the `screening_answers` table. See [FAQ_SCREENING_DATA.md](FAQ_SCREENING_DATA.md#q-should-i-be-saving-data-to-user_complete_profile-or-screening_answers)

### Q: Is user_complete_profile a table or a view?

**A:** It's a VIEW (not a table). See [SCHEMA_ARCHITECTURE.md](SCHEMA_ARCHITECTURE.md#the-user_complete_profile-view)

### Q: Why does screening_answers appear empty?

**A:** See [FAQ_SCREENING_DATA.md](FAQ_SCREENING_DATA.md#q-why-is-my-screening_answers-table-empty-even-though-the-wizard-says-data-was-saved) for troubleshooting steps

### Q: Should we consolidate tables into one?

**A:** No, the current design is optimal. See [FAQ_SCREENING_DATA.md](FAQ_SCREENING_DATA.md#q-should-we-convert-user_complete_profile-from-a-view-to-a-table)

## Documentation Structure

```
📁 Root Directory
├── 📄 SCREENING_DATA_RESOLUTION.md    ← Complete investigation results
├── 📄 FAQ_SCREENING_DATA.md           ← Common questions & answers
├── 📄 SCHEMA_ARCHITECTURE.md          ← Architecture deep dive
├── 📄 DATABASE_SCHEMA_DOCS.md         ← This index file
│
├── 📁 database/
│   ├── 📄 schema.sql                  ← Schema with detailed comments
│   └── 📁 migrations/                 ← Database migrations
│
├── 📁 src/
│   ├── 📁 database/
│   │   └── 📁 models/
│   │       ├── 📄 User.js             ← getCompleteProfile() method
│   │       ├── 📄 ScreeningAnswers.js ← upsert() for screening data
│   │       ├── 📄 JobPreferences.js   ← Step 1 data
│   │       ├── 📄 Profile.js          ← Step 2 data
│   │       └── 📄 Eligibility.js      ← Step 3 data
│   │
│   └── 📁 routes/
│       └── 📄 wizard.js                ← API endpoints
│
├── 📁 scripts/
│   └── 📄 verify-screening-schema.js  ← Verification tool
│
└── 📁 tests/
    ├── 📄 wizard-screening.test.js     ← Unit tests
    └── 📄 wizard-screening-e2e.test.js ← E2E tests
```

## Key Concepts

### 1. Normalized Schema Design

The platform uses **separate tables** for different data domains:
- `job_preferences` - Wizard Step 1
- `profile` - Wizard Step 2
- `eligibility` - Wizard Step 3
- `screening_answers` - Screening questions

### 2. The VIEW Pattern

`user_complete_profile` is a **PostgreSQL VIEW** that:
- JOINs all four wizard tables
- Provides unified read interface
- Does NOT store data itself

### 3. Data Flow

**Write (POST/PUT):**
```
Frontend → API Route → Model.upsert() → Individual TABLE
```

**Read (GET):**
```
Frontend → API Route → User.getCompleteProfile() → user_complete_profile VIEW → Individual TABLES
```

## Verification

### Run the verification script:
```bash
node scripts/verify-screening-schema.js
```

### Run the tests:
```bash
npm test -- wizard-screening
```

Expected: All 16 tests pass

### Manual SQL verification:
```sql
-- Check if user_complete_profile is a VIEW
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_complete_profile';

-- Check screening data in the table
SELECT * FROM screening_answers WHERE user_id = YOUR_USER_ID;

-- Check screening data through the VIEW
SELECT * FROM user_complete_profile WHERE user_id = YOUR_USER_ID;
```

## For Developers

### Adding new screening fields:

1. Add column to `screening_answers` table (migration)
2. Update `ScreeningAnswers.upsert()` method
3. Update `POST /api/wizard/screening` route
4. VIEW automatically includes new column (uses `sa.*`)
5. Add tests for the new field

### Debugging data issues:

1. Check server logs for errors
2. Run `npm test -- wizard-screening`
3. Run `node scripts/verify-screening-schema.js`
4. Query database directly with SQL
5. Review [FAQ_SCREENING_DATA.md](FAQ_SCREENING_DATA.md)

## Additional Resources

### Historical Context
- **[TASK_SUMMARY.md](TASK_SUMMARY.md)** - Previous screening investigation
- **[SCREENING_ANSWERS_TROUBLESHOOT_REPORT.md](SCREENING_ANSWERS_TROUBLESHOOT_REPORT.md)** - Original troubleshooting
- **[QUICK_START_SCREENING_VERIFICATION.md](QUICK_START_SCREENING_VERIFICATION.md)** - Quick start guide

### Database Setup
- **[DATABASE_CONNECTION_GUIDE.md](DATABASE_CONNECTION_GUIDE.md)** - Connection setup
- **[DATABASE_FIX_INSTRUCTIONS.md](DATABASE_FIX_INSTRUCTIONS.md)** - Fix common issues

### General Documentation
- **[README.md](README.md)** - Project overview
- **[QUICK_START.md](QUICK_START.md)** - Getting started guide

## Need Help?

1. **For schema questions**: Read [SCHEMA_ARCHITECTURE.md](SCHEMA_ARCHITECTURE.md)
2. **For common issues**: Check [FAQ_SCREENING_DATA.md](FAQ_SCREENING_DATA.md)
3. **For verification**: Run [scripts/verify-screening-schema.js](scripts/verify-screening-schema.js)
4. **For examples**: See test files in `tests/wizard-screening*.test.js`

## Contributing

When modifying the schema or wizard data flow:
1. Update relevant tables (not the VIEW)
2. Update model methods
3. Update API routes
4. Add/update tests
5. Update this documentation
6. Run verification script to confirm

---

**Last Updated:** January 2025  
**Status:** ✅ Architecture documented and verified  
**Tests:** 16/16 passing
