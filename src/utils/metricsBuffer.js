/**
 * In-Memory Metrics Buffer
 * 
 * Stores performance metrics in a circular buffer for real-time monitoring.
 * Used by the metrics API endpoints to provide live performance data.
 * 
 * Features:
 * - Circular buffer with configurable max size
 * - Rolling window statistics (1 hour default)
 * - Route-level aggregation
 * - Thread-safe operations
 * 
 * @module metricsBuffer
 */

const EventEmitter = require('events');

class MetricsBuffer extends EventEmitter {
    constructor(maxSize = 10000) {
        super();
        this.maxSize = maxSize;
        this.buffer = [];
        this.index = 0;
    }

    /**
     * Add a performance metric to the buffer
     * @param {Object} metric - Performance metric object
     */
    add(metric) {
        if (this.buffer.length < this.maxSize) {
            this.buffer.push(metric);
        } else {
            // Circular buffer - overwrite oldest
            this.buffer[this.index] = metric;
            this.index = (this.index + 1) % this.maxSize;
        }
        
        // Emit event for SSE subscribers
        this.emit('metric', metric);
    }

    /**
     * Get all metrics within a time window
     * @param {number} windowMs - Time window in milliseconds (default: 1 hour)
     * @returns {Array} Array of metrics
     */
    getMetrics(windowMs = 3600000) {
        const now = Date.now();
        const cutoff = new Date(now - windowMs);
        
        return this.buffer.filter(m => {
            const timestamp = new Date(m.timestamp);
            return timestamp >= cutoff;
        });
    }

    /**
     * Get summary statistics per route for a time window
     * @param {number} windowMs - Time window in milliseconds (default: 1 hour)
     * @returns {Object} Route-level statistics
     */
    getSummary(windowMs = 3600000) {
        const metrics = this.getMetrics(windowMs);
        const routeStats = {};

        metrics.forEach(m => {
            const route = m.route || m.path;
            if (!routeStats[route]) {
                routeStats[route] = {
                    route,
                    count: 0,
                    totalDuration: 0,
                    totalDbTime: 0,
                    successCount: 0,
                    errorCount: 0,
                    durations: [],
                    dbTimes: []
                };
            }

            const stats = routeStats[route];
            stats.count++;
            stats.totalDuration += m.durationMs || 0;
            stats.durations.push(m.durationMs || 0);

            if (m.dbTotalMs !== undefined) {
                stats.totalDbTime += m.dbTotalMs;
                stats.dbTimes.push(m.dbTotalMs);
            }

            if (m.statusCode >= 200 && m.statusCode < 400) {
                stats.successCount++;
            } else {
                stats.errorCount++;
            }
        });

        // Calculate averages and percentiles
        Object.keys(routeStats).forEach(route => {
            const stats = routeStats[route];
            stats.avgDuration = stats.count > 0 ? stats.totalDuration / stats.count : 0;
            stats.avgDbTime = stats.dbTimes.length > 0 ? stats.totalDbTime / stats.dbTimes.length : 0;
            stats.successRate = stats.count > 0 ? (stats.successCount / stats.count) * 100 : 0;

            // Calculate p95 if we have enough data
            if (stats.durations.length > 0) {
                stats.durations.sort((a, b) => a - b);
                const p95Index = Math.floor(stats.durations.length * 0.95);
                stats.p95Duration = stats.durations[p95Index] || 0;
            }

            // Clean up temporary arrays
            delete stats.durations;
            delete stats.dbTimes;
            delete stats.totalDuration;
            delete stats.totalDbTime;
        });

        return {
            windowMs,
            routes: Object.values(routeStats),
            totalRequests: metrics.length
        };
    }

    /**
     * Clear all metrics
     */
    clear() {
        this.buffer = [];
        this.index = 0;
    }

    /**
     * Get buffer size
     * @returns {number} Current buffer size
     */
    size() {
        return this.buffer.length;
    }
}

// Singleton instance
const metricsBuffer = new MetricsBuffer();

module.exports = metricsBuffer;
