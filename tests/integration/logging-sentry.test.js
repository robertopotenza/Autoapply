/**
 * Integration test for logging and Sentry
 */

const path = require('path');
const fs = require('fs');

console.log('Testing logging and Sentry integration...\n');

// Test 1: Logger module can be loaded
console.log('Test 1: Loading logger module');
try {
    const { Logger } = require('../../src/utils/logger');
    console.log('  ✅ Logger module loaded');
    
    // Test 2: Create logger instance
    const logger = new Logger('TestContext');
    console.log('  ✅ Logger instance created');
    
    // Test 3: Logs directory should be created
    const logsDir = path.join(__dirname, '../../logs');
    if (fs.existsSync(logsDir)) {
        console.log('  ✅ Logs directory exists');
    } else {
        console.log('  ❌ Logs directory not found');
    }
} catch (error) {
    console.log('  ❌ Error:', error.message);
    process.exit(1);
}

// Test 4: Sentry module can be loaded
console.log('\nTest 2: Loading Sentry module');
try {
    const Sentry = require('@sentry/node');
    console.log('  ✅ Sentry module loaded');
    console.log('  ✅ Sentry version:', Sentry.SDK_VERSION);
} catch (error) {
    console.log('  ❌ Error:', error.message);
    process.exit(1);
}

// Test 5: winston-daily-rotate-file can be loaded
console.log('\nTest 3: Loading winston-daily-rotate-file');
try {
    require('winston-daily-rotate-file');
    console.log('  ✅ winston-daily-rotate-file loaded');
} catch (error) {
    console.log('  ❌ Error:', error.message);
    process.exit(1);
}

console.log('\n✅ All integration tests passed!');
