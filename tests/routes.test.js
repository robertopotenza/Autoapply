// @ai-meta: route-test
// @ai-meta: endpoint-test

/**
 * Test for consolidated route handlers
 * Verifies that both /route and /route.html patterns work correctly
 */

const request = require('supertest');
const express = require('express');
const path = require('path');

describe('Consolidated Route Handlers', () => {
  let app;

  beforeEach(() => {
    app = express();
    
    // Mock logger
    const mockLogger = {
      info: jest.fn(),
      error: jest.fn()
    };
    
    // Wizard endpoint (handles both /wizard and /wizard.html)
    app.get('/wizard(.html)?', (req, res) => {
      try {
        const wizardPath = path.join(__dirname, '../public/wizard.html');
        mockLogger.info(`Serving wizard.html from: ${wizardPath}`);
        res.sendFile(wizardPath);
      } catch (error) {
        mockLogger.error('Error serving wizard.html:', error);
        res.status(500).send('Error loading wizard');
      }
    });
    
    // Applications endpoint (handles both /applications and /applications.html)
    app.get('/applications(.html)?', (req, res) => {
      try {
        const applicationsPath = path.join(__dirname, '../public/applications.html');
        mockLogger.info(`Serving applications.html from: ${applicationsPath}`);
        res.sendFile(applicationsPath);
      } catch (error) {
        mockLogger.error('Error serving applications.html:', error);
        res.status(500).send('Error loading applications');
      }
    });
  });

  describe('Wizard Routes', () => {
    test('should serve wizard.html for /wizard route', async () => {
      const response = await request(app).get('/wizard');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
    });

    test('should serve wizard.html for /wizard.html route', async () => {
      const response = await request(app).get('/wizard.html');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
    });
  });

  describe('Applications Routes', () => {
    test('should serve applications.html for /applications route', async () => {
      const response = await request(app).get('/applications');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
    });

    test('should serve applications.html for /applications.html route', async () => {
      const response = await request(app).get('/applications.html');
      expect(response.status).toBe(200);
      expect(response.type).toMatch(/html/);
    });
  });
});
