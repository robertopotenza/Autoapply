/**
 * Integration test for Admin Dashboard logs functionality
 * Tests that logs endpoint correctly handles both production and development log files
 */

const request = require('supertest');
const express = require('express');
const fs = require('fs');
const path = require('path');

// Mock the database before requiring routes
jest.mock('../src/database/db', () => ({
    query: jest.fn()
}));

// Set up test environment
const ADMIN_TOKEN = 'test-admin-token-12345';
process.env.ADMIN_TOKEN = ADMIN_TOKEN;

describe('Admin Dashboard Logs Endpoint', () => {
    let app;
    let logsDir;
    
    beforeAll(() => {
        // Create Express app with admin dashboard routes
        app = express();
        app.use(express.json());
        
        const adminRouter = require('../src/routes/admin-dashboard');
        app.use('/api/admin', adminRouter);
        
        logsDir = path.join(__dirname, '../logs');
        
        // Ensure logs directory exists
        if (!fs.existsSync(logsDir)) {
            fs.mkdirSync(logsDir, { recursive: true });
        }
    });
    
    afterEach(() => {
        // Clean up all test log files
        const testFiles = fs.readdirSync(logsDir);
        testFiles.forEach(file => {
            if (file !== '.gitkeep') {
                const filePath = path.join(logsDir, file);
                try {
                    fs.unlinkSync(filePath);
                } catch (err) {
                    // Ignore errors
                }
            }
        });
    });
    
    describe('Development Mode', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'development';
        });
        
        test('should read combined.log in development mode', async () => {
            // Create test log file
            const logPath = path.join(logsDir, 'combined.log');
            const testLogs = [
                JSON.stringify({ timestamp: '2025-10-09T10:00:00Z', level: 'info', message: 'Test log 1' }),
                JSON.stringify({ timestamp: '2025-10-09T10:01:00Z', level: 'info', message: 'Test log 2' })
            ].join('\n');
            fs.writeFileSync(logPath, testLogs);
            
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(2);
            expect(response.body.logs[0].message).toBe('Test log 1');
            expect(response.body.type).toBe('combined');
        });
        
        test('should read error.log in development mode', async () => {
            // Create test error log file
            const logPath = path.join(logsDir, 'error.log');
            const testLogs = [
                JSON.stringify({ timestamp: '2025-10-09T10:00:00Z', level: 'error', message: 'Test error 1' })
            ].join('\n');
            fs.writeFileSync(logPath, testLogs);
            
            const response = await request(app)
                .get('/api/admin/logs?type=error&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(1);
            expect(response.body.logs[0].message).toBe('Test error 1');
        });
        
        test('should return empty array if log file does not exist', async () => {
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toEqual([]);
            expect(response.body.message).toBe('Log file not found');
        });
    });
    
    describe('Production Mode', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'production';
        });
        
        afterAll(() => {
            process.env.NODE_ENV = 'development';
        });
        
        test('should read most recent date-stamped combined log in production mode', async () => {
            // Create multiple date-stamped log files
            const today = new Date().toISOString().split('T')[0];
            const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];
            
            const oldLogPath = path.join(logsDir, `combined-${yesterday}.log`);
            const newLogPath = path.join(logsDir, `combined-${today}.log`);
            
            fs.writeFileSync(oldLogPath, JSON.stringify({ message: 'Old log' }));
            fs.writeFileSync(newLogPath, JSON.stringify({ message: 'New log' }));
            
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(1);
            expect(response.body.logs[0].message).toBe('New log');
        });
        
        test('should read most recent date-stamped error log in production mode', async () => {
            const today = new Date().toISOString().split('T')[0];
            const errorLogPath = path.join(logsDir, `error-${today}.log`);
            
            const testLogs = [
                JSON.stringify({ timestamp: '2025-10-09T10:00:00Z', level: 'error', message: 'Production error' })
            ].join('\n');
            fs.writeFileSync(errorLogPath, testLogs);
            
            const response = await request(app)
                .get('/api/admin/logs?type=error&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(1);
            expect(response.body.logs[0].message).toBe('Production error');
        });
        
        test('should return empty array if no date-stamped log files exist', async () => {
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toEqual([]);
            expect(response.body.message).toBe('Log file not found');
        });
    });
    
    describe('Authentication', () => {
        test('should reject request without admin token', async () => {
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10');
            
            expect(response.status).toBe(403);
        });
        
        test('should reject request with invalid admin token', async () => {
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10')
                .set('X-Admin-Token', 'invalid-token');
            
            expect(response.status).toBe(403);
        });
    });
    
    describe('Edge Cases', () => {
        beforeAll(() => {
            process.env.NODE_ENV = 'development';
        });
        
        test('should handle non-JSON log lines gracefully', async () => {
            const logPath = path.join(logsDir, 'combined.log');
            const testLogs = [
                JSON.stringify({ message: 'Valid JSON log' }),
                'This is not JSON',
                JSON.stringify({ message: 'Another valid log' })
            ].join('\n');
            fs.writeFileSync(logPath, testLogs);
            
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=10')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(3);
            expect(response.body.logs[1].raw).toBe('This is not JSON');
        });
        
        test('should respect line limit parameter', async () => {
            const logPath = path.join(logsDir, 'combined.log');
            const logs = [];
            for (let i = 0; i < 100; i++) {
                logs.push(JSON.stringify({ message: `Log ${i}` }));
            }
            fs.writeFileSync(logPath, logs.join('\n'));
            
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=50')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(50);
            // Should get the last 50 logs
            expect(response.body.logs[0].message).toBe('Log 50');
            expect(response.body.logs[49].message).toBe('Log 99');
        });
        
        test('should enforce maximum line limit of 500', async () => {
            const logPath = path.join(logsDir, 'combined.log');
            const logs = [];
            for (let i = 0; i < 600; i++) {
                logs.push(JSON.stringify({ message: `Log ${i}` }));
            }
            fs.writeFileSync(logPath, logs.join('\n'));
            
            const response = await request(app)
                .get('/api/admin/logs?type=combined&lines=1000')
                .set('X-Admin-Token', ADMIN_TOKEN);
            
            expect(response.status).toBe(200);
            expect(response.body.logs).toHaveLength(500);
        });
    });
});
