// @ai-meta: schema-test
// @ai-meta: unit-test

/**
 * Unit tests for Schema Verification Utility
 * Tests the verifySchema function without requiring a database connection
 */

const { requiredColumns } = require('../src/utils/verifySchema');

describe('Schema Verification Utility', () => {
  describe('Required Columns Configuration', () => {
    test('requiredColumns defines critical tables', () => {
      expect(requiredColumns).toBeDefined();
      expect(requiredColumns).toHaveProperty('users');
      expect(requiredColumns).toHaveProperty('jobs');
      expect(requiredColumns).toHaveProperty('applications');
      expect(requiredColumns).toHaveProperty('profile');
    });

    test('users table has required columns', () => {
      expect(requiredColumns.users).toContain('user_id');
      expect(requiredColumns.users).toContain('email');
      expect(requiredColumns.users).toContain('password_hash');
      expect(requiredColumns.users).toContain('created_at');
    });

    test('jobs table has required columns for listings', () => {
      expect(requiredColumns.jobs).toContain('job_id');
      expect(requiredColumns.jobs).toContain('job_title');
      expect(requiredColumns.jobs).toContain('company_name');
      expect(requiredColumns.jobs).toContain('job_url');
      expect(requiredColumns.jobs).toContain('created_at');
      // user_id is nullable for global jobs, so it's not in requiredColumns
    });

    test('applications table has required columns', () => {
      expect(requiredColumns.applications).toContain('application_id');
      expect(requiredColumns.applications).toContain('user_id');
      expect(requiredColumns.applications).toContain('job_id');
      expect(requiredColumns.applications).toContain('status');
      // applied_at is nullable, so it's not in requiredColumns
    });

    test('profile table has required columns including email', () => {
      expect(requiredColumns.profile).toContain('user_id');
      expect(requiredColumns.profile).toContain('full_name');
      expect(requiredColumns.profile).toContain('email');
      expect(requiredColumns.profile).toContain('phone');
    });
  });

  describe('verifySchema function structure', () => {
    test('verifySchema is exported', () => {
      const { verifySchema } = require('../src/utils/verifySchema');
      expect(verifySchema).toBeDefined();
      expect(typeof verifySchema).toBe('function');
    });

    test('verifySchemaGraceful is exported', () => {
      const { verifySchemaGraceful } = require('../src/utils/verifySchema');
      expect(verifySchemaGraceful).toBeDefined();
      expect(typeof verifySchemaGraceful).toBe('function');
    });

    test('verifySchema function signature expects pool parameter', () => {
      const { verifySchema } = require('../src/utils/verifySchema');
      const functionString = verifySchema.toString();
      
      // Should accept pool parameter
      expect(functionString).toContain('pool');
      
      // Should use pool.query
      expect(functionString).toContain('pool.query');
      
      // Should check information_schema
      expect(functionString).toContain('information_schema');
    });
  });
});
