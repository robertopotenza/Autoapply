#!/usr/bin/env node
/**
 * Step 2 Alert Monitor
 * Monitors logs for Step 2 validation warnings and sends Slack alerts
 * 
 * Usage:
 *   node scripts/monitor-step2-alerts.js           # Run in normal mode
 *   node scripts/monitor-step2-alerts.js --ci      # Run in CI mode (check test failures)
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');

// Load environment variables
try {
    require('dotenv-flow').config();
} catch (err) {
    // dotenv-flow not available in CI
    require('dotenv').config();
}

const LOGS_DIR = path.join(__dirname, '../logs');
const ALERTS_LOG_PATH = path.join(__dirname, '../alerts/step2-alerts.log');
const RUNTIME_CONFIG_PATH = path.join(__dirname, '../config/runtime.json');

// Step 2 warning patterns to detect
const WARNING_PATTERNS = [
    /⚠️ INCOMPLETE STEP 2 SUBMISSION/,
    /❌ CRITICAL: All Step 2 fields are empty/
];

/**
 * Load runtime configuration
 */
function loadRuntimeConfig() {
    try {
        if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
            const config = JSON.parse(fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8'));
            return config;
        }
    } catch (error) {
        console.error('Error loading runtime config:', error.message);
    }
    return {
        alerts: {
            step2Slack: true,
            threshold: 'critical'
        }
    };
}

/**
 * Check if alerts are enabled
 */
function areAlertsEnabled() {
    const config = loadRuntimeConfig();
    return config.alerts && config.alerts.step2Slack !== false;
}

/**
 * Parse log entry and extract Step 2 warning details
 */
