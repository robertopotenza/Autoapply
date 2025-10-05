# Troubleshooting Authentication and Wizard Data Loading

This guide helps diagnose issues with authentication tokens and wizard data loading in the AutoApply application.

## Problem Overview

When users edit their profile in the wizard, they may encounter issues where:
1. The request is unauthorized (401) due to missing or incorrect auth token
2. The GET /api/wizard/data returns 200 but data is null
3. No data populates in the wizard form fields

## Authentication Token Setup

### ✅ Correct Setup (Already Implemented)

The application stores the auth token under the exact key `authToken` in localStorage:

**Login Flow (public/login.html):**
```javascript
// Line 278-280
localStorage.setItem('authToken', data.data.token);
localStorage.setItem('userEmail', data.data.email);
localStorage.setItem('userId', data.data.userId);
```

**Wizard Flow (public/app.js):**
```javascript
// Line 39
const token = localStorage.getItem('authToken');
```

**API Request:**
```javascript
// Line 47-50
const response = await fetch('/api/wizard/data', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});
```

### 🔍 How to Verify Token is Present

1. **Open Browser DevTools** (F12)
2. **Go to Application tab → Local Storage**
3. **Check for `authToken` key** - it should have a JWT value
4. **Console logs** - Look for these messages in the console:
   - ✅ `Auth token found, making request to /api/wizard/data`
   - ❌ `No auth token found in localStorage under key "authToken"`

### 🚨 If Token is Missing

If you see "No auth token found":
1. Log out completely
2. Clear localStorage: `localStorage.clear()`
3. Log in again
4. Verify token is set after login

## Database Query Logging

### Server-Side Logging

**Enhanced Logging in `src/routes/wizard.js`:**
- Line 19: Logs when loading user data begins
- Line 24: Warns if no data found in database
- Line 32: Confirms successful data retrieval

**Enhanced Logging in `src/database/models/User.js`:**
- Line 63: Logs the userId being queried
- Line 70-71: Logs if no rows found + suggests running verify script
- Line 73: Confirms profile data found

### Client-Side Logging

**Enhanced Logging in `public/app.js`:**
- Line 37: Start of data loading
- Line 41-42: Token presence check
- Line 46: Token found confirmation
- Line 53: Response status
- Line 57: Full API response
- Line 73-76: Special case for null data with troubleshooting hints
- Line 84-86: 401 Unauthorized guidance

## Diagnostic Steps

### Step 1: Check Browser Console

Open the wizard page with DevTools open and look for these logs:

**Expected Success Flow:**
```
🔄 Loading existing user data for edit mode...
✅ Auth token found, making request to /api/wizard/data
📡 Response status: 200 OK
✅ API Response: {success: true, data: {...}}
📊 Populating form with user data...
✅ Form fields populated successfully
```

**Problem: No Token**
```
🔄 Loading existing user data for edit mode...
❌ No auth token found in localStorage under key "authToken"
💡 Make sure you logged in and the token was set correctly
```
**Solution:** Log in again

**Problem: Unauthorized**
```
🔄 Loading existing user data for edit mode...
✅ Auth token found, making request to /api/wizard/data
📡 Response status: 401 Unauthorized
❌ API request failed: 401 Unauthorized
💡 Unauthorized - token may be invalid or expired
💡 Try logging out and logging in again
```
**Solution:** Token is invalid/expired - log in again

**Problem: Data is Null**
```
🔄 Loading existing user data for edit mode...
✅ Auth token found, making request to /api/wizard/data
📡 Response status: 200 OK
✅ API Response: {success: true, data: null, message: "No data found"}
⚠️ GET /api/wizard/data returned status 200 but data is null
💡 This means the user_complete_profile view has no row for this user
💡 Check server logs for [User] messages
💡 Run: node scripts/verify-database.js --user <your-email>
```
**Solution:** Continue to Step 2

### Step 2: Check Server Logs

Look for these messages in your server logs:

**Expected Logs:**
```
[Wizard] Loading existing user data for user 123
[User] Querying user_complete_profile for user_id: 123
[User] Found profile data for user_id: 123
[Wizard] Successfully retrieved complete profile for user 123
```

**Problem: No Data in Database**
```
[Wizard] Loading existing user data for user 123
[User] Querying user_complete_profile for user_id: 123
[User] No rows found in user_complete_profile for user_id: 123
[User] Hint: Run 'node scripts/verify-database.js --user <email>' to check DB
[Wizard] No data found in user_complete_profile for user 123
```
**Solution:** Continue to Step 3

### Step 3: Verify Database

Run the verification script to check if user data exists:

```bash
# Check database structure
node scripts/verify-database.js

# Check specific user's data (use the email you logged in with)
node scripts/verify-database.js --user your-email@example.com
```

**Expected Output (User with Data):**
```
🔍 Checking data for user: your-email@example.com

✅ User found! Data summary:

📝 Profile Information:
   Full Name: John Doe
   Email: your-email@example.com
   Phone: +1234567890
   Location: New York, NY, United States

💼 Job Preferences:
   Remote Jobs: ["remote","hybrid"]
   Job Types: ["full-time"]
   Job Titles: ["Software Engineer","Developer"]
   Seniority Levels: ["senior"]

🌍 Eligibility:
   Current Job Title: Senior Developer
   Availability: Immediately
   Visa Sponsorship: No
   Eligible Countries: ["United States"]

✅ Data verification complete!
```

**Problem: No User Found**
```
🔍 Checking data for user: your-email@example.com

❌ No user found with that email
```

**Solution:** The user needs to complete the wizard form at least once to populate the database.

### Step 4: Understanding the Database View

The `user_complete_profile` is a PostgreSQL VIEW that combines data from multiple tables:
- `users` - Basic user account info
- `job_preferences` - Job search preferences
- `profile` - Resume and contact info
- `eligibility` - Work authorization details
- `screening_answers` - Additional screening questions

**If the view returns null**, it means:
- The user exists in the `users` table
- But they haven't completed the wizard yet (no rows in related tables)
- OR there's an issue with the database view definition

**To populate data:**
1. Complete the wizard form and click "Save"
2. Check that all POST requests succeed
3. Re-run the verify script

## Quick Reference

| Issue | Console Message | Solution |
|-------|----------------|----------|
| No token | `No auth token found` | Log in again |
| Invalid token | `401 Unauthorized` | Log out and log in again |
| No DB data | `data is null` | Complete wizard form OR run verify script |
| Server error | `500` | Check server logs for errors |

## Related Files

- `public/login.html` (line 278) - Sets authToken in localStorage
- `public/app.js` (line 39) - Reads authToken from localStorage
- `src/routes/wizard.js` (line 16) - GET /api/wizard/data endpoint
- `src/middleware/auth.js` - Authentication middleware
- `src/database/models/User.js` (line 62) - getCompleteProfile method
- `scripts/verify-database.js` - Database verification tool

## Additional Help

If you're still experiencing issues:
1. Check that JWT_SECRET is set in environment variables
2. Verify database connection is working
3. Check that all migrations have run successfully
4. Look for any error messages in server logs
5. Ensure the `user_complete_profile` view exists in the database
