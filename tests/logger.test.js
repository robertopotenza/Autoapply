/**
 * Unit tests for Logger utility
 * Tests structured JSON logging, log levels, and context handling
 */

const { Logger } = require('../src/utils/logger');

describe('Logger', () => {
  let consoleLogSpy;
  let consoleErrorSpy;
  let consoleWarnSpy;
  let consoleDebugSpy;

  beforeEach(() => {
    // Mock console methods to capture output
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleDebugSpy = jest.spyOn(console, 'debug').mockImplementation();
    
    // Clear environment variables
    delete process.env.DEBUG_MODE;
    delete process.env.LOG_LEVEL;
  });

  afterEach(() => {
    // Restore console methods
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    consoleWarnSpy.mockRestore();
    consoleDebugSpy.mockRestore();
  });

  describe('Structured JSON Output', () => {
    test('outputs valid JSON with required fields', () => {
      const logger = new Logger('TestModule');
      logger.info('Test message');

      expect(consoleLogSpy).toHaveBeenCalled();
      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level', 'INFO');
      expect(parsed).toHaveProperty('context', 'TestModule');
      expect(parsed).toHaveProperty('message', 'Test message');
    });

    test('timestamp is in ISO 8601 format', () => {
      const logger = new Logger('TestModule');
      logger.info('Test message');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      // Verify ISO 8601 format
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);
    });

    test('includes context objects in log output', () => {
      const logger = new Logger('TestModule');
      logger.info('Test message', { userId: 123, traceId: 'abc-123' });

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.userId).toBe(123);
      expect(parsed.traceId).toBe('abc-123');
    });

    test('merges multiple context objects', () => {
      const logger = new Logger('TestModule');
      logger.info('Test message',
        { userId: 123 },
        { module: 'AutoApply', action: 'scan' }
      );

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);

      expect(parsed.userId).toBe(123);
      expect(parsed.module).toBe('AutoApply');
      expect(parsed.action).toBe('scan');
    });
  });

  describe('Log Levels', () => {
    test('default log level is INFO', () => {
      const logger = new Logger('TestModule');
      expect(logger.level).toBe('INFO');
    });

    test('DEBUG_MODE=true sets level to DEBUG', () => {
      process.env.DEBUG_MODE = 'true';
      const logger = new Logger('TestModule');
      expect(logger.level).toBe('DEBUG');
    });

    test('LOG_LEVEL env var sets custom level', () => {
      process.env.LOG_LEVEL = 'ERROR';
      const logger = new Logger('TestModule');
      expect(logger.level).toBe('ERROR');
    });

    test('programmatic level change works', () => {
      const logger = new Logger('TestModule');
      expect(logger.level).toBe('INFO');
      
      logger.level = 'debug';
      expect(logger.level).toBe('DEBUG');
      
      logger.level = 'error';
      expect(logger.level).toBe('ERROR');
    });
  });

  describe('Log Level Filtering', () => {
    test('DEBUG messages are filtered when level is INFO', () => {
      const logger = new Logger('TestModule');
      logger.level = 'info';
      logger.debug('Debug message');

      expect(consoleDebugSpy).not.toHaveBeenCalled();
    });

    test('INFO messages are shown when level is INFO', () => {
      const logger = new Logger('TestModule');
      logger.level = 'info';
      logger.info('Info message');

      expect(consoleLogSpy).toHaveBeenCalled();
    });

    test('ERROR messages are always shown', () => {
      const logger = new Logger('TestModule');
      logger.level = 'error';
      logger.error('Error message');

      expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test('DEBUG messages are shown when level is DEBUG', () => {
      const logger = new Logger('TestModule');
      logger.level = 'debug';
      logger.debug('Debug message');

      expect(consoleDebugSpy).toHaveBeenCalled();
    });
  });

  describe('Different Log Methods', () => {
    test('error() logs with ERROR level', () => {
      const logger = new Logger('TestModule');
      logger.error('Error message');

      const logOutput = consoleErrorSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('ERROR');
    });

    test('warn() logs with WARN level', () => {
      const logger = new Logger('TestModule');
      logger.warn('Warning message');

      const logOutput = consoleWarnSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('WARN');
    });

    test('info() logs with INFO level', () => {
      const logger = new Logger('TestModule');
      logger.info('Info message');

      const logOutput = consoleLogSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('INFO');
    });

    test('debug() logs with DEBUG level', () => {
      const logger = new Logger('TestModule');
      logger.level = 'debug';
      logger.debug('Debug message');

      const logOutput = consoleDebugSpy.mock.calls[0][0];
      const parsed = JSON.parse(logOutput);
      expect(parsed.level).toBe('DEBUG');
    });
  });
});
