/**
 * Integration Tests for wizard Step 2 (Profile) endpoint
 * Verifies Profile.upsert correctly stores fullName, resumePath, and other profile fields
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

// --- Mock Logger ---
jest.mock('../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }))
}));

const wizardRouter = require('../src/routes/wizard');

describe('POST /api/wizard/step2 - Profile Data', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/wizard', wizardRouter);
  });

  test('should save profile with fullName and resumePath', async () => {
    // Mock the Profile.upsert to return saved data
    const mockSavedProfile = {
      user_id: 2,
      full_name: 'John Doe',
      email: 'john@example.com',
      resume_path: '/uploads/resume-123.pdf',
      phone: '+1234567890',
      country: 'USA',
      city: 'New York',
      state_region: 'NY',
      postal_code: '10001'
    };
    mockProfileUpsert.mockResolvedValue(mockSavedProfile);

    const response = await request(app)
      .post('/api/wizard/step2')
      .send({
        fullName: 'John Doe',
        email: 'john@example.com',
        resumePath: '/uploads/resume-123.pdf',
        coverLetterOption: 'upload',
        coverLetterPath: '/uploads/cover-123.pdf',
        phone: '+1234567890',
        country: 'USA',
        city: 'New York',
        stateRegion: 'NY',
        postalCode: '10001'
      });

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    expect(response.body.message).toBe('Step 2 saved successfully');
    
    // Verify Profile.upsert was called with correct data
    expect(mockProfileUpsert).toHaveBeenCalledWith(2, {
      fullName: 'John Doe',
      email: 'john@example.com',
      resumePath: '/uploads/resume-123.pdf',
      coverLetterOption: 'upload',
      coverLetterPath: '/uploads/cover-123.pdf',
      phone: '+1234567890',
      country: 'USA',
      city: 'New York',
      stateRegion: 'NY',
      postalCode: '10001'
    });

    // Verify response includes saved data
    expect(response.body.data).toEqual(mockSavedProfile);
  });

  test('should handle empty strings for optional fields', async () => {
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

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify Profile.upsert was called with empty strings (not null)
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

  test('should return 500 on Profile.upsert error', async () => {
    mockProfileUpsert.mockRejectedValue(new Error('Database error'));

    const response = await request(app)
      .post('/api/wizard/step2')
      .send({
        fullName: 'Test User',
        email: 'test@example.com'
      });

    expect(response.status).toBe(500);
    expect(response.body.success).toBe(false);
    expect(response.body.message).toBe('Error saving step 2');
  });
});
