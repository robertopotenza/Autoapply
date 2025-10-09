# Quick Start: Step 2 Field Validation

## Problem Symptoms

- Backend logs show `fullName: null` or `country: null`
- Resume uploads succeed but `resumePath` is empty in database
- "Save and Exit" loses user data

## Quick Fix Verification

### 1. Run Diagnostic Tool (30 seconds)

```bash
node scripts/diagnose-step2-flow.js
```

**Expected output:**
```
✅ All checks passed! Data flow appears to be properly configured.
```

### 2. Run Tests (1 minute)

```bash
npm test -- wizard-step2
```

**Expected output:**
```
✓ 9 passed, 9 total
```

### 3. Check Server Logs

When users submit forms, you should see:

**Good submission:**
```
Step 2 data received for user 2: {
  fullName: "John Doe",
  email: "john@example.com",
  country: "USA"
}
```

**Problem detected (auto-alert):**
```
⚠️ INCOMPLETE STEP 2 SUBMISSION - User 2 submitted with empty critical fields
```

## Manual Testing (5 minutes)

1. Open `/wizard.html` in browser
2. Open DevTools Console (F12)
3. Fill in Step 2 form
4. Before submitting, check console:
   - Should see: `✅ Step 2 validation passed`
   - If not: `⚠️ WARNING: Step 2 critical fields are empty`
5. Submit form
6. Check server logs for data

## Key Files

| File | Purpose |
|------|---------|
| `public/app.js` | Frontend validation + fixed saveAndExit bug |
| `src/routes/wizard.js` | Backend auto-detection |
| `tests/wizard-step2-validation.test.js` | Validation tests |
| `scripts/diagnose-step2-flow.js` | Diagnostic tool |
| `STEP2_AUTO_DETECT_FIX.md` | Complete documentation |

## What Was Fixed

1. **Critical Bug**: `saveAndExit()` now uploads files BEFORE parsing data
2. **Auto-Detection**: Backend logs warnings for incomplete submissions
3. **Validation**: Frontend validates critical fields before submission
4. **Testing**: 9 comprehensive tests ensure reliability
5. **Diagnostics**: Tool to analyze complete data flow

## Troubleshooting

If tests fail or diagnostic reports issues:

1. Check git status: `git log --oneline -5`
2. Verify you're on the correct branch
3. Run: `npm install` (ensure dependencies are up to date)
4. Check for syntax errors: `node -c public/app.js`
5. Review STEP2_AUTO_DETECT_FIX.md for detailed analysis

## Production Deployment Checklist

- [ ] All tests passing: `npm test -- wizard-step2`
- [ ] Diagnostic passes: `node scripts/diagnose-step2-flow.js`
- [ ] Server logs configured to capture warnings
- [ ] Database backup completed
- [ ] Rollback plan documented
- [ ] Monitor error rates post-deployment

## Support

**Issue**: Empty fields in database  
**Solution**: Check server logs for auto-detection warnings

**Issue**: Tests failing  
**Solution**: Run diagnostic tool for detailed analysis

**Issue**: Frontend errors  
**Solution**: Check browser console for validation messages

For detailed information, see: `STEP2_AUTO_DETECT_FIX.md`
