#!/usr/bin/env node
/**
 * AI-Assisted Trace Analysis Tool
 * 
 * Analyzes performance traces and generates optimization recommendations
 * using AI (OpenAI GPT or local LLM).
 * 
 * Features:
 * - Parses performance logs
 * - Calculates mean, median, P95, P99 latency per route
 * - Identifies bottlenecks and patterns
 * - Generates AI-powered optimization recommendations
 * - Produces markdown reports
 * 
 * Environment Variables:
 * - OPENAI_API_KEY: OpenAI API key for AI analysis
 * - TRACE_ANALYSIS_ENABLED: Enable trace analysis (default: false)
 * - TRACE_ANALYSIS_PERIOD_HOURS: Analysis period (default: 24)
 * 
 * Usage:
 *   node scripts/analyze-traces-with-ai.js
 *   node scripts/analyze-traces-with-ai.js --period=48
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

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const TRACE_ANALYSIS_ENABLED = process.env.TRACE_ANALYSIS_ENABLED === 'true';
const TRACE_ANALYSIS_PERIOD_HOURS = parseInt(process.env.TRACE_ANALYSIS_PERIOD_HOURS || '24', 10);

class TraceAnalyzer {
    constructor() {
        this.traces = [];
        this.routeStats = {};
        this.analysis = {};
    }

    /**
     * Load traces from log files
     */
    loadTraces(periodHours = TRACE_ANALYSIS_PERIOD_HOURS) {
        console.log(`📊 Loading traces from last ${periodHours} hours...\n`);

        const logsDir = path.join(__dirname, '../logs');
        const combinedLogPath = path.join(logsDir, 'combined.log');

        if (!fs.existsSync(combinedLogPath)) {
            console.log('⚠️  No log files found. Ensure PERF_LOG_ENABLED=true');
            return;
        }

        const cutoffTime = Date.now() - (periodHours * 3600000);
        const logContent = fs.readFileSync(combinedLogPath, 'utf8');
        const lines = logContent.split('\n').filter(line => line.trim());

        for (const line of lines) {
            try {
                const logEntry = JSON.parse(line);
                
                if (logEntry.message === 'Request performance' && logEntry.timestamp) {
                    const timestamp = new Date(logEntry.timestamp).getTime();
                    
                    // Only include traces within the period
                    if (timestamp >= cutoffTime) {
                        this.traces.push({
                            timestamp: logEntry.timestamp,
                            route: logEntry.route || logEntry.path,
                            method: logEntry.method,
                            durationMs: logEntry.durationMs || 0,
                            dbTotalMs: logEntry.dbTotalMs || 0,
                            statusCode: logEntry.statusCode,
                            requestBytes: logEntry.requestBytes || 0,
                            responseBytes: logEntry.responseBytes || 0
                        });
                    }
                }
            } catch (error) {
                // Skip invalid JSON lines
            }
        }

        console.log(`✅ Loaded ${this.traces.length} traces\n`);
    }

    /**
     * Calculate detailed statistics per route
     */
    calculateStatistics() {
        console.log('📈 Calculating performance statistics...\n');

        const routes = {};

        for (const trace of this.traces) {
            const route = trace.route;
            
            if (!routes[route]) {
                routes[route] = {
                    route,
                    method: trace.method,
                    count: 0,
                    durations: [],
                    dbTimes: [],
                    errors: 0,
                    totalResponseSize: 0
                };
            }

            const stats = routes[route];
            stats.count++;
            stats.durations.push(trace.durationMs);
            stats.dbTimes.push(trace.dbTotalMs);
            stats.totalResponseSize += trace.responseBytes;

            if (trace.statusCode >= 400) {
                stats.errors++;
            }
        }

        // Calculate statistics for each route
        for (const route in routes) {
            const stats = routes[route];
            
            // Sort durations for percentile calculations
            stats.durations.sort((a, b) => a - b);
            stats.dbTimes.sort((a, b) => a - b);

            // Calculate mean
            stats.meanDuration = stats.durations.reduce((a, b) => a + b, 0) / stats.count;
            stats.meanDbTime = stats.dbTimes.reduce((a, b) => a + b, 0) / stats.count;

            // Calculate median
            const mid = Math.floor(stats.count / 2);
            stats.medianDuration = stats.count % 2 === 0
                ? (stats.durations[mid - 1] + stats.durations[mid]) / 2
                : stats.durations[mid];

            // Calculate percentiles
            stats.p95Duration = stats.durations[Math.floor(stats.count * 0.95)] || 0;
            stats.p99Duration = stats.durations[Math.floor(stats.count * 0.99)] || 0;
            stats.maxDuration = stats.durations[stats.count - 1];
            stats.minDuration = stats.durations[0];

            // Calculate DB time percentiles
            stats.p95DbTime = stats.dbTimes[Math.floor(stats.count * 0.95)] || 0;
            
            // Calculate error rate
            stats.errorRate = (stats.errors / stats.count) * 100;

            // Calculate average response size
            stats.avgResponseSize = stats.totalResponseSize / stats.count;

            // Calculate DB time as percentage of total
            stats.dbTimePercent = stats.meanDbTime > 0 
                ? (stats.meanDbTime / stats.meanDuration) * 100 
                : 0;

            // Clean up arrays
            delete stats.durations;
            delete stats.dbTimes;
        }

        this.routeStats = routes;

        console.log(`✅ Analyzed ${Object.keys(routes).length} unique routes\n`);
    }

    /**
     * Identify performance bottlenecks
     */
    identifyBottlenecks() {
        console.log('🔍 Identifying bottlenecks...\n');

        const bottlenecks = [];

        for (const route in this.routeStats) {
            const stats = this.routeStats[route];

            // Check for slow routes (P95 > 500ms)
            if (stats.p95Duration > 500) {
                bottlenecks.push({
                    route: stats.route,
                    type: 'slow_response',
                    severity: 'high',
                    value: stats.p95Duration,
                    message: `P95 duration of ${stats.p95Duration.toFixed(0)}ms exceeds 500ms threshold`
                });
            }

            // Check for excessive DB time (> 50% of total)
            if (stats.dbTimePercent > 50) {
                bottlenecks.push({
                    route: stats.route,
                    type: 'excessive_db_time',
                    severity: 'medium',
                    value: stats.dbTimePercent,
                    message: `Database time is ${stats.dbTimePercent.toFixed(1)}% of total response time`
                });
            }

            // Check for high error rates (> 5%)
            if (stats.errorRate > 5) {
                bottlenecks.push({
                    route: stats.route,
                    type: 'high_error_rate',
                    severity: 'high',
                    value: stats.errorRate,
                    message: `Error rate of ${stats.errorRate.toFixed(1)}% exceeds 5% threshold`
                });
            }

            // Check for large response sizes (> 1MB average)
            if (stats.avgResponseSize > 1048576) {
                bottlenecks.push({
                    route: stats.route,
                    type: 'large_response',
                    severity: 'medium',
                    value: stats.avgResponseSize / 1048576,
                    message: `Average response size of ${(stats.avgResponseSize / 1048576).toFixed(2)}MB may impact performance`
                });
            }
        }

        this.analysis.bottlenecks = bottlenecks;

        console.log(`${bottlenecks.length > 0 ? '⚠️' : '✅'} Found ${bottlenecks.length} bottlenecks\n`);
    }

    /**
     * Generate AI recommendations using OpenAI
     */
    async generateAIRecommendations() {
        if (!OPENAI_API_KEY) {
            console.log('⚠️  OPENAI_API_KEY not configured, skipping AI analysis\n');
            this.analysis.recommendations = [{
                category: 'general',
                recommendation: 'AI analysis not available without OpenAI API key'
            }];
            return;
        }

        console.log('🤖 Generating AI recommendations...\n');

        // Prepare context for AI
        const context = {
            totalTraces: this.traces.length,
            periodHours: TRACE_ANALYSIS_PERIOD_HOURS,
            routeCount: Object.keys(this.routeStats).length,
            bottlenecks: this.analysis.bottlenecks,
            topSlowRoutes: Object.values(this.routeStats)
                .sort((a, b) => b.p95Duration - a.p95Duration)
                .slice(0, 5)
                .map(r => ({
                    route: r.route,
                    p95: r.p95Duration,
                    meanDuration: r.meanDuration,
                    dbTimePercent: r.dbTimePercent,
                    count: r.count
                }))
        };

        const prompt = `You are a performance optimization expert. Analyze the following performance data and provide specific, actionable recommendations.

Performance Data:
- Total Traces: ${context.totalTraces}
- Analysis Period: ${context.periodHours} hours
- Unique Routes: ${context.routeCount}
- Bottlenecks Found: ${context.bottlenecks.length}

Top Slow Routes:
${context.topSlowRoutes.map(r => 
`- ${r.route}: P95=${r.p95.toFixed(0)}ms, Mean=${r.meanDuration.toFixed(0)}ms, DB=${r.dbTimePercent.toFixed(1)}%, Requests=${r.count}`
).join('\n')}

Bottlenecks:
${context.bottlenecks.map(b => `- ${b.route}: ${b.message}`).join('\n')}

Provide 5-7 specific optimization recommendations focusing on:
1. Database query optimization (indexes, query patterns, N+1 problems)
2. Caching strategies (Redis, in-memory, CDN)
3. API design improvements (pagination, batching, response size)
4. Code-level optimizations
5. Infrastructure/architecture suggestions

Format each recommendation as a category and specific action.`;

        try {
            const recommendations = await this.callOpenAI(prompt);
            this.analysis.recommendations = recommendations;
            console.log('✅ AI recommendations generated\n');
        } catch (error) {
            console.error('❌ Failed to generate AI recommendations:', error.message);
            this.analysis.recommendations = [{
                category: 'error',
                recommendation: `AI analysis failed: ${error.message}`
            }];
        }
    }

    /**
     * Call OpenAI API
     */
    async callOpenAI(prompt) {
        return new Promise((resolve, reject) => {
            const data = JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'You are a performance optimization expert for Node.js and PostgreSQL applications.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.7,
                max_tokens: 1000
            });

            const options = {
                hostname: 'api.openai.com',
                path: '/v1/chat/completions',
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${OPENAI_API_KEY}`,
                    'Content-Length': data.length
                }
            };

            const req = https.request(options, (res) => {
                let body = '';

                res.on('data', (chunk) => {
                    body += chunk;
                });

                res.on('end', () => {
                    try {
                        const response = JSON.parse(body);
                        if (response.choices && response.choices[0]) {
                            const content = response.choices[0].message.content;
                            // Parse recommendations from response
                            const recommendations = this.parseRecommendations(content);
                            resolve(recommendations);
                        } else {
                            reject(new Error('Invalid OpenAI response'));
                        }
                    } catch (error) {
                        reject(error);
                    }
                });
            });

            req.on('error', reject);
            req.write(data);
            req.end();
        });
    }

    /**
     * Parse AI recommendations from text
     */
    parseRecommendations(text) {
        const recommendations = [];
        const lines = text.split('\n').filter(line => line.trim());

        let currentCategory = 'general';
        let currentRec = '';

        for (const line of lines) {
            // Look for numbered items or categories
            if (/^\d+\./.test(line) || /^[*-]/.test(line)) {
                if (currentRec) {
                    recommendations.push({
                        category: currentCategory,
                        recommendation: currentRec.trim()
                    });
                }
                currentRec = line.replace(/^[\d*.-]+\s*/, '');
            } else if (line.includes(':')) {
                // Potential category
                const parts = line.split(':');
                if (parts[0].length < 50) {
                    currentCategory = parts[0].trim().toLowerCase();
                    currentRec = parts.slice(1).join(':').trim();
                } else {
                    currentRec += ' ' + line;
                }
            } else {
                currentRec += ' ' + line;
            }
        }

        if (currentRec) {
            recommendations.push({
                category: currentCategory,
                recommendation: currentRec.trim()
            });
        }

        return recommendations.length > 0 ? recommendations : [
            { category: 'general', recommendation: text }
        ];
    }

    /**
     * Generate markdown report
     */
    generateMarkdownReport() {
        const date = new Date().toISOString().split('T')[0];
        
        let markdown = `# AI-Assisted Performance Trace Analysis\n\n`;
        markdown += `**Generated:** ${new Date().toISOString()}\n`;
        markdown += `**Analysis Period:** ${TRACE_ANALYSIS_PERIOD_HOURS} hours\n`;
        markdown += `**Total Traces:** ${this.traces.length}\n\n`;

        // Executive Summary
        markdown += `## Executive Summary\n\n`;
        markdown += `Analyzed ${this.traces.length} performance traces across ${Object.keys(this.routeStats).length} unique routes.\n`;
        markdown += `Identified ${this.analysis.bottlenecks.length} performance bottlenecks requiring attention.\n\n`;

        // Top Routes by Volume
        markdown += `## Top Routes by Request Volume\n\n`;
        markdown += `| Route | Requests | Mean | Median | P95 | P99 | Error Rate |\n`;
        markdown += `|-------|----------|------|--------|-----|-----|------------|\n`;
        
        const topByVolume = Object.values(this.routeStats)
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);

        topByVolume.forEach(route => {
            markdown += `| \`${route.route}\` | ${route.count} | ${route.meanDuration.toFixed(0)}ms | ${route.medianDuration.toFixed(0)}ms | ${route.p95Duration.toFixed(0)}ms | ${route.p99Duration.toFixed(0)}ms | ${route.errorRate.toFixed(1)}% |\n`;
        });

        markdown += `\n`;

        // Slowest Routes
        markdown += `## Slowest Routes (P95)\n\n`;
        markdown += `| Route | P95 | Mean | DB Time % | Requests |\n`;
        markdown += `|-------|-----|------|-----------|----------|\n`;
        
        const topSlow = Object.values(this.routeStats)
            .sort((a, b) => b.p95Duration - a.p95Duration)
            .slice(0, 10);

        topSlow.forEach(route => {
            markdown += `| \`${route.route}\` | ${route.p95Duration.toFixed(0)}ms | ${route.meanDuration.toFixed(0)}ms | ${route.dbTimePercent.toFixed(1)}% | ${route.count} |\n`;
        });

        markdown += `\n`;

        // Bottlenecks
        if (this.analysis.bottlenecks.length > 0) {
            markdown += `## ⚠️ Performance Bottlenecks\n\n`;
            
            const grouped = {};
            this.analysis.bottlenecks.forEach(b => {
                if (!grouped[b.type]) grouped[b.type] = [];
                grouped[b.type].push(b);
            });

            for (const type in grouped) {
                markdown += `### ${type.replace(/_/g, ' ').toUpperCase()}\n\n`;
                grouped[type].forEach(b => {
                    markdown += `- **${b.route}**: ${b.message}\n`;
                });
                markdown += `\n`;
            }
        }

        // AI Recommendations
        if (this.analysis.recommendations && this.analysis.recommendations.length > 0) {
            markdown += `## 🤖 AI-Powered Optimization Recommendations\n\n`;
            
            this.analysis.recommendations.forEach((rec, idx) => {
                markdown += `### ${idx + 1}. ${rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}\n\n`;
                markdown += `${rec.recommendation}\n\n`;
            });
        }

        // Recommendations (if no AI)
        if (!OPENAI_API_KEY) {
            markdown += `## Recommendations\n\n`;
            markdown += `### General Performance Optimization Tips\n\n`;
            markdown += `1. **Database Optimization**: Review slow queries and add appropriate indexes\n`;
            markdown += `2. **Caching**: Implement caching for frequently accessed data\n`;
            markdown += `3. **Response Size**: Minimize JSON response payloads with pagination\n`;
            markdown += `4. **N+1 Queries**: Look for routes with high DB time percentage\n`;
            markdown += `5. **Error Handling**: Investigate routes with high error rates\n\n`;
        }

        return markdown;
    }

    /**
     * Save report to file
     */
    saveReport(markdown) {
        const reportsDir = path.join(__dirname, '../reports');
        if (!fs.existsSync(reportsDir)) {
            fs.mkdirSync(reportsDir, { recursive: true });
        }

        const date = new Date().toISOString().split('T')[0];
        const filename = `ai-trace-report-${date}.md`;
        const filepath = path.join(reportsDir, filename);

        fs.writeFileSync(filepath, markdown);
        console.log(`💾 Report saved to: ${filepath}\n`);

        return filepath;
    }
}

// Main execution
async function main() {
    console.log('\n🤖 AutoApply AI-Assisted Trace Analyzer\n');

    if (!TRACE_ANALYSIS_ENABLED) {
        console.log('⚠️  TRACE_ANALYSIS_ENABLED=false, exiting\n');
        process.exit(0);
    }

    const analyzer = new TraceAnalyzer();

    // Parse command line args
    const periodArg = process.argv.find(arg => arg.startsWith('--period='));
    const period = periodArg ? parseInt(periodArg.split('=')[1], 10) : TRACE_ANALYSIS_PERIOD_HOURS;

    // Load traces
    analyzer.loadTraces(period);

    if (analyzer.traces.length === 0) {
        console.log('⚠️  No traces to analyze. Ensure PERF_LOG_ENABLED=true and the server has been running.\n');
        process.exit(0);
    }

    // Calculate statistics
    analyzer.calculateStatistics();

    // Identify bottlenecks
    analyzer.identifyBottlenecks();

    // Generate AI recommendations
    await analyzer.generateAIRecommendations();

    // Generate and save report
    const markdown = analyzer.generateMarkdownReport();
    analyzer.saveReport(markdown);

    console.log('✅ Trace analysis complete!\n');
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = TraceAnalyzer;
