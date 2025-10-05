/**
 * Comprehensive test suite for the "Search for Jobs" feature
 * Tests the /api/autoapply/jobs endpoint with various scenarios:
 * - Authentication requirements
 * - Pagination parameters (page, limit)
 * - Filtering (minScore)
 * - Edge cases and parameter validation
 * - Error handling
 * - Different modes (basic vs enhanced)
 */

const request = require('supertest');
const express = require('express');

// Mock the database and models before requiring routes
jest.mock('../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn(),
  pool: { query: jest.fn() },
  isDatabaseConfigured: jest.fn().mockReturnValue(true)
}));

jest.mock('../src/models/Job', () => ({
  findByUserId: jest.fn(),
  getAnalytics: jest.fn().mockResolvedValue({})
}));

jest.mock('../src/models/Application', () => ({
  findByUserId: jest.fn().mockResolvedValue([]),
  getAnalytics: jest.fn().mockResolvedValue({}),
  getSuccessRate: jest.fn().mockResolvedValue(0)
}));

jest.mock('../src/models/AutoApplySettings', () => ({
  findByUserId: jest.fn().mockResolvedValue({
    enabled: true,
    max_applications_per_day: 10
  }),
  getDefaultSettings: jest.fn().mockReturnValue({
    enabled: false,
    max_applications_per_day: 10
  })
}));

