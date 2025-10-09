/**
 * @file
 * @description End-to-End Scenario Tests for Step 2 Field Persistence Issues
 * 
 * These tests simulate real-world scenarios where Step 2 data goes missing:
 * - User fills form but backend receives empty values
 * - Save and Exit loses resume path
 * - Partial data submission
 * 
 * Each test validates that the auto-detection system properly identifies
 * and logs these issues for debugging.
 */

const request = require('supertest');
const express = require('express');

// --- Mock Database and Models ---
const mockProfileUpsert = jest.fn();

jest.mock('../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../src/database/models/Profile', () => ({
  upsert: mockProfileUpsert,
  findByUserId: jest.fn(),
  delete: jest.fn()
}));

jest.mock('../src/database/models/JobPreferences', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn()
}));

jest.mock('../src/database/models/Eligibility', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn()
}));

jest.mock('../src/database/models/ScreeningAnswers', () => ({
  upsert: jest.fn(),
  findByUserId: jest.fn()
}));

jest.mock('../src/database/models/User', () => ({
  getCompleteProfile: jest.fn()
}));

// --- Mock Auth Middleware ---
jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 2 };
    next();
  }
}));

// --- Mock Logger to capture diagnostics ---
const mockLoggerInfo = jest.fn();
const mockLoggerWarn = jest.fn();
const mockLoggerError = jest.fn();

jest.mock('../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
    debug: jest.fn()
  }))
}));

const wizardRouter = require('../src/routes/wizard');

describe('POST /api/wizard/step2 - Real-World Scenario Tests', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/wizard', wizardRouter);
  });

  describe('Scenario: User fills form but frontend sends empty payload', () => {
    test('should log CRITICAL error when all fields are empty', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: null,
        email: null,
        resume_path: null,
        phone: null,
        country: null
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      // Simulate frontend bug where form is filled but empty payload sent
      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: '',
          email: '',
          resumePath: '',
          coverLetterOption: '',
          coverLetterPath: '',
          phone: '',
          country: '',
          city: '',
          stateRegion: '',
          postalCode: ''
        });

      expect(response.status).toBe(200);

      // Verify CRITICAL error was logged
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('All Step 2 fields are empty'),
        expect.objectContaining({
          suggestion: expect.stringContaining('Frontend is sending empty payload')
        })
      );

      // Verify warning was also logged for empty critical fields
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.any(Object)
      );
    });
  });

  describe('Scenario: Save and Exit without resume upload', () => {
    test('should detect when resumePath is missing from Save and Exit', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'John Doe',
        email: 'john@example.com',
        resume_path: '',  // Empty because parseFormData was called before uploadFiles
        phone: '+1234567890',
        country: 'USA'
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: 'John Doe',
          email: 'john@example.com',
          resumePath: '',  // Missing!
          coverLetterOption: '',
          coverLetterPath: '',
          phone: '+1234567890',
          country: 'USA',
          city: 'New York',
          stateRegion: 'NY',
          postalCode: '10001'
        });

      expect(response.status).toBe(200);

      // Should NOT log critical error (not all fields empty)
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        expect.stringContaining('All Step 2 fields are empty'),
        expect.any(Object)
      );

      // Should NOT log warning (critical fields are populated)
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.any(Object)
      );

      // Verify data was still saved
      expect(mockProfileUpsert).toHaveBeenCalledWith(2, expect.objectContaining({
        fullName: 'John Doe',
        email: 'john@example.com',
        country: 'USA'
      }));
    });
  });

  describe('Scenario: Incomplete form submission', () => {
    test('should warn when country is missing but name and email provided', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        resume_path: '',
        phone: '',
        country: '',  // Missing!
        city: '',
        state_region: '',
        postal_code: ''
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: 'Jane Smith',
          email: 'jane@example.com',
          resumePath: '',
          coverLetterOption: '',
          coverLetterPath: '',
          phone: '',
          country: '',  // User forgot to fill this
          city: '',
          stateRegion: '',
          postalCode: ''
        });

      expect(response.status).toBe(200);

      // Should log warning for incomplete submission
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.objectContaining({
          emptyFields: ['country']
        })
      );

      // Should NOT log critical error (some fields populated)
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        expect.stringContaining('All Step 2 fields are empty'),
        expect.any(Object)
      );
    });
  });

  describe('Scenario: Successful complete submission', () => {
    test('should not log any warnings when all critical fields are provided', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'Roberto Potenza',
        email: 'roberto@example.com',
        resume_path: '/uploads/resume-user2-123.pdf',
        phone: '+15551234567',
        country: 'USA',
        city: 'New York',
        state_region: 'NY',
        postal_code: '10001'
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: 'Roberto Potenza',
          email: 'roberto@example.com',
          resumePath: '/uploads/resume-user2-123.pdf',
          coverLetterOption: 'upload',
          coverLetterPath: '/uploads/cover-user2-123.pdf',
          phone: '+15551234567',
          country: 'USA',
          city: 'New York',
          stateRegion: 'NY',
          postalCode: '10001'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      // Should NOT log any warnings or errors
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.any(Object)
      );
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        expect.stringContaining('All Step 2 fields are empty'),
        expect.any(Object)
      );

      // Verify info log was called
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Step 2 data received for user 2:',
        expect.objectContaining({
          fullName: 'Roberto Potenza',
          email: 'roberto@example.com',
          country: 'USA'
        })
      );
    });
  });

  describe('Scenario: User skips optional fields', () => {
    test('should accept submission with only required fields', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'Min User',
        email: 'min@example.com',
        resume_path: '',
        phone: '',
        country: 'Canada',
        city: '',
        state_region: '',
        postal_code: ''
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: 'Min User',
          email: 'min@example.com',
          resumePath: '',
          coverLetterOption: '',
          coverLetterPath: '',
          phone: '',  // Optional
          country: 'Canada',
          city: '',  // Optional
          stateRegion: '',  // Optional
          postalCode: ''  // Optional
        });

      expect(response.status).toBe(200);

      // Should NOT log warnings (all critical fields present)
      expect(mockLoggerWarn).not.toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.any(Object)
      );

      // Verify data saved correctly
      expect(mockProfileUpsert).toHaveBeenCalledWith(2, expect.objectContaining({
        fullName: 'Min User',
        email: 'min@example.com',
        country: 'Canada'
      }));
    });
  });
});
