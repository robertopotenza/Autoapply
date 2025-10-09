#!/usr/bin/env node
/**
 * AutoApply Developer CLI Tool
 * 
 * Unified CLI for common developer tasks including verification,
 * performance analysis, debugging, documentation, and alerts.
 * 
 * Commands:
 *   verify     - Run schema verification and tests
 *   perf       - Summarize performance logs
 *   debug <uid> - Fetch debug profile data
 *   docs       - Regenerate ER diagram and audit reports
 *   alerts     - Manually trigger anomaly detector
 * 
 * Usage:
 *   autoapply verify
 *   autoapply perf --window=24h
 *   autoapply debug 123
 *   autoapply docs
 *   autoapply alerts
 */

const { Command } = require('commander');
const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const https = require('https');

// ANSI color codes
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m'
};

function log(message, color = 'reset') {
    console.log(`${colors[color]}${message}${colors.reset}`);
}

function header(message) {
    console.log('');
    log('═'.repeat(60), 'cyan');
    log(`  ${message}`, 'bright');
    log('═'.repeat(60), 'cyan');
    console.log('');
}

function success(message) {
    log(`✅ ${message}`, 'green');
}

function error(message) {
    log(`❌ ${message}`, 'red');
}

function warning(message) {
    log(`⚠️  ${message}`, 'yellow');
}

function info(message) {
    log(`ℹ️  ${message}`, 'blue');
}

function runCommand(command, description) {
    try {
        info(description);
        const output = execSync(command, { 
            cwd: path.join(__dirname, '..'),
            encoding: 'utf8',
            stdio: 'inherit'
        });
        return true;
    } catch (err) {
        error(`Failed: ${description}`);
        return false;
    }
}

// Verify command
function verify(options) {
    header('🔍 AutoApply Verification');

    let allPassed = true;

    // 1. Schema verification
    info('Running schema verification...');
    const schemaResult = runCommand(
        'node scripts/verify-screening-schema.js',
        'Verifying database schema'
    );
    if (!schemaResult) allPassed = false;

    // 2. Schema drift detection
    info('\nChecking for schema drift...');
    const driftResult = runCommand(
        'node scripts/detect-schema-drift.js',
        'Detecting schema drift'
    );
    if (!driftResult) allPassed = false;

    // 3. Run tests
    if (!options.skipTests) {
        info('\nRunning test suite...');
        const testResult = runCommand(
            'npm test',
            'Running automated tests'
        );
        if (!testResult) allPassed = false;
    }

    console.log('');
    if (allPassed) {
        success('All verifications passed!');
        process.exit(0);
    } else {
        error('Some verifications failed. Check logs above.');
        process.exit(1);
    }
}

// Performance summary command
function perf(options) {
    header('📊 Performance Summary');

    const window = options.window || '1h';
    
    // Parse window (e.g., "24h", "7d")
    let periodHours = 1;
    if (window.endsWith('h')) {
        periodHours = parseInt(window);
    } else if (window.endsWith('d')) {
        periodHours = parseInt(window) * 24;
    }

    info(`Analyzing performance for last ${window}`);

    // Run performance analyzer
    const result = runCommand(
        `node scripts/analyze-performance-logs.js --output=perf-summary-${Date.now()}.json`,
        'Analyzing performance logs'
    );

    console.log('');
    if (result) {
        success('Performance analysis complete!');
        info('Report saved to reports/ directory');
    } else {
        warning('No performance data available. Ensure PERF_LOG_ENABLED=true');
    }
}

// Debug profile command
async function debug(userId, options) {
    header(`🔧 Debug Profile - User ${userId}`);

    // Load environment for admin token
    try {
        require('dotenv-flow').config({ silent: true });
    } catch (error) {
        // No dotenv available
    }

    const adminToken = process.env.ADMIN_TOKEN || options.token;
    const host = options.host || 'localhost:3000';

    if (!adminToken) {
        error('ADMIN_TOKEN not configured. Set it in .env or use --token flag');
        process.exit(1);
    }

    info(`Fetching debug data from ${host}...`);

    try {
        const data = await makeRequest(host, `/api/debug/profile/${userId}`, adminToken);
        
        console.log('');
        success('Profile data retrieved!');
        console.log('');
        console.log(JSON.stringify(data, null, 2));
        
    } catch (err) {
        console.log('');
        error(`Failed to fetch profile: ${err.message}`);
        process.exit(1);
    }
}

