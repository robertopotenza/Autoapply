# Screening Fetch Logging Documentation

## Overview
Comprehensive logging has been added to the JavaScript code to track when and how the screening fetch API calls are invoked.

## Logging Locations

### 1. **parseFormData() Function** (Line ~1250)
Extracts and parses screening data from the form state.

**Logs:**
- `📊 [parseFormData] Screening data extracted:` - Shows all extracted screening values

### 2. **saveAndExit() Function** (Line ~790-870)
Saves partial progress when user clicks "Save and Exit" button.

**Logs:**
- `🔍 [SAVE_AND_EXIT] Checking for screening data...` - Start of check
- `🔍 [SAVE_AND_EXIT] Parsed screening data to check:` - Shows all screening fields being checked
- `📝 [SCREENING FETCH - SAVE_AND_EXIT] Detected screening data - preparing to save` - Data found
- `🔍 [SCREENING FETCH - SAVE_AND_EXIT] Screening data details:` - Full data object
- `📤 [SCREENING FETCH - SAVE_AND_EXIT] Sending POST request to /api/wizard/screening` - About to send
- `📦 [SCREENING FETCH - SAVE_AND_EXIT] Payload:` - Full JSON payload being sent
- `⏱️ [SCREENING FETCH - SAVE_AND_EXIT] Timestamp:` - Exact time of request
- `✅ [SCREENING FETCH - SAVE_AND_EXIT] Response received - Status:` - Response status code
- `✅ [SCREENING FETCH - SAVE_AND_EXIT] Success response:` - Success details (if OK)
- `❌ [SCREENING FETCH - SAVE_AND_EXIT] Error response:` - Error details (if failed)
- `❌ [SCREENING FETCH - SAVE_AND_EXIT] Fetch failed with exception:` - Network/exception errors
- `⚠️ [SCREENING FETCH - SAVE_AND_EXIT] No screening data detected - skipping screening save` - When no data found

### 3. **submitForm() Function** (Line ~1053-1248)
Saves complete profile when user submits the final step.

**Logs:**
- `📝 [SCREENING] Saving screening data (using simple pattern like job preferences)` - Starting screening save
- `📤 [SCREENING] Sending to /api/wizard/screening:` - About to send with payload details
- `✅ [SCREENING] Success:` - Success details (if OK)
- `❌ [SCREENING] Error:` - Error details (if failed)

**Note:** Unlike `saveAndExit()`, `submitForm()` always saves screening data without checking if it exists first (using the "simple always-submit pattern").

## How to Use the Logs

### Viewing in Browser
1. Open the application in your browser
2. Open Developer Tools (F12 or Ctrl+Shift+I)
3. Go to the Console tab
4. Fill out the wizard form including screening questions
5. Click "Save and Exit" or "Submit"
6. Watch the console for `[SCREENING FETCH]` logs

### Filtering Logs
Use the browser console filter to show only screening-related logs:
```
[SCREENING FETCH]
```

Or filter by specific function:
```
[SAVE_AND_EXIT]
[SUBMIT_FORM]
[SCREENING]
[parseFormData]
```

## What to Look For

### Successful Flow (submitForm)
```
🔍 [parseFormData] Screening data extracted: {...}
📝 [SCREENING] Saving screening data (using simple pattern like job preferences)
📤 [SCREENING] Sending to /api/wizard/screening: {...payload...}
✅ [SCREENING] Success: {...}
```

### Successful Flow (saveAndExit with data)
```
🔍 [SAVE_AND_EXIT] Checking for screening data...
🔍 [SAVE_AND_EXIT] Parsed screening data to check: {...}
📝 [SCREENING FETCH - SAVE_AND_EXIT] Detected screening data - preparing to save
🔍 [SCREENING FETCH - SAVE_AND_EXIT] Screening data details: {...}
📤 [SCREENING FETCH - SAVE_AND_EXIT] Sending POST request to /api/wizard/screening
📦 [SCREENING FETCH - SAVE_AND_EXIT] Payload: {...}
⏱️ [SCREENING FETCH - SAVE_AND_EXIT] Timestamp: 2025-10-09T...
✅ [SCREENING FETCH - SAVE_AND_EXIT] Response received - Status: 200 OK
✅ [SCREENING FETCH - SAVE_AND_EXIT] Success response: {...}
```

### When No Data Found (saveAndExit only)
```
🔍 [SAVE_AND_EXIT] Checking for screening data...
🔍 [SAVE_AND_EXIT] Parsed screening data to check: {all empty...}
⚠️ [SCREENING FETCH - SAVE_AND_EXIT] No screening data detected - skipping screening save
```

**Note:** `submitForm()` always submits screening data, so it never skips.

### When Fetch Fails
```
📤 [SCREENING FETCH - SAVE_AND_EXIT] Sending POST request...
❌ [SCREENING FETCH - SAVE_AND_EXIT] Response received - Status: 500 Internal Server Error
❌ [SCREENING FETCH - SAVE_AND_EXIT] Error response: {...error details...}
```
Or for submitForm:
```
📤 [SCREENING] Sending to /api/wizard/screening: {...}
❌ [SCREENING] Error: {...error details...}
```

## Troubleshooting Guide

### Issue: Fetch never called
**Look for:** `⚠️ No screening data detected - skipping screening save`
**Check:**
- Are screening form fields filled out?
- Are field IDs correct in HTML?
- Check `[parseFormData]` logs to see what data was extracted

### Issue: Fetch called but fails
**Look for:** `❌ Response received - Status: [error code]`
**Check:**
- Server logs for backend errors
- Network tab in DevTools for request details
- Payload in `📦 Payload:` log to ensure data format is correct

### Issue: Data not being extracted
**Look for:** `📊 [parseFormData] Screening data extracted:`
**Check:**
- Are all fields showing `(empty)`?
- Compare field IDs in HTML with IDs used in parseFormData()
- Check if formState.data contains the field values

## Related Files
- **Frontend:** `public/app.js`
- **Backend:** `src/routes/wizard.js` (API endpoint handler)
- **Database:** `src/database/models/ScreeningAnswers.js`

## Key Data Fields Tracked
- experienceSummary
- hybridPreference
- travel
- relocation
- languages (array)
- dateOfBirth
- gpa
- isAdult
- genderIdentity
- disabilityStatus
- militaryService
- ethnicity
- drivingLicense

## Notes
- All logs use emoji prefixes for easy visual scanning
- Each log includes context tags like `[SCREENING FETCH]` for filtering
- Timestamps are ISO 8601 format for precise timing
- Payloads are JSON stringified with 2-space indentation for readability
