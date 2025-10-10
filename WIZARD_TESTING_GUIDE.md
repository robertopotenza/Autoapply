# Wizard Testing Guide

This guide provides comprehensive manual and automated testing instructions for the Autoapply wizard flow.

## Quick Start

### Automated Testing

Run all wizard tests:
```bash
npm test -- --testPathPattern="wizard"
```

Run specific test suites:
```bash
# Full E2E flow test
npm test tests/wizard-full-e2e.test.js

# Screening data flow tests
npm test tests/wizard-screening-e2e.test.js

# Step 2 validation tests
npm test tests/wizard-step2-validation.test.js
```

### Manual Testing

1. **Launch the application:**
   ```bash
   npm run dev
   ```

2. **Open the wizard:**
   Navigate to http://localhost:3000/wizard

---

## Manual Testing Checklist

### Step 1: Job Preferences

#### Required Fields Validation
- [ ] Try to click "Next" without filling any fields
- [ ] Verify error messages appear for:
  - Job Types (required)
  - Job Titles (required)
- [ ] Fill required fields and verify "Next" button works

#### Test Data
```
Job Types: Full-Time
Job Titles: Software Engineer, DevOps Engineer
Seniority Levels: Mid-Senior
Time Zones: UTC-05:00 (EST)
```

### Step 2: Profile

#### Required Fields Validation
- [ ] Try to advance without filling required fields
- [ ] Verify validation for:
  - Full Name (required)
  - Email (required)
  - Country (required)

#### Optional Fields with Special Characters
Test these special character scenarios:

**Name with accents:**
```
Full Name: José María García-López
```

**International phone:**
```
Phone: +34 (123) 456-7890
```

**Email with special chars:**
```
Email: josé.garcía+test@example.com
```

**Resume path with special chars:**
```
Resume: resume-josé-maría.pdf
```

#### Save & Exit Test
- [ ] Fill Step 1 and Step 2 partially
- [ ] Click "Save and Exit"
- [ ] Reload the page
- [ ] Verify data persists from localStorage
- [ ] Verify all entered values are still present

### Step 3: Eligibility

#### Toggle Fields Test
- [ ] Toggle "Availability" between options:
  - Immediate
  - 2 Weeks
  - 1 Month
  - 3+ Months
- [ ] Toggle "Visa Sponsorship":
  - Yes
  - No
- [ ] Verify selected state is maintained

#### Eligible Countries Multi-Select
- [ ] Add multiple countries
- [ ] Remove a country
- [ ] Verify the tag display

#### Salary Fields
```
Current Salary: 90000
Expected Salary: 120000
```

#### State Persistence
- [ ] Fill all Step 3 fields
- [ ] Save data (click next or save & exit)
- [ ] Go back to Step 3
- [ ] Verify all values are preserved

### Step 4: Screening Questions

#### Languages with Special Characters

Test adding these languages:
- [ ] English
- [ ] Español
- [ ] 中文 (Chinese)
- [ ] Français
- [ ] हिन्दी (Hindi)
- [ ] العربية (Arabic)
- [ ] Português
- [ ] Русский (Russian)

Verify:
- [ ] All languages display correctly in tags
- [ ] Special characters are preserved
- [ ] Languages can be removed
- [ ] Maximum of 6 languages enforced

#### Disability Status Options

Test each option:
- [ ] "Prefer not to say" (empty value)
- [ ] "Yes"
- [ ] "No"

#### Empty Languages Test
- [ ] Submit form with NO languages selected
- [ ] Verify form accepts empty array
- [ ] Check network tab: languages should be `[]`

#### "Prefer Not to Say" Test
- [ ] Select "Prefer not to say" for:
  - Gender Identity
  - Disability Status
  - Military Service
  - Ethnicity
- [ ] Submit form
- [ ] Check network tab: values should be empty strings or null

#### Complete Screening Data
Fill all fields with various data:
```
Experience Summary: 5+ years in software development with focus on cloud technologies
Hybrid Preference: Hybrid
Travel: Occasionally
Relocation: Depends on Location
Languages: English, Español, 中文
Date of Birth: 1990-01-15
GPA: 3.8
Age 18+: Yes
Gender Identity: Non-Binary
Disability: No
Military Service: No
Ethnicity: Hispanic or Latino
Driving License: Class B
```

### Update Scenario

#### Test Update Flow
1. [ ] Complete entire wizard and submit
2. [ ] Navigate back to wizard (edit mode)
3. [ ] Modify screening data:
   - Add more languages
   - Change disability status
   - Update experience summary
4. [ ] Submit updated form
5. [ ] Open browser DevTools → Network tab
6. [ ] Verify the updated payload:
   ```json
   {
     "languages": ["English", "Spanish", "French"],
     "disabilityStatus": "yes",
     "experienceSummary": "Updated text..."
   }
   ```

### Database Verification (Optional)

If you have database access:

1. **Query screening_answers table:**
   ```sql
   SELECT * FROM screening_answers 
   WHERE user_id = 'your-test-user-id'
   ORDER BY updated_at DESC 
   LIMIT 1;
   ```

