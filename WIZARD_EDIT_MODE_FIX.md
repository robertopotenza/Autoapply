# Wizard Edit Mode Fix - Hidden Input Fields

## Problem Summary

When users clicked the "Edit" button on the dashboard to modify their wizard data, the fields appeared blank even though the data was saved in the database. This affected:

1. **Work Location & Job Preferences** (Step 1)
2. **Additional Screening Questions (Optional)** (Step 4)

## Root Cause

The issue was in the `convertUserDataToFormState()` function in `public/app.js`. When populating the form in edit mode:

1. Pill buttons were being activated visually: `pill.classList.add('active')`
2. **BUT** the corresponding hidden input fields were NOT being updated
3. The `populateFormFields()` function captures field values from inputs (including hidden inputs) into `formState.data`
4. Since hidden inputs were empty, `formState.data` had no values for those fields
5. The data appeared blank even though pills were visually active

## Fields Affected

### Pill-Based Fields with Hidden Inputs

These fields use pill buttons for selection but store the selected value in a hidden input field:

**Step 1 - Work Location & Job Preferences:**
- Job Types → hidden input `#job-types`

**Step 2 - Seniority:**
- Seniority Levels → hidden input `#seniority-levels`

**Step 3 - Resume & Contact:**
- Cover Letter Option → hidden input `#cover-letter-option`

**Step 4 - Eligibility:**
- Availability → hidden input `#availability`
- Visa Sponsorship → hidden input `#visa-sponsorship`

**Step 4 - Additional Screening Questions:**
- Hybrid Preference → hidden input `#hybrid-preference`
- Travel Comfortable → hidden input `#travel-comfortable`
- Relocation Open → hidden input `#relocation-open`
- Age 18+ → hidden input `#age-18`

## Solution Implemented

Updated the `convertUserDataToFormState()` function to:

1. ✅ Activate pill buttons visually (existing behavior)
2. ✅ **NEW:** Update the corresponding hidden input field with the correct value
3. ✅ **NEW:** Store the value in the `formData` object for immediate use

### Code Changes

For each pill-based field, the fix follows this pattern:

```javascript
// BEFORE (pill activated but hidden input not set)
if (userData.field_name) {
    const pill = document.querySelector(`.pill[data-value="${userData.field_name}"]`);
    if (pill) {
        pill.classList.add('active');
    }
}

// AFTER (pill activated AND hidden input set)
if (userData.field_name) {
    const pill = document.querySelector(`.pill[data-value="${userData.field_name}"]`);
    if (pill) {
        pill.classList.add('active');
        // Update hidden input
        const hiddenInput = document.getElementById('field-id');
        if (hiddenInput) {
            hiddenInput.value = userData.field_name.toLowerCase();
        }
        formData['field-id'] = userData.field_name.toLowerCase();
    }
}
```

## Testing Instructions

### Manual Testing

1. **Setup:** Ensure you have a user with complete wizard data in the database
   
2. **Test Edit Mode:**
   - Login to the application
   - Go to the dashboard
   - Click "Edit" on any of the following sections:
     - "Work Location & Jobs" (Step 1)
     - "Seniority & Time Zones" (Step 2)
     - "Resume & Contact" (Step 3)
     - "Eligibility" (Step 4)
   
3. **Verify Fields Are Populated:**
   - Job Types: Pills should be active, hidden input should have comma-separated values
   - Seniority Levels: Pills should be active, hidden input should have comma-separated values
   - Cover Letter Option: Pill should be active, hidden input should have value
   - Availability: Pill should be active, hidden input should have value
   - Visa Sponsorship: Pill should be active, hidden input should have value
   - Screening Questions: All pill-based fields should be active with hidden inputs set

4. **Verify Form Submission:**
   - Make a small change to any field
   - Submit the form
   - Check that all data is saved correctly

### Browser Console Debugging

Open browser DevTools console and check for these log messages:

```
✅ Activated job type: fulltime
✅ Activated seniority: mid-senior
✅ Set cover letter option: auto
✅ Set availability: immediate
✅ Set visa sponsorship: no
✅ Set hybrid preference: hybrid
✅ Set travel: yes
✅ Set relocation: no
✅ Set is adult: yes
```

You can also inspect the hidden inputs directly in the console:

```javascript
// Check if hidden inputs have values
console.log('Job Types:', document.getElementById('job-types').value);
console.log('Seniority:', document.getElementById('seniority-levels').value);
console.log('Cover Letter:', document.getElementById('cover-letter-option').value);
console.log('Availability:', document.getElementById('availability').value);
console.log('Visa:', document.getElementById('visa-sponsorship').value);
console.log('Hybrid:', document.getElementById('hybrid-preference').value);
console.log('Travel:', document.getElementById('travel-comfortable').value);
console.log('Relocation:', document.getElementById('relocation-open').value);
console.log('Age 18+:', document.getElementById('age-18').value);
```

## Data Flow

### Before Fix
```
API → userData → convertUserDataToFormState() → activates pills (visual only)
                                               ↓
                                  populateFormFields() captures inputs
                                               ↓
                                  hidden inputs are empty ❌
                                               ↓
                                  formState.data has no values
                                               ↓
                                  form appears blank
```

### After Fix
```
API → userData → convertUserDataToFormState() → activates pills (visual)
                                               → sets hidden inputs ✅
                                               → sets formData values ✅
                                               ↓
                                  populateFormFields() captures inputs
                                               ↓
                                  hidden inputs have correct values ✅
                                               ↓
                                  formState.data has all values
                                               ↓
                                  form displays correctly
```

## Files Modified

- `public/app.js` - Updated `convertUserDataToFormState()` function

## Related Issues

This fix addresses the issue described in the problem statement:
> "the [Work Location & Job Preferences] Additional Screening Questions (Optional) information are not being retrieved when the user click [edit] it's bringing all fields blank, but the end user needs to see the information previously filled in."

## Notes

- Multi-select fields (remote countries, time zones, languages, eligible countries, nationalities) were already working correctly because the `populateMultiSelect()` function properly updates both the hidden input and the text input field
- Tags input fields (job titles) were already working correctly
- The fix only affects pill-based fields with hidden inputs
