# Screening Data Capture Debugging Guide

## Issue Summary
The frontend is not triggering the `/api/wizard/screening` POST request when the form is submitted, causing the `screening_answers` table to remain empty.

## Root Cause Analysis

The `/api/wizard/screening` endpoint is only called when `hasScreeningData(data)` returns `true`. This function checks if ANY screening field contains data.

### Debugging Steps Added

We've added comprehensive logging to help diagnose why the screening API call is not being made:

1. **In `parseFormData()`**: Logs raw `formState.data` for all screening fields BEFORE parsing
2. **In `hasScreeningData()`**: Logs detailed checks for each field and shows which fields pass/fail
3. **Before API calls in `submitForm()` and `saveAndExit()`**: Logs whether screening data will be sent or skipped

## How to Debug

### 1. Enable Browser Console
Open your browser's Developer Tools (F12) and navigate to the Console tab.

### 2. Fill Out the Form
1. Navigate through the wizard steps
2. **IMPORTANT**: Expand the "Additional Screening Questions (Optional)" section in Step 4
3. Fill in at least ONE screening field (e.g., GPA, languages, hybrid preference)
4. Submit the form

### 3. Check Console Logs

Look for these log messages in order:

#### Step 1: Raw Form Data Capture
```
🔍 saveAllStepsData() - Collecting data from all steps...
  Step 1: Found X inputs
  Step 2: Found X inputs
  Step 3: Found X inputs
  Step 4: Found X inputs
📦 Final formState.data keys: [...]
```

**What to check:**
- Are screening field IDs present in the `formState.data` keys?
- Expected keys: `experience-summary`, `hybrid-preference`, `travel-comfortable`, `relocation-open`, `languages-input`, `date-of-birth`, `gpa`, `age-18`, `gender`, `disability`, `military`, `ethnicity`, `licenses`

#### Step 2: Parsing Raw Data
```
🔍 parseFormData() - Raw screening fields in formState.data:
{
  'experience-summary': '...',
  'hybrid-preference': '...',
  'languages-input': '...',
  ...
}
```

**What to check:**
- Do the raw values match what you entered in the form?
- Are multi-select fields (like languages) showing comma-separated values?

#### Step 3: Checking for Screening Data
```
🔍 hasScreeningData() check:
{
  hasData: true/false,
  checks: {
    experienceSummary: true/false,
    hybridPreference: true/false,
    ...
  },
  rawValues: {
    experienceSummary: '...',
    hybridPreference: '...',
    ...
  }
}
```

**What to check:**
- Is `hasData` true or false?
- Which specific fields are passing (`true`) or failing (`false`)?
- Do the `rawValues` match your input?

#### Step 4: API Call Decision
If screening data exists:
```
✅ [submitForm] hasScreeningData returned TRUE - sending screening data to API
📤 [submitForm] Screening payload to be sent: { ... }
```

If no screening data:
```
❌ [submitForm] hasScreeningData returned FALSE - skipping screening API call
💡 No screening data was filled in, so /api/wizard/screening will not be called
```

## Common Issues and Solutions

### Issue 1: Screening Section Not Expanded
**Symptom**: Screening fields are not in `formState.data`

**Solution**: Make sure to click the "Additional Screening Questions (Optional)" header to expand the section before filling in fields.

### Issue 2: Hidden Inputs Not Captured
**Symptom**: Pill group selections (hybrid preference, travel, relocation, age-18) show as empty

**Cause**: The hidden input field is not being updated when the pill is clicked.

**Check**: Look at the pill initialization code in `app.js` and verify the hidden input IDs match the HTML.

### Issue 3: Multi-Select Not Working
**Symptom**: Languages array is empty even though you selected languages

**Cause**: The multi-select component may not be updating the hidden input field correctly.

**Check**: 
1. Look for the `languages-input` field in the console logs
2. Verify it shows a comma-separated string like "English,Spanish,French"
3. Check if `parseCommaSeparated()` is correctly parsing it into an array

### Issue 4: Fields Don't Match
**Symptom**: Field IDs in HTML don't match field names in JavaScript

**Solution**: 
- HTML uses kebab-case IDs (e.g., `experience-summary`)
- JavaScript uses camelCase (e.g., `experienceSummary`)
- The mapping happens in `parseFormData()`

Verify the mapping is correct:
```javascript
experienceSummary: data['experience-summary'] || '',
hybridPreference: data['hybrid-preference'] || '',
travel: data['travel-comfortable'] || '',  // Note: travel-comfortable, not travel
relocation: data['relocation-open'] || '',  // Note: relocation-open, not relocation
```

## Testing the Fix

### Test Case 1: Single Field
1. Navigate to Step 4
2. Expand "Additional Screening Questions"
3. Enter only a GPA (e.g., 3.5)
4. Submit the form
5. Check console for:
   - `gpa: true` in the checks
   - `hasData: true`
   - Screening API call made

### Test Case 2: Multiple Fields
1. Navigate to Step 4
2. Expand "Additional Screening Questions"
3. Fill in:
   - Experience Summary: "Test experience"
   - Languages: Select "English", "Spanish"
   - GPA: 3.8
4. Submit the form
5. Check console for all three fields showing `true`

### Test Case 3: No Screening Data
1. Navigate through all steps
2. Do NOT expand or fill any screening questions
3. Submit the form
4. Check console for:
   - All checks showing `false`
   - `hasData: false`
   - "❌ hasScreeningData returned FALSE" message

## Expected Behavior

When screening data is properly captured and sent:

1. Browser console shows the screening payload being sent
2. Network tab shows a POST to `/api/wizard/screening` with status 200
3. Database query shows data in `screening_answers` table:
   ```sql
   SELECT * FROM screening_answers WHERE user_id = YOUR_USER_ID;
   ```

## Next Steps

If the issue persists after adding this debugging:

1. Copy the complete console output and share it
2. Check the Network tab for the `/api/wizard/screening` request
3. Verify the backend route is working by testing with curl:
   ```bash
   curl -X POST http://localhost:3000/api/wizard/screening \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"languages":["English"],"gpa":3.5}'
   ```

## Technical Details

### Data Flow
```
User fills form → saveAllStepsData() captures inputs → 
parseFormData() transforms to camelCase → hasScreeningData() checks if any field has data →
If true: POST to /api/wizard/screening → Backend saves to database
If false: Skip screening API call (expected if user didn't fill screening section)
```

### Key Functions
- `saveAllStepsData()`: Captures ALL form inputs from ALL steps (lines 928-962)
- `parseFormData()`: Transforms kebab-case to camelCase (lines 1174-1253)
- `hasScreeningData()`: Checks if any screening field has data (lines 1261-1304)
- `submitForm()`: Main submission function (lines 990-1172)
- `saveAndExit()`: Save progress function (lines 728-830)
