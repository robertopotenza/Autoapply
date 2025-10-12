# Remote Countries Test Harness Guide

## Overview

The test harness (`public/test-remote-countries.html`) is a standalone diagnostic tool that validates the multi-select component's data flow and persistence without requiring database connectivity. It verifies that remote country selections are properly captured, stored, and retrieved across all data transformation paths.

## Purpose

This test harness was created to:

1. **Validate Frontend Consistency** - Ensure that user selections correctly propagate through:
   - Hidden input fields
   - `formState.data` object
   - `parseFormData()` function output

2. **Verify Round-Trip Persistence** - Confirm that data survives different storage format conversions:
   - Array format (JavaScript native)
   - JSON string format (PostgreSQL JSONB)
   - Comma-separated string format (legacy compatibility)

3. **Debug Data Loss Issues** - Provide detailed logging to identify where data might be lost in the save/load cycle

## How to Use

### Prerequisites

- A modern web browser (Chrome, Firefox, Safari, Edge)
- A local web server (Python's http.server, Node.js http-server, or the main application server)

### Running the Test Harness

#### Option 1: Using Python HTTP Server

```bash
cd public
python3 -m http.server 8080
```

Then navigate to: `http://localhost:8080/test-remote-countries.html`

#### Option 2: Using the Main Application Server

```bash
npm start
```

Then navigate to: `http://localhost:3000/test-remote-countries.html`

#### Option 3: Using Node.js http-server

```bash
npm install -g http-server
cd public
http-server -p 8080
```

Then navigate to: `http://localhost:8080/test-remote-countries.html`

### Running Tests

1. **Select Countries**: Click the search box and select 2-3 countries from the dropdown

2. **Run Frontend Consistency Test**:
   - Click the "🔍 Run Frontend Consistency Test" button
   - This validates that selected countries are properly stored in:
     - Hidden input field (as comma-separated string)
     - `formState.data['remote-countries']`
     - Output of `parseCommaSeparated()` function

3. **Run Mock Round-Trip Test**:
   - Click the "🔄 Run Mock Round-Trip (Save → Load)" button
   - This simulates save/load cycles with three different formats:
     - **Array Format**: How frontend stores data internally
     - **JSON String Format**: How PostgreSQL JSONB columns store arrays
     - **CSV Format**: How legacy systems might store multi-values

4. **Review Results**:
   - Green checkmarks (✅) indicate passing tests
   - Red X marks (❌) indicate failing tests
   - Detailed comparison shows expected vs actual values

### Understanding Test Results

#### Frontend Consistency Test Results

```
✅ PASS: Hidden input matches selected items
✅ PASS: FormState matches selected items
✅ PASS: ParseFormData produces correct array
```

**What this means**: User selections are correctly captured in all frontend data structures. No data loss between UI and API payload.

#### Round-Trip Test Results

```
✅ PASS: Array format round-trip successful
✅ PASS: JSON string format round-trip successful
✅ PASS: CSV format round-trip successful
```

**What this means**: The `convertUserDataToFormState()` and `populateMultiSelect()` functions correctly handle data regardless of how it's stored in the database.

## Test Architecture

### Frontend Consistency Test Flow

```
User Selection
    ↓
Multi-Select Component (selectedItems Set)
    ↓
updateHiddenInput() → Hidden Input Value (CSV string)
    ↓
formState.data[baseId] = hiddenInput.value
    ↓
parseCommaSeparated() → Array for API
```

### Mock Round-Trip Test Flow

```
Original Selection: [A, B, C]
    ↓
Test 1: Array Format
    Frontend → [A, B, C] → Backend → [A, B, C] → Frontend → [A, B, C]
    
Test 2: JSON String Format
    Frontend → [A, B, C] → JSON.stringify → '["A","B","C"]' → JSON.parse → [A, B, C] → Frontend → [A, B, C]
    
Test 3: CSV Format
    Frontend → [A, B, C] → join(',') → 'A,B,C' → split(',') → [A, B, C] → Frontend → [A, B, C]
```

## Console Logging

The test harness includes detailed console logging that matches the logging in the main application:

```javascript
🌍 REMOTE COUNTRIES UPDATE: {
  selectedItems: Array(3) ["United States", "Canada", "United Kingdom"],
  hiddenInputValue: "United States,Canada,United Kingdom",
  formStateValue: "United States,Canada,United Kingdom"
}
```

This logging helps trace data flow through the component lifecycle.

## Backend Logging

In addition to the test harness, backend logging has been added to `src/routes/wizard.js`:

### POST /api/wizard/step1

```javascript
🌍 [Step 1] Raw remoteJobs input for user X: {
  remoteJobsRaw: ["United States", "Canada", "United Kingdom"],
  remoteJobsType: "object",
  remoteJobsIsArray: true,
  remoteJobsLength: 3
}

🌍 [Step 1] Stored result for user X: {
  remoteJobsStored: ["United States", "Canada", "United Kingdom"],
  remoteJobsStoredType: "object",
  remoteJobsStoredIsArray: true
}
```

These logs confirm:
- The API receives data in the correct format (array)
- The database stores data in the correct format (JSONB array)
- Data is not corrupted during the save process

## Frontend Logging

Enhanced logging has been added to `public/app.js`:

### parseFormData()

```javascript
🌍 parseFormData() - Remote countries parsing: {
  rawValue: "United States,Canada,United Kingdom",
  rawType: "string",
  parsedArray: ["United States", "Canada", "United Kingdom"],
  parsedLength: 3
}
```

This logging confirms that `parseFormData()` correctly transforms the comma-separated string into an array for the API payload.

## Common Issues and Solutions

### Issue: Tests fail with "No countries selected"

**Solution**: Make sure to select at least one country before running tests. Click the search box and choose countries from the dropdown.

### Issue: Hidden input test fails

**Symptoms**: 
```
❌ FAIL: Hidden input does not match selected items
Expected: [A, B, C]
Got: [A, B]
```

**Diagnosis**: The `updateHiddenInput()` function is not being called after selection, or there's a race condition.

**Solution**: Check that the multi-select component's `addItem()` function calls `updateHiddenInput()`.

### Issue: FormState test fails

**Symptoms**:
```
❌ FAIL: FormState does not match selected items
Expected: [A, B, C]
Got: undefined
```

**Diagnosis**: The `updateHiddenInput()` function is not updating `window.formState.data[baseId]`.

**Solution**: Verify that `updateHiddenInput()` includes:
```javascript
if (window.formState && window.formState.data) {
    window.formState.data[baseId] = hiddenInput.value;
}
```

### Issue: Round-trip tests fail with format mismatches

**Symptoms**:
```
❌ FAIL: JSON string format round-trip failed
Expected: [A, B, C]
Got: [a, b, c]
```

**Diagnosis**: The `setItems()` function in the multi-select instance is not properly handling case-insensitive matching.

**Solution**: Verify that `setItems()` includes case-insensitive fallback matching:
```javascript
const matchedOption = options.find(opt => 
    opt.toLowerCase() === trimmedItem.toLowerCase()
);
```

## Integration with Main Application

The test harness uses the exact same code as the main application's `app.js`:

- `initMultiSelect()` - Identical implementation
- `parseCommaSeparated()` - Identical implementation
- `updateHiddenInput()` - Identical implementation
- `setItems()` - Identical implementation

This ensures that test results accurately reflect real-world behavior.

## When to Use This Test Harness

Use this test harness:

1. **Before deploying changes** to multi-select components
2. **When investigating reports** of missing remote countries data
3. **When debugging** the save/load cycle for wizard data
4. **When verifying** that database format changes don't break the UI
5. **When onboarding new developers** to understand the data flow

## Related Files

- `public/app.js` - Main application JavaScript (contains actual multi-select implementation)
- `src/routes/wizard.js` - Backend API for wizard data (Step 1 POST endpoint)
- `src/database/models/JobPreferences.js` - Database model for job preferences
- `public/wizard.html` - Main wizard UI that uses the multi-select component
- `public/wizard-debug.html` - Debug page for viewing wizard form state

## Test Results

When both tests pass, you should see:

```
ALL TESTS PASSED ✅
ALL ROUND-TRIP TESTS PASSED ✅

✨ All data format round-trips work correctly. The multi-select component 
   handles array, JSON string, and comma-separated formats properly.
```

This confirms that:
- ✅ Frontend data flow is correct
- ✅ No data loss occurs during user interaction
- ✅ All storage formats are supported
- ✅ The component is production-ready

## Troubleshooting Backend Issues

If frontend tests pass but data is still lost in production:

1. **Check server logs** for the POST /api/wizard/step1 endpoint:
   ```
   🌍 [Step 1] Raw remoteJobs input for user X: ...
   ```

2. **Verify database column type** in PostgreSQL:
   ```sql
   SELECT column_name, data_type 
   FROM information_schema.columns 
   WHERE table_name = 'job_preferences' 
   AND column_name = 'remote_jobs';
   ```
   Expected: `jsonb` or `text[]`

3. **Check database constraints**:
   ```sql
   SELECT constraint_name, constraint_type 
   FROM information_schema.table_constraints 
   WHERE table_name = 'job_preferences';
   ```

4. **Verify the view query**:
   ```sql
   SELECT pg_get_viewdef('user_complete_profile', true);
   ```
   
   Should include proper JSONB handling for remote_jobs.

## Automated Testing

In addition to the interactive test harness, there are automated tests that can be run in CI/CD pipelines:

### Jest API Test

**Location**: `tests/remote-countries-api.test.js`

**Purpose**: Validates the complete API round-trip for remote countries persistence through mocked database interactions.

**Run with**:
```bash
npm run test:remote-countries:api
# or
npm test -- tests/remote-countries-api.test.js
```

**Coverage**:
- ✅ POST /api/wizard/step1 - Save remote countries
- ✅ GET /api/wizard/data - Retrieve remote countries
- ✅ Array format handling
- ✅ Empty array handling
- ✅ Multiple countries handling
- ✅ Update scenarios
- ✅ Full round-trip persistence

### JSdom Test

**Location**: `scripts/e2e-remote-countries-jsdom.js`

**Purpose**: Runs the interactive test harness in a headless environment using JSdom, perfect for CI pipelines.

**Run with**:
```bash
npm run test:remote-countries:jsdom
```

**Features**:
- Programmatically selects test countries
- Executes both Frontend Consistency and Mock Round-Trip tests
- Returns exit code 0 on success, 1 on failure
- No browser required

**Output**:
```
----- JSdom SUMMARY -----
Frontend Consistency: PASS
Mock Round-Trip   : PASS
```

### Continuous Integration

All automated tests are included in the main test suite:
```bash
npm test
```

This ensures that:
1. Remote countries functionality is validated on every commit
2. Regressions are caught immediately
3. Both frontend logic and API endpoints are tested
4. Multiple data formats are verified

## Conclusion

The test harness provides a comprehensive validation framework for the remote countries multi-select component. All tests passing indicates that the frontend implementation is solid and any data loss must be occurring in the backend persistence layer.