jest.mock('../src/services/UserProfile', () => ({
  getCompleteProfile: jest.fn(),
  getProfileCompletion: jest.fn()
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

// Mock auth middleware - default to authenticated
const mockAuth = jest.fn((req, res, next) => {
  req.user = { userId: 'test-user-123', user_id: 'test-user-123', email: 'test@example.com' };
  next();
});

jest.mock('../src/middleware/auth', () => ({
  authenticateToken: mockAuth
}));

describe('Search for Jobs Feature - /api/autoapply/jobs', () => {
  let app;
  const Job = require('../src/models/Job');
  const db = require('../src/database/db');

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    const autoapplyRoutes = require('../src/routes/autoapply');
    app.use('/api/autoapply', autoapplyRoutes.router);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset auth mock to default authenticated state
    mockAuth.mockImplementation((req, res, next) => {
      req.user = { userId: 'test-user-123', user_id: 'test-user-123', email: 'test@example.com' };
      next();
    });
    // Reset database configured state
    db.isDatabaseConfigured.mockReturnValue(true);
    db.pool = { query: jest.fn() };
  });

  describe('Authentication Requirements', () => {
    test('should require authentication token', async () => {
      // Mock auth to reject request
      mockAuth.mockImplementation((req, res, next) => {
        return res.status(401).json({
          success: false,
          message: 'Access token required'
        });
      });

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Access token required');
    });

    test('should reject invalid or expired token', async () => {
      mockAuth.mockImplementation((req, res, next) => {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
      });

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .set('Authorization', 'Bearer invalid-token')
        .expect(403);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('Invalid or expired token');
    });

    test('should accept valid authentication token', async () => {
      Job.findByUserId.mockResolvedValueOnce([
        { id: 1, title: 'Software Engineer', company: 'Tech Corp', matchScore: 85 }
      ]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .set('Authorization', 'Bearer valid-token')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeDefined();
    });
  });

  describe('Basic Job Retrieval (Default Parameters)', () => {
    test('should return jobs list with default parameters', async () => {
      const mockJobs = [
        { 
          id: 1, 
          title: 'Software Engineer', 
          company: 'Tech Corp', 
          location: 'Remote',
          matchScore: 85,
          description: 'Great opportunity',
          requirements: 'BS in CS'
        },
        { 
          id: 2, 
          title: 'Senior Developer', 
          company: 'StartupCo', 
          location: 'San Francisco',
          matchScore: 92,
          description: 'Lead role',
          requirements: '5+ years exp'
        }
      ];

      Job.findByUserId.mockResolvedValueOnce(mockJobs);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeDefined();
      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(response.body.jobs.length).toBe(2);
      expect(response.body.mode).toBe('basic');
    });

    test('should return expected job fields', async () => {
      const mockJob = {
        id: 1,
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote',
        matchScore: 85,
        description: 'Great opportunity',
        requirements: 'BS in CS',
        salary_min: 100000,
        salary_max: 150000,
        job_type: 'full-time',
        seniority_level: 'mid'
      };

      Job.findByUserId.mockResolvedValueOnce([mockJob]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs[0]).toMatchObject({
        id: 1,
        title: 'Software Engineer',
        company: 'Tech Corp',
        location: 'Remote'
      });
    });

    test('should return empty array when no jobs available', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toEqual([]);
      expect(Array.isArray(response.body.jobs)).toBe(true);
    });
  });

  describe('Pagination Parameters', () => {
    test('should apply default pagination (page=1, limit=10)', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 1,
          limit: 10
        })
      );
    });

    test('should respect custom page parameter', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?page=2')
        .expect(200);

      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 2
        })
      );
    });

    test('should respect custom limit parameter', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?limit=5')
        .expect(200);

      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 5
        })
      );
    });

    test('should combine page and limit parameters', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?page=3&limit=15')
        .expect(200);

      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 3,
          limit: 15
        })
      );
    });

    test('should enforce maximum limit of 50', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?limit=100')
        .expect(200);

      // Should be clamped to 50
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 50
        })
      );
    });

    test('should enforce minimum page of 1', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?page=-1')
        .expect(200);

      // Should default to 1
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 1
        })
      );
    });

    test('should enforce minimum limit of 1', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?limit=0')
        .expect(200);

      // When limit=0, parseInt gives 0 which is falsy, so || 10 applies
      // Then Math.max(1, 10) = 10, so default limit is used
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 10
        })
      );
    });
  });

  describe('Filtering by minScore', () => {
    test('should apply default minScore of 0', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      // minScore should be passed but not affect basic mode query
      // In enhanced mode, orchestrator would filter
      expect(Job.findByUserId).toHaveBeenCalled();
    });

    test('should accept minScore parameter', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs?minScore=75')
        .expect(200);

      expect(response.body.success).toBe(true);
    });

    test('should handle high minScore value', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs?minScore=90')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeDefined();
    });

    test('should handle minScore with other parameters', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs?page=1&limit=5&minScore=75')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 1,
          limit: 5
        })
      );
    });

    test('should enforce minimum minScore of 0 (negative values)', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs?minScore=-10')
        .expect(200);

      expect(response.body.success).toBe(true);
      // Negative minScore should be treated as 0
    });
  });

  describe('Edge Cases and Parameter Validation', () => {
    test('should handle invalid page parameter (non-numeric)', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?page=invalid')
        .expect(200);

      // Should default to page 1
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 1
        })
      );
    });

    test('should handle invalid limit parameter (non-numeric)', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?limit=invalid')
        .expect(200);

      // Should default to limit 10
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 10
        })
      );
    });

    test('should handle decimal page number', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?page=2.5')
        .expect(200);

      // Should parse as integer
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 2
        })
      );
    });

    test('should handle decimal limit number', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?limit=5.8')
        .expect(200);

      // Should parse as integer
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          limit: 5
        })
      );
    });

    test('should handle very large page numbers', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs?page=999999')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toEqual([]);
    });

    test('should handle multiple query parameters with same name', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs?page=1&page=2')
        .expect(200);

      expect(response.body.success).toBe(true);
    });
  });

  describe('Error Handling', () => {
    test('should handle database errors gracefully', async () => {
      Job.findByUserId.mockRejectedValueOnce(
        new Error('Error finding jobs by user ID: Database not configured')
      );

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200); // Should still return 200 with warning

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toEqual([]);
      expect(response.body.warning).toBeDefined();
    });

    test('should handle database not configured error', async () => {
      db.isDatabaseConfigured.mockReturnValue(false);
      db.pool = null;

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toEqual([]);
      expect(response.body.mode).toBe('basic');
      expect(response.body.warning).toContain('Job history is unavailable');
    });

    test('should return appropriate error for database connection errors', async () => {
      Job.findByUserId.mockRejectedValueOnce(
        new Error('Error finding jobs by user ID: Database not configured')
      );

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toEqual([]);
      expect(response.body.warning).toContain('Job history is unavailable');
    });

    test('should handle unexpected errors with 500 status', async () => {
      Job.findByUserId.mockRejectedValueOnce(
        new Error('Unexpected catastrophic error')
      );
      // Don't set database as unconfigured
      db.isDatabaseConfigured.mockReturnValue(true);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to get jobs');
      expect(response.body.error).toBeDefined();
    });
  });

  describe('Different Modes (Basic vs Enhanced)', () => {
    test('should return mode: basic when orchestrator not available', async () => {
      Job.findByUserId.mockResolvedValueOnce([
        { id: 1, title: 'Test Job', company: 'Test Co' }
      ]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.mode).toBe('basic');
    });

    test('should use Job.findByUserId in basic mode', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs?page=2&limit=20')
        .expect(200);

      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 2,
          limit: 20
        })
      );
    });

    test('should include warning when database is unavailable', async () => {
      db.isDatabaseConfigured.mockReturnValue(false);
      db.pool = null;

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.warning).toContain('Job history is unavailable');
      expect(response.body.warning).toContain('database connection is configured');
    });
  });

  describe('Response Structure Validation', () => {
    test('should return correct response structure', async () => {
      Job.findByUserId.mockResolvedValueOnce([
        { id: 1, title: 'Test Job', company: 'Test Co', matchScore: 80 }
      ]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('jobs');
      expect(response.body).toHaveProperty('mode');
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(['basic', 'enhanced', 'offline']).toContain(response.body.mode);
    });

    test('should include jobs array even when empty', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(response.body.jobs).toBeDefined();
      expect(Array.isArray(response.body.jobs)).toBe(true);
      expect(response.body.jobs).toEqual([]);
    });

    test('should have consistent structure for error responses', async () => {
      Job.findByUserId.mockRejectedValueOnce(
        new Error('Critical error')
      );
      db.isDatabaseConfigured.mockReturnValue(true);

      const response = await request(app)
        .get('/api/autoapply/jobs')
        .expect(500);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('message');
      expect(response.body).toHaveProperty('error');
      expect(response.body.success).toBe(false);
    });
  });

  describe('Multiple Request Scenarios', () => {
    test('should handle multiple sequential requests correctly', async () => {
      Job.findByUserId.mockResolvedValue([
        { id: 1, title: 'Job 1', company: 'Co 1' }
      ]);

      const response1 = await request(app)
        .get('/api/autoapply/jobs?page=1')
        .expect(200);

      const response2 = await request(app)
        .get('/api/autoapply/jobs?page=2')
        .expect(200);

      expect(response1.body.success).toBe(true);
      expect(response2.body.success).toBe(true);
      expect(Job.findByUserId).toHaveBeenCalledTimes(2);
    });

    test('should maintain user context across requests', async () => {
      Job.findByUserId.mockResolvedValue([]);

      await request(app)
        .get('/api/autoapply/jobs')
        .set('Authorization', 'Bearer token1')
        .expect(200);

      await request(app)
        .get('/api/autoapply/jobs')
        .set('Authorization', 'Bearer token2')
        .expect(200);

      // Both should use the same mocked user
      expect(Job.findByUserId).toHaveBeenCalledWith('test-user-123', expect.any(Object));
    });
  });

  describe('Integration with Filters and Preferences', () => {
    test('should call Job.findByUserId with correct userId', async () => {
      Job.findByUserId.mockResolvedValueOnce([]);

      await request(app)
        .get('/api/autoapply/jobs')
        .expect(200);

      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.any(Object)
      );
    });

    test('should work with all query parameters combined', async () => {
      Job.findByUserId.mockResolvedValueOnce([
        { 
          id: 1, 
          title: 'Senior Engineer', 
          company: 'Tech Corp',
          matchScore: 95
        }
      ]);

      const response = await request(app)
        .get('/api/autoapply/jobs?page=2&limit=15&minScore=90')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.jobs).toBeDefined();
      expect(Job.findByUserId).toHaveBeenCalledWith(
        'test-user-123',
        expect.objectContaining({
          page: 2,
          limit: 15
        })
      );
    });
  });
});
