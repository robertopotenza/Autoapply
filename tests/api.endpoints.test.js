/**
 * Integration test for API endpoints
 * Tests the routes without requiring a full database
 */

const request = require('supertest');
const express = require('express');

// Mock the database and models before requiring routes
jest.mock('../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../src/models/Application', () => ({
  findByUserId: jest.fn().mockResolvedValue([]),
  getAnalytics: jest.fn().mockResolvedValue({}),
  getSuccessRate: jest.fn().mockResolvedValue(0),
  getUserStats: jest.fn().mockResolvedValue({
    user_id: 'test-user',
    total_applications: 10,
    applications_submitted: 8,
    interviews_received: 3,
    offers_received: 1,
    rejections_received: 2,
    applications_this_week: 5,
    applications_today: 2
  })
}));

jest.mock('../src/models/AutoApplySettings', () => ({
  findByUserId: jest.fn().mockResolvedValue({
    enabled: true,
    max_applications_per_day: 10,
    exclude_companies: ['Company A', 'Company B']
  }),
  updateByUserId: jest.fn().mockImplementation((userId, updates) =>
    Promise.resolve({
      user_id: userId,
      ...updates
    })
  ),
  getDefaultSettings: jest.fn().mockReturnValue({
    enabled: false,
    max_applications_per_day: 10,
    exclude_companies: []
  }),
  toggleEnabled: jest.fn().mockImplementation((userId, enabled) => 
    Promise.resolve({
      user_id: userId,
      enabled,
      max_applications_per_day: 10
    })
  ),
  update: jest.fn().mockImplementation((userId, updates) =>
    Promise.resolve({
      user_id: userId,
      ...updates
    })
  )
}));

jest.mock('../src/services/UserProfile', () => ({
  getCompleteProfile: jest.fn(),
  getProfileCompletion: jest.fn()
}));

jest.mock('../src/models/Job', () => ({
  findByUserId: jest.fn().mockResolvedValue([]),
  getAnalytics: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'test-user-123', user_id: 'test-user-123' };
    next();
  }
}));

jest.mock('../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return { Logger: jest.fn(() => mockLogger) };
});

