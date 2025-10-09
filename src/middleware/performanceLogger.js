const crypto = require('crypto');
const { Logger } = require('../utils/logger');

const logger = new Logger('Performance');

/**
 * Performance Logger Middleware
 * 
 * Logs structured performance metrics for each HTTP request.
 * 
 * Features:
 * - High-resolution request/response timing (process.hrtime.bigint)
 * - Route, method, status, userId tracking
 * - Request/response size tracking (bytes in/out)
 * - Database timing injection via res.locals.dbTimings
 * - PII redaction (email, password, tokens)
 * - Configurable sampling rate
 * - Includes correlationId/requestId for distributed tracing
 * 
 * Environment Variables:
 * - PERF_LOG_ENABLED: Enable performance logging (default: false)
 * - PERF_LOG_SAMPLE_RATE: Sampling rate 0.0-1.0 (default: 1.0)
 * 
 * Usage:
 * ```javascript
 * const performanceLogger = require('./middleware/performanceLogger');
 * app.use(performanceLogger());
 * 
 * // In route handler, add DB timings:
 * res.locals.dbTimings = [15.3, 8.7]; // milliseconds
 * ```
 * 
 * @returns {Function} Express middleware function
 */
function performanceLogger() {
    const isEnabled = process.env.PERF_LOG_ENABLED === 'true';
    const sampleRate = parseFloat(process.env.PERF_LOG_SAMPLE_RATE || '1.0');

    // Validate sample rate
    const validSampleRate = (!isNaN(sampleRate) && sampleRate >= 0 && sampleRate <= 1) 
        ? sampleRate 
        : 1.0;

    return (req, res, next) => {
        // Skip if disabled
        if (!isEnabled) {
            return next();
        }

        // Apply sampling
        if (validSampleRate < 1.0 && Math.random() > validSampleRate) {
            return next();
        }

        // Start timing
        const startTime = process.hrtime.bigint();
        const startDate = new Date();

        // Generate correlation ID if not present (from traceId middleware)
        const correlationId = req.traceId || crypto.randomUUID();
        req.correlationId = correlationId;

        // Track request size
        const requestSize = parseInt(req.headers['content-length'] || '0', 10);

        // Capture original end function
        const originalEnd = res.end;

        // Override end function to capture response
        res.end = function (chunk, encoding) {
            // Restore original end
            res.end = originalEnd;

            // Calculate duration
            const endTime = process.hrtime.bigint();
            const durationMs = Number(endTime - startTime) / 1_000_000;

            // Calculate response size
            let responseSize = 0;
            if (chunk) {
                responseSize = Buffer.isBuffer(chunk) 
                    ? chunk.length 
                    : Buffer.byteLength(chunk, encoding || 'utf8');
            }
            if (res.getHeader('content-length')) {
                responseSize = parseInt(res.getHeader('content-length'), 10);
            }

            // Build performance log
            const perfLog = {
                timestamp: startDate.toISOString(),
                correlationId,
                method: req.method,
                route: req.route ? req.route.path : req.path,
                path: req.path,
                statusCode: res.statusCode,
                durationMs: parseFloat(durationMs.toFixed(2)),
                requestBytes: requestSize,
                responseBytes: responseSize,
            };

            // Add userId if available (from auth middleware)
            if (req.user && req.user.userId) {
                perfLog.userId = req.user.userId;
            } else if (req.user && req.user.user_id) {
                perfLog.userId = req.user.user_id;
            }

            // Add database timings if available
            if (res.locals.dbTimings && Array.isArray(res.locals.dbTimings)) {
                const dbTimings = res.locals.dbTimings.filter(t => typeof t === 'number');
                if (dbTimings.length > 0) {
                    perfLog.dbTimingsMs = dbTimings.map(t => parseFloat(t.toFixed(2)));
                    perfLog.dbTotalMs = parseFloat(dbTimings.reduce((sum, t) => sum + t, 0).toFixed(2));
                }
            }

            // Redact PII from request body if logged
            // Note: We don't log the full body by default, but if needed in the future
            if (req.body && typeof req.body === 'object') {
                const redactedBody = redactPII(req.body);
                // Only include if debugging or specific flag is set
                if (process.env.PERF_LOG_INCLUDE_BODY === 'true') {
                    perfLog.requestBody = redactedBody;
                }
            }

            // Log as single-line JSON
            logger.info('Request performance', perfLog);

            // Call original end
            res.end.apply(res, [chunk, encoding]);
        };

        next();
    };
}

/**
 * Redact PII fields from an object
 * 
 * @param {Object} obj - Object to redact
 * @returns {Object} Redacted copy of object
 */
function redactPII(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }

    const piiFields = [
        'email', 
        'password', 
        'token', 
        'accessToken', 
        'refreshToken',
        'access_token',
        'refresh_token',
        'apiKey',
        'api_key',
        'secret',
        'ssn',
        'phone',
        'phoneNumber',
        'phone_number',
        'creditCard',
        'credit_card'
    ];

    const redacted = Array.isArray(obj) ? [] : {};

    for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
            const lowerKey = key.toLowerCase();
            
            // Check if key matches PII field (case-insensitive)
            const isPII = piiFields.some(field => lowerKey.includes(field.toLowerCase()));
            
            if (isPII) {
                redacted[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                // Recursively redact nested objects
                redacted[key] = redactPII(obj[key]);
            } else {
                redacted[key] = obj[key];
            }
        }
    }

    return redacted;
}

module.exports = performanceLogger;
module.exports.redactPII = redactPII; // Export for testing
