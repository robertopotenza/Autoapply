#!/usr/bin/env node
/**
 * Demo script to test Step 2 alert system
 * Generates sample log entries and triggers alert monitoring
 */

const fs = require('fs');
const path = require('path');

// Load environment
try {
    require('dotenv-flow').config();
} catch (err) {
    require('dotenv').config();
}

const logsDir = path.join(__dirname, '../logs');
const logFile = path.join(logsDir, 'combined.log');

// Ensure logs directory exists
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

console.log('📝 Step 2 Alert System Demo\n');
console.log('This script will:');
console.log('  1. Generate sample Step 2 warning log entries');
console.log('  2. Run the alert monitor script');
console.log('  3. Show alerts in the alerts log file\n');

// Sample log entries
const sampleLogs = [
    // Warning: Incomplete submission
    JSON.stringify({
        level: 'warn',
        message: '⚠️ INCOMPLETE STEP 2 SUBMISSION - User 123 submitted with empty critical fields:',
        args: [{
            emptyFields: ['fullName', 'country'],
            userId: '123',
            allData: { email: 'test@example.com', phone: '' }
        }],
        timestamp: new Date().toISOString(),
        context: 'Wizard',
        service: 'apply-autonomously'
    }),
    
    // Critical: All fields empty
    JSON.stringify({
        level: 'error',
        message: '❌ CRITICAL: All Step 2 fields are empty for user 456!',
        args: [{
            receivedBody: {},
            userId: '456'
        }],
        timestamp: new Date(Date.now() + 1000).toISOString(),
        context: 'Wizard',
        service: 'apply-autonomously'
    }),
    
    // Normal log entry (should not trigger alert)
    JSON.stringify({
        level: 'info',
        message: 'User 789 successfully completed Step 2',
        args: [{ userId: '789' }],
        timestamp: new Date(Date.now() + 2000).toISOString(),
        context: 'Wizard',
        service: 'apply-autonomously'
    })
];

// Write sample logs
console.log('✍️  Writing sample log entries...\n');
sampleLogs.forEach((log, index) => {
    fs.appendFileSync(logFile, log + '\n');
    const logObj = JSON.parse(log);
    console.log(`   ${index + 1}. ${logObj.level.toUpperCase()}: ${logObj.message.substring(0, 60)}...`);
});

console.log('\n✅ Sample logs written to:', logFile);
console.log('\n🔍 Running alert monitor...\n');

// Run the monitor script
const { spawnSync } = require('child_process');
const result = spawnSync('node', [path.join(__dirname, '../scripts/monitor-step2-alerts.js')], {
    stdio: 'inherit',
    env: {
        ...process.env,
        NODE_ENV: 'development'
    }
});

// Show alerts log if it exists
const alertsLogPath = path.join(__dirname, '../alerts/step2-alerts.log');
if (fs.existsSync(alertsLogPath)) {
    console.log('\n📋 Alerts Log Contents:\n');
    const alertsContent = fs.readFileSync(alertsLogPath, 'utf8');
    const alerts = alertsContent.trim().split('\n').filter(line => line);
    
    alerts.slice(-5).forEach((line, index) => {
        try {
            const alert = JSON.parse(line);
            console.log(`   Alert ${index + 1}:`);
            console.log(`     User: ${alert.userId}`);
            console.log(`     Severity: ${alert.severity}`);
            console.log(`     Missing Fields: ${alert.emptyFields.length > 0 ? alert.emptyFields.join(', ') : 'All fields empty'}`);
            console.log(`     Time: ${alert.timestamp}`);
            console.log('');
        } catch (e) {
            console.log(`     (Parse error for line ${index + 1})`);
        }
    });
}

console.log('✅ Demo complete!\n');
console.log('📖 Next steps:');
console.log('   • Configure SLACK_STEP2_ALERT_WEBHOOK in .env file');
console.log('   • Run the demo again to see Slack notifications');
console.log('   • Visit /admin/dashboard to view alerts in the UI');
console.log('   • Check alerts/step2-alerts.log for full alert history\n');

process.exit(result.status || 0);
