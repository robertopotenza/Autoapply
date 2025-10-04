const Application = require('../src/database/models/Application');
const db = require('../src/database/db');

// Mock the database module
jest.mock('../src/database/db');

describe('Application.updateStatus - Error Logging', () => {
  let mockClient;
  const applicationId = 1;
  const newStatus = 'applied';
  const statusMessage = 'Application submitted successfully';

  beforeEach(() => {
    jest.clearAllMocks();

    // Create mock client with flexible query implementation
    mockClient = {
      query: jest.fn().mockImplementation((sql, params) => {
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'BEGIN') {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT status FROM applications')) {
          return Promise.resolve({ rows: [{ status: 'pending' }] });
        }
        if (typeof sql === 'string' && sql.includes('UPDATE applications')) {
          return Promise.resolve({ rows: [{ application_id: applicationId, status: newStatus }] });
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO application_status_history')) {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'COMMIT') {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        // Default fallback
        return Promise.resolve({ rows: [] });
      }),
      release: jest.fn()
    };

    // Mock getClient to return our flexible mock client
    db.getClient.mockResolvedValue(mockClient);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('Transaction handling', () => {
    it('should successfully update status with proper transaction flow', async () => {
      const result = await Application.updateStatus(applicationId, newStatus, statusMessage);

      // Verify transaction started
      expect(mockClient.query).toHaveBeenCalledWith('BEGIN');

      // Verify current status was fetched
      expect(mockClient.query).toHaveBeenCalledWith(
        'SELECT status FROM applications WHERE application_id = $1',
        [applicationId]
      );

      // Verify status was updated
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE applications'),
        [newStatus, applicationId]
      );

      // Verify status history was logged
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO application_status_history'),
        [applicationId, 'pending', newStatus, statusMessage]
      );

      // Verify transaction was committed
      expect(mockClient.query).toHaveBeenCalledWith('COMMIT');

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();

      // Verify result
      expect(result).toEqual({ application_id: applicationId, status: newStatus });
    });

    it('should rollback transaction on error', async () => {
      // Mock an error during UPDATE
      mockClient.query.mockImplementation((sql, params) => {
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'BEGIN') {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT status FROM applications')) {
          return Promise.resolve({ rows: [{ status: 'pending' }] });
        }
        if (typeof sql === 'string' && sql.includes('UPDATE applications')) {
          return Promise.reject(new Error('Database error during update'));
        }
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        Application.updateStatus(applicationId, newStatus, statusMessage)
      ).rejects.toThrow('Database error during update');

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');

      // Verify client was released even after error
      expect(mockClient.release).toHaveBeenCalled();
    });

    it('should throw error when application is not found', async () => {
      // Mock SELECT to return no rows
      mockClient.query.mockImplementation((sql, params) => {
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'BEGIN') {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT status FROM applications')) {
          return Promise.resolve({ rows: [] }); // Empty result
        }
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        Application.updateStatus(applicationId, newStatus, statusMessage)
      ).rejects.toThrow('Application not found');

      // Verify ROLLBACK was called
      expect(mockClient.query).toHaveBeenCalledWith('ROLLBACK');

      // Verify client was released
      expect(mockClient.release).toHaveBeenCalled();
    });
  });

  describe('Status transitions', () => {
    it('should correctly log old and new status in history', async () => {
      const oldStatus = 'pending';
      
      await Application.updateStatus(applicationId, newStatus, statusMessage);

      // Verify the history insert includes both old and new status
      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO application_status_history'),
        [applicationId, oldStatus, newStatus, statusMessage]
      );
    });

    it('should handle status updates with applied_at when status is applied', async () => {
      await Application.updateStatus(applicationId, 'applied', statusMessage);

      // Verify UPDATE query includes applied_at for 'applied' status
      const updateCalls = mockClient.query.mock.calls.filter(call => 
        typeof call[0] === 'string' && call[0].includes('UPDATE applications')
      );
      
      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls[0][0]).toContain('applied_at = NOW()');
    });

    it('should handle status updates without applied_at for non-applied status', async () => {
      const nonAppliedStatus = 'rejected';
      
      await Application.updateStatus(applicationId, nonAppliedStatus, statusMessage);

      // Verify UPDATE query doesn't include applied_at for non-'applied' status
      const updateCalls = mockClient.query.mock.calls.filter(call => 
        typeof call[0] === 'string' && call[0].includes('UPDATE applications')
      );
      
      expect(updateCalls.length).toBeGreaterThan(0);
      expect(updateCalls[0][0]).not.toContain('applied_at = NOW()');
    });
  });

  describe('Error logging', () => {
    it('should log status message when provided', async () => {
      const customMessage = 'Custom status update message';
      
      await Application.updateStatus(applicationId, newStatus, customMessage);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO application_status_history'),
        [applicationId, 'pending', newStatus, customMessage]
      );
    });

    it('should handle null status message', async () => {
      await Application.updateStatus(applicationId, newStatus, null);

      expect(mockClient.query).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO application_status_history'),
        [applicationId, 'pending', newStatus, null]
      );
    });

    it('should release client on successful transaction', async () => {
      await Application.updateStatus(applicationId, newStatus, statusMessage);

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });

    it('should release client even when commit fails', async () => {
      mockClient.query.mockImplementation((sql, params) => {
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'BEGIN') {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.includes('SELECT status FROM applications')) {
          return Promise.resolve({ rows: [{ status: 'pending' }] });
        }
        if (typeof sql === 'string' && sql.includes('UPDATE applications')) {
          return Promise.resolve({ rows: [{ application_id: applicationId, status: newStatus }] });
        }
        if (typeof sql === 'string' && sql.includes('INSERT INTO application_status_history')) {
          return Promise.resolve({ rows: [] });
        }
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'COMMIT') {
          return Promise.reject(new Error('Commit failed'));
        }
        if (typeof sql === 'string' && sql.trim().toUpperCase() === 'ROLLBACK') {
          return Promise.resolve({ rows: [] });
        }
        return Promise.resolve({ rows: [] });
      });

      await expect(
        Application.updateStatus(applicationId, newStatus, statusMessage)
      ).rejects.toThrow('Commit failed');

      expect(mockClient.release).toHaveBeenCalledTimes(1);
    });
  });
});
