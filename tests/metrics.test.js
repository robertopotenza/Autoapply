// @ai-meta: metrics-test
// @ai-meta: performance-api-test

/**
 * Unit tests for Metrics API Endpoints
 * Tests summary endpoint, live SSE streaming, and access control
 */

const request = require('supertest');
const express = require('express');
const metricsRoutes = require('../src/routes/metrics');
const metricsBuffer = require('../src/utils/metricsBuffer');

describe('Metrics API', () => {
    let app;
    let originalEnv;

    beforeAll(() => {
        // Save original env
        originalEnv = { ...process.env };
        
        // Set admin token for tests
        process.env.ADMIN_TOKEN = 'test-admin-token-12345';
    });

    beforeEach(() => {
        // Create fresh Express app for each test
        app = express();
        app.use(express.json());
        app.use('/api/metrics', metricsRoutes);
        
        // Clear metrics buffer
        metricsBuffer.clear();
    });

    afterAll(() => {
        // Restore env
        process.env = originalEnv;
    });

    describe('GET /api/metrics/summary', () => {
        test('requires admin token', async () => {
            const response = await request(app)
                .get('/api/metrics/summary');
            
            expect(response.status).toBe(403);
            expect(response.body).toHaveProperty('error');
        });

        test('rejects invalid admin token', async () => {
            const response = await request(app)
                .get('/api/metrics/summary')
                .set('X-Admin-Token', 'invalid-token');
            
            expect(response.status).toBe(403);
            expect(response.body.error).toBe('Forbidden');
        });

        test('returns empty summary when no metrics', async () => {
            const response = await request(app)
                .get('/api/metrics/summary')
                .set('X-Admin-Token', 'test-admin-token-12345');
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('routes');
            expect(response.body).toHaveProperty('totalRequests', 0);
            expect(response.body.routes).toEqual([]);
        });

        test('returns metrics summary with data', async () => {
            // Add test metrics
            metricsBuffer.add({
                timestamp: new Date().toISOString(),
                method: 'GET',
                route: '/api/test',
                path: '/api/test',
                statusCode: 200,
                durationMs: 150,
                dbTotalMs: 50
            });

            metricsBuffer.add({
                timestamp: new Date().toISOString(),
                method: 'POST',
                route: '/api/test',
                path: '/api/test',
                statusCode: 201,
                durationMs: 200,
                dbTotalMs: 75
            });

            const response = await request(app)
                .get('/api/metrics/summary')
                .set('X-Admin-Token', 'test-admin-token-12345');
            
            expect(response.status).toBe(200);
            expect(response.body.totalRequests).toBe(2);
            expect(response.body.routes).toHaveLength(1);
            
            const route = response.body.routes[0];
            expect(route.route).toBe('/api/test');
            expect(route.count).toBe(2);
            expect(route.avgDuration).toBe(175); // (150 + 200) / 2
            expect(route.avgDbTime).toBe(62.5); // (50 + 75) / 2
            expect(route.successRate).toBe(100);
        });

        test('respects time window parameter', async () => {
            // Add old metric (2 hours ago)
            const oldMetric = {
                timestamp: new Date(Date.now() - 7200000).toISOString(),
                method: 'GET',
                route: '/api/old',
                path: '/api/old',
                statusCode: 200,
                durationMs: 100
            };
            metricsBuffer.add(oldMetric);

            // Add recent metric
            const recentMetric = {
                timestamp: new Date().toISOString(),
                method: 'GET',
                route: '/api/recent',
                path: '/api/recent',
                statusCode: 200,
                durationMs: 100
            };
            metricsBuffer.add(recentMetric);

            // Query with 1 hour window
            const response = await request(app)
                .get('/api/metrics/summary?window=1')
                .set('X-Admin-Token', 'test-admin-token-12345');
            
            expect(response.status).toBe(200);
            // Should only include recent metric
            expect(response.body.totalRequests).toBe(1);
            expect(response.body.routes[0].route).toBe('/api/recent');
        });

        test('calculates success rate correctly', async () => {
            // Add successful requests
            for (let i = 0; i < 8; i++) {
                metricsBuffer.add({
                    timestamp: new Date().toISOString(),
                    method: 'GET',
                    route: '/api/test',
                    path: '/api/test',
                    statusCode: 200,
                    durationMs: 100
                });
            }

            // Add failed requests
            for (let i = 0; i < 2; i++) {
                metricsBuffer.add({
                    timestamp: new Date().toISOString(),
                    method: 'GET',
                    route: '/api/test',
                    path: '/api/test',
                    statusCode: 500,
                    durationMs: 150
                });
            }

            const response = await request(app)
                .get('/api/metrics/summary')
                .set('X-Admin-Token', 'test-admin-token-12345');
            
            expect(response.status).toBe(200);
            const route = response.body.routes[0];
            expect(route.successRate).toBe(80); // 8 out of 10
            expect(route.errorCount).toBe(2);
            expect(route.successCount).toBe(8);
        });

        test('calculates P95 duration', async () => {
            // Add metrics with varying durations
            const durations = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
            durations.forEach(duration => {
                metricsBuffer.add({
                    timestamp: new Date().toISOString(),
                    method: 'GET',
                    route: '/api/test',
                    path: '/api/test',
                    statusCode: 200,
                    durationMs: duration
                });
            });

            const response = await request(app)
                .get('/api/metrics/summary')
                .set('X-Admin-Token', 'test-admin-token-12345');
            
            expect(response.status).toBe(200);
            const route = response.body.routes[0];
            expect(route.p95Duration).toBe(100); // 95th percentile of 10 items
        });
    });

    describe('GET /api/metrics/health', () => {
        test('requires admin token', async () => {
            const response = await request(app)
                .get('/api/metrics/health');
            
            expect(response.status).toBe(403);
        });

        test('returns health status', async () => {
            const response = await request(app)
                .get('/api/metrics/health')
                .set('X-Admin-Token', 'test-admin-token-12345');
            
            expect(response.status).toBe(200);
            expect(response.body).toHaveProperty('status', 'operational');
            expect(response.body).toHaveProperty('bufferSize');
            expect(response.body).toHaveProperty('timestamp');
        });
    });

    describe('GET /api/metrics/live', () => {
        test('requires admin token', async () => {
            const response = await request(app)
                .get('/api/metrics/live');
            
            expect(response.status).toBe(403);
        });

        // SSE tests are skipped as they require special handling
        // Manual testing required for live streaming functionality
        test.skip('starts SSE stream with valid token', () => {
            // This requires special SSE client testing
        });
    });

    describe('Access Control', () => {
        test('rejects when ADMIN_TOKEN not configured', async () => {
            delete process.env.ADMIN_TOKEN;

            const response = await request(app)
                .get('/api/metrics/summary');
            
            expect(response.status).toBe(403);
            expect(response.body.message).toContain('not configured');

            // Restore token
            process.env.ADMIN_TOKEN = 'test-admin-token-12345';
        });
    });
});
