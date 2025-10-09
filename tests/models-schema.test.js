// @ai-meta: schema-test
// @ai-meta: model-compatibility-test

/**
 * Test to verify legacy models use correct schema column names
 */

describe('Legacy Models Schema Compatibility', () => {
  describe('Job Model', () => {
    test('findById query uses job_id column', () => {
      const Job = require('../src/models/Job');
      const findByIdMethod = Job.findById.toString();
      expect(findByIdMethod).toContain('job_id');
      expect(findByIdMethod).not.toContain('WHERE id =');
    });

    test('create query uses correct column names', () => {
      const Job = require('../src/models/Job');
      const createMethod = Job.create.toString();
      expect(createMethod).toContain('job_title');
      expect(createMethod).toContain('company_name');
      expect(createMethod).toContain('job_description');
      expect(createMethod).toContain('job_url');
      expect(createMethod).not.toContain('INSERT INTO jobs (\n          user_id, title, company');
    });

    test('findByUserId query uses application_id for joins', () => {
      const Job = require('../src/models/Job');
      const findByUserIdMethod = Job.findByUserId.toString();
      expect(findByUserIdMethod).toContain('application_id IS NOT NULL');
      expect(findByUserIdMethod).toContain('j.job_id = a.job_id');
      expect(findByUserIdMethod).not.toContain('a.id IS NOT NULL');
    });
  });

  describe('Application Model', () => {
    test('findById query uses application_id column', () => {
      const Application = require('../src/models/Application');
      const findByIdMethod = Application.findById.toString();
      expect(findByIdMethod).toContain('application_id');
      expect(findByIdMethod).not.toContain('WHERE id =');
    });

    test('findByUserId query uses correct job column names', () => {
      const Application = require('../src/models/Application');
      const findByUserIdMethod = Application.findByUserId.toString();
      expect(findByUserIdMethod).toContain('j.job_title');
      expect(findByUserIdMethod).toContain('j.company_name');
      expect(findByUserIdMethod).toContain('a.job_id = j.job_id');
      expect(findByUserIdMethod).not.toContain('j.title as job_title');
      expect(findByUserIdMethod).not.toContain('j.company,');
    });

    test('getRecentApplications uses correct column names', () => {
      const Application = require('../src/models/Application');
      const getRecentMethod = Application.getRecentApplications.toString();
      expect(getRecentMethod).toContain('j.job_title');
      expect(getRecentMethod).toContain('j.company_name');
      expect(getRecentMethod).toContain('a.job_id = j.job_id');
    });

    test('getPendingApplications uses job_url not application_url', () => {
      const Application = require('../src/models/Application');
      const getPendingMethod = Application.getPendingApplications.toString();
      expect(getPendingMethod).toContain('j.job_url');
      expect(getPendingMethod).not.toContain('j.application_url');
    });
  });

  describe('AutoApplySettings Model', () => {
    test('getDefaultSettings uses is_enabled', () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      const defaults = AutoApplySettings.getDefaultSettings(1);
      expect(defaults).toHaveProperty('is_enabled');
      expect(defaults).not.toHaveProperty('enabled');
    });

    test('create query uses is_enabled column', () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      const createMethod = AutoApplySettings.create.toString();
      expect(createMethod).toContain('is_enabled');
      expect(createMethod).toContain('excluded_companies');
      expect(createMethod).toContain('required_keywords');
      expect(createMethod).toContain('excluded_keywords');
      expect(createMethod).toContain('min_salary');
    });

    test('toggleEnabled uses is_enabled column', () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      const toggleMethod = AutoApplySettings.toggleEnabled.toString();
      expect(toggleMethod).toContain('is_enabled');
      expect(toggleMethod).not.toContain('SET enabled =');
    });

    test('getEnabledUsers uses correct column and table references', () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      const getEnabledMethod = AutoApplySettings.getEnabledUsers.toString();
      expect(getEnabledMethod).toContain('is_enabled = true');
      expect(getEnabledMethod).toContain('u.user_id');
      expect(getEnabledMethod).not.toContain('WHERE s.enabled = true');
      expect(getEnabledMethod).not.toContain('u.id\n');
    });

    test('getCompanyApplicationCount uses company_name', () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      const getCompanyMethod = AutoApplySettings.getCompanyApplicationCount.toString();
      expect(getCompanyMethod).toContain('j.company_name');
      expect(getCompanyMethod).toContain('a.job_id = j.job_id');
      expect(getCompanyMethod).not.toContain('j.company =');
      expect(getCompanyMethod).not.toContain('a.job_id = j.id');
    });

    test('update method supports legacy field names', () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      const updateMethod = AutoApplySettings.update.toString();
      // Should handle both enabled and is_enabled
      expect(updateMethod).toContain('updates.enabled');
      expect(updateMethod).toContain('is_enabled');
      // Should handle legacy exclude_companies -> excluded_companies
      expect(updateMethod).toContain('exclude_companies');
      expect(updateMethod).toContain('excluded_companies');
    });
  });
});
