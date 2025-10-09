# Frequently Asked Questions: Screening Data Storage

## Q: Why is my screening_answers table empty even though the wizard says data was saved?

**A:** Check if you're looking at the right place. If the logs say "Screening answers saved successfully", the data IS being saved. Try these steps:

1. **Verify data is in the table:**
   ```sql
   SELECT * FROM screening_answers WHERE user_id = YOUR_USER_ID;
   ```

2. **Check if user_id exists:**
   ```sql
   SELECT user_id FROM users WHERE email = 'your@email.com';
   ```

3. **View through the user_complete_profile VIEW:**
   ```sql
   SELECT languages, disability_status, gender_identity, military_service 
   FROM user_complete_profile 
   WHERE user_id = YOUR_USER_ID;
   ```

If you see data in #3 but not #1, you're experiencing the exact issue this FAQ addresses - see the next question.

## Q: I see screening data in user_complete_profile but not in screening_answers. How is that possible?

**A:** That's actually **NOT** possible with the current schema. Here's why:

- `user_complete_profile` is a **VIEW** (not a table)
- The VIEW doesn't store any data
- It simply **JOINs** data from the underlying tables including `screening_answers`
- If you see data in the VIEW, it MUST be in `screening_answers` table

If you're absolutely sure you see data in the VIEW but not the table, check:
1. Are you connected to the same database?
2. Are you looking at the correct user_id?
3. Is there a typo in your query?

## Q: Should I be saving data to user_complete_profile or screening_answers?

**A:** Always save to **screening_answers**. Here's why:

- ❌ You CANNOT write to `user_complete_profile` (it's a read-only VIEW)
- ✅ Always write to `screening_answers` using `ScreeningAnswers.upsert()`
- The VIEW will automatically reflect the data from `screening_answers`

**In code:**
```javascript
// ✅ CORRECT - Write to the table
await ScreeningAnswers.upsert(userId, data);

// ✅ CORRECT - Read from the VIEW
await User.getCompleteProfile(userId);
```

## Q: The problem statement says "backend merges all step data into user_complete_profile table". Is that true?

**A:** That's a misunderstanding. Here's what actually happens:

1. **Write operations** (POST/PUT):
   - Step 1 → `job_preferences` table
   - Step 2 → `profile` table
   - Step 3 → `eligibility` table
   - Screening → `screening_answers` table

2. **Read operations** (GET):
   - GET /api/wizard/data → Reads from `user_complete_profile` VIEW
   - The VIEW aggregates data from all four tables above

The VIEW doesn't "merge" or store data - it just provides a convenient read interface.

## Q: Should we convert user_complete_profile from a VIEW to a TABLE?

**A:** **No, the current design is optimal.** Here's why:

**Benefits of current VIEW-based design:**
- ✅ No data duplication (normalized)
- ✅ Each table has a specific purpose (separation of concerns)
- ✅ Easy to update individual sections
- ✅ Better performance with targeted indexes
- ✅ Simpler queries (VIEW handles the JOINs)

**Downsides of converting to a single table:**
- ❌ Data duplication across tables
- ❌ More complex update logic
- ❌ Harder to maintain
- ❌ Would require major code refactoring
- ❌ Could break existing code and tests

**Conclusion:** Keep the current architecture.

## Q: How do I verify if user_complete_profile is a VIEW or TABLE?

**A:** Run the verification script:

```bash
node scripts/verify-screening-schema.js
```

Or query directly:

```sql
SELECT table_name, table_type
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name = 'user_complete_profile';
```

Expected result: `table_type = 'VIEW'`

## Q: Where is the VIEW definition?

**A:** In `database/schema.sql`, starting at line 120:

```sql
CREATE OR REPLACE VIEW user_complete_profile AS
SELECT
    u.user_id,
    u.email,
    jp.*,  -- job_preferences columns
    p.*,   -- profile columns
    e.*,   -- eligibility columns
    sa.*   -- screening_answers columns
FROM users u
LEFT JOIN job_preferences jp ON u.user_id = jp.user_id
LEFT JOIN profile p ON u.user_id = p.user_id
LEFT JOIN eligibility e ON u.user_id = e.user_id
LEFT JOIN screening_answers sa ON u.user_id = sa.user_id;
```

## Q: What if I really need to consolidate the tables?

**A:** If you have a specific business requirement, here's the migration path:

1. Create a migration to:
   - Create new `user_complete_profile` TABLE (not VIEW)
   - Copy data from all existing tables
   - Add appropriate constraints and indexes

2. Update all models to write to the new table

3. Update all routes to use the unified model

4. Update all tests

5. Migrate production data

**Estimated effort:** 40+ hours of development + testing + migration

**Risk level:** High (breaking changes to core functionality)

**Recommendation:** Only do this if there's a compelling business reason.

## Q: How do I debug screening data issues?

1. **Check server logs** for errors during upsert
2. **Run the screening tests**: `npm test -- wizard-screening`
3. **Use the verification script**: `node scripts/verify-screening-schema.js`
4. **Check database directly** with the queries above
5. **Review the data flow** in `SCHEMA_ARCHITECTURE.md`

## Q: What tests verify the screening data flow?

All tests are in:
- `tests/wizard-screening.test.js` - Unit tests for the API endpoint
- `tests/wizard-screening-e2e.test.js` - End-to-end tests for data flow

Run them with: `npm test -- wizard-screening`

All 16 tests should pass.

## Q: Who should I contact if I still have questions?

1. Read `SCHEMA_ARCHITECTURE.md` for detailed explanation
2. Run `node scripts/verify-screening-schema.js` to verify your setup
3. Check the test files for examples of correct usage
4. Review the inline comments in:
   - `src/routes/wizard.js`
   - `src/database/models/ScreeningAnswers.js`
   - `src/database/models/User.js`
