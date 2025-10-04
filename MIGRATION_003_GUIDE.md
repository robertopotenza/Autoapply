# Database Migration Guide - Adding Email Field to Profile Table

## Overview
This migration adds an `email` column to the `profile` table to ensure that email addresses entered in the wizard form (Step 3) are properly saved to the database.

## Migration File
- **File**: `database/migrations/003_add_email_to_profile.sql`
- **Purpose**: Add email column to profile table

## Running the Migration

### Option 1: Using the Migration Script (Recommended)
```bash
node scripts/run-migration-003.js
```

### Option 2: Using Railway CLI
```bash
# Connect to Railway database
railway connect

# Run the migration SQL
\i database/migrations/003_add_email_to_profile.sql
```

### Option 3: Manual SQL Execution
Connect to your PostgreSQL database and run:
```sql
ALTER TABLE profile ADD COLUMN IF NOT EXISTS email VARCHAR(255);
CREATE INDEX IF NOT EXISTS idx_profile_email ON profile(email);
```

## Railway Database Details
- **Service Link**: https://railway.com/project/869e01d3-accc-4409-a7b3-5f2970846141/service/27d47a6b-44d2-4a1a-a36d-232c3b32115e/database
- **Password**: eTrLmvAOSGqNpqlIrXVvyRQyuFCwxkZI0
- **Environment ID**: d484047e-7520-4118-9c1e-4ec2c686629e

## Verification

After running the migration, verify that the email column exists:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profile' AND column_name = 'email';
```

Expected output:
```
 column_name | data_type 
-------------+-----------
 email       | character varying
```

## Testing the Integration

1. **Clear browser cache and localStorage**:
   - Open browser console
   - Run: `localStorage.clear()`

2. **Navigate to the wizard form**:
   - Go to `/wizard.html`

3. **Fill out all fields including email**:
   - Complete all steps of the form
   - Make sure to fill in the email field in Step 3
   - Submit the form

4. **Verify data in database**:
   ```sql
   SELECT 
       p.full_name,
       p.email,
       p.phone,
       p.city,
       p.country
   FROM profile p
   JOIN users u ON p.user_id = u.user_id
   WHERE u.email = 'your-test-email@example.com';
   ```

## Changes Made

### Database Schema Changes
- Added `email VARCHAR(255)` column to `profile` table
- Added index on `profile.email` for performance
- Updated `user_complete_profile` view to include email field

### Backend Changes
- **Profile.js Model**: Updated `upsert()` method to handle email field
- **wizard.js Route**: Updated `/api/wizard/step2` endpoint to accept and save email

### Frontend Changes
- **app.js - parseFormData()**: Added email extraction from form data
- **app.js - submitForm()**: Added email to step2 API request
- **app.js - parseFormData()**: Enhanced no-license checkbox handling

## Impact
This migration enables the application to:
1. Save email addresses entered in the wizard form to the database
2. Allow users to update their email address through the wizard
3. Maintain consistency between the UI form and database schema
4. Handle the "no driver's license" checkbox correctly

## Rollback (if needed)
If you need to rollback this migration:
```sql
ALTER TABLE profile DROP COLUMN IF EXISTS email;
DROP INDEX IF EXISTS idx_profile_email;
```

Note: This will remove the email column and all data stored in it.
