# Authentication and Data Flow with Logging

This document shows the complete flow of authentication and data loading with all the logging points added.

## Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────┐
│ 1. LOGIN PROCESS (public/login.html)                                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ User enters credentials
                              ▼
                    POST /api/auth/login
                              │
                              │ Server validates
                              ▼
                ┌─────────────────────────────┐
                │ Store in localStorage:      │
                │ - authToken: <JWT>          │
                │ - userEmail: user@email.com │
                │ - userId: 123               │
                └─────────────────────────────┘
                              │
                              │ Redirect to dashboard/wizard
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│ 2. WIZARD PAGE LOAD (public/app.js)                                 │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              │ DOMContentLoaded
                              ▼
               🔄 Log: "Loading existing user data..."
                              │
                              ▼
        ┌─────────────────────────────────────────┐
        │ Check localStorage.getItem('authToken') │
        └─────────────────────────────────────────┘
                    │                    │
                    │ No Token           │ Token Found
                    ▼                    ▼
          ❌ Log: "No auth        ✅ Log: "Auth token found"
          token found"            📡 Log: "Making request..."
          Return                            │
                                           ▼

┌─────────────────────────────────────────────────────────────────────┐
│ 3. API REQUEST TO SERVER                                             │
└─────────────────────────────────────────────────────────────────────┘
                              │
                GET /api/wizard/data
             Authorization: Bearer <token>
                              │
                              ▼
        ┌──────────────────────────────────────────┐
        │ src/middleware/auth.js                   │
        │ - Verify token                           │
        │ - Extract userId from JWT                │
        └──────────────────────────────────────────┘
                    │                    │
               Invalid Token         Valid Token
                    ▼                    ▼
           401 Unauthorized      Continue to handler
           💡 Log: "token              │
           may be invalid"             ▼

┌─────────────────────────────────────────────────────────────────────┐
│ 4. WIZARD ROUTE HANDLER (src/routes/wizard.js)                      │
└─────────────────────────────────────────────────────────────────────┘
                              │
            [Wizard] Log: "Loading existing user data for user 123"
                              │
                              ▼
        Call User.getCompleteProfile(userId)
                              │
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│ 5. DATABASE QUERY (src/database/models/User.js)                     │
└─────────────────────────────────────────────────────────────────────┘
                              │
    [User] Log: "Querying user_complete_profile for user_id: 123"
                              │
                              ▼
         SELECT * FROM user_complete_profile 
         WHERE user_id = 123
                              │
                 ┌────────────┴────────────┐
                 │                         │
            No Rows Found            Rows Found
                 │                         │
                 ▼                         ▼
    [User] Log: "No rows found"   [User] Log: "Found profile data"
    [User] Log: "Hint: Run        Return profile data
    verify-database.js"                   │
    Return null                           ▼
                 │
                 └────────────┬────────────┘
                              │
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│ 6. RESPONSE TO WIZARD HANDLER (src/routes/wizard.js)                │
└─────────────────────────────────────────────────────────────────────┘
                              │
                 ┌────────────┴────────────┐
                 │                         │
            Data is null             Data exists
                 │                         │
                 ▼                         ▼
    [Wizard] Log: "No data        [Wizard] Log: "Successfully
    found in user_complete_       retrieved complete profile"
    profile for user 123"         Return: {success: true, 
    Return: {success: true,       data: {...}}
    data: null, message: "No
    data found"}
                 │
                 └────────────┬────────────┘
                              │
                              ▼

┌─────────────────────────────────────────────────────────────────────┐
│ 7. CLIENT RECEIVES RESPONSE (public/app.js)                         │
└─────────────────────────────────────────────────────────────────────┘
                              │
              📡 Log: "Response status: 200 OK"
              ✅ Log: "API Response: {...}"
                              │
                 ┌────────────┴────────────┐
                 │                         │
          Data is null                Data exists
                 │                         │
                 ▼                         ▼
    ⚠️ Log: "GET /api/wizard/      📊 Log: "Populating form
    data returned 200 but           with user data..."
    data is null"                   Call populateFormFields()
    💡 Log: "This means the               │
    user_complete_profile                 ▼
    view has no row"            ✅ Log: "Form fields
    💡 Log: "Check server           populated successfully"
    logs for [User]"            Form is now filled
    💡 Log: "Run: node
    scripts/verify-database.js
    --user <email>"

