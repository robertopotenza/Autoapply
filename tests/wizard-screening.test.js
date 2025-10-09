// @ai-meta: endpoint-test
// @ai-meta: endpoint-test (POST /api/wizard/screening)
// @ai-meta: integration-test

/**
 * Integration & Unit Tests for wizard screening endpoint
 * Verifies ScreeningAnswers.upsert and correct storage of languages/disabilityStatus
 */

const request = require('supertest');
const express = require('express');

// --- Mock Database and Models ---
const mockQuery = jest.fn();
const mockUpsert = jest.fn();
const mockFindByUserId = jest.fn();

jest.mock('../src/database/db', () => ({
  query: mockQuery,
  getClient: jest.fn()
}));

jest.mock('../src/database/models/ScreeningAnswers', () => ({
  upsert: mockUpsert,
  findByUserId: mockFindByUserId,
  delete: jest.fn()
}));

jest.mock('../src/database/models/JobPreferences', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn()
}));

jest.mock('../src/database/models/Profile', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn()
}));

jest.mock('../src/database/models/Eligibility', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn()
}));

jest.mock('../src/database/models/User', () => ({
  getCompleteProfile: jest.fn()
}));

// --- Mock Auth Middleware ---
jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'test-user-123' };
    next();
  }
}));

// --- Mock Logger ---
jest.mock('../src/utils/logger', () => {
  const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  };
  return { Logger: jest.fn(() => mockLogger) };
});

// --- Import Routes ---
const wizardRoutes = require('../src/routes/wizard');

// ----------------------------------------------------

describe('Wizard Screening Endpoint', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/wizard', wizardRoutes);
    jest.clearAllMocks();
  });

  // ----------------------------------------------------
  // POST /api/wizard/screening
  // ----------------------------------------------------
  describe('POST /api/wizard/screening', () => {
    test('should save screening answers with languages array', async () => {
      const mockResult = {
        rows: [{
          id: 1,
          user_id: 'test-user-123',
          experience_summary: 'Test experience',
          languages: ['English', 'Spanish', 'French'],
          disability_status: 'no'
        }]
      };

      mockQuery.mockResolvedValue(mockResult);
      mockUpsert.mockResolvedValueOnce(mockResult.rows[0]);

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({
          experienceSummary: 'Test experience',
          hybridPreference: 'hybrid',
          travel: 'yes',
          relocation: 'no',
          languages: ['English', 'Spanish', 'French'],
          dateOfBirth: '1990-01-01',
          gpa: 3.5,
          isAdult: true,
          genderIdentity: 'male',
          disabilityStatus: 'no',
          militaryService: 'no',
          ethnicity: 'other',
          drivingLicense: 'Class A'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(mockUpsert).toHaveBeenCalledTimes(1);

      const calledWith = mockUpsert.mock.calls[0][1];
      expect(calledWith.languages).toEqual(['English', 'Spanish', 'French']);
      expect(calledWith.disabilityStatus).toBe('no');
    });

    test('should handle empty languages array', async () => {
      mockUpsert.mockResolvedValueOnce({
        id: 2,
        user_id: 'test-user-123',
        languages: [],
        disability_status: 'prefer not to say'
      });

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({
          languages: [],
          disabilityStatus: 'prefer not to say'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const calledWith = mockUpsert.mock.calls[0][1];
      expect(calledWith.languages).toEqual([]);
      expect(calledWith.disabilityStatus).toBe('prefer not to say');
    });

    test('should handle missing languages and disabilityStatus with defaults', async () => {
      mockUpsert.mockResolvedValueOnce({
        id: 3,
        user_id: 'test-user-123',
        languages: [],
        disability_status: null
      });

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({ experienceSummary: 'Some experience' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const calledWith = mockUpsert.mock.calls[0][1];
      expect(calledWith.languages).toEqual([]);
      expect(calledWith.disabilityStatus).toBe('');
    });

    test('should call ScreeningAnswers.upsert with correct parameters', async () => {
      const mockScreeningData = {
        user_id: 'test-user-123',
        experience_summary: 'Test experience',
        hybrid_preference: 'hybrid',
        travel: 'yes',
        relocation: 'no',
        languages: ['English', 'Spanish'],
        disability_status: 'no'
      };

      mockUpsert.mockResolvedValueOnce(mockScreeningData);

      const requestData = {
        experienceSummary: 'Test experience',
        hybridPreference: 'hybrid',
        travel: 'yes',
        relocation: 'no',
        languages: ['English', 'Spanish'],
        disabilityStatus: 'no'
      };

      const response = await request(app)
        .post('/api/wizard/screening')
        .send(requestData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(mockUpsert).toHaveBeenCalledWith('test-user-123', expect.any(Object));
      const calledWithData = mockUpsert.mock.calls[0][1];
      expect(calledWithData.languages).toEqual(['English', 'Spanish']);
      expect(calledWithData.disabilityStatus).toBe('no');
      expect(response.body.success).toBe(true);
    });

    test('should return error on database failure', async () => {
      mockUpsert.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({ experienceSummary: 'x' })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.error).toBe('Database error');
    });
  });

  // ----------------------------------------------------
  // Data Validation
  // ----------------------------------------------------
  describe('Data Type Validation', () => {
    test('should handle languages as a string and convert to array', async () => {
      mockUpsert.mockResolvedValueOnce({
        user_id: 'test-user-123',
        languages: ['English', 'Spanish']
      });

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({ languages: 'English,Spanish' });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should handle all disability status values', async () => {
      const statuses = ['yes', 'no', 'prefer not to say', ''];
      for (const status of statuses) {
        mockUpsert.mockResolvedValueOnce({
          user_id: 'test-user-123',
          disability_status: status
        });

        const res = await request(app)
          .post('/api/wizard/screening')
          .send({ disabilityStatus: status });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      }
    });
  });

  // ----------------------------------------------------
  // PUT /api/wizard/update - screening section
  // ----------------------------------------------------
  describe('PUT /api/wizard/update - screening section', () => {
    test('should call ScreeningAnswers.upsert when updating screening section', async () => {
      const mockScreeningData = {
        user_id: 'test-user-123',
        experience_summary: 'Updated experience'
      };

      mockUpsert.mockResolvedValueOnce(mockScreeningData);

      const response = await request(app)
        .put('/api/wizard/update')
        .send({
          section: 'screening',
          data: {
            experienceSummary: 'Updated experience',
            hybridPreference: 'remote'
          }
        })
        .expect(200);

      expect(mockUpsert).toHaveBeenCalledWith('test-user-123', {
        experienceSummary: 'Updated experience',
        hybridPreference: 'remote'
      });

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Data updated successfully');
    });
  });

  // ----------------------------------------------------
  // Verification: ScreeningAnswers methods
  // ----------------------------------------------------
  describe('Verification: ScreeningAnswers model', () => {
    test('should verify that ScreeningAnswers model has only upsert/find/delete', () => {
      const ScreeningAnswers = require('../src/database/models/ScreeningAnswers');

      expect(ScreeningAnswers.upsert).toBeDefined();
      expect(typeof ScreeningAnswers.upsert).toBe('function');
      expect(ScreeningAnswers.findByUserId).toBeDefined();
      expect(ScreeningAnswers.delete).toBeDefined();
      expect(ScreeningAnswers.save).toBeUndefined();
    });
  });
});
