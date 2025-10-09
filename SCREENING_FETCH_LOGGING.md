# Screening Fetch Logging Documentation

## Overview
Comprehensive logging has been added to the JavaScript code to track when and how the screening fetch API calls are invoked.

## Logging Locations

### 1. **hasScreeningData() Function** (Line ~1339)
This function determines whether screening data exists before attempting to save it.

**Logs:**
- `🔍 [hasScreeningData] Evaluating screening data presence...` - Entry point
- `📋 [hasScreeningData] Checking fields:` - Shows boolean status of each screening field
- `✅ [hasScreeningData] Result: TRUE/FALSE` - Final decision

### 2. **parseFormData() Function** (Line ~1315)
Extracts and parses screening data from the form state.

**Logs:**
- `📊 [parseFormData] Screening data extracted:` - Shows all extracted screening values

### 3. **saveAndExit() Function** (Line ~791-854)
Saves partial progress when user clicks "Save and Exit" button.

**Logs:**
- `🔍 [SAVE_AND_EXIT] Checking for screening data...` - Start of check
- `📝 [SCREENING FETCH - SAVE_AND_EXIT] Detected screening data - preparing to save` - Data found
- `📊 [SCREENING FETCH - SAVE_AND_EXIT] hasScreeningData returned true` - Confirmation
- `🔍 [SCREENING FETCH - SAVE_AND_EXIT] Screening data details:` - Full data object
- `📤 [SCREENING FETCH - SAVE_AND_EXIT] Sending POST request to /api/wizard/screening` - About to send
- `📦 [SCREENING FETCH - SAVE_AND_EXIT] Payload:` - Full JSON payload being sent
- `⏱️ [SCREENING FETCH - SAVE_AND_EXIT] Timestamp:` - Exact time of request
- `✅ [SCREENING FETCH - SAVE_AND_EXIT] Response received - Status:` - Response status code
- `✅ [SCREENING FETCH - SAVE_AND_EXIT] Success response:` - Success details (if OK)
- `❌ [SCREENING FETCH - SAVE_AND_EXIT] Error response:` - Error details (if failed)
- `❌ [SCREENING FETCH - SAVE_AND_EXIT] Fetch failed with exception:` - Network/exception errors
- `⚠️ [SCREENING FETCH - SAVE_AND_EXIT] No screening data detected - skipping screening save` - When no data found

### 4. **submitForm() Function** (Line ~1176-1239)
Saves complete profile when user submits the final step.

**Logs:** (Same structure as saveAndExit)
- `🔍 [SUBMIT_FORM] Checking for screening data...`
- `📝 [SCREENING FETCH - SUBMIT_FORM] Detected screening data - preparing to save`
- `📊 [SCREENING FETCH - SUBMIT_FORM] hasScreeningData returned true`
- `🔍 [SCREENING FETCH - SUBMIT_FORM] Screening data details:`
- `📤 [SCREENING FETCH - SUBMIT_FORM] Sending POST request to /api/wizard/screening`
- `📦 [SCREENING FETCH - SUBMIT_FORM] Payload:`
- `⏱️ [SCREENING FETCH - SUBMIT_FORM] Timestamp:`
- `✅ [SCREENING FETCH - SUBMIT_FORM] Response received - Status:`
- `✅ [SCREENING FETCH - SUBMIT_FORM] Success response:` (if OK)
- `❌ [SCREENING FETCH - SUBMIT_FORM] Error response:` (if failed)
- `❌ [SCREENING FETCH - SUBMIT_FORM] Fetch failed with exception:` (network errors)
- `⚠️ [SCREENING FETCH - SUBMIT_FORM] No screening data detected - skipping screening save`

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
[hasScreeningData]
[parseFormData]
```

## What to Look For

### Successful Flow
```
🔍 [parseFormData] Screening data extracted: {...}
🔍 [SUBMIT_FORM] Checking for screening data...
🔍 [hasScreeningData] Evaluating screening data presence...
📋 [hasScreeningData] Checking fields: {...}
✅ [hasScreeningData] Result: TRUE - screening data found
📝 [SCREENING FETCH - SUBMIT_FORM] Detected screening data - preparing to save
🔍 [SCREENING FETCH - SUBMIT_FORM] Screening data details: {...}
📤 [SCREENING FETCH - SUBMIT_FORM] Sending POST request to /api/wizard/screening
📦 [SCREENING FETCH - SUBMIT_FORM] Payload: {...}
⏱️ [SCREENING FETCH - SUBMIT_FORM] Timestamp: 2025-10-09T...
✅ [SCREENING FETCH - SUBMIT_FORM] Response received - Status: 200 OK
✅ [SCREENING FETCH - SUBMIT_FORM] Success response: {...}
```

### When No Data Found
```
🔍 [hasScreeningData] Evaluating screening data presence...
📋 [hasScreeningData] Checking fields: {all false...}
✅ [hasScreeningData] Result: FALSE - no screening data
⚠️ [SCREENING FETCH - SUBMIT_FORM] No screening data detected - skipping screening save
```

### When Fetch Fails
```
📤 [SCREENING FETCH - SUBMIT_FORM] Sending POST request...
❌ [SCREENING FETCH - SUBMIT_FORM] Response received - Status: 500 Internal Server Error
❌ [SCREENING FETCH - SUBMIT_FORM] Error response: {...error details...}
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