```

## Logging Summary

### Client-Side Logs (Browser Console)

| Log Message | Meaning | Action Required |
|-------------|---------|-----------------|
| 🔄 Loading existing user data... | Starting the load process | None - normal flow |
| ❌ No auth token found | User is not logged in | Log in first |
| ✅ Auth token found | Token exists in localStorage | None - normal flow |
| 📡 Response status: 200 OK | Server responded successfully | None - normal flow |
| ⚠️ data is null | No profile data in database | Complete wizard form OR check DB |
| 📊 Populating form... | Data being loaded into form | None - normal flow |
| ✅ Form fields populated | Success! | None - normal flow |
| ❌ API request failed: 401 | Invalid/expired token | Log out and log in again |

### Server-Side Logs (Application Logs)

| Log Message | Meaning | Action Required |
|-------------|---------|-----------------|
| [Wizard] Loading existing user data for user 123 | Request received | None - normal flow |
| [User] Querying... | Database query starting | None - normal flow |
| [User] Found profile data | Data exists in DB | None - normal flow |
| [User] No rows found | No data in DB for user | User needs to complete wizard |
| [Wizard] Successfully retrieved complete profile | Success! | None - normal flow |
| [Wizard] No data found in user_complete_profile | No profile data | User needs to complete wizard |

## Troubleshooting Quick Reference

### Problem: 401 Unauthorized

**Symptoms:**
- Browser console shows: "API request failed: 401 Unauthorized"
- No server logs for [Wizard] or [User]

**Cause:** Invalid or expired JWT token

**Solution:**
1. Log out
2. Clear localStorage: `localStorage.clear()`
3. Log in again

### Problem: 200 OK but data is null

**Symptoms:**
- Browser console shows: "data is null"
- Server logs show: "[User.getCompleteProfile] No rows found"

**Cause:** User hasn't completed the wizard form yet OR database view is empty

**Solution:**
1. Check server logs to confirm user_id
2. Run: `node scripts/verify-database.js --user <email>`
3. If no data found, complete the wizard form
4. If data exists but not returned, check database view definition

### Problem: No token in localStorage

**Symptoms:**
- Browser console shows: "No auth token found"
- Happens immediately on page load

**Cause:** User never logged in OR localStorage was cleared

**Solution:**
1. Go to login page
2. Enter credentials
3. Verify authToken is set in localStorage after login

## Testing the Logging

To test that all logging is working:

1. **Open browser DevTools** (F12) - Console and Network tabs
2. **Clear console** logs
3. **Navigate to wizard page** while logged in
4. **Observe console logs** - should see the flow:
   ```
   🔄 Loading existing user data...
   ✅ Auth token found, making request...
   📡 Response status: 200 OK
   ✅ API Response: {success: true, data: {...}}
   📊 Populating form with user data...
   ✅ Form fields populated successfully
   ```
5. **Check server logs** - should see:
   ```
   [Wizard] Loading existing user data for user 123
   [User] Querying user_complete_profile for user_id: 123
   [User] Found profile data for user_id: 123
   [Wizard] Successfully retrieved complete profile for user 123
   ```

If you see different logs, refer to the troubleshooting section above.

## Files Modified

1. **public/app.js** - Enhanced client-side logging
   - Lines 40-43: Token presence check
   - Lines 46, 53: Request tracking
   - Lines 72-77: Special handling for null data
   - Lines 84-86: 401 error guidance

2. **src/routes/wizard.js** - Server endpoint logging
   - Line 19: Request start logging
   - Line 24: No data warning
   - Line 32: Success confirmation

3. **src/database/models/User.js** - Database query logging
   - Line 65: Query start with user_id (using Logger utility with [User] prefix)
   - Lines 72-73: No rows found + troubleshooting hint (using Logger utility)
   - Line 75: Data found confirmation (using Logger utility)

4. **TROUBLESHOOTING_AUTH_AND_DATA.md** - Comprehensive guide created
