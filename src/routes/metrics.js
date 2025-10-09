const express = require('express');
const router = express.Router();
const metricsBuffer = require('../utils/metricsBuffer');
const { Logger } = require('../utils/logger');

const logger = new Logger('Metrics');

/**
 * Access control middleware for metrics endpoints
 * Requires ADMIN_TOKEN in X-Admin-Token header
 */
function metricsAccessControl(req, res, next) {
    const adminToken = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!expectedToken) {
        logger.warn('ADMIN_TOKEN not configured', {
            path: req.path,
            ip: req.ip
        });
        return res.status(403).json({
            error: 'Metrics endpoints are disabled',
            message: 'ADMIN_TOKEN not configured'
        });
    }
    
    if (adminToken !== expectedToken) {
        logger.warn('Invalid admin token attempt', {
            path: req.path,
            ip: req.ip,
            hasToken: !!adminToken
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or missing X-Admin-Token header'
        });
    }
    
    next();
}

/**
 * GET /api/metrics/summary
 * 
 * Returns aggregated performance metrics summary for a rolling time window.
 * 
 * Query Parameters:
 * - window: Time window in hours (default: 1)
 * 
 * Response:
 * {
 *   windowMs: number,
 *   totalRequests: number,
 *   routes: [
 *     {
 *       route: string,
 *       count: number,
 *       avgDuration: number,
 *       avgDbTime: number,
 *       successRate: number,
 *       successCount: number,
 *       errorCount: number,
 *       p95Duration: number
 *     }
 *   ]
 * }
 */
router.get('/summary', metricsAccessControl, (req, res) => {
    try {
        const windowHours = parseFloat(req.query.window || '1');
        const windowMs = windowHours * 3600000;
        
        const summary = metricsBuffer.getSummary(windowMs);
        
        // Round all numbers to 2 decimal places for cleaner output
        summary.routes = summary.routes.map(route => ({
            ...route,
            avgDuration: parseFloat(route.avgDuration.toFixed(2)),
            avgDbTime: parseFloat(route.avgDbTime.toFixed(2)),
            successRate: parseFloat(route.successRate.toFixed(2)),
            p95Duration: route.p95Duration ? parseFloat(route.p95Duration.toFixed(2)) : 0
        }));
        
        res.json(summary);
    } catch (error) {
        logger.error('Error generating metrics summary', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            error: 'Failed to generate metrics summary',
            message: error.message
        });
    }
});

/**
 * GET /api/metrics/live
 * 
 * Streams real-time performance metrics via Server-Sent Events (SSE).
 * 
 * Each event contains a single performance metric as JSON.
 * 
 * Usage:
 * const eventSource = new EventSource('/api/metrics/live?token=YOUR_ADMIN_TOKEN');
 * eventSource.onmessage = (event) => {
 *   const metric = JSON.parse(event.data);
 *   console.log(metric);
 * };
 */
router.get('/live', (req, res) => {
    // Check admin token from query param or header
    const adminToken = req.query.token || req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!expectedToken || adminToken !== expectedToken) {
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or missing admin token'
        });
    }
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    
    // Send initial connection message
    res.write(`data: ${JSON.stringify({ type: 'connected', timestamp: new Date().toISOString() })}\n\n`);
    
    // Handler for new metrics
    const metricHandler = (metric) => {
        try {
            res.write(`data: ${JSON.stringify(metric)}\n\n`);
        } catch (error) {
            logger.error('Error writing SSE metric', { error: error.message });
        }
    };
    
    // Subscribe to metrics buffer events
    metricsBuffer.on('metric', metricHandler);
    
    // Send heartbeat every 30 seconds to keep connection alive
    const heartbeat = setInterval(() => {
        try {
            res.write(`: heartbeat ${Date.now()}\n\n`);
        } catch (error) {
            clearInterval(heartbeat);
        }
    }, 30000);
    
    // Clean up on connection close
    req.on('close', () => {
        clearInterval(heartbeat);
        metricsBuffer.removeListener('metric', metricHandler);
        logger.info('SSE client disconnected');
    });
});

/**
 * GET /api/metrics/health
 * 
 * Health check endpoint for metrics service
 */
router.get('/health', metricsAccessControl, (req, res) => {
    res.json({
        status: 'operational',
        bufferSize: metricsBuffer.size(),
        timestamp: new Date().toISOString()
    });
});

module.exports = router;