2. **Verify fields match:**
   - [ ] `languages` is a JSON array with your selected languages
   - [ ] `disability_status` matches your selection
   - [ ] Special characters are preserved
   - [ ] `updated_at` timestamp is recent

3. **Check logs:**
   ```bash
   # View wizard-screening logs
   tail -f logs/wizard-screening-e2e.test.js.log
   ```

---

## Network Tab Verification

### What to Check

Open Browser DevTools → Network tab and monitor these requests:

#### Step 1: POST /api/wizard/step1
```json
{
  "remoteJobs": ["United States"],
  "jobTypes": ["fulltime"],
  "jobTitles": ["Software Engineer"]
}
```

#### Step 2: POST /api/wizard/step2
```json
{
  "fullName": "José María García",
  "email": "jose@example.com",
  "phone": "+34 (123) 456-7890",
  "country": "Spain"
}
```

#### Step 3: POST /api/wizard/step3
```json
{
  "availability": "immediate",
  "visaSponsorship": true,
  "expectedSalary": 120000
}
```

#### Screening: POST /api/wizard/screening
```json
{
  "languages": ["English", "Español", "中文"],
  "disabilityStatus": "no",
  "experienceSummary": "Test summary",
  "hybridPreference": "hybrid"
}
```

### Verify Response Status
- [ ] All requests return 200 OK
- [ ] Response contains `"success": true`
- [ ] Response includes saved data

---

## Edge Cases to Test

### 1. Empty Submissions
- [ ] Submit Step 1 with no job types
- [ ] Submit Step 2 with no name/email
- [ ] Submit screening with all fields empty
- [ ] Verify app handles gracefully (no crashes)

### 2. Maximum Length Tests
- [ ] Experience summary: 500 characters max
- [ ] Job titles: 5 max
- [ ] Languages: 6 max
- [ ] Nationalities: 3 max

### 3. Special Character Edge Cases
- [ ] Name with emoji: "José 👨‍💻 García"
- [ ] Email with + symbol: "user+test@example.com"
- [ ] Languages with parentheses: "中文 (Simplified)"
- [ ] License with slashes: "Class A/B/C"

### 4. Browser Refresh Tests
- [ ] Fill Step 1, refresh → data persists
- [ ] Fill Step 2, refresh → data persists
- [ ] Fill screening, refresh → data persists
- [ ] Submit all, refresh → can view submitted data

### 5. Back Navigation Tests
- [ ] Go to Step 3, click "Previous" → Step 2 data preserved
- [ ] Go to Step 4, click "Previous" → Step 3 data preserved
- [ ] Navigate back and forth multiple times → no data loss

---

## Automated Test Coverage

The test suite `tests/wizard-full-e2e.test.js` covers:

✅ **Step 1 Validation:**
- Required field validation
- Successful submission with all fields

✅ **Step 2 Profile:**
- Required field validation  
- Special characters in name, email, phone
- Optional fields (resume path, phone)

✅ **Step 3 Eligibility:**
- Boolean field toggling
- Multi-submission persistence
- Salary field validation

✅ **Screening Step:**
- Multiple languages with special characters (Español, 中文, etc.)
- Empty languages array handling
- "Prefer not to say" null value handling
- Update scenario (modify existing submission)
- All field types (text, select, boolean, array)

✅ **Integration:**
- Complete wizard flow end-to-end
- Database query parameter verification
- Network payload validation

---

## Troubleshooting

### Issue: Data not persisting on reload
**Solution:** Check browser localStorage:
```javascript
// In browser console
console.log(JSON.parse(localStorage.getItem('autoApplyFormState')))
```

### Issue: Special characters appearing as "?"
**Solution:** Verify:
1. Database charset is UTF-8
2. API responses have correct Content-Type header
3. Frontend uses UTF-8 encoding

### Issue: Form validation not working
**Solution:** Check browser console for JavaScript errors:
```javascript
// Should see validation messages like:
"⚠️ Step 1 validation failed: Missing job types"
```

### Issue: Network requests failing
**Solution:** 
1. Verify server is running: `npm run dev`
2. Check auth token in localStorage: `localStorage.getItem('authToken')`
3. Review server logs for errors

---

## Test Results Summary

Current test coverage:
- **Total Tests:** 43
- **Passing:** 43 ✅
- **Failing:** 0
- **Test Suites:** 6

Run tests to verify:
```bash
npm test -- --testPathPattern="wizard"
```

Expected output:
```
Test Suites: 6 passed, 6 total
Tests:       43 passed, 43 total
```

---

## Additional Resources

- [Wizard Routes Documentation](src/routes/wizard.js)
- [Screening Data FAQ](FAQ_SCREENING_DATA.md)
- [Schema Architecture](SCHEMA_ARCHITECTURE.md)
- [Database Schema Docs](DATABASE_SCHEMA_DOCS.md)

---

**Last Updated:** October 2025
**Test Suite Version:** 2.0.0
