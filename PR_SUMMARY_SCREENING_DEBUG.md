# PR Summary: Add Debugging for Screening Data Capture Issue

## Overview
This PR adds comprehensive debugging and documentation to help identify why the frontend is not triggering the `/api/wizard/screening` POST request, which causes the `screening_answers` table to remain empty.

## Problem Statement
The screening questions in the wizard form are optional. The frontend only sends data to `/api/wizard/screening` if `hasScreeningData(data)` returns `true`. Without proper debugging, it's unclear whether:
1. The screening data is not being captured from the form
2. The `hasScreeningData()` function is incorrectly returning false
3. Users are simply not filling in the optional screening section

## Changes Made

### 1. Enhanced Logging in `public/app.js` (101 lines changed)

#### A. `hasScreeningData()` Function Enhancement
**Before:**
```javascript
function hasScreeningData(data) {
    return data.experienceSummary || data.hybridPreference ||
           data.travel || data.relocation ||
           data.languages?.length > 0 || data.dateOfBirth ||
           data.gpa || data.isAdult || data.gender ||
           data.disability || data.military ||
           data.ethnicity || data.licenses;
}
```

**After:**
```javascript
function hasScreeningData(data) {
    const checks = {
        experienceSummary: !!data.experienceSummary,
        hybridPreference: !!data.hybridPreference,
        travel: !!data.travel,
        relocation: !!data.relocation,
        languages: data.languages?.length > 0,
        dateOfBirth: !!data.dateOfBirth,
        gpa: !!data.gpa,
        isAdult: !!data.isAdult,
        gender: !!data.gender,
        disability: !!data.disability,
        military: !!data.military,
        ethnicity: !!data.ethnicity,
        licenses: !!data.licenses
    };
    
    const hasData = Object.values(checks).some(v => v === true);
    
    // Log detailed information when debugging
    console.log('🔍 hasScreeningData() check:', {
        hasData,
        checks,
        rawValues: { /* all field values */ }
    });
    
    return hasData;
}
```

**Impact:** Developers can now see exactly which fields pass/fail the screening data check.

#### B. API Call Decision Logging (in both `submitForm()` and `saveAndExit()`)
**Before:**
```javascript
if (hasScreeningData(data)) {
    console.log('📝 Saving screening data:', data);
    await fetch('/api/wizard/screening', { /* ... */ });
}
```

**After:**
```javascript
console.log('🔍 [submitForm] Checking if screening data should be saved...');
if (hasScreeningData(data)) {
    console.log('✅ [submitForm] hasScreeningData returned TRUE - sending screening data to API');
    const screeningPayload = { /* ... */ };
    console.log('📤 [submitForm] Screening payload to be sent:', screeningPayload);
    await fetch('/api/wizard/screening', {
        method: 'POST',
        headers,
        body: JSON.stringify(screeningPayload)
    });
} else {
    console.log('❌ [submitForm] hasScreeningData returned FALSE - skipping screening API call');
    console.log('💡 No screening data was filled in, so /api/wizard/screening will not be called');
}
```

**Impact:** Clear indication of whether and why the screening API call is made or skipped.

#### C. Raw Form Data Logging (in `parseFormData()`)
**Before:**
```javascript
console.log('🔍 parseFormData() - Raw formState.data relevant fields:', {
    'full-name': data['full-name'],
    'email': data['email'],
    // ... only non-screening fields
});
```

**After:**
```javascript
console.log('🔍 parseFormData() - Raw formState.data relevant fields:', {
    // ... existing fields
});

console.log('🔍 parseFormData() - Raw screening fields in formState.data:', {
    'experience-summary': data['experience-summary'],
    'hybrid-preference': data['hybrid-preference'],
    'travel-comfortable': data['travel-comfortable'],
    'relocation-open': data['relocation-open'],
    'languages-input': data['languages-input'],
    'date-of-birth': data['date-of-birth'],
    'gpa': data['gpa'],
    // ... all screening fields
});
```

**Impact:** Developers can see if screening data is being captured from the form before transformation.

### 2. New Documentation Files

#### A. `SCREENING_DATA_DEBUG_GUIDE.md` (209 lines)
- Comprehensive debugging guide for developers
- Detailed explanation of each debugging step
- Console log examples with interpretations
- Common issues and solutions
- Testing instructions
- Expected behavior documentation

#### B. `SCREENING_DEBUG_IMPLEMENTATION.md` (288 lines)
- Implementation summary
- Root cause analysis
- Changes explained with examples
- Testing checklist
- Expected outcomes for different scenarios
- Support resources

