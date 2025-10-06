# Database Fix Instructions for Railway

## Problem Summary
The `jobs` and `applications` tables are missing from your production database, causing the "Failed to get job analytics" error in `src/models/Job.js:285`.

## Solution: Run Diagnostic Script on Railway

### Option 1: Using Railway CLI (Recommended)

1. **Install Railway CLI** (if not already installed):
   ```bash
   npm install -g @railway/cli
   ```

2. **Login to Railway**:
   ```bash
   railway login
   ```

3. **Link to your project**:
   ```bash
   cd /path/to/Autoapply
   railway link
   ```

4. **Run the diagnostic script**:
   ```bash
   railway run node scripts/diagnose-and-fix-db.js
   ```

   This will:
   - Check which tables exist
   - Test the analytics query
   - Automatically create missing tables
   - Verify the fix

5. **Restart your Railway service**:
   ```bash
   railway up
   ```
   Or restart via the Railway dashboard.

---

### Option 2: Using Railway Shell

1. **Open Railway Dashboard**:
   - Go to https://railway.app
   - Select your project
   - Click on your service

2. **Open Shell**:
   - Click "Shell" tab or "Connect" → "Shell"

3. **Run the diagnostic script**:
   ```bash
   node scripts/diagnose-and-fix-db.js
   ```

4. **Check the output**:
   - Look for ✅ or ❌ next to each critical table
   - The script will automatically attempt to fix missing tables

5. **Restart the service** after tables are created

---

### Option 3: Using Railway One-Time Job

1. In Railway Dashboard, go to your service

2. Click "Settings" → "Deploy" → "Custom Start Command"

3. **Temporarily** change the start command to:
   ```bash
   node scripts/diagnose-and-fix-db.js && node src/server.js
   ```

4. Deploy the change

5. Check deployment logs to see diagnostic output

6. **Revert** the start command back to:
   ```bash
   node src/server.js
   ```

---

### Option 4: Manual SQL Execution (If scripts fail)

If the Node.js scripts don't work, you can run SQL directly:

1. **Get your DATABASE_URL from Railway**:
   - Railway Dashboard → Your Service → Variables
   - Copy the `DATABASE_URL` value

2. **Connect using psql** (requires PostgreSQL client):
   ```bash
   psql "postgresql://postgres:YOUR_PASSWORD@postgres.railway.internal:5432/railway"
   ```

3. **Check existing tables**:
   ```sql
   \dt public.*
   ```

4. **Run migrations manually**:
   ```bash
   # From your local machine with the DATABASE_URL
   psql "$DATABASE_URL" -f database/migrations/002_autoapply_tables.sql
   psql "$DATABASE_URL" -f database/migrations/005_enhanced_autoapply_tables.sql
   ```

---

## Verification Steps

After running the fix, verify it worked:

### 1. Check the diagnostic output
You should see:
```
✅ jobs
✅ applications
✅ autoapply_sessions
```

### 2. Test the analytics endpoint
```bash
# Using Railway CLI
railway run curl http://localhost:3000/api/dashboard/analytics

# Or visit in browser after deployment
https://your-app.railway.app/api/dashboard/analytics
```

### 3. Check application logs
The error "Failed to get job analytics" should no longer appear.

---

## Expected Output

### Before Fix:
```
🔍 Checking critical tables:
   ✅ users
   ❌ jobs
   ❌ applications
   ❌ autoapply_sessions

⚠️  Missing jobs/applications tables - cannot test analytics query
```

### After Fix:
```
🔍 Checking critical tables:
   ✅ users
   ✅ jobs
   ✅ applications
   ✅ autoapply_sessions

🧪 Testing analytics query...
✅ Analytics query succeeded!
   Results: {"total":"0","this_week":"0","today":"0","applied":"0","available":"0"}
```

---

## Troubleshooting

### Error: "Cannot find module 'pg'"
```bash
# Make sure dependencies are installed
railway run npm install
```

### Error: "No database configuration found"
Your DATABASE_URL environment variable is not set in Railway. Check:
- Railway Dashboard → Your Service → Variables
- Ensure `DATABASE_URL` is set

### Error: "permission denied for schema public"
Your database user doesn't have permissions. Contact Railway support or:
```sql
GRANT ALL ON SCHEMA public TO postgres;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres;
```

### Migration script hangs
The database might be locked. Try:
1. Stop the running service
2. Run the diagnostic script
3. Restart the service

---

## Prevention

To prevent this in the future, add a database health check to your server startup:

**In `src/server.js`, after line 213:**

```javascript
// Verify critical tables exist
const criticalTables = ['users', 'jobs', 'applications'];
for (const table of criticalTables) {
    const result = await pool.query(`
        SELECT EXISTS (
            SELECT FROM information_schema.tables
            WHERE table_name = $1
        )
    `, [table]);

    if (!result.rows[0].exists) {
        throw new Error(`Critical table '${table}' is missing! Run migrations.`);
    }
}
logger.info('✅ All critical tables verified');
```

This will prevent the server from starting if tables are missing.

---

## Questions?

If you encounter issues:
1. Share the full output of `diagnose-and-fix-db.js`
2. Check Railway logs for any database connection errors
3. Verify your DATABASE_URL is correct and accessible
