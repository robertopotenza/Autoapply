// @ai-meta: middleware-test
// @ai-meta: performance-logging-test

/**
 * Unit tests for Performance Logger Middleware
 * Tests timing, PII redaction, sampling, and structured output
 */

const performanceLogger = require('../src/middleware/performanceLogger');
const { redactPII } = require('../src/middleware/performanceLogger');

describe('Performance Logger Middleware', () => {
  let req, res, next;
  let consoleLogSpy;
  let originalEnv;

  beforeEach(() => {
    // Save original env
    originalEnv = { ...process.env };

    // Mock request
    req = {
      method: 'GET',
      path: '/api/test',
      route: { path: '/api/test' },
      headers: { 'content-length': '100' },
      body: {}
    };

    // Mock response
    res = {
      statusCode: 200,
      locals: {},
      end: jest.fn(),
      getHeader: jest.fn(() => '250')
    };

    // Mock next
    next = jest.fn();

    // Spy on console
    consoleLogSpy = jest.spyOn(console, 'log').mockImplementation();
  });

  afterEach(() => {
    // Restore env
    process.env = originalEnv;
    consoleLogSpy.mockRestore();
  });

  describe('Basic Functionality', () => {
    test('logs performance when enabled', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Simulate response end
      setTimeout(() => {
        res.end();

        // Check that log was called
        expect(consoleLogSpy).toHaveBeenCalled();
        
        // Parse the log output
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed).toHaveProperty('timestamp');
        expect(parsed).toHaveProperty('method', 'GET');
        expect(parsed).toHaveProperty('path', '/api/test');
        expect(parsed).toHaveProperty('statusCode', 200);
        expect(parsed).toHaveProperty('durationMs');
        expect(typeof parsed.durationMs).toBe('number');
        expect(parsed.durationMs).toBeGreaterThanOrEqual(0);

        done();
      }, 10);
    });

    test('skips logging when disabled', () => {
      process.env.PERF_LOG_ENABLED = 'false';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Simulate response end
      res.end();

      // Check that no log was created
      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('skips logging when PERF_LOG_ENABLED is not set', () => {
      delete process.env.PERF_LOG_ENABLED;
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      expect(next).toHaveBeenCalled();

      // Simulate response end
      res.end();

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });
  });

  describe('Correlation ID', () => {
    test('uses traceId if available', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      req.traceId = 'test-trace-id-123';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.correlationId).toBe('test-trace-id-123');
        done();
      }, 10);
    });

    test('generates correlationId if traceId not available', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.correlationId).toBeDefined();
        expect(typeof parsed.correlationId).toBe('string');
        expect(parsed.correlationId.length).toBeGreaterThan(0);
        done();
      }, 10);
    });
  });

  describe('User ID Tracking', () => {
    test('includes userId from req.user.userId', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      req.user = { userId: 123 };
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.userId).toBe(123);
        done();
      }, 10);
    });

    test('includes userId from req.user.user_id', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      req.user = { user_id: 456 };
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.userId).toBe(456);
        done();
      }, 10);
    });

    test('does not include userId if not authenticated', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.userId).toBeUndefined();
        done();
      }, 10);
    });
  });

  describe('Request/Response Size Tracking', () => {
    test('tracks request and response bytes', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      req.headers['content-length'] = '512';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.requestBytes).toBe(512);
        expect(parsed.responseBytes).toBe(250); // from getHeader mock
        done();
      }, 10);
    });
  });

  describe('Database Timing Injection', () => {
    test('includes database timings from res.locals', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      res.locals.dbTimings = [15.3, 8.7, 22.1];
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.dbTimingsMs).toEqual([15.3, 8.7, 22.1]);
        expect(parsed.dbTotalMs).toBe(46.1);
        done();
      }, 10);
    });

    test('handles empty database timings array', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      res.locals.dbTimings = [];
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.dbTimingsMs).toBeUndefined();
        expect(parsed.dbTotalMs).toBeUndefined();
        done();
      }, 10);
    });

    test('filters out non-numeric values in dbTimings', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      res.locals.dbTimings = [10.5, 'invalid', 20.3, null, 5.2];
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        
        const logOutput = consoleLogSpy.mock.calls[0][0];
        const parsed = JSON.parse(logOutput);

        expect(parsed.dbTimingsMs).toEqual([10.5, 20.3, 5.2]);
        expect(parsed.dbTotalMs).toBe(36.0);
        done();
      }, 10);
    });
  });

  describe('Sampling', () => {
    test('respects PERF_LOG_SAMPLE_RATE of 0.0', () => {
      process.env.PERF_LOG_ENABLED = 'true';
      process.env.PERF_LOG_SAMPLE_RATE = '0.0';
      
      const middleware = performanceLogger();
      
      // Run multiple times to ensure sampling is working
      for (let i = 0; i < 10; i++) {
        middleware(req, res, next);
        res.end();
      }

      expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    test('defaults to 1.0 sample rate if not specified', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      delete process.env.PERF_LOG_SAMPLE_RATE;
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        expect(consoleLogSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    test('handles invalid sample rate by defaulting to 1.0', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      process.env.PERF_LOG_SAMPLE_RATE = 'invalid';
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        expect(consoleLogSpy).toHaveBeenCalled();
        done();
      }, 10);
    });

    test('clamps sample rate to [0, 1] range', (done) => {
      process.env.PERF_LOG_ENABLED = 'true';
      process.env.PERF_LOG_SAMPLE_RATE = '1.5'; // > 1.0
      
      const middleware = performanceLogger();
      middleware(req, res, next);

      setTimeout(() => {
        res.end();
        // Should default to 1.0 and log
        expect(consoleLogSpy).toHaveBeenCalled();
        done();
      }, 10);
    });
  });
});