// Docs regeneration command
function docs(options) {
    header('📚 Documentation Regeneration');

    let allPassed = true;

    // 1. Generate ER diagram
    info('Generating ER diagram...');
    const diagramResult = runCommand(
        'node scripts/generate-er-diagram.js',
        'Creating entity relationship diagram'
    );
    if (!diagramResult) allPassed = false;

    // 2. Run documentation audit
    info('\nRunning documentation audit...');
    const auditResult = runCommand(
        'node scripts/audit-documentation.js',
        'Auditing documentation completeness'
    );
    if (!auditResult) allPassed = false;

    console.log('');
    if (allPassed) {
        success('Documentation updated successfully!');
        info('Check docs/ and reports/ directories for updates');
    } else {
        warning('Some documentation tasks failed');
    }
}

// Alerts command
function alerts(options) {
    header('🚨 Performance Alerts');

    info('Running anomaly detection...');

    const result = runCommand(
        `node scripts/analyze-performance-logs.js`,
        'Analyzing logs for anomalies'
    );

    console.log('');
    if (result) {
        success('Anomaly detection complete!');
        info('Check reports/ directory for details');
        
        if (process.env.ALERTS_ENABLED === 'true') {
            info('Alerts were sent to configured channels');
        } else {
            warning('ALERTS_ENABLED=false, no alerts were sent');
        }
    } else {
        warning('No performance data available');
    }
}

// Helper to make HTTP requests
function makeRequest(host, path, token) {
    return new Promise((resolve, reject) => {
        const isHttps = host.includes('railway.app') || host.includes('herokuapp.com');
        const protocol = isHttps ? https : require('http');
        const [hostname, port] = host.split(':');

        const options = {
            hostname,
            port: port || (isHttps ? 443 : 80),
            path,
            method: 'GET',
            headers: {
                'X-Admin-Token': token
            }
        };

        const req = protocol.request(options, (res) => {
            let body = '';

            res.on('data', (chunk) => {
                body += chunk;
            });

            res.on('end', () => {
                if (res.statusCode === 200) {
                    try {
                        resolve(JSON.parse(body));
                    } catch (error) {
                        reject(new Error('Invalid JSON response'));
                    }
                } else {
                    reject(new Error(`HTTP ${res.statusCode}: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.end();
    });
}

// CLI setup
const program = new Command();

program
    .name('autoapply')
    .description('AutoApply Developer CLI Tool')
    .version('1.0.0');

program
    .command('verify')
    .description('Run schema verification and tests')
    .option('--skip-tests', 'Skip running test suite')
    .action(verify);

program
    .command('perf')
    .description('Summarize performance logs')
    .option('-w, --window <time>', 'Time window (e.g., 1h, 24h, 7d)', '1h')
    .action(perf);

program
    .command('debug <userId>')
    .description('Fetch debug profile data for a user')
    .option('-t, --token <token>', 'Admin token')
    .option('-h, --host <host>', 'API host (default: localhost:3000)')
    .action(debug);

program
    .command('docs')
    .description('Regenerate ER diagram and audit reports')
    .action(docs);

program
    .command('alerts')
    .description('Manually trigger anomaly detector')
    .action(alerts);

// Parse and execute
program.parse(process.argv);

// Show help if no command provided
if (!process.argv.slice(2).length) {
    header('🚀 AutoApply Developer CLI');
    program.outputHelp();
    console.log('');
    log('Examples:', 'bright');
    log('  autoapply verify', 'cyan');
    log('  autoapply perf --window=24h', 'cyan');
    log('  autoapply debug 123', 'cyan');
    log('  autoapply docs', 'cyan');
    log('  autoapply alerts', 'cyan');
    console.log('');
}
