/**
 * Test to verify Job model security and business logic for user_id field
 * 
 * This test validates that the security model for jobs with user_id IS NULL is correct
 * and that the business logic properly separates global jobs from user-specific jobs.
 */

describe('Job Model Security and Business Logic', () => {
  describe('Job Model user_id field', () => {
    test('getStatistics method includes user_id IS NULL condition', () => {
      const Job = require('../src/models/Job');
      const getStatisticsMethod = Job.getStatistics.toString();
      
      // Should query both user-specific jobs and global jobs
      expect(getStatisticsMethod).toContain('j.user_id = $1 OR j.user_id IS NULL');
      
      // Should join with applications table using user_id for privacy
      expect(getStatisticsMethod).toContain('a.user_id = $1');
      
      // Should return statistics with proper aggregation
      expect(getStatisticsMethod).toContain('COUNT(*) as total_jobs');
      expect(getStatisticsMethod).toContain('application_id IS NOT NULL');
    });

    test('getAnalytics method includes user_id IS NULL condition', () => {
      const Job = require('../src/models/Job');
      const getAnalyticsMethod = Job.getAnalytics.toString();
      
      // Should query both user-specific jobs and global jobs
      expect(getAnalyticsMethod).toContain('j.user_id = $1 OR j.user_id IS NULL');
      
      // Should join with applications table using user_id for privacy
      expect(getAnalyticsMethod).toContain('a.user_id = $1');
      
      // Should return analytics with time-based filtering
      expect(getAnalyticsMethod).toContain('j.created_at >= NOW()');
    });

    test('findByUserId method queries only user-specific jobs', () => {
      const Job = require('../src/models/Job');
      const findByUserIdMethod = Job.findByUserId.toString();
      
      // Should query only user-specific jobs (not global jobs)
      expect(findByUserIdMethod).toContain('WHERE j.user_id = $1');
      
      // Should NOT include "OR j.user_id IS NULL" - this is user-specific query
      expect(findByUserIdMethod).not.toContain('j.user_id = $1 OR j.user_id IS NULL');
      
      // Should join with applications for application status
      expect(findByUserIdMethod).toContain('a.user_id = $1');
    });

    test('create method includes user_id in INSERT statement', () => {
      const Job = require('../src/models/Job');
      const createMethod = Job.create.toString();
      
      // Should insert user_id into jobs table
      expect(createMethod).toContain('user_id');
      expect(createMethod).toContain('INSERT INTO jobs');
      
      // Should use jobData.userId parameter
      expect(createMethod).toContain('jobData.userId');
    });

    test('Job model has comprehensive documentation', () => {
      const Job = require('../src/models/Job');
      const jobClassSource = Job.toString();
      
      // The model should be well-documented (not testing the actual comments,
      // but verifying the methods exist as expected)
      expect(Job.getStatistics).toBeDefined();
      expect(Job.getAnalytics).toBeDefined();
      expect(Job.findByUserId).toBeDefined();
      expect(Job.create).toBeDefined();
      expect(Job.findById).toBeDefined();
      expect(Job.findMatchingJobs).toBeDefined();
    });
  });

  describe('Security Model Documentation', () => {
    test('getStatistics has security documentation in source', () => {
      const fs = require('fs');
      const path = require('path');
      const jobModelPath = path.join(__dirname, '../src/models/Job.js');
      const jobModelSource = fs.readFileSync(jobModelPath, 'utf8');
      
      // Should have comprehensive comments explaining the security model
      expect(jobModelSource).toContain('Security Note');
      expect(jobModelSource).toContain('Global Jobs');
      expect(jobModelSource).toContain('user_id IS NULL');
      expect(jobModelSource).toContain('intentional');
      
      // Should explain both types of jobs
      expect(jobModelSource).toContain('User-Specific Jobs');
      expect(jobModelSource).toContain('Global Jobs');
    });

    test('Job model explains privacy separation', () => {
      const fs = require('fs');
      const path = require('path');
      const jobModelPath = path.join(__dirname, '../src/models/Job.js');
      const jobModelSource = fs.readFileSync(jobModelPath, 'utf8');
      
      // Should explain how privacy is maintained
      expect(jobModelSource).toContain('applications table');
      expect(jobModelSource).toContain('privacy');
      
      // Should mention job boards/sources
      expect(jobModelSource.toLowerCase()).toContain('indeed');
      expect(jobModelSource.toLowerCase()).toContain('linkedin');
    });
  });

  describe('Business Logic Validation', () => {
    test('Job model supports both global and user-specific jobs', () => {
      const Job = require('../src/models/Job');
      
      // Global jobs functionality
      const getStatisticsMethod = Job.getStatistics.toString();
      expect(getStatisticsMethod).toContain('user_id IS NULL');
      
      // User-specific jobs functionality
      const findByUserIdMethod = Job.findByUserId.toString();
      expect(findByUserIdMethod).toContain('user_id = $1');
      
      // Both should respect application privacy
      expect(getStatisticsMethod).toContain('a.user_id = $1');
      expect(findByUserIdMethod).toContain('a.user_id = $1');
    });

    test('Application privacy is maintained through JOIN conditions', () => {
      const Job = require('../src/models/Job');
      
      // All methods that join applications should filter by user_id
      const getStatisticsMethod = Job.getStatistics.toString();
      const getAnalyticsMethod = Job.getAnalytics.toString();
      const findByUserIdMethod = Job.findByUserId.toString();
      const findMatchingJobsMethod = Job.findMatchingJobs.toString();
      
      // All should join applications with user_id filter
      [getStatisticsMethod, getAnalyticsMethod, findByUserIdMethod, findMatchingJobsMethod].forEach(method => {
        expect(method).toContain('LEFT JOIN applications');
        expect(method).toContain('a.user_id = $1');
      });
    });
  });
});