describe('PII Redaction', () => {
  test('redacts email field', () => {
    const input = {
      name: 'John Doe',
      email: 'john@example.com',
      age: 30
    };

    const result = redactPII(input);

    expect(result.name).toBe('John Doe');
    expect(result.email).toBe('[REDACTED]');
    expect(result.age).toBe(30);
  });

  test('redacts password field', () => {
    const input = {
      username: 'john',
      password: 'secret123'
    };

    const result = redactPII(input);

    expect(result.username).toBe('john');
    expect(result.password).toBe('[REDACTED]');
  });

  test('redacts token fields (various formats)', () => {
    const input = {
      token: 'abc123',
      accessToken: 'xyz789',
      access_token: 'def456',
      refreshToken: 'refresh123'
    };

    const result = redactPII(input);

    expect(result.token).toBe('[REDACTED]');
    expect(result.accessToken).toBe('[REDACTED]');
    expect(result.access_token).toBe('[REDACTED]');
    expect(result.refreshToken).toBe('[REDACTED]');
  });

  test('redacts nested objects', () => {
    const input = {
      user: {
        name: 'John',
        email: 'john@example.com',
        credentials: {
          password: 'secret'
        }
      }
    };

    const result = redactPII(input);

    expect(result.user.name).toBe('John');
    expect(result.user.email).toBe('[REDACTED]');
    expect(result.user.credentials.password).toBe('[REDACTED]');
  });

  test('handles arrays', () => {
    const input = {
      users: [
        { name: 'John', email: 'john@example.com' },
        { name: 'Jane', email: 'jane@example.com' }
      ]
    };

    const result = redactPII(input);

    expect(result.users[0].name).toBe('John');
    expect(result.users[0].email).toBe('[REDACTED]');
    expect(result.users[1].name).toBe('Jane');
    expect(result.users[1].email).toBe('[REDACTED]');
  });

  test('handles null and undefined', () => {
    expect(redactPII(null)).toBe(null);
    expect(redactPII(undefined)).toBe(undefined);
  });

  test('handles non-object types', () => {
    expect(redactPII('string')).toBe('string');
    expect(redactPII(123)).toBe(123);
    expect(redactPII(true)).toBe(true);
  });

  test('is case-insensitive for PII field names', () => {
    const input = {
      EMAIL: 'test@example.com',
      Password: 'secret',
      ACCESS_TOKEN: 'token123'
    };

    const result = redactPII(input);

    expect(result.EMAIL).toBe('[REDACTED]');
    expect(result.Password).toBe('[REDACTED]');
    expect(result.ACCESS_TOKEN).toBe('[REDACTED]');
  });

  test('redacts phone numbers', () => {
    const input = {
      phone: '555-1234',
      phoneNumber: '555-5678',
      phone_number: '555-9999'
    };

    const result = redactPII(input);

    expect(result.phone).toBe('[REDACTED]');
    expect(result.phoneNumber).toBe('[REDACTED]');
    expect(result.phone_number).toBe('[REDACTED]');
  });
});