#### C. `docs/testing/screening-debug-test.html` (325 lines)
- Interactive HTML test page
- Visual guide with color-coded sections
- Step-by-step testing instructions
- Expected console output examples
- Common issues with visual indicators
- Test results template
- Copy-to-clipboard functionality for code blocks

## How to Use

### For Developers:
1. Deploy this branch to your development environment
2. Open the wizard form in a browser
3. Open Browser DevTools (F12) → Console tab
4. Fill out the form, making sure to:
   - Expand "Additional Screening Questions (Optional)"
   - Fill in at least one field (e.g., GPA, languages)
5. Submit the form
6. Review console output to see:
   - Raw form data capture
   - Which fields have data
   - Whether API call is made or skipped

### For QA/Testers:
1. Open `docs/testing/screening-debug-test.html` in a browser
2. Follow the visual guide
3. Record results using the provided template
4. Share console output screenshots

## Expected Console Output

### When Screening Data IS Filled:
```
🔍 [submitForm] Checking if screening data should be saved...
🔍 hasScreeningData() check: {
  hasData: true,
  checks: {
    languages: true,
    gpa: true,
    // ...
  }
}
✅ [submitForm] hasScreeningData returned TRUE - sending screening data to API
📤 [submitForm] Screening payload to be sent: { languages: [...], gpa: 3.5 }
```

### When Screening Data is NOT Filled (Expected):
```
🔍 [submitForm] Checking if screening data should be saved...
🔍 hasScreeningData() check: {
  hasData: false,
  checks: {
    experienceSummary: false,
    languages: false,
    gpa: false,
    // ... all false
  }
}
❌ [submitForm] hasScreeningData returned FALSE - skipping screening API call
💡 No screening data was filled in, so /api/wizard/screening will not be called
```

## Testing Results

### Automated Tests:
- ✅ All wizard-screening.test.js tests pass (9/9)
- ✅ All wizard-screening-e2e.test.js tests pass
- ✅ No regressions in existing tests (273 passed)

### Manual Testing Required:
- [ ] Test with screening data filled in
- [ ] Test without screening data filled in
- [ ] Verify console output matches expectations
- [ ] Verify Network tab shows/doesn't show API call appropriately
- [ ] Verify database row creation when appropriate

## Key Insights

### Important Note:
The screening section is **OPTIONAL**. If a user:
- Does NOT expand the section
- Does NOT fill in any screening fields
- The `screening_answers` table will correctly remain empty for that user

This is **WORKING AS INTENDED** - not a bug!

### The Real Question:
We need to determine if users ARE filling in screening data but it's not being captured, OR if users are simply NOT filling it in (which is expected behavior).

## Files Changed

1. **public/app.js** (+101/-38 lines)
   - Enhanced `hasScreeningData()` with detailed logging
   - Enhanced `submitForm()` with API call decision logging
   - Enhanced `saveAndExit()` with API call decision logging
   - Enhanced `parseFormData()` with raw screening data logging

2. **SCREENING_DATA_DEBUG_GUIDE.md** (NEW, 209 lines)
   - Comprehensive debugging guide

3. **SCREENING_DEBUG_IMPLEMENTATION.md** (NEW, 288 lines)
   - Implementation summary document

4. **docs/testing/screening-debug-test.html** (NEW, 325 lines)
   - Interactive HTML test page

**Total: 4 files, +923/-38 lines**

## Benefits

1. ✅ **Observability:** Clear visibility into the screening data flow
2. ✅ **Debuggability:** Easy to identify exactly where/why data is missing
3. ✅ **Documentation:** Comprehensive guides for both developers and testers
4. ✅ **Non-Breaking:** Only adds logging, no functional changes
5. ✅ **Minimal Changes:** Focused, surgical changes to app.js
6. ✅ **Test Coverage:** All existing tests still pass

## Next Steps

1. Deploy to development environment
2. Run through test scenarios with browser console open
3. Collect console output for both scenarios (with/without screening data)
4. Share findings to confirm root cause
5. If issue persists, we'll have detailed logs to investigate further

## Rollback Plan

If needed, this PR can be safely rolled back as it:
- Only adds logging (no functional changes)
- Only adds documentation files (no impact on runtime)
- All existing tests pass

## Support

For questions or issues:
- See: [SCREENING_DATA_DEBUG_GUIDE.md](SCREENING_DATA_DEBUG_GUIDE.md)
- See: [SCREENING_DEBUG_IMPLEMENTATION.md](SCREENING_DEBUG_IMPLEMENTATION.md)
- Open: [docs/testing/screening-debug-test.html](docs/testing/screening-debug-test.html)
