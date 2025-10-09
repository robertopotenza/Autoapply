/**
 * Test for wizard screening endpoint
 * Verifies that ScreeningAnswers.upsert is called correctly
 */

const request = require('supertest');
const express = require('express');

// Mock the database and models before requiring routes
jest.mock('../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

// Mock ScreeningAnswers model
const mockUpsert = jest.fn();
const mockFindByUserId = jest.fn();

jest.mock('../src/database/models/ScreeningAnswers', () => ({
  upsert: mockUpsert,
  findByUserId: mockFindByUserId,
  delete: jest.fn()
}));

// Mock other models
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

jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'test-user-123' };
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

describe('Wizard Screening Endpoint', () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    
    // Load the wizard routes
    const wizardRoutes = require('../src/routes/wizard');
    app.use('/api/wizard', wizardRoutes);
  });

  beforeEach(() => {
    // Clear all mocks before each test
    jest.clearAllMocks();
  });

  describe('POST /api/wizard/screening', () => {
    test('should call ScreeningAnswers.upsert with correct parameters', async () => {
      const mockScreeningData = {
        user_id: 'test-user-123',
        experience_summary: 'Test experience',
        hybrid_preference: 'hybrid',
        travel: 'yes',
        relocation: 'no',
        languages: ['English', 'Spanish'],
        date_of_birth: '1990-01-01',
        gpa: 3.5,
        is_adult: true,
        gender_identity: 'prefer-not-to-say',
        disability_status: 'no',
        military_service: 'no',
        ethnicity: 'prefer-not-to-say',
        driving_license: 'yes'
      };

      mockUpsert.mockResolvedValueOnce(mockScreeningData);

      const requestData = {
        experienceSummary: 'Test experience',
        hybridPreference: 'hybrid',
        travel: 'yes',
        relocation: 'no',
        languages: ['English', 'Spanish'],
        dateOfBirth: '1990-01-01',
        gpa: 3.5,
        isAdult: true,
        genderIdentity: 'prefer-not-to-say',
        disabilityStatus: 'no',
        militaryService: 'no',
        ethnicity: 'prefer-not-to-say',
        drivingLicense: 'yes'
      };

      const response = await request(app)
        .post('/api/wizard/screening')
        .send(requestData)
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify that upsert was called
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      
      // Verify the userId parameter
      expect(mockUpsert).toHaveBeenCalledWith('test-user-123', expect.any(Object));
      
      // Verify the data parameter structure
      const calledWithData = mockUpsert.mock.calls[0][1];
      expect(calledWithData).toEqual({
        experienceSummary: 'Test experience',
        hybridPreference: 'hybrid',
        travel: 'yes',
        relocation: 'no',
        languages: ['English', 'Spanish'],
        dateOfBirth: '1990-01-01',
        gpa: 3.5,
        isAdult: true,
        genderIdentity: 'prefer-not-to-say',
        disabilityStatus: 'no',
        militaryService: 'no',
        ethnicity: 'prefer-not-to-say',
        drivingLicense: 'yes'
      });

      // Verify response
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Screening answers saved successfully');
      expect(response.body.data).toEqual(mockScreeningData);
    });

    test('should handle empty/missing fields with defaults', async () => {
      const mockScreeningData = {
        user_id: 'test-user-123',
        experience_summary: '',
        hybrid_preference: '',
        travel: '',
        relocation: ''
      };

      mockUpsert.mockResolvedValueOnce(mockScreeningData);

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({})
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify that upsert was called
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      
      // Verify default values are used
      const calledWithData = mockUpsert.mock.calls[0][1];
      expect(calledWithData.experienceSummary).toBe('');
      expect(calledWithData.hybridPreference).toBe('');
      expect(calledWithData.languages).toEqual([]);
      expect(calledWithData.dateOfBirth).toBe(null);
      expect(calledWithData.gpa).toBe(null);
      expect(calledWithData.isAdult).toBe(null);
    });

    test('should handle errors from ScreeningAnswers.upsert', async () => {
      mockUpsert.mockRejectedValueOnce(new Error('Database error'));

      const response = await request(app)
        .post('/api/wizard/screening')
        .send({
          experienceSummary: 'Test'
        })
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Error saving screening answers');
      expect(response.body.error).toBe('Database error');
    });
  });

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
        .expect('Content-Type', /json/)
        .expect(200);

      // Verify that upsert was called
      expect(mockUpsert).toHaveBeenCalledTimes(1);
      expect(mockUpsert).toHaveBeenCalledWith('test-user-123', {
        experienceSummary: 'Updated experience',
        hybridPreference: 'remote'
      });

      // Verify response
      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Data updated successfully');
      expect(response.body.data).toEqual(mockScreeningData);
    });
  });

  describe('Verification: ScreeningAnswers only has upsert method', () => {
    test('should verify that ScreeningAnswers model does not have a save method', () => {
      const ScreeningAnswers = require('../src/database/models/ScreeningAnswers');
      
      // Verify that upsert exists
      expect(ScreeningAnswers.upsert).toBeDefined();
      expect(typeof ScreeningAnswers.upsert).toBe('function');
      
      // Verify that save does NOT exist (this is the key assertion)
      expect(ScreeningAnswers.save).toBeUndefined();
    });

    test('should verify ScreeningAnswers has the correct methods', () => {
      const ScreeningAnswers = require('../src/database/models/ScreeningAnswers');
      
      // Expected methods
      expect(ScreeningAnswers.upsert).toBeDefined();
      expect(ScreeningAnswers.findByUserId).toBeDefined();
      expect(ScreeningAnswers.delete).toBeDefined();
      
      // Should NOT have save method
      expect(ScreeningAnswers.save).toBeUndefined();
    });
  });
});
