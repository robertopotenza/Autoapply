# Quick Start: Testing the Screening Debug Changes

## What This PR Does
Adds comprehensive debugging to identify why the `/api/wizard/screening` POST request might not be triggered when the form is submitted.

## How to Test (3 minutes)

### 1. Open the Application
Navigate to the wizard form in your browser.

### 2. Open DevTools
Press **F12** (or right-click → Inspect), then click the **Console** tab.

### 3. Clear Console
Click the 🚫 icon or type `clear()` to start fresh.

### 4. Fill Out the Form

#### Test A: WITH Screening Data
1. Complete Steps 1-3 normally
2. Navigate to Step 4
3. **IMPORTANT:** Click "Additional Screening Questions (Optional)" to expand
4. Fill in at least ONE field:
   - GPA: `3.5`
   - OR Languages: Select "English"
   - OR Hybrid Preference: Click "Hybrid"
5. Click "Complete Setup"

**Expected Console Output:**
```
🔍 [submitForm] Checking if screening data should be saved...
🔍 hasScreeningData() check: { hasData: true, checks: { ... } }
✅ [submitForm] hasScreeningData returned TRUE - sending screening data to API
📤 [submitForm] Screening payload to be sent: { gpa: 3.5, languages: [...] }
```

**Expected Network Activity:**
- Look in Network tab (F12 → Network)
- Should see POST to `/api/wizard/screening`
- Status: 200 OK

#### Test B: WITHOUT Screening Data
1. Complete Steps 1-3 normally
2. Navigate to Step 4
3. **Do NOT expand** "Additional Screening Questions"
4. Fill in required fields only
5. Click "Complete Setup"

**Expected Console Output:**
```
🔍 [submitForm] Checking if screening data should be saved...
🔍 hasScreeningData() check: { hasData: false, checks: { ... all false } }
❌ [submitForm] hasScreeningData returned FALSE - skipping screening API call
💡 No screening data was filled in, so /api/wizard/screening will not be called
```

**Expected Network Activity:**
- NO POST to `/api/wizard/screening` (this is correct!)

## What to Look For

### ✅ Good Signs (Everything Working)
- Console shows all debugging messages
- `hasData: true` when you fill screening fields
- `hasData: false` when you don't fill screening fields
- API call matches the `hasData` value
- Network tab shows/doesn't show request appropriately

### ❌ Bad Signs (Something Wrong)
- Console shows `hasData: false` even when you filled screening fields
- All checks show `false` even though you entered data
- Raw values show empty even though you filled the form
- API call doesn't happen when `hasData: true`

## Quick Checklist

- [ ] Console shows `🔍 hasScreeningData() check` message
- [ ] Console shows detailed `checks` object with true/false for each field
- [ ] Console shows `rawValues` object with actual field values
- [ ] Console shows decision message (✅ or ❌)
- [ ] Network tab matches the decision (request sent or not)

## If Something's Wrong

### Scenario 1: Data Not Captured
If console shows all fields as empty even though you filled them:
- Check if you **expanded** the screening section
- Check if the hidden input fields are being updated
- Check the `Raw screening fields in formState.data` log

### Scenario 2: hasScreeningData Returns False Incorrectly
If you filled fields but `hasData: false`:
- Look at the `checks` object - which specific fields are false?
- Look at the `rawValues` object - are the values there?
- Check the field ID mappings in `parseFormData()`

### Scenario 3: API Not Called When It Should Be
If `hasData: true` but no API call:
- Check browser console for JavaScript errors
- Check if the fetch is throwing an error
- Check Network tab for failed requests

## Full Documentation

For detailed debugging steps, see:
- **Debugging Guide:** [SCREENING_DATA_DEBUG_GUIDE.md](SCREENING_DATA_DEBUG_GUIDE.md)
- **Implementation Details:** [SCREENING_DEBUG_IMPLEMENTATION.md](SCREENING_DEBUG_IMPLEMENTATION.md)
- **Interactive Test Page:** [docs/testing/screening-debug-test.html](docs/testing/screening-debug-test.html)
- **PR Summary:** [PR_SUMMARY_SCREENING_DEBUG.md](PR_SUMMARY_SCREENING_DEBUG.md)

## Share Your Results

When reporting results, please include:
1. **Browser:** Chrome/Firefox/Safari + Version
2. **Test Scenario:** With or without screening data
3. **Console Output:** Copy/paste or screenshot
4. **Network Tab:** Screenshot of requests
5. **Database Check:** `SELECT * FROM screening_answers WHERE user_id = X`

## Summary

This PR adds **observability** - it doesn't change functionality, only adds logging to help identify the issue. After testing, we'll know definitively:
- ✅ Is the data being captured from the form?
- ✅ Is `hasScreeningData()` working correctly?
- ✅ Is the API call being made when it should?
- ✅ Are users simply not filling the optional section?

**Time to test: ~3 minutes per scenario = 6 minutes total**
