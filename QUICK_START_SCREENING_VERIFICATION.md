# Quick Start: Verifying Screening Data Storage

## For Developers

### Running Tests

```bash
# Run screening-specific tests
npm test -- wizard-screening

# Expected output:
# Test Suites: 2 passed, 2 total
# Tests:       14 passed, 14 total
```

### Viewing Logs

To see detailed logging of data flow:

1. **Set DEBUG_MODE** in your environment:
   ```bash
   DEBUG_MODE=true npm start
   ```

2. **Check server logs** for:
   ```
   [POST /screening] Received payload for user X
   [POST /screening] Prepared data for upsert
   [POST /screening] Result after upsert
   ```

3. **In the model**, check for:
   ```
   Upserting screening answers for user X
   Screening answers saved for user X
   ```

### Manual Testing

To manually test the screening form:

1. **Submit a test form**:
   ```javascript
   // In browser console
   fetch('/api/wizard/screening', {
       method: 'POST',
       headers: {
           'Authorization': 'Bearer YOUR_TOKEN',
           'Content-Type': 'application/json'
       },
       body: JSON.stringify({
           languages: ['English', 'Spanish', 'French'],
           disabilityStatus: 'no',
           experienceSummary: 'Test submission'
       })
   }).then(r => r.json()).then(console.log);
   ```

2. **Check the database**:
   ```sql
   SELECT user_id, languages, disability_status 
   FROM screening_answers 
   WHERE user_id = YOUR_USER_ID;
   ```

   Expected result:
   ```
   user_id | languages                           | disability_status
   --------|-------------------------------------|------------------
   123     | ["English","Spanish","French"]     | no
   ```

3. **Check via the view**:
   ```sql
   SELECT user_id, languages, disability_status 
   FROM user_complete_profile 
   WHERE user_id = YOUR_USER_ID;
   ```

### Understanding the Data Flow

```
User Interface (wizard.html)
     ↓
Multi-Select Component (app.js)
     ├── User selects languages
     ├── updateHiddenInput() sets input.value = "English,Spanish,French"
     └── Stored in formState.data['languages-input']
     ↓
Submit Form (submitForm() function)
     ├── saveAllStepsData() captures all input values
     ├── parseFormData() parses comma-separated to array
     └── fetch('/api/wizard/screening') with JSON payload
     ↓
Backend Route (wizard.js)
     ├── Receives: { languages: ['English', 'Spanish', 'French'] }
     ├── Validates and prepares data
     └── Calls ScreeningAnswers.upsert()
     ↓
Model (ScreeningAnswers.js)
     ├── JSON.stringify(['English', 'Spanish', 'French'])
     ├── Executes SQL INSERT...ON CONFLICT UPDATE
     └── Returns: { languages: [...], disability_status: 'no' }
     ↓
Database (screening_answers table)
     ├── languages: JSONB column stores ["English","Spanish","French"]
     └── disability_status: VARCHAR(50) stores "no"
```

### Common Issues & Solutions

#### Issue: Languages not appearing in database

**Check:**
1. Is the multi-select component populated?
   ```javascript
   // Browser console
   document.getElementById('languages-input').value
   // Should show: "English,Spanish,French"
   ```

2. Is the form being submitted?
   ```javascript
   // Check if hasScreeningData() returns true
   // It checks if any screening field has data
   ```

3. Check server logs for errors during upsert

#### Issue: Disability status showing as NULL

This is normal! Empty strings are converted to NULL in the database. If a user selects "Prefer not to say" (empty string), it becomes NULL in the database.

**Expected behavior:**
- User selects "Yes" → Database: `'yes'`
- User selects "No" → Database: `'no'`
- User selects "Prefer not to say" → Database: `NULL`

### File Locations

- **Frontend Form**: `/public/wizard.html`
- **Frontend Logic**: `/public/app.js`
- **Backend Route**: `/src/routes/wizard.js`
- **Database Model**: `/src/database/models/ScreeningAnswers.js`
- **Database Schema**: `/database/schema.sql`
- **Tests**: `/tests/wizard-screening*.test.js`
- **Report**: `/SCREENING_ANSWERS_TROUBLESHOOT_REPORT.md`

### API Endpoints

**POST /api/wizard/screening**
- **Purpose**: Save or update screening answers
- **Auth**: Required (Bearer token)
- **Body**:
  ```json
  {
    "experienceSummary": "string",
    "hybridPreference": "string",
    "travel": "string",
    "relocation": "string",
    "languages": ["English", "Spanish"],
    "dateOfBirth": "YYYY-MM-DD",
    "gpa": 3.5,
    "isAdult": true,
    "genderIdentity": "string",
    "disabilityStatus": "string",
    "militaryService": "string",
    "ethnicity": "string",
    "drivingLicense": "string"
  }
  ```
- **Response**:
  ```json
  {
    "success": true,
    "message": "Screening answers saved successfully",
    "data": {
      "id": 1,
      "user_id": 123,
      "languages": ["English", "Spanish"],
      "disability_status": "no",
      ...
    }
  }
  ```

**GET /api/wizard/data**
- **Purpose**: Retrieve all wizard data including screening answers
- **Auth**: Required
- **Response**: Complete user profile including screening_answers fields

### Test Coverage

✅ **14 tests covering:**
- Array and empty array handling
- Missing fields (defaults)
- Single and multiple languages
- All disability status values
- Database error handling
- Special characters
- Update scenarios (UPSERT)
- Edge cases

### Conclusion

The system correctly stores and retrieves `languages` and `disabilityStatus`. All tests pass, and the data flow is verified end-to-end.

If issues are reported, check:
1. Server logs (look for the new debug statements)
2. Browser console (check for JavaScript errors)
3. Database directly (query screening_answers table)
4. Run the test suite to verify system integrity

---

For detailed investigation report, see: `SCREENING_ANSWERS_TROUBLESHOOT_REPORT.md`
