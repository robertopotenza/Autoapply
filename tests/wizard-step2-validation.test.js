/**
 * @file
 * @description Comprehensive validation tests for Step 2 Profile data flow.
 * Detects incomplete/null values and validates data persistence across the stack.
 * 
 * Tests cover:
 * - Frontend payload validation (simulating what app.js sends)
 * - Backend data reception and null/empty detection
 * - Profile.upsert parameter validation
 * - Database persistence verification
 */

const request = require('supertest');
const express = require('express');

// --- Mock Database and Models ---
const mockProfileUpsert = jest.fn();
const mockProfileFindByUserId = jest.fn();

jest.mock('../src/database/db', () => ({
  query: jest.fn(),
  getClient: jest.fn()
}));

jest.mock('../src/database/models/Profile', () => ({
  upsert: mockProfileUpsert,
  findByUserId: mockProfileFindByUserId,
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

// --- Mock Logger to capture log output ---
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

describe('POST /api/wizard/step2 - Validation & Detection', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/wizard', wizardRouter);
  });

  describe('Null/Empty Value Detection', () => {
    test('should detect when critical fields are empty strings', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: '',
        email: '',
        resume_path: '',
        phone: '',
        country: '',
        city: '',
        state_region: '',
        postal_code: ''
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

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
      
      // Verify that the backend logged the received data
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Step 2 data received for user 2:',
        expect.objectContaining({
          fullName: '',
          email: '',
          resumePath: '',
          country: ''
        })
      );

      // Verify that a warning was logged for empty critical fields
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.objectContaining({
          emptyFields: expect.arrayContaining(['fullName', 'email', 'country'])
        })
      );

      // Verify that an error was logged for ALL fields being empty
      expect(mockLoggerError).toHaveBeenCalledWith(
        expect.stringContaining('All Step 2 fields are empty'),
        expect.any(Object)
      );

      // Verify Profile.upsert was called with empty strings
      expect(mockProfileUpsert).toHaveBeenCalledWith(2, {
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
    });

    test('should detect when only some fields are populated', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'John Doe',
        email: 'john@example.com',
        resume_path: '',
        phone: '',
        country: '',
        city: '',
        state_region: '',
        postal_code: ''
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: 'John Doe',
          email: 'john@example.com',
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
      
      // Verify logger shows partial data
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Step 2 data received for user 2:',
        expect.objectContaining({
          fullName: 'John Doe',
          email: 'john@example.com',
          resumePath: '',
          country: ''
        })
      );

      // Verify that a warning was logged for missing country
      expect(mockLoggerWarn).toHaveBeenCalledWith(
        expect.stringContaining('INCOMPLETE STEP 2 SUBMISSION'),
        expect.objectContaining({
          emptyFields: ['country']
        })
      );

      // Should NOT log error for all fields empty (since some are populated)
      expect(mockLoggerError).not.toHaveBeenCalledWith(
        expect.stringContaining('All Step 2 fields are empty'),
        expect.any(Object)
      );
    });

    test('should handle undefined/missing fields by converting to empty strings', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'Jane Smith',
        email: 'jane@example.com',
        resume_path: '',
        phone: '',
        country: '',
        city: '',
        state_region: '',
        postal_code: ''
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: 'Jane Smith',
          email: 'jane@example.com'
          // Other fields intentionally omitted
        });

      expect(response.status).toBe(200);
      
      // Verify that undefined fields were converted to empty strings
      expect(mockProfileUpsert).toHaveBeenCalledWith(2, {
        fullName: 'Jane Smith',
        email: 'jane@example.com',
        resumePath: '',
        coverLetterOption: '',
        coverLetterPath: '',
        phone: '',
        country: '',
        city: '',
        stateRegion: '',
        postalCode: ''
      });
    });
  });

  describe('Complete Profile Submission', () => {
    test('should successfully save all fields when fully populated', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: 'Roberto Potenza',
        email: 'roberto@example.com',
        resume_path: '/uploads/resume-user2-1234567890.pdf',
        cover_letter_option: 'upload',
        cover_letter_path: '/uploads/cover-user2-1234567890.pdf',
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
          resumePath: '/uploads/resume-user2-1234567890.pdf',
          coverLetterOption: 'upload',
          coverLetterPath: '/uploads/cover-user2-1234567890.pdf',
          phone: '+15551234567',
          country: 'USA',
          city: 'New York',
          stateRegion: 'NY',
          postalCode: '10001'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      // Verify all fields were logged
      expect(mockLoggerInfo).toHaveBeenCalledWith(
        'Step 2 data received for user 2:',
        expect.objectContaining({
          fullName: 'Roberto Potenza',
          email: 'roberto@example.com',
          resumePath: '/uploads/resume-user2-1234567890.pdf',
          coverLetterOption: 'upload',
          coverLetterPath: '/uploads/cover-user2-1234567890.pdf',
          phone: '+15551234567',
          country: 'USA',
          city: 'New York',
          stateRegion: 'NY',
          postalCode: '10001'
        })
      );

      // Verify Profile.upsert was called with all fields
      expect(mockProfileUpsert).toHaveBeenCalledWith(2, {
        fullName: 'Roberto Potenza',
        email: 'roberto@example.com',
        resumePath: '/uploads/resume-user2-1234567890.pdf',
        coverLetterOption: 'upload',
        coverLetterPath: '/uploads/cover-user2-1234567890.pdf',
        phone: '+15551234567',
        country: 'USA',
        city: 'New York',
        stateRegion: 'NY',
        postalCode: '10001'
      });

      // Verify response contains saved data
      expect(response.body.data).toEqual(mockSavedProfile);
    });
  });

  describe('Field Value Validation', () => {
    test('should preserve special characters in names', async () => {
      const mockSavedProfile = {
        user_id: 2,
        full_name: "O'Brien-Smith Jr.",
        email: 'obrien@example.com',
        phone: '+1 (555) 123-4567',
        country: 'Ireland',
        city: "Saint Mary's",
        state_region: 'County Cork',
        postal_code: 'T12 ABC1'
      };
      mockProfileUpsert.mockResolvedValue(mockSavedProfile);

      const response = await request(app)
        .post('/api/wizard/step2')
        .send({
          fullName: "O'Brien-Smith Jr.",
          email: 'obrien@example.com',
          resumePath: '',
          coverLetterOption: '',
          coverLetterPath: '',
          phone: '+1 (555) 123-4567',
          country: 'Ireland',
          city: "Saint Mary's",
          stateRegion: 'County Cork',
          postalCode: 'T12 ABC1'
        });

      expect(response.status).toBe(200);
      expect(mockProfileUpsert).toHaveBeenCalledWith(2, expect.objectContaining({
        fullName: "O'Brien-Smith Jr.",
        city: "Saint Mary's",
        country: 'Ireland'
      }));
    });

    test('should handle international phone formats', async () => {
      const testCases = [
        { phone: '+44 20 1234 5678', country: 'UK' },
        { phone: '+81-3-1234-5678', country: 'Japan' },
        { phone: '+55 11 98765-4321', country: 'Brazil' }
      ];

      for (const testCase of testCases) {
        jest.clearAllMocks();
        const mockSavedProfile = {
          user_id: 2,
          full_name: 'Test User',
          phone: testCase.phone,
          country: testCase.country
        };
        mockProfileUpsert.mockResolvedValue(mockSavedProfile);

        const response = await request(app)
          .post('/api/wizard/step2')
          .send({
            fullName: 'Test User',
            email: 'test@example.com',
            resumePath: '',
            coverLetterOption: '',
            coverLetterPath: '',
            phone: testCase.phone,
            country: testCase.country,
            city: '',
            stateRegion: '',
            postalCode: ''
          });

        expect(response.status).toBe(200);
        expect(mockProfileUpsert).toHaveBeenCalledWith(2, expect.objectContaining({
          phone: testCase.phone,
          country: testCase.country
        }));
      }
    });
  });
});
