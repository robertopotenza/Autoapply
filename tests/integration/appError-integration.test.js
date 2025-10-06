/**
 * Integration test for AppError in database operations
 * Verifies that AppError is properly thrown and logged with context
 */

const AppError = require('../../src/utils/AppError');
const Application = require('../../src/models/Application');
const Job = require('../../src/models/Job');

describe('AppError Integration Tests', () => {
  describe('Database Operations', () => {
    test('Application.getAnalytics throws AppError with context on DB failure', async () => {
      // Mock db.query to simulate a database error
      const mockDb = require('../../src/database/db');
      const originalQuery = mockDb.query;
      
      // Simulate a database connection error
      mockDb.query = jest.fn().mockRejectedValue(
        Object.assign(new Error('Connection timeout'), { code: 'ETIMEDOUT' })
      );

      try {
        await Application.getAnalytics(123, '30');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe('DB_ERROR');
        expect(error.context).toBeDefined();
        expect(error.context.module).toBe('Application');
        expect(error.context.method).toBe('getAnalytics');
        expect(error.context.userId).toBe(123);
        expect(error.context.period).toBe('30');
        expect(error.cause).toBeDefined();
        expect(error.cause.code).toBe('ETIMEDOUT');
        
        // Verify toJSON includes all context
        const json = error.toJSON();
        expect(json.code).toBe('DB_ERROR');
        expect(json.context.module).toBe('Application');
        expect(json.timestamp).toBeDefined();
      }

      // Restore original query function
      mockDb.query = originalQuery;
    });

    test('Job.getAnalytics throws AppError with context on DB failure', async () => {
      const mockDb = require('../../src/database/db');
      const originalQuery = mockDb.query;
      
      mockDb.query = jest.fn().mockRejectedValue(
        Object.assign(new Error('Query execution failed'), { code: '42P01' })
      );

      try {
        await Job.getAnalytics(456, '30');
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe('DB_ERROR');
        expect(error.context.module).toBe('Job');
        expect(error.context.method).toBe('getAnalytics');
        expect(error.context.userId).toBe(456);
        expect(error.cause.code).toBe('42P01');
      }

      mockDb.query = originalQuery;
    });

    test('Application.checkExistingApplication throws AppError with context', async () => {
      const mockDb = require('../../src/database/db');
      const originalQuery = mockDb.query;
      
      mockDb.query = jest.fn().mockRejectedValue(
        Object.assign(new Error('Database error'), { code: 'ECONNREFUSED' })
      );

      try {
        await Application.checkExistingApplication(789, 101);
        fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(AppError);
        expect(error.code).toBe('DB_ERROR');
        expect(error.context.userId).toBe(789);
        expect(error.context.jobId).toBe(101);
        expect(error.context.method).toBe('checkExistingApplication');
      }

      mockDb.query = originalQuery;
    });
  });

  describe('AppError Structured Logging', () => {
    test('AppError toJSON includes all required fields', () => {
      const context = {
        module: 'TestModule',
        method: 'testMethod',
        userId: 999,
        additionalData: { key: 'value' }
      };
      
      const cause = new Error('Original error');
      const appError = AppError.database('Test error message', context, cause);
      
      const json = appError.toJSON();
      
      expect(json.name).toBe('AppError');
      expect(json.message).toBe('Test error message');
      expect(json.code).toBe('DB_ERROR');
      expect(json.context).toEqual(context);
      expect(json.timestamp).toBeDefined();
      expect(json.stack).toBeDefined();
      expect(json.cause).toBeDefined();
      expect(json.cause.message).toBe('Original error');
    });

    test('AppError factory method api() creates proper error', () => {
      const error = AppError.api('API call failed', {
        endpoint: '/api/test',
        statusCode: 500
      });
      
      expect(error.code).toBe('API_ERROR');
      expect(error.context.endpoint).toBe('/api/test');
      expect(error.context.statusCode).toBe(500);
    });
  });
});
