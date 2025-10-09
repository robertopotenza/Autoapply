/**
 * Integration tests for Admin Config Sync functionality
 * Tests POST /api/admin/config/update and GET /api/admin/config/current
 * Verifies runtimeConfig updated in-memory and Slack alerts on failures
 */

const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Mock the database and Slack alert before requiring routes
jest.mock('../src/database/db', () => ({
    query: jest.fn()
}));

// Mock the Slack alert utility
const mockSendSlackAlert = jest.fn();
jest.mock('../src/utils/slackAlert', () => ({
    sendSlackAlert: mockSendSlackAlert
}));

// Set up test environment
const ADMIN_TOKEN = 'test-admin-token-12345';
process.env.ADMIN_TOKEN = ADMIN_TOKEN;
process.env.NODE_ENV = 'test';

describe('Admin Config Sync', () => {
    let app;
    let runtimeConfigPath;
    
    beforeAll(() => {
        // Create Express app with admin dashboard routes
        app = express();
        app.use(express.json());
        
        const adminRouter = require('../src/routes/admin-dashboard');
        app.use('/api/admin', adminRouter);
        
        runtimeConfigPath = path.join(__dirname, '../config/runtime.json');
    });
    
    beforeEach(() => {
        // Clear mocks before each test
        mockSendSlackAlert.mockClear();
        mockSendSlackAlert.mockResolvedValue();
        
        // Reset globalThis.runtimeConfig
        globalThis.runtimeConfig = {
            PERF_LOG_ENABLED: false,
            DEBUG_MODE: false,
            ALERTS_ENABLED: false,
            lastUpdated: null
        };
        
        // Reset config file to defaults
        const defaultConfig = {
            PERF_LOG_ENABLED: false,
            DEBUG_MODE: false,
            ALERTS_ENABLED: false,
            lastUpdated: null
        };
        fs.writeFileSync(runtimeConfigPath, JSON.stringify(defaultConfig, null, 2));
    });
    
    afterAll(() => {
        // Restore config file to defaults
        const defaultConfig = {
            PERF_LOG_ENABLED: false,
            DEBUG_MODE: false,
            ALERTS_ENABLED: false,
            lastUpdated: null
        };
        fs.writeFileSync(runtimeConfigPath, JSON.stringify(defaultConfig, null, 2));
    });
    
    describe('POST /api/admin/config/update', () => {
        test('should update single config value', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.config.PERF_LOG_ENABLED).toBe(true);
            expect(response.body.config.DEBUG_MODE).toBe(false);
            expect(response.body.config.ALERTS_ENABLED).toBe(false);
            expect(response.body.config.lastUpdated).toBeTruthy();
        });
        
        test('should update multiple config values at once', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({
                    PERF_LOG_ENABLED: true,
                    DEBUG_MODE: true,
                    ALERTS_ENABLED: false
                });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.config.PERF_LOG_ENABLED).toBe(true);
            expect(response.body.config.DEBUG_MODE).toBe(true);
            expect(response.body.config.ALERTS_ENABLED).toBe(false);
        });
        
        test('should update globalThis.runtimeConfig', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ DEBUG_MODE: true });
            
            expect(response.status).toBe(200);
            expect(globalThis.runtimeConfig.DEBUG_MODE).toBe(true);
            expect(globalThis.runtimeConfig.PERF_LOG_ENABLED).toBe(false);
        });
        
        test('should persist config to runtime.json file', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ ALERTS_ENABLED: true });
            
            expect(response.status).toBe(200);
            
            // Read file and verify
            const fileContent = fs.readFileSync(runtimeConfigPath, 'utf8');
            const savedConfig = JSON.parse(fileContent);
            
            expect(savedConfig.ALERTS_ENABLED).toBe(true);
            expect(savedConfig.lastUpdated).toBeTruthy();
        });
        
        test('should update process.env values', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            expect(response.status).toBe(200);
            expect(process.env.PERF_LOG_ENABLED).toBe('true');
        });
        
        test('should reject request without admin token', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .send({ PERF_LOG_ENABLED: true });
            
            expect(response.status).toBe(403);
        });
        
        test('should reject request with invalid admin token', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', 'invalid-token')
                .send({ PERF_LOG_ENABLED: true });
            
            expect(response.status).toBe(403);
        });
        
        test('should handle boolean conversion correctly', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: 'true', DEBUG_MODE: 1 });
            
            expect(response.status).toBe(200);
            expect(response.body.config.PERF_LOG_ENABLED).toBe(true);
            expect(response.body.config.DEBUG_MODE).toBe(true);
        });
        
        test('should send Slack alert on file write failure', async () => {
            // Make the config file read-only to simulate write failure
            const originalMode = fs.statSync(runtimeConfigPath).mode;
            fs.chmodSync(runtimeConfigPath, 0o444);
            
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            // Restore file permissions
            fs.chmodSync(runtimeConfigPath, originalMode);
            
            expect(response.status).toBe(500);
            expect(response.body.success).toBe(false);
            expect(mockSendSlackAlert).toHaveBeenCalled();
            expect(mockSendSlackAlert.mock.calls[0][0]).toContain('Config Sync Failed');
        });
    });
    
    describe('GET /api/admin/config/current', () => {
        test('should return current runtime config', async () => {
            // Set some values
            globalThis.runtimeConfig = {
                PERF_LOG_ENABLED: true,
                DEBUG_MODE: false,
                ALERTS_ENABLED: true,
                lastUpdated: '2025-10-09T04:25:00Z'
            };
            
            const response = await request(app)
                .get('/api/admin/config/current')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.PERF_LOG_ENABLED).toBe(true);
            expect(response.body.DEBUG_MODE).toBe(false);
            expect(response.body.ALERTS_ENABLED).toBe(true);
            expect(response.body.lastUpdated).toBe('2025-10-09T04:25:00Z');
        });
        
        test('should return updated values after config update', async () => {
            // First update config
            await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true, DEBUG_MODE: true });
            
            // Then get current config
            const response = await request(app)
                .get('/api/admin/config/current')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.PERF_LOG_ENABLED).toBe(true);
            expect(response.body.DEBUG_MODE).toBe(true);
        });
        
        test('should reject request without admin token', async () => {
            const response = await request(app)
                .get('/api/admin/config/current');
            
            expect(response.status).toBe(403);
        });
        
        test('should reject request with invalid admin token', async () => {
            const response = await request(app)
                .get('/api/admin/config/current')
                .set('X-Admin-Token', 'invalid-token');
            
            expect(response.status).toBe(403);
        });
    });
    
    describe('Integration: Update and Current Sync', () => {
        test('should sync config between update and current endpoints', async () => {
            // Update via POST /config/update
            const updateResponse = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({
                    PERF_LOG_ENABLED: true,
                    DEBUG_MODE: true,
                    ALERTS_ENABLED: false
                });
            
            expect(updateResponse.status).toBe(200);
            expect(updateResponse.body.success).toBe(true);
            
            // Verify via GET /config/current
            const currentResponse = await request(app)
                .get('/api/admin/config/current')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(currentResponse.status).toBe(200);
            expect(currentResponse.body.PERF_LOG_ENABLED).toBe(true);
            expect(currentResponse.body.DEBUG_MODE).toBe(true);
            expect(currentResponse.body.ALERTS_ENABLED).toBe(false);
            
            // Verify globalThis.runtimeConfig is in sync
            expect(globalThis.runtimeConfig.PERF_LOG_ENABLED).toBe(true);
            expect(globalThis.runtimeConfig.DEBUG_MODE).toBe(true);
            expect(globalThis.runtimeConfig.ALERTS_ENABLED).toBe(false);
        });
        
        test('should maintain consistency across multiple updates', async () => {
            // First update
            await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            // Second update
            await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ DEBUG_MODE: true });
            
            // Third update
            await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ ALERTS_ENABLED: true });
            
            // Verify final state
            const response = await request(app)
                .get('/api/admin/config/current')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.body.PERF_LOG_ENABLED).toBe(true);
            expect(response.body.DEBUG_MODE).toBe(true);
            expect(response.body.ALERTS_ENABLED).toBe(true);
        });
    });
    
    describe('Slack Alert Integration', () => {
        test('should not send alert on successful update', async () => {
            const response = await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            expect(response.status).toBe(200);
            expect(mockSendSlackAlert).not.toHaveBeenCalled();
        });
        
        test('should send alert with correct message on failure', async () => {
            // Make the config file read-only
            const originalMode = fs.statSync(runtimeConfigPath).mode;
            fs.chmodSync(runtimeConfigPath, 0o444);
            
            await request(app)
                .post('/api/admin/config/update')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            // Restore file permissions
            fs.chmodSync(runtimeConfigPath, originalMode);
            
            expect(mockSendSlackAlert).toHaveBeenCalledTimes(1);
            const alertCall = mockSendSlackAlert.mock.calls[0];
            expect(alertCall[0]).toContain('Config Sync Failed');
            expect(alertCall[1].error).toBeTruthy();
            expect(alertCall[1].environment).toBe('test');
        });
    });
    
    describe('Backwards Compatibility', () => {
        test('should still support PUT /api/admin/config endpoint', async () => {
            const response = await request(app)
                .put('/api/admin/config')
                .set('X-Admin-Token', ADMIN_TOKEN)
                .send({ PERF_LOG_ENABLED: true });
            
            expect(response.status).toBe(200);
            expect(response.body.success).toBe(true);
            expect(response.body.config.PERF_LOG_ENABLED).toBe(true);
        });
        
        test('should still support GET /api/admin/config endpoint', async () => {
            const response = await request(app)
                .get('/api/admin/config')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.saved).toBeTruthy();
            expect(response.body.current).toBeTruthy();
        });
    });
});
