/**
 * Tests for error logging in application flow
 */

const Application = require('../src/database/models/Application');
const db = require('../src/database/db');

// Mock database
jest.mock('../src/database/db');

describe('Application - Error Logging', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('should log error when application fails', async () => {
    const applicationId = 'app-123';
    const errorMessage = 'Failed to submit application: Connection timeout';

    // Mock database response
    db.query.mockResolvedValue({
      rows: [{
        application_id: applicationId,
        error_message: errorMessage,
        retry_count: 1,
        last_retry_at: new Date()
      }]
    });

    // Execute
    const result = await Application.markAsFailed(applicationId, errorMessage);

    // Verify error was logged correctly
    expect(result.error_message).toBe(errorMessage);
    expect(result.retry_count).toBe(1);
    expect(result.last_retry_at).toBeDefined();
    
    // Verify database was called with correct parameters
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('UPDATE applications'),
      [applicationId, errorMessage]
    );
  });

  test('should increment retry count on multiple failures', async () => {
    const applicationId = 'app-456';
    const errorMessage = 'ATS system error';

    // First failure
    db.query.mockResolvedValueOnce({
      rows: [{ application_id: applicationId, retry_count: 1 }]
    });
    await Application.markAsFailed(applicationId, errorMessage);

    // Second failure
    db.query.mockResolvedValueOnce({
      rows: [{ application_id: applicationId, retry_count: 2 }]
    });
    const result = await Application.markAsFailed(applicationId, errorMessage);

    // Verify retry count incremented
    expect(result.retry_count).toBeGreaterThan(1);
  });

  test('should prevent duplicate applications', async () => {
    const userId = 'user-123';
    const jobId = 'job-456';

    // Mock existing application
    db.query.mockResolvedValue({
      rows: [{
        application_id: 'app-789',
        user_id: userId,
        job_id: jobId,
        status: 'applied'
      }]
    });

    // Execute
    const duplicate = await Application.checkDuplicateApplication(userId, jobId);

    // Verify duplicate was detected
    expect(duplicate).toBeDefined();
    expect(duplicate.user_id).toBe(userId);
    expect(duplicate.job_id).toBe(jobId);
  });

  test('should track status changes in history', async () => {
    const applicationId = 'app-101';
    const newStatus = 'applied';
    const statusMessage = 'Application submitted successfully';

    // Mock client and queries
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [] }) // BEGIN
        .mockResolvedValueOnce({ rows: [{ status: 'pending' }] }) // Current status SELECT
        .mockResolvedValueOnce({ rows: [{ application_id: applicationId, status: newStatus }] }) // UPDATE
        .mockResolvedValueOnce({ rows: [] }) // History INSERT
        .mockResolvedValueOnce({ rows: [] }), // COMMIT
      release: jest.fn()
    };

    db.getClient = jest.fn().mockResolvedValue(mockClient);

    // Execute
    const result = await Application.updateStatus(applicationId, newStatus, statusMessage);

    // Verify status history was logged
    expect(mockClient.query).toHaveBeenCalledWith('BEGIN');
    expect(mockClient.query).toHaveBeenCalledWith(
      expect.stringContaining('application_status_history'),
      [applicationId, 'pending', newStatus, statusMessage]
    );
    expect(mockClient.query).toHaveBeenCalledWith('COMMIT');
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('should rollback transaction on status update failure', async () => {
    const applicationId = 'app-202';
    const newStatus = 'applied';

    // Mock client with error
    const mockClient = {
      query: jest.fn()
        .mockResolvedValueOnce({ rows: [{ status: 'pending' }] })
        .mockRejectedValueOnce(new Error('Database error')),
      release: jest.fn()
    };

    db.getClient = jest.fn().mockResolvedValue(mockClient);

    // Execute and expect error
    await expect(
      Application.updateStatus(applicationId, newStatus)
    ).rejects.toThrow('Database error');

    // Verify rollback was called
    expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');
    expect(mockClient.release).toHaveBeenCalled();
  });

  test('should retrieve user application statistics', async () => {
    const userId = 'user-999';
    
    // Mock user stats from database
    db.query.mockResolvedValue({
      rows: [{
        user_id: userId,
        total_applications: 25,
        applications_submitted: 20,
        interviews_received: 5,
        offers_received: 2,
        rejections_received: 10,
        applications_this_week: 8,
        applications_today: 2
      }]
    });

    // Execute
    const stats = await Application.getUserStats(userId);

    // Verify stats are retrieved correctly
    expect(stats.user_id).toBe(userId);
    expect(stats.total_applications).toBe(25);
    expect(stats.applications_submitted).toBe(20);
    expect(stats.interviews_received).toBe(5);
    expect(stats.offers_received).toBe(2);
    expect(stats.applications_today).toBe(2);
  });

  test('should return default stats for users with no applications', async () => {
    const userId = 'new-user-001';
    
    // Mock empty result
    db.query.mockResolvedValue({ rows: [] });

    // Execute
    const stats = await Application.getUserStats(userId);

    // Verify default stats are returned
    expect(stats.user_id).toBe(userId);
    expect(stats.total_applications).toBe(0);
    expect(stats.applications_submitted).toBe(0);
    expect(stats.interviews_received).toBe(0);
  });
});
