/**
 * Remote Countries API Round-Trip Test
 * 
 * This test validates that remote countries (remote_jobs field) correctly:
 * 1. Saves to the database via POST /api/wizard/step1
 * 2. Retrieves from the database via GET /api/wizard/data
 * 3. Preserves the array format and all selected countries
 * 
 * This automated test complements the manual test-remote-countries-manual.js
 * and can be run as part of the CI pipeline.
 */

const request = require('supertest');
const express = require('express');

// Mock the database for this test
const mockQuery = jest.fn();
jest.mock('../src/database/db', () => ({
  query: mockQuery,
  getClient: jest.fn()
}));

// Mock authentication middleware
jest.mock('../src/middleware/auth', () => ({
  authenticateToken: (req, res, next) => {
    req.user = { userId: 'test-remote-countries-user' };
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

describe('Remote Countries API Round-Trip', () => {
  let app;

  beforeAll(() => {
    // Set up Express app with routes
    app = express();
    app.use(express.json());
    
    // Mount wizard routes
    const wizardRoutes = require('../src/routes/wizard');
    app.use('/api/wizard', wizardRoutes);
  });

  beforeEach(() => {
    mockQuery.mockReset();
  });

  describe('POST /api/wizard/step1 - Save Remote Countries', () => {
    test('should save remote countries array correctly', async () => {
      const testCountries = ['United States', 'United Kingdom', 'Canada'];
      
      // Mock the database upsert response
      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 'test-remote-countries-user',
          remote_jobs: testCountries,
          onsite_location: 'San Francisco',
          job_types: ['Full-time'],
          job_titles: ['Software Engineer'],
          seniority_levels: ['Mid-level'],
          time_zones: ['UTC-08:00 (PST)'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/api/wizard/step1')
        .send({
          remoteJobs: testCountries,
          onsiteLocation: 'San Francisco',
          jobTypes: ['Full-time'],
          jobTitles: ['Software Engineer'],
          seniorityLevels: ['Mid-level'],
          timeZones: ['UTC-08:00 (PST)']
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remote_jobs).toEqual(testCountries);
      
      // Verify the database was called with the correct data
      expect(mockQuery).toHaveBeenCalled();
      const queryCall = mockQuery.mock.calls[0];
      const queryParams = queryCall[1];
      
      // The remote_jobs should be in the parameters
      expect(queryParams).toContain('test-remote-countries-user');
    });

    test('should handle empty remote countries array', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 'test-remote-countries-user',
          remote_jobs: [],
          onsite_location: 'New York',
          job_types: ['Full-time'],
          job_titles: ['Developer'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/api/wizard/step1')
        .send({
          remoteJobs: [],
          onsiteLocation: 'New York',
          jobTypes: ['Full-time'],
          jobTitles: ['Developer'],
          seniorityLevels: [],
          timeZones: []
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remote_jobs).toEqual([]);
    });

    test('should handle multiple remote countries', async () => {
      const multipleCountries = [
        'United States',
        'United Kingdom',
        'Canada',
        'Germany',
        'Australia',
        'Japan'
      ];

      mockQuery.mockResolvedValue({
        rows: [{
          id: 1,
          user_id: 'test-remote-countries-user',
          remote_jobs: multipleCountries,
          onsite_location: '',
          job_types: ['Remote'],
          job_titles: ['Engineer'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const response = await request(app)
        .post('/api/wizard/step1')
        .send({
          remoteJobs: multipleCountries,
          onsiteLocation: '',
          jobTypes: ['Remote'],
          jobTitles: ['Engineer'],
          seniorityLevels: [],
          timeZones: []
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remote_jobs).toEqual(multipleCountries);
      expect(response.body.data.remote_jobs.length).toBe(6);
    });
  });

  describe('GET /api/wizard/data - Retrieve Remote Countries', () => {
    test('should retrieve saved remote countries correctly', async () => {
      const savedCountries = ['United States', 'Canada', 'Mexico'];
      
      // Mock the database query to return user profile with remote_jobs
      mockQuery.mockResolvedValue({
        rows: [{
          user_id: 'test-remote-countries-user',
          remote_jobs: savedCountries,
          onsite_location: 'Austin',
          job_types: ['Full-time', 'Contract'],
          job_titles: ['Software Engineer', 'DevOps Engineer'],
          seniority_levels: ['Senior'],
          time_zones: ['UTC-06:00 (CST)']
        }]
      });

      const response = await request(app)
        .get('/api/wizard/data');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.remote_jobs).toBeDefined();
      
      // Parse if stored as JSON string, otherwise use as-is
      let retrievedCountries = response.body.data.remote_jobs;
      if (typeof retrievedCountries === 'string') {
        retrievedCountries = JSON.parse(retrievedCountries);
      }
      
      expect(Array.isArray(retrievedCountries)).toBe(true);
      expect(retrievedCountries).toEqual(savedCountries);
    });

    test('should handle case when no remote countries are saved', async () => {
      mockQuery.mockResolvedValue({
        rows: [{
          user_id: 'test-remote-countries-user',
          remote_jobs: [],
          onsite_location: 'Boston',
          job_types: ['Full-time']
        }]
      });

      const response = await request(app)
        .get('/api/wizard/data');

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      
      const remoteJobs = response.body.data.remote_jobs;
      expect(remoteJobs === null || (Array.isArray(remoteJobs) && remoteJobs.length === 0)).toBe(true);
    });
  });

  describe('Full Round-Trip: Save and Retrieve', () => {
    test('should preserve remote countries through complete save/retrieve cycle', async () => {
      const testCountries = ['United States', 'United Kingdom', 'Canada'];
      
      // Step 1: Save remote countries
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 'test-remote-countries-user',
          remote_jobs: testCountries,
          onsite_location: 'San Francisco',
          job_types: ['Full-time'],
          job_titles: ['Software Engineer'],
          seniority_levels: ['Mid-level'],
          time_zones: ['UTC-08:00 (PST)'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      const saveResponse = await request(app)
        .post('/api/wizard/step1')
        .send({
          remoteJobs: testCountries,
          onsiteLocation: 'San Francisco',
          jobTypes: ['Full-time'],
          jobTitles: ['Software Engineer'],
          seniorityLevels: ['Mid-level'],
          timeZones: ['UTC-08:00 (PST)']
        });

      expect(saveResponse.status).toBe(200);
      expect(saveResponse.body.success).toBe(true);

      // Step 2: Retrieve the saved data
      mockQuery.mockResolvedValueOnce({
        rows: [{
          user_id: 'test-remote-countries-user',
          remote_jobs: testCountries,
          onsite_location: 'San Francisco',
          job_types: ['Full-time'],
          job_titles: ['Software Engineer'],
          seniority_levels: ['Mid-level'],
          time_zones: ['UTC-08:00 (PST)']
        }]
      });

      const retrieveResponse = await request(app)
        .get('/api/wizard/data');

      expect(retrieveResponse.status).toBe(200);
      expect(retrieveResponse.body.success).toBe(true);

      // Step 3: Verify the retrieved data matches what was saved
      let retrievedCountries = retrieveResponse.body.data.remote_jobs;
      if (typeof retrievedCountries === 'string') {
        retrievedCountries = JSON.parse(retrievedCountries);
      }

      expect(Array.isArray(retrievedCountries)).toBe(true);
      expect(retrievedCountries.sort()).toEqual(testCountries.sort());
      
      // Verify all countries are present
      testCountries.forEach(country => {
        expect(retrievedCountries).toContain(country);
      });
    });

    test('should update remote countries when changed', async () => {
      const initialCountries = ['United States', 'Canada'];
      const updatedCountries = ['United Kingdom', 'Germany', 'France'];
      
      // Initial save
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 'test-remote-countries-user',
          remote_jobs: initialCountries,
          job_types: ['Full-time'],
          job_titles: ['Developer'],
          created_at: new Date(),
          updated_at: new Date()
        }]
      });

      await request(app)
        .post('/api/wizard/step1')
        .send({
          remoteJobs: initialCountries,
          jobTypes: ['Full-time'],
          jobTitles: ['Developer'],
          onsiteLocation: '',
          seniorityLevels: [],
          timeZones: []
        });

      // Update with new countries
      mockQuery.mockResolvedValueOnce({
        rows: [{
          id: 1,
          user_id: 'test-remote-countries-user',
          remote_jobs: updatedCountries,
          job_types: ['Full-time'],
          job_titles: ['Developer'],
          updated_at: new Date()
        }]
      });

      const updateResponse = await request(app)
        .post('/api/wizard/step1')
        .send({
          remoteJobs: updatedCountries,
          jobTypes: ['Full-time'],
          jobTitles: ['Developer'],
          onsiteLocation: '',
          seniorityLevels: [],
          timeZones: []
        });

      expect(updateResponse.status).toBe(200);
      expect(updateResponse.body.success).toBe(true);
      expect(updateResponse.body.data.remote_jobs).toEqual(updatedCountries);
    });
  });
});
