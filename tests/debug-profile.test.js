// @ai-meta: endpoint-test
// @ai-meta: endpoint-test (GET /api/debug/profile/:userId)

/**
 * Unit tests for Debug Profile Endpoint
 * Tests access control, profile completion calculation, and error handling
 */

const request = require('supertest');
const express = require('express');
const debugRoutes = require('../src/routes/debug');

// Mock database
jest.mock('../src/database/db', () => ({
    query: jest.fn()
}));

const db = require('../src/database/db');

describe('Debug Profile Endpoint', () => {
    let app;
    let originalEnv;

    beforeEach(() => {
        // Save original env
        originalEnv = { ...process.env };

        // Create fresh app for each test
        app = express();
        app.use(express.json());
        
        // Mock traceId middleware
        app.use((req, res, next) => {
            req.traceId = 'test-trace-id-123';
            next();
        });
        
        app.use('/api/debug', debugRoutes);

        // Clear all mocks
        jest.clearAllMocks();
    });

    afterEach(() => {
        // Restore env
        process.env = originalEnv;
    });

    describe('Access Control', () => {
        test('allows access in development environment', async () => {
            process.env.NODE_ENV = 'development';
            
            // Mock user exists
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            // Mock section queries
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // job_preferences
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // profile
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // eligibility
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // screening

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user_id', 1);
        });

        test('allows access in test environment', async () => {
            process.env.NODE_ENV = 'test';
            
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(200);
        });

        test('blocks access in production without admin token', async () => {
            process.env.NODE_ENV = 'production';
            process.env.ADMIN_TOKEN = 'secret-admin-token';

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        test('allows access in production with valid admin token', async () => {
            process.env.NODE_ENV = 'production';
            process.env.ADMIN_TOKEN = 'secret-admin-token';
            
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const response = await request(app)
                .get('/api/debug/profile/1')
                .set('X-Admin-Token', 'secret-admin-token');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user_id', 1);
        });

        test('blocks access in production with invalid admin token', async () => {
            process.env.NODE_ENV = 'production';
            process.env.ADMIN_TOKEN = 'secret-admin-token';

            const response = await request(app)
                .get('/api/debug/profile/1')
                .set('X-Admin-Token', 'wrong-token');

            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        test('blocks access in production when ADMIN_TOKEN not configured', async () => {
            process.env.NODE_ENV = 'production';
            delete process.env.ADMIN_TOKEN;

            const response = await request(app)
                .get('/api/debug/profile/1')
                .set('X-Admin-Token', 'any-token');

            expect(response.status).toBe(403);
            expect(response.body.message).toContain('ADMIN_TOKEN not configured');
        });
    });

    describe('Profile Completion Calculation', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        test('returns 100% completion when all core sections complete', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] }); // user exists
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // job_preferences
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // profile
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // eligibility
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // screening

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(200);
            expect(response.body.completion.percentage).toBe(100);
            expect(response.body.completion.sections).toEqual({
                jobPreferences: true,
                profile: true,
                eligibility: true,
                screening: true
            });
        });

        test('returns 67% completion with 2 of 3 core sections', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // job_preferences - yes
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // profile - yes
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // eligibility - no
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // screening

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(200);
            expect(response.body.completion.percentage).toBe(67);
            expect(response.body.completion.sections.jobPreferences).toBe(true);
            expect(response.body.completion.sections.profile).toBe(true);
            expect(response.body.completion.sections.eligibility).toBe(false);
        });

        test('returns 0% completion when no sections complete', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // job_preferences
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // profile
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // eligibility
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // screening

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(200);
            expect(response.body.completion.percentage).toBe(0);
            expect(response.body.completion.sections).toEqual({
                jobPreferences: false,
                profile: false,
                eligibility: false,
                screening: false
            });
        });

        test('screening section does not affect percentage calculation', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // job_preferences
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // profile
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] }); // eligibility
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] }); // screening - not complete

            const response = await request(app)
                .get('/api/debug/profile/1');

            // Should still be 100% because screening is optional
            expect(response.body.completion.percentage).toBe(100);
            expect(response.body.completion.sections.screening).toBe(false);
        });
    });

    describe('Response Structure', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        test('returns correct response structure', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 123 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const response = await request(app)
                .get('/api/debug/profile/123');

            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('user_id', 123);
            expect(response.body).toHaveProperty('completion');
            expect(response.body.completion).toHaveProperty('percentage');
            expect(response.body.completion).toHaveProperty('sections');
            expect(response.body).toHaveProperty('calculatedAt');
            expect(response.body).toHaveProperty('correlationId');
            
            // Validate ISO 8601 timestamp
            expect(new Date(response.body.calculatedAt).toISOString()).toBe(response.body.calculatedAt);
        });

        test('includes correlationId from traceId middleware', async () => {
            db.query.mockResolvedValueOnce({ rows: [{ id: 1 }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '1' }] });
            db.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.body.correlationId).toBe('test-trace-id-123');
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            process.env.NODE_ENV = 'development';
        });

        test('returns 400 for invalid userId', async () => {
            const response = await request(app)
                .get('/api/debug/profile/invalid');

            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Invalid userId');
        });

        test('returns 404 for non-existent user', async () => {
            db.query.mockResolvedValueOnce({ rows: [] }); // user not found

            const response = await request(app)
                .get('/api/debug/profile/999');

            expect(response.status).toBe(404);
            expect(response.body.error).toBe('User not found');
            expect(response.body.userId).toBe(999);
        });

        test('returns 500 on database error', async () => {
            db.query.mockRejectedValueOnce(new Error('Database connection failed'));

            const response = await request(app)
                .get('/api/debug/profile/1');

            expect(response.status).toBe(500);
            expect(response.body.error).toBe('Internal server error');
        });
    });
});
