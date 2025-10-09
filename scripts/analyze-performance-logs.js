#!/usr/bin/env node
/**
 * Performance Log Analyzer with Anomaly Detection
 * 
 * Analyzes performance logs to detect anomalies and performance issues.
 * Supports alerting via Slack webhooks and email.
 * 
 * Anomaly Detection Rules:
 * - Request duration > ALERTS_THRESHOLD_MS (default: 500ms)
 * - Database time > 100ms
 * - Request duration > 3x rolling average for route
 * 
 * Environment Variables:
 * - ALERTS_ENABLED: Enable alerting (default: false)
 * - ALERTS_SLACK_WEBHOOK: Slack webhook URL
 * - ALERTS_THRESHOLD_MS: Threshold for slow requests (default: 500)
 * - PERF_LOG_ENABLED: Must be true to collect metrics
 * 
 * Usage:
 *   node scripts/analyze-performance-logs.js
 *   node scripts/analyze-performance-logs.js --output=report.json
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

// Load environment variables
try {
    require('dotenv-flow').config({ silent: true });
} catch (error) {
    // dotenv-flow not available
}

const ALERTS_ENABLED = process.env.ALERTS_ENABLED === 'true';
const ALERTS_SLACK_WEBHOOK = process.env.ALERTS_SLACK_WEBHOOK;
const ALERTS_THRESHOLD_MS = parseInt(process.env.ALERTS_THRESHOLD_MS || '500', 10);
const DB_THRESHOLD_MS = 100;
const SPIKE_MULTIPLIER = 3;

class PerformanceAnalyzer {
    constructor() {
        this.metrics = [];
        this.anomalies = [];
        this.routeStats = {};
    }

    /**
     * Load metrics from the in-memory metrics buffer or log files
     */
    loadMetrics() {
        console.log('📊 Loading performance metrics...\n');

        // Try to load from log files
        const logsDir = path.join(__dirname, '../logs');
        const combinedLogPath = path.join(logsDir, 'combined.log');

        if (!fs.existsSync(combinedLogPath)) {
            console.log('⚠️  No log files found. Ensure PERF_LOG_ENABLED=true');
            return;
        }

        // Read and parse log file
        const logContent = fs.readFileSync(combinedLogPath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                
                // Only process performance logs
                if (logEntry.message === 'Request performance' && logEntry.durationMs) {
                    this.metrics.push({
                        timestamp: logEntry.timestamp,
                        route: logEntry.route,
                        method: logEntry.method,
                        path: logEntry.path,
                        durationMs: logEntry.durationMs,
                        dbTotalMs: logEntry.dbTotalMs || 0,
                        statusCode: logEntry.statusCode,
                        correlationId: logEntry.correlationId
                    });
                }
            } catch (error) {
                // Skip invalid JSON lines
            }
        }

        console.log(`✅ Loaded ${this.metrics.length} performance metrics\n`);
    }

    /**
     * Calculate rolling averages per route
     */
    calculateRouteStatistics() {
        console.log('📈 Calculating route statistics...\n');

        const routes = {};

        for (const metric of this.metrics) {
            const route = metric.route || metric.path;
            
            if (!routes[route]) {
                routes[route] = {
                    route,
                    count: 0,
                    totalDuration: 0,
                    durations: [],
                    totalDbTime: 0
                };
            }

            const stats = routes[route];
            stats.count++;
            stats.totalDuration += metric.durationMs;
            stats.durations.push(metric.durationMs);
            stats.totalDbTime += metric.dbTotalMs;
        }

        // Calculate averages
        for (const route in routes) {
            const stats = routes[route];
            stats.avgDuration = stats.totalDuration / stats.count;
            stats.avgDbTime = stats.totalDbTime / stats.count;
            
            // Calculate median
            stats.durations.sort((a, b) => a - b);
            const mid = Math.floor(stats.durations.length / 2);
            stats.medianDuration = stats.durations.length % 2 === 0
                ? (stats.durations[mid - 1] + stats.durations[mid]) / 2
                : stats.durations[mid];
        }

        this.routeStats = routes;

        console.log(`✅ Analyzed ${Object.keys(routes).length} unique routes\n`);
    }

    /**
     * Detect performance anomalies
     */
    detectAnomalies() {
        console.log('🔍 Detecting anomalies...\n');

        for (const metric of this.metrics) {
            const route = metric.route || metric.path;
            const stats = this.routeStats[route];

            if (!stats) continue;

            const anomaly = {
                timestamp: metric.timestamp,
                route,
                method: metric.method,
                correlationId: metric.correlationId,
                durationMs: metric.durationMs,
                dbTotalMs: metric.dbTotalMs,
                statusCode: metric.statusCode,
                reasons: []
            };

            // Check if duration exceeds threshold
            if (metric.durationMs > ALERTS_THRESHOLD_MS) {
                anomaly.reasons.push(`Duration ${metric.durationMs.toFixed(2)}ms exceeds threshold ${ALERTS_THRESHOLD_MS}ms`);
            }

            // Check if DB time is excessive
            if (metric.dbTotalMs > DB_THRESHOLD_MS) {
                anomaly.reasons.push(`Database time ${metric.dbTotalMs.toFixed(2)}ms exceeds threshold ${DB_THRESHOLD_MS}ms`);
            }

            // Check for spikes (>3x average)
            if (metric.durationMs > stats.avgDuration * SPIKE_MULTIPLIER) {
                anomaly.reasons.push(`Duration ${metric.durationMs.toFixed(2)}ms is ${SPIKE_MULTIPLIER}x average ${stats.avgDuration.toFixed(2)}ms`);
            }

            // If any anomalies detected, add to list
            if (anomaly.reasons.length > 0) {
                this.anomalies.push(anomaly);
            }
        }

        console.log(`⚠️  Detected ${this.anomalies.length} anomalies\n`);
    }

    /**
     * Generate summary report
     */
    generateSummary() {
        const summary = {
            timestamp: new Date().toISOString(),
            totalMetrics: this.metrics.length,
            totalAnomalies: this.anomalies.length,
            thresholds: {
                durationMs: ALERTS_THRESHOLD_MS,
                dbTimeMs: DB_THRESHOLD_MS,
                spikeMultiplier: SPIKE_MULTIPLIER
            },
            routes: Object.values(this.routeStats).map(stats => ({
                route: stats.route,
                count: stats.count,
                avgDuration: parseFloat(stats.avgDuration.toFixed(2)),
                medianDuration: parseFloat(stats.medianDuration.toFixed(2)),
                avgDbTime: parseFloat(stats.avgDbTime.toFixed(2))
            })),
            anomalies: this.anomalies.map(a => ({
                timestamp: a.timestamp,
                route: a.route,
                method: a.method,
                durationMs: a.durationMs,
                dbTotalMs: a.dbTotalMs,
                statusCode: a.statusCode,
                reasons: a.reasons
            }))
        };

        return summary;
    }

    /**
     * Send Slack alert
     */
    async sendSlackAlert(summary) {
        if (!ALERTS_SLACK_WEBHOOK) {
            console.log('⚠️  ALERTS_SLACK_WEBHOOK not configured, skipping Slack alert\n');
            return;
        }

        const message = {
            text: '🚨 Performance Anomalies Detected',
            blocks: [
                {
                    type: 'header',
                    text: {
                        type: 'plain_text',
                        text: '🚨 Performance Anomalies Detected'
                    }
                },
                {
                    type: 'section',
                    fields: [
                        {
                            type: 'mrkdwn',
                            text: `*Total Metrics:*\n${summary.totalMetrics}`
                        },
                        {
                            type: 'mrkdwn',
                            text: `*Anomalies:*\n${summary.totalAnomalies}`
                        }
                    ]
                }
            ]
        };

        // Add top anomalies
        if (summary.anomalies.length > 0) {
            const topAnomalies = summary.anomalies
                .slice(0, 5)
                .map(a => `• \`${a.route}\` - ${a.durationMs.toFixed(0)}ms - ${a.reasons[0]}`)
                .join('\n');

            message.blocks.push({
                type: 'section',
                text: {
                    type: 'mrkdwn',
                    text: `*Top Anomalies:*\n${topAnomalies}`
                }
            });
        }

        return new Promise((resolve, reject) => {
            const webhookUrl = new URL(ALERTS_SLACK_WEBHOOK);
            const data = JSON.stringify(message);

            const options = {
                hostname: webhookUrl.hostname,
                path: webhookUrl.pathname + webhookUrl.search,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, (res) => {
                if (res.statusCode === 200) {
                    console.log('✅ Slack alert sent successfully\n');
                    resolve();
                } else {
                    console.error(`❌ Slack alert failed: HTTP ${res.statusCode}\n`);
                    reject(new Error(`HTTP ${res.statusCode}`));
                }
            });

            req.on('error', (error) => {
                console.error('❌ Slack alert error:', error.message);
                reject(error);
            });

            req.write(data);
            req.end();
        });
    }

    /**
     * Save report to file
     */
    saveReport(summary, outputPath) {
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const filename = outputPath || `performance-anomalies-${new Date().toISOString().split('T')[0]}.json`;
        const filepath = path.join(reportsDir, filename);

        fs.writeFileSync(filepath, JSON.stringify(summary, null, 2));
        console.log(`💾 Report saved to: ${filepath}\n`);

        return filepath;
    }

    /**
     * Print summary to console
     */
    printSummary(summary) {
        console.log('═══════════════════════════════════════════════════');
        console.log('           PERFORMANCE ANALYSIS SUMMARY            ');
        console.log('═══════════════════════════════════════════════════\n');

        console.log(`📊 Total Metrics: ${summary.totalMetrics}`);
        console.log(`⚠️  Total Anomalies: ${summary.totalAnomalies}`);
        console.log(`\n🎯 Thresholds:`);
        console.log(`   - Duration: ${summary.thresholds.durationMs}ms`);
        console.log(`   - DB Time: ${summary.thresholds.dbTimeMs}ms`);
        console.log(`   - Spike Multiplier: ${summary.thresholds.spikeMultiplier}x`);

        if (summary.routes.length > 0) {
            console.log(`\n📈 Top Routes by Request Count:`);
            const topRoutes = summary.routes
                .sort((a, b) => b.count - a.count)
                .slice(0, 10);

            topRoutes.forEach(route => {
                console.log(`   ${route.route}`);
                console.log(`     Requests: ${route.count} | Avg: ${route.avgDuration}ms | Median: ${route.medianDuration}ms`);
            });
        }

        if (summary.anomalies.length > 0) {
            console.log(`\n🚨 Recent Anomalies (top 10):`);
            const recentAnomalies = summary.anomalies.slice(0, 10);

            recentAnomalies.forEach(anomaly => {
                console.log(`\n   Route: ${anomaly.route}`);
                console.log(`   Duration: ${anomaly.durationMs.toFixed(2)}ms | DB: ${anomaly.dbTotalMs.toFixed(2)}ms`);
                console.log(`   Reasons:`);
                anomaly.reasons.forEach(reason => {
                    console.log(`     - ${reason}`);
                });
            });
        } else {
            console.log(`\n✅ No anomalies detected! Performance is healthy.`);
        }

        console.log('\n═══════════════════════════════════════════════════\n');
    }
}

// Main execution
async function main() {
    console.log('\n🔍 AutoApply Performance Log Analyzer\n');

    const analyzer = new PerformanceAnalyzer();

    // Load metrics
    analyzer.loadMetrics();

    if (analyzer.metrics.length === 0) {
        console.log('⚠️  No metrics to analyze. Ensure PERF_LOG_ENABLED=true and the server has been running.\n');
        process.exit(0);
    }

    // Calculate statistics
    analyzer.calculateRouteStatistics();

    // Detect anomalies
    analyzer.detectAnomalies();

    // Generate summary
    const summary = analyzer.generateSummary();

    // Print summary
    analyzer.printSummary(summary);

    // Save report
    const outputArg = process.argv.find(arg => arg.startsWith('--output='));
    const outputFile = outputArg ? outputArg.split('=')[1] : null;
    analyzer.saveReport(summary, outputFile);

    // Send alerts if enabled
    if (ALERTS_ENABLED && summary.totalAnomalies > 0) {
        console.log('📢 Sending alerts...\n');
        try {
            await analyzer.sendSlackAlert(summary);
        } catch (error) {
            console.error('❌ Failed to send alert:', error.message);
        }
    }

    console.log('✅ Analysis complete!\n');
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = PerformanceAnalyzer;
