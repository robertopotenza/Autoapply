/**
 * Unit tests for AppError class
 * Tests structured error handling, context preservation, and error chaining
 */

const AppError = require('../src/utils/AppError');

describe('AppError', () => {
  describe('Basic Error Creation', () => {
    test('creates error with message and code', () => {
      const error = new AppError('Test error', 'TEST_CODE');

      expect(error.message).toBe('Test error');
      expect(error.code).toBe('TEST_CODE');
      expect(error.name).toBe('AppError');
    });

    test('includes timestamp in ISO format', () => {
      const error = new AppError('Test error', 'TEST_CODE');

      expect(error.timestamp).toBeDefined();
      expect(error.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
    });

    test('accepts context object', () => {
      const context = { module: 'TestModule', userId: 123 };
      const error = new AppError('Test error', 'TEST_CODE', context);

      expect(error.context).toEqual(context);
    });

    test('defaults to INTERNAL_ERROR code', () => {
      const error = new AppError('Test error');

      expect(error.code).toBe('INTERNAL_ERROR');
    });

    test('defaults to empty context', () => {
      const error = new AppError('Test error', 'TEST_CODE');

      expect(error.context).toEqual({});
    });
  });

  describe('Error Chaining', () => {
    test('preserves cause error', () => {
      const cause = new Error('Original error');
      const error = new AppError('Wrapped error', 'TEST_CODE', {}, cause);

      expect(error.cause).toBe(cause);
    });

    test('appends cause stack to error stack', () => {
      const cause = new Error('Original error');
      const error = new AppError('Wrapped error', 'TEST_CODE', {}, cause);

      expect(error.stack).toContain('Caused by:');
      expect(error.stack).toContain(cause.stack);
    });

    test('handles null cause gracefully', () => {
      const error = new AppError('Test error', 'TEST_CODE', {}, null);

      expect(error.cause).toBeNull();
      expect(error.stack).not.toContain('Caused by:');
    });
  });

  describe('toJSON Method', () => {
    test('returns complete error information', () => {
      const error = new AppError('Test error', 'TEST_CODE', { userId: 123 });
      const json = error.toJSON();

      expect(json).toHaveProperty('name', 'AppError');
      expect(json).toHaveProperty('message', 'Test error');
      expect(json).toHaveProperty('code', 'TEST_CODE');
      expect(json).toHaveProperty('context', { userId: 123 });
      expect(json).toHaveProperty('timestamp');
      expect(json).toHaveProperty('stack');
      expect(json).toHaveProperty('cause');
    });

    test('includes cause information when present', () => {
      const cause = new Error('Original error');
      cause.code = '23505';
      const error = new AppError('Wrapped error', 'TEST_CODE', {}, cause);
      const json = error.toJSON();

      expect(json.cause).toBeDefined();
      expect(json.cause.message).toBe('Original error');
      expect(json.cause.name).toBe('Error');
      expect(json.cause.stack).toBeDefined();
    });

    test('cause is null when not provided', () => {
      const error = new AppError('Test error', 'TEST_CODE');
      const json = error.toJSON();

      expect(json.cause).toBeNull();
    });
  });

  describe('Factory Methods', () => {
    test('database() creates DB_ERROR', () => {
      const error = AppError.database('Query failed', { query: 'SELECT *' });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('DB_ERROR');
      expect(error.message).toBe('Query failed');
      expect(error.context.query).toBe('SELECT *');
    });

    test('api() creates API_ERROR', () => {
      const error = AppError.api('Request failed', { endpoint: '/api/test' });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('API_ERROR');
      expect(error.message).toBe('Request failed');
      expect(error.context.endpoint).toBe('/api/test');
    });

    test('validation() creates VALIDATION_ERROR', () => {
      const error = AppError.validation('Invalid input', { field: 'email' });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('VALIDATION_ERROR');
      expect(error.message).toBe('Invalid input');
      expect(error.context.field).toBe('email');
    });

    test('auth() creates AUTH_ERROR', () => {
      const error = AppError.auth('Unauthorized', { userId: 123 });

      expect(error).toBeInstanceOf(AppError);
      expect(error.code).toBe('AUTH_ERROR');
      expect(error.message).toBe('Unauthorized');
      expect(error.context.userId).toBe(123);
    });

    test('factory methods accept cause parameter', () => {
      const cause = new Error('DB timeout');
      const error = AppError.database('Query failed', { query: 'SELECT *' }, cause);

      expect(error.cause).toBe(cause);
    });
  });

  describe('Error Properties', () => {
    test('is instance of Error', () => {
      const error = new AppError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(Error);
    });

    test('is instance of AppError', () => {
      const error = new AppError('Test error', 'TEST_CODE');

      expect(error).toBeInstanceOf(AppError);
    });

    test('has stack trace', () => {
      const error = new AppError('Test error', 'TEST_CODE');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('AppError');
      expect(error.stack).toContain('Test error');
    });
  });

  describe('Context Preservation', () => {
    test('preserves complex context objects', () => {
      const context = {
        module: 'JobModel',
        method: 'getAnalytics',
        userId: 123,
        params: { period: 30 },
        sqlCode: '23505'
      };
      const error = new AppError('Query failed', 'DB_ERROR', context);

      expect(error.context).toEqual(context);
    });

    test('context is preserved in toJSON()', () => {
      const context = { module: 'Test', userId: 456, traceId: 'abc-123' };
      const error = new AppError('Test error', 'TEST_CODE', context);
      const json = error.toJSON();

      expect(json.context).toEqual(context);
    });
  });
});