function parseLogEntry(line) {
    try {
        // Try to parse as JSON log entry
        const logEntry = JSON.parse(line);
        
        // Check if this is a Step 2 warning
        const message = logEntry.message || '';
        const args = logEntry.args || [];
        
        // Check for warning patterns
        const isStep2Warning = WARNING_PATTERNS.some(pattern => pattern.test(message));
        
        if (!isStep2Warning) {
            return null;
        }
        
        // Extract details
        const userId = extractUserId(message, args);
        const emptyFields = extractEmptyFields(message, args);
        const isCritical = message.includes('CRITICAL');
        
        return {
            userId,
            emptyFields,
            severity: isCritical ? 'critical' : 'warning',
            message,
            timestamp: logEntry.timestamp || new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        };
    } catch (err) {
        // Not a JSON log entry, try plain text parsing
        const line_str = String(line);
        
        // Check for warning patterns in plain text
        const isStep2Warning = WARNING_PATTERNS.some(pattern => pattern.test(line_str));
        
        if (!isStep2Warning) {
            return null;
        }
        
        // Extract user ID from plain text
        const userIdMatch = line_str.match(/User (\d+)/);
        const userId = userIdMatch ? userIdMatch[1] : 'unknown';
        
        // Extract empty fields
        const emptyFieldsMatch = line_str.match(/emptyFields['":\s]+\[([^\]]+)\]/);
        const emptyFields = emptyFieldsMatch ? 
            emptyFieldsMatch[1].split(',').map(f => f.trim().replace(/['"]/g, '')) : 
            [];
        
        const isCritical = line_str.includes('CRITICAL');
        
        return {
            userId,
            emptyFields,
            severity: isCritical ? 'critical' : 'warning',
            message: line_str,
            timestamp: new Date().toISOString(),
            environment: process.env.NODE_ENV || 'development'
        };
    }
}

/**
 * Extract user ID from log message and args
 */
function extractUserId(message, args) {
    // Try to extract from message
    const userIdMatch = message.match(/User (\d+)/);
    if (userIdMatch) {
        return userIdMatch[1];
    }
    
    // Try to find in args
    if (Array.isArray(args) && args.length > 0) {
        const firstArg = args[0];
        if (firstArg && typeof firstArg === 'object') {
            return firstArg.userId || firstArg.user_id || 'unknown';
        }
    }
    
    return 'unknown';
}

/**
 * Extract empty fields from log args
 */
function extractEmptyFields(message, args) {
    if (Array.isArray(args) && args.length > 0) {
        const firstArg = args[0];
        if (firstArg && Array.isArray(firstArg.emptyFields)) {
            return firstArg.emptyFields;
        }
    }
    
    // Try to extract from message
    const emptyFieldsMatch = message.match(/emptyFields['":\s]+\[([^\]]+)\]/);
    if (emptyFieldsMatch) {
        return emptyFieldsMatch[1].split(',').map(f => f.trim().replace(/['"]/g, ''));
    }
    
    return [];
}

/**
 * Send Slack alert
 */
async function sendSlackAlert(alertData) {
    const webhook = process.env.SLACK_STEP2_ALERT_WEBHOOK;
    
    if (!webhook) {
        console.log('⚠️  SLACK_STEP2_ALERT_WEBHOOK not configured, skipping Slack alert');
        return false;
    }
    
    // Format the message
    const color = alertData.severity === 'critical' ? '#FF0000' : '#FFA500';
    const icon = alertData.severity === 'critical' ? '🚨' : '⚠️';
    
    const payload = {
        text: `${icon} *${alertData.severity === 'critical' ? 'Critical' : 'Incomplete'} Step 2 Submission Detected*`,
        attachments: [
            {
                color: color,
                fields: [
                    {
                        title: 'User ID',
                        value: String(alertData.userId),
                        short: true
                    },
                    {
                        title: 'Missing Fields',
                        value: alertData.emptyFields.length > 0 ? 
                            alertData.emptyFields.join(', ') : 
                            'All fields empty',
                        short: true
                    },
                    {
                        title: 'Environment',
                        value: alertData.environment,
                        short: true
                    },
                    {
                        title: 'Detected At',
                        value: alertData.timestamp
                    }
                ],
                footer: 'AutoApply Platform Step 2 Monitor',
                ts: Math.floor(Date.parse(alertData.timestamp) / 1000)
            }
        ]
    };
    
    try {
        await axios.post(webhook, payload);
        console.log('✅ Slack alert sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Failed to send Slack alert:', error.message);
        return false;
    }
}

/**
 * Save alert to log file
 */
function saveAlert(alertData) {
    try {
        // Create alerts directory if it doesn't exist
        const alertsDir = path.dirname(ALERTS_LOG_PATH);
        if (!fs.existsSync(alertsDir)) {
            fs.mkdirSync(alertsDir, { recursive: true });
        }
        
        // Append alert to log file
        const logEntry = JSON.stringify({
            ...alertData,
            savedAt: new Date().toISOString()
        }) + '\n';
        
        fs.appendFileSync(ALERTS_LOG_PATH, logEntry);
        console.log('📝 Alert saved to log file');
    } catch (error) {
        console.error('❌ Failed to save alert to log:', error.message);
    }
}

/**
 * Monitor combined logs for Step 2 warnings
 */
async function monitorLogs() {
    console.log('🔍 Monitoring logs for Step 2 warnings...\n');
    
    // Check if alerts are enabled
    if (!areAlertsEnabled()) {
        console.log('⚠️  Step 2 Slack alerts are disabled in runtime config');
        return;
    }
    
    // Determine log file path based on environment
    const isDevelopment = process.env.NODE_ENV === 'development';
    const logFileName = isDevelopment ? 'combined.log' : `combined-${new Date().toISOString().split('T')[0]}.log`;
    const logFilePath = path.join(LOGS_DIR, logFileName);
    
    // Check if log file exists
    if (!fs.existsSync(logFilePath)) {
        console.log(`⚠️  Log file not found: ${logFilePath}`);
        console.log('   No logs to process. This is normal if the application hasn\'t generated logs yet.');
        return;
    }
    
    // Read log file
    const logContent = fs.readFileSync(logFilePath, 'utf8');
    const lines = logContent.split('\n').filter(line => line.trim());
    
    console.log(`📄 Processing ${lines.length} log entries...`);
    
    let alertCount = 0;
    
    // Process each log line
    for (const line of lines) {
        const alertData = parseLogEntry(line);
        
        if (alertData) {
            console.log(`\n${alertData.severity === 'critical' ? '🚨' : '⚠️'} Step 2 ${alertData.severity} detected:`);
            console.log(`   User ID: ${alertData.userId}`);
            console.log(`   Missing Fields: ${alertData.emptyFields.length > 0 ? alertData.emptyFields.join(', ') : 'All fields empty'}`);
            console.log(`   Timestamp: ${alertData.timestamp}`);
            
            // Send Slack alert
            await sendSlackAlert(alertData);
            
            // Save to alerts log
            saveAlert(alertData);
            
            alertCount++;
        }
    }
    
    console.log(`\n✅ Monitoring complete. Found ${alertCount} Step 2 alert(s).`);
}

/**
 * Check for Step 2 test failures in CI mode
 */
async function checkTestFailures() {
    console.log('🔍 Checking for Step 2 test failures in CI mode...\n');
    
    // Check if alerts are enabled
    if (!areAlertsEnabled()) {
        console.log('⚠️  Step 2 Slack alerts are disabled in runtime config');
        return;
    }
    
    // In CI mode, we look for test failure reports or run tests
    const testOutputPath = path.join(__dirname, '../test-results.txt');
    
    let testsFailed = false;
    let failureMessage = '';
    
    if (fs.existsSync(testOutputPath)) {
        const testOutput = fs.readFileSync(testOutputPath, 'utf8');
        
        // Check for step2 test failures
        if (testOutput.includes('wizard-step2') && testOutput.includes('FAIL')) {
            testsFailed = true;
            failureMessage = 'Step 2 validation tests failed in CI';
        }
    }
    
    if (testsFailed) {
        const alertData = {
            userId: 'CI',
            emptyFields: [],
            severity: 'critical',
            message: failureMessage,
            timestamp: new Date().toISOString(),
            environment: 'ci'
        };
        
        console.log('🚨 Step 2 test failures detected in CI');
        await sendSlackAlert(alertData);
        saveAlert(alertData);
        
        // Exit with error code to fail the CI job
        process.exit(1);
    } else {
        console.log('✅ No Step 2 test failures detected');
    }
}

/**
 * Main execution
 */
async function main() {
    const args = process.argv.slice(2);
    const isCI = args.includes('--ci');
    
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║         Step 2 Alert Monitor                               ║');
    console.log('╚════════════════════════════════════════════════════════════╝\n');
    
    if (isCI) {
        await checkTestFailures();
    } else {
        await monitorLogs();
    }
}

// Run if called directly
if (require.main === module) {
    main().catch(error => {
        console.error('❌ Fatal error:', error);
        process.exit(1);
    });
}

module.exports = {
    parseLogEntry,
    sendSlackAlert,
    monitorLogs,
    areAlertsEnabled
};