describe('AutoApply API Endpoints', () => {
  let app;
  let router;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Load the router (auth is now mocked above)
    const autoapplyRoutes = require('../src/routes/autoapply');
    router = autoapplyRoutes.router;
    app.use('/api/autoapply', router);
  });

  describe('GET /api/autoapply/health', () => {
    test('should return health status', async () => {
      const response = await request(app)
        .get('/api/autoapply/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.status).toBe('operational');
    });
  });

  describe('GET /api/autoapply/settings', () => {
    test('should return user settings', async () => {
      const response = await request(app)
        .get('/api/autoapply/settings')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.settings).toBeDefined();
      expect(response.body.settings.enabled).toBe(true);
    });
  });

  describe('GET /api/autoapply/applications', () => {
    test('should return user applications', async () => {
      const response = await request(app)
        .get('/api/autoapply/applications')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.applications).toBeDefined();
    });
  });

  describe('POST /api/autoapply/enable', () => {
    test('should enable autoapply successfully', async () => {
      const response = await request(app)
        .post('/api/autoapply/enable')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('AutoApply enabled successfully');
      expect(response.body.mode).toBeDefined();
    });
  });

  describe('POST /api/autoapply/start', () => {
    test('should start autoapply session successfully', async () => {
      const response = await request(app)
        .post('/api/autoapply/start')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('autoapply session started');
      expect(response.body.mode).toBeDefined();
    });
  });

  describe('GET /api/autoapply/jobs', () => {
    test('should return jobs list when database is working', async () => {
      const Job = require('../src/models/Job');
      Job.findByUserId.mockResolvedValueOnce([
        { id: 1, title: 'Test Job 1', company: 'Test Company 1' },
        { id: 2, title: 'Test Job 2', company: 'Test Company 2' }
      ]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeDefined();
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });

    test('should handle database not configured error gracefully', async () => {
      const Job = require('../src/models/Job');
      Job.findByUserId.mockRejectedValueOnce(
        new Error('Error finding jobs by user ID: Database not configured')
      );

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toEqual([]);
      expect(response.body.warning).toContain('Job history is unavailable');
      expect(response.body.mode).toBe('basic');
    });
  });

  describe('GET /api/autoapply/analytics', () => {
    test('should return analytics data with correct structure', async () => {
      const Application = require('../src/models/Application');
      const Job = require('../src/models/Job');
      
      Application.getAnalytics.mockResolvedValueOnce({
        total: 10,
        this_week: 5,
        today: 2,
        period_total: 8
      });
      
      Application.getSuccessRate.mockResolvedValueOnce(75);
      
      Job.getAnalytics.mockResolvedValueOnce({
        total: 50,
        this_week: 20,
        today: 5,
        applied: 10,
        available: 40
      });

      const response = await request(app)
        .get('/api/autoapply/analytics')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
      expect(response.body.analytics.applications).toBeDefined();
      expect(response.body.analytics.applications.total).toBe(10);
      expect(response.body.analytics.applications.this_week).toBe(5);
      expect(response.body.analytics.jobs).toBeDefined();
      expect(response.body.analytics.jobs.total).toBe(50);
      expect(response.body.analytics.success_rate).toBe(75);
    });

    test('should handle analytics endpoint with custom period', async () => {
      const Application = require('../src/models/Application');
      const Job = require('../src/models/Job');
      
      Application.getAnalytics.mockResolvedValueOnce({
        total: 20,
        this_week: 8,
        today: 3,
        period_total: 15
      });
      
      Application.getSuccessRate.mockResolvedValueOnce(60);
      
      Job.getAnalytics.mockResolvedValueOnce({
        total: 100,
        this_week: 30,
        today: 8,
        applied: 20,
        available: 80
      });

      const response = await request(app)
        .get('/api/autoapply/analytics?period=60')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
      expect(Application.getAnalytics).toHaveBeenCalledWith('test-user-123', '60');
      expect(Job.getAnalytics).toHaveBeenCalledWith('test-user-123', '60');
      expect(Application.getSuccessRate).toHaveBeenCalledWith('test-user-123', '60');
    });

    test('should handle analytics errors gracefully', async () => {
      const Application = require('../src/models/Application');
      
      Application.getAnalytics.mockRejectedValueOnce(
        new Error('Database error')
      );

      const response = await request(app)
        .get('/api/autoapply/analytics')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get analytics');
      expect(response.body.error).toBeDefined();
    });

    test('should return fallback analytics when column does not exist', async () => {
      const Job = require('../src/models/Job');
      
      // Mock a PostgreSQL column does not exist error
      const columnError = new Error('column "user_id" does not exist');
      columnError.code = '42703';
      Job.getAnalytics.mockRejectedValueOnce(columnError);

      const response = await request(app)
        .get('/api/autoapply/analytics')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
      expect(response.body.analytics.applications).toEqual({
        total: 0,
        this_week: 0,
        today: 0,
        period_total: 0
      });
      expect(response.body.analytics.jobs).toEqual({
        total: 0,
        this_week: 0,
        today: 0,
        applied: 0,
        available: 0
      });
      expect(response.body.storage_mode).toBe('offline');
      expect(response.body.warning).toContain('temporarily unavailable');
    });

    test('should return fallback analytics when database not configured', async () => {
      const Job = require('../src/models/Job');
      
      Job.getAnalytics.mockRejectedValueOnce(
        new Error('Database not configured')
      );

      const response = await request(app)
        .get('/api/autoapply/analytics')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.analytics).toBeDefined();
      expect(response.body.storage_mode).toBe('offline');
      expect(response.body.warning).toBeDefined();
    });

    test('should return fallback analytics on connection refused', async () => {
      const Application = require('../src/models/Application');
      
      const connError = new Error('connect ECONNREFUSED 127.0.0.1:5432');
      connError.code = 'ECONNREFUSED';
      Application.getAnalytics.mockRejectedValueOnce(connError);

      const response = await request(app)
        .get('/api/autoapply/analytics')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.storage_mode).toBe('offline');
      expect(response.body.warning).toContain('temporarily unavailable');
    });
  });
});
