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

jest.mock('../src/database/models/Application', () => ({
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

jest.mock('../src/models/Application', () => ({
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

jest.mock('../src/models/Job', () => ({}));

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

  describe('GET /api/autoapply/stats', () => {
    test('should return user statistics', async () => {
      const response = await request(app)
        .get('/api/autoapply/stats')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.stats).toBeDefined();
      expect(response.body.data.stats.total_applications).toBe(10);
      expect(response.body.data.stats.applications_today).toBe(2);
    });
  });

  describe('POST /api/autoapply/pause', () => {
    test('should pause autoapply', async () => {
      const response = await request(app)
        .post('/api/autoapply/pause')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('paused');
      expect(response.body.settings.enabled).toBe(false);
    });
  });

  describe('POST /api/autoapply/resume', () => {
    test('should resume autoapply', async () => {
      const response = await request(app)
        .post('/api/autoapply/resume')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('resumed');
      expect(response.body.settings.enabled).toBe(true);
    });
  });

  describe('GET /api/autoapply/blacklist', () => {
    test('should return blacklisted companies', async () => {
      const response = await request(app)
        .get('/api/autoapply/blacklist')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.excludeCompanies).toBeDefined();
      expect(Array.isArray(response.body.data.excludeCompanies)).toBe(true);
    });
  });

  describe('POST /api/autoapply/blacklist/add', () => {
    test('should add company to blacklist', async () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      AutoApplySettings.findByUserId.mockResolvedValueOnce({
        exclude_companies: ['Company A']
      });

      const response = await request(app)
        .post('/api/autoapply/blacklist/add')
        .send({ company: 'Test Company' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('added to blacklist');
    });

    test('should return 400 if company name is missing', async () => {
      const response = await request(app)
        .post('/api/autoapply/blacklist/add')
        .send({})
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('required');
    });
  });

  describe('POST /api/autoapply/blacklist/remove', () => {
    test('should remove company from blacklist', async () => {
      const AutoApplySettings = require('../src/models/AutoApplySettings');
      AutoApplySettings.findByUserId.mockResolvedValueOnce({
        exclude_companies: ['Company A', 'Test Company']
      });

      const response = await request(app)
        .post('/api/autoapply/blacklist/remove')
        .send({ company: 'Test Company' })
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toContain('removed from blacklist');
    });
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
});
