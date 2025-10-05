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
});
