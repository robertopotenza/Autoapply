/**
 * End-to-End Simulation Test for Screening Form Data Flow
 * 
 * This test simulates the exact frontend payload structure and verifies
 * that languages and disabilityStatus are properly stored in the database.
 */

const request = require('supertest');
const express = require('express');

// Mock the database
const mockQuery = jest.fn();
jest.mock('../src/database/db', () => ({
  query: mockQuery,
  getClient: jest.fn()
}));

// Mock authentication middleware
jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'test-user-456' };
    next();
  }
}));

// Mock logger
jest.mock('../src/utils/logger', () => ({
  Logger: jest.fn().mockImplementation(() => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn()
  }))
}));

// Import routes after mocking
const wizardRoutes = require('../src/routes/wizard');

describe('E2E: Frontend to Database Data Flow', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/wizard', wizardRoutes);
    mockQuery.mockReset();
  });

  test('Scenario 1: User fills all screening fields with languages and disability', async () => {
    // This simulates exactly what the frontend sends
    const frontendPayload = {
      experienceSummary: '5 years of software development',
      hybridPreference: 'hybrid',
      travel: 'yes',
      relocation: 'no',
      languages: ['English', 'Spanish', 'Mandarin'], // Array of strings
      dateOfBirth: '1995-05-15',
      gpa: 3.8,
      isAdult: true,
      genderIdentity: 'male',
      disabilityStatus: 'no', // String value
      militaryService: 'no',
      ethnicity: 'hispanic',
      drivingLicense: 'Class B'
    };

    const mockDbResult = {
      rows: [{
        id: 1,
        user_id: 'test-user-456',
        experience_summary: '5 years of software development',
        hybrid_preference: 'hybrid',
        travel: 'yes',
        relocation: 'no',
        languages: ['English', 'Spanish', 'Mandarin'],
        date_of_birth: '1995-05-15',
        gpa: 3.8,
        is_adult: true,
        gender_identity: 'male',
        disability_status: 'no',
        military_service: 'no',
        ethnicity: 'hispanic',
        driving_license: 'Class B',
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(mockDbResult);

    const response = await request(app)
      .post('/api/wizard/screening')
      .send(frontendPayload);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);
    
    // Verify the database query was called
    expect(mockQuery).toHaveBeenCalledTimes(1);
    
    // Get the actual parameters passed to the database
    const [sql, params] = mockQuery.mock.calls[0];
    
    console.log('\n=== E2E Test: Database Query Parameters ===');
    console.log('SQL:', sql.substring(0, 100) + '...');
    console.log('Params:');
    console.log('  [0] user_id:', params[0]);
    console.log('  [5] languages:', params[5]);
    console.log('  [10] disability_status:', params[10]);
    
    // Verify languages is properly JSON stringified
    expect(params[5]).toBe(JSON.stringify(['English', 'Spanish', 'Mandarin']));
    expect(JSON.parse(params[5])).toEqual(['English', 'Spanish', 'Mandarin']);
    
    // Verify disabilityStatus is passed as string
    expect(params[10]).toBe('no');
  });

  test('Scenario 2: User selects "prefer not to say" for disability', async () => {
    const frontendPayload = {
      experienceSummary: 'Fresh graduate',
      languages: ['English'],
      disabilityStatus: '', // Empty string represents "prefer not to say"
      genderIdentity: ''
    };

    const mockDbResult = {
      rows: [{
        id: 2,
        user_id: 'test-user-456',
        languages: ['English'],
        disability_status: null, // Empty string should become null in DB
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(mockDbResult);

    const response = await request(app)
      .post('/api/wizard/screening')
      .send(frontendPayload);

    expect(response.status).toBe(200);
    
    const [sql, params] = mockQuery.mock.calls[0];
    
    console.log('\n=== Empty String to Null Conversion ===');
    console.log('  disabilityStatus sent:', frontendPayload.disabilityStatus);
    console.log('  disabilityStatus in DB params:', params[10]);
    
    // Empty string should be converted to null
    expect(params[10]).toBe(null);
  });

  test('Scenario 3: User submits with no languages selected', async () => {
    const frontendPayload = {
      experienceSummary: 'Test',
      languages: [], // Empty array
      disabilityStatus: 'yes'
    };

    const mockDbResult = {
      rows: [{
        id: 3,
        user_id: 'test-user-456',
        languages: [],
        disability_status: 'yes',
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(mockDbResult);

    const response = await request(app)
      .post('/api/wizard/screening')
      .send(frontendPayload);

    expect(response.status).toBe(200);
    
    const [sql, params] = mockQuery.mock.calls[0];
    
    console.log('\n=== Empty Languages Array ===');
    console.log('  languages sent:', frontendPayload.languages);
    console.log('  languages in DB params:', params[5]);
    
    // Empty array should be JSON stringified as "[]"
    expect(params[5]).toBe(JSON.stringify([]));
    expect(params[10]).toBe('yes');
  });

  test('Scenario 4: Fields are completely omitted from payload', async () => {
    const frontendPayload = {
      experienceSummary: 'Only experience provided'
      // languages and disabilityStatus are not in the payload at all
    };

    const mockDbResult = {
      rows: [{
        id: 4,
        user_id: 'test-user-456',
        experience_summary: 'Only experience provided',
        languages: [],
        disability_status: null,
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(mockDbResult);

    const response = await request(app)
      .post('/api/wizard/screening')
      .send(frontendPayload);

    expect(response.status).toBe(200);
    
    const [sql, params] = mockQuery.mock.calls[0];
    
    console.log('\n=== Missing Fields Default Handling ===');
    console.log('  languages default:', params[5]);
    console.log('  disabilityStatus default:', params[10]);
    
    // When fields are missing, they should use defaults
    expect(params[5]).toBe(JSON.stringify([])); // languages defaults to []
    expect(params[10]).toBe(null); // disabilityStatus empty string becomes null
  });

  test('Scenario 5: Verify data persists on second upsert (update scenario)', async () => {
    // First insert
    const firstPayload = {
      languages: ['English'],
      disabilityStatus: 'no'
    };

    const firstMockResult = {
      rows: [{
        id: 5,
        user_id: 'test-user-456',
        languages: ['English'],
        disability_status: 'no',
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(firstMockResult);

    const firstResponse = await request(app)
      .post('/api/wizard/screening')
      .send(firstPayload);

    expect(firstResponse.status).toBe(200);

    // Second update - user adds more languages
    const secondPayload = {
      languages: ['English', 'French', 'German'],
      disabilityStatus: 'no' // Should remain the same
    };

    const secondMockResult = {
      rows: [{
        id: 5,
        user_id: 'test-user-456',
        languages: ['English', 'French', 'German'],
        disability_status: 'no',
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(secondMockResult);

    const secondResponse = await request(app)
      .post('/api/wizard/screening')
      .send(secondPayload);

    expect(secondResponse.status).toBe(200);
    
    const [sql, params] = mockQuery.mock.calls[1]; // Second call
    
    console.log('\n=== Update Scenario ===');
    console.log('  Updated languages:', params[5]);
    console.log('  Disability status:', params[10]);
    
    expect(params[5]).toBe(JSON.stringify(['English', 'French', 'German']));
    expect(params[10]).toBe('no');
  });
});

describe('E2E: Edge Cases and Data Validation', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/api/wizard', wizardRoutes);
    mockQuery.mockReset();
  });

  test('Should handle special characters in languages', async () => {
    const frontendPayload = {
      languages: ['中文 (Chinese)', 'Español', 'Français'],
      disabilityStatus: 'no'
    };

    const mockDbResult = {
      rows: [{
        user_id: 'test-user-456',
        languages: ['中文 (Chinese)', 'Español', 'Français'],
        disability_status: 'no',
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(mockDbResult);

    const response = await request(app)
      .post('/api/wizard/screening')
      .send(frontendPayload);

    expect(response.status).toBe(200);
    
    const [sql, params] = mockQuery.mock.calls[0];
    const languagesJson = JSON.parse(params[5]);
    
    expect(languagesJson).toEqual(['中文 (Chinese)', 'Español', 'Français']);
  });

  test('Should handle very long disability status text', async () => {
    const longText = 'I prefer not to disclose this information at this time';
    
    const frontendPayload = {
      languages: [],
      disabilityStatus: longText
    };

    const mockDbResult = {
      rows: [{
        user_id: 'test-user-456',
        languages: [],
        disability_status: longText,
        created_at: new Date(),
        updated_at: new Date()
      }]
    };

    mockQuery.mockResolvedValue(mockDbResult);

    const response = await request(app)
      .post('/api/wizard/screening')
      .send(frontendPayload);

    expect(response.status).toBe(200);
    
    const [sql, params] = mockQuery.mock.calls[0];
    expect(params[10]).toBe(longText);
  });
});
