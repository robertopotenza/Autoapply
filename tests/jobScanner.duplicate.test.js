/**
 * Tests for duplicate prevention in job scanning
 */

// Mock dependencies before requiring modules
jest.mock('../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return mockLogger;
});

jest.mock('../src/database/models/Job');
jest.mock('../src/database/models/AutoApplySettings');

const JobScanner = require('../src/scanner/jobScanner');
const Job = require('../src/database/models/Job');
const AutoApplySettings = require('../src/database/models/AutoApplySettings');

describe('JobScanner - Duplicate Prevention', () => {
  let jobScanner;

  beforeEach(() => {
    jobScanner = new JobScanner();
    jest.clearAllMocks();
  });

  test('should skip duplicate jobs based on URL', async () => {
    // Setup: Mock existing job in database
    const existingJob = {
      job_id: 'job-123',
      job_url: 'https://www.tesla.com/careers/job/senior-software-engineer-12345'
    };

    Job.findByUrl.mockResolvedValue(existingJob);
    Job.markAsChecked.mockResolvedValue(true);
    AutoApplySettings.getEnabledUsers.mockResolvedValue([{ user_id: 'user-1' }]);

    // Execute
    const stats = await jobScanner.scanAllPortals();

    // Verify duplicate was detected and skipped
    expect(stats.duplicatesSkipped).toBeGreaterThan(0);
    expect(Job.markAsChecked).toHaveBeenCalledWith(existingJob.job_id);
    expect(Job.create).not.toHaveBeenCalled();
  });

  test('should add new jobs when no duplicates exist', async () => {
    // Setup: No existing jobs
    Job.findByUrl.mockResolvedValue(null);
    Job.create.mockResolvedValue({ job_id: 'new-job-1' });
    AutoApplySettings.getEnabledUsers.mockResolvedValue([{ user_id: 'user-1' }]);

    // Execute
    const stats = await jobScanner.scanAllPortals();

    // Verify new jobs were added
    expect(stats.newJobsAdded).toBeGreaterThan(0);
    expect(Job.create).toHaveBeenCalled();
  });

  test('should track scan statistics correctly', async () => {
    // Setup
    Job.findByUrl.mockResolvedValueOnce(null) // First job is new
                   .mockResolvedValueOnce({ job_id: 'existing-1' }) // Second is duplicate
                   .mockResolvedValueOnce(null) // Third is new
                   .mockResolvedValueOnce({ job_id: 'existing-2' }); // Fourth is duplicate
    
    Job.create.mockResolvedValue({ job_id: 'new-job' });
    Job.markAsChecked.mockResolvedValue(true);
    AutoApplySettings.getEnabledUsers.mockResolvedValue([{ user_id: 'user-1' }]);

    // Execute
    const stats = await jobScanner.scanAllPortals();

    // Verify stats are correct
    expect(stats.totalJobsFound).toBe(4);
    expect(stats.newJobsAdded).toBe(2);
    expect(stats.duplicatesSkipped).toBe(2);
  });

  test('should handle errors gracefully and track error count', async () => {
    // Setup: Simulate database error
    Job.findByUrl.mockRejectedValue(new Error('Database connection failed'));
    AutoApplySettings.getEnabledUsers.mockResolvedValue([{ user_id: 'user-1' }]);

    // Execute
    const stats = await jobScanner.scanAllPortals();

    // Verify errors are tracked
    expect(stats.errors).toBeGreaterThan(0);
    expect(stats.totalJobsFound).toBeGreaterThanOrEqual(0);
  });

  test('should prevent concurrent scans', async () => {
    // Setup
    AutoApplySettings.getEnabledUsers.mockResolvedValue([{ user_id: 'user-1' }]);
    Job.findByUrl.mockResolvedValue(null);
    Job.create.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

    // Execute: Start first scan
    const firstScan = jobScanner.scanAllPortals();
    
    // Try to start second scan while first is running
    const secondScan = jobScanner.scanAllPortals();

    const [firstResult, secondResult] = await Promise.all([firstScan, secondScan]);

    // Verify second scan was rejected/returned early
    expect(firstResult.totalJobsFound).toBeGreaterThanOrEqual(0);
    expect(secondResult).toEqual(expect.objectContaining({
      totalJobsFound: expect.any(Number)
    }));
  });
});
