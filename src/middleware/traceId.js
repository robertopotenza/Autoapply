const crypto = require('crypto');

/**
 * TraceId Middleware
 * Generates a unique trace ID for each request for observability
 * Sets X-Trace-Id response header and logs incoming requests
 */
function traceIdMiddleware(logger) {
    return (req, res, next) => {
        // Generate unique trace ID using crypto.randomUUID (fallback to timestamp-based)
        let traceId;
        try {
            traceId = crypto.randomUUID();
        } catch (error) {
            // Fallback for older Node versions
            traceId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        }
        
        // Attach traceId to request object for use by route handlers
        req.traceId = traceId;
        
        // Set X-Trace-Id response header
        res.setHeader('X-Trace-Id', traceId);
        
        // Log incoming request with traceId
        logger.info('Incoming request', {
            traceId,
            method: req.method,
            path: req.path,
            ip: req.ip || req.connection.remoteAddress
        });
        
        next();
    };
}

module.exports = traceIdMiddleware;
