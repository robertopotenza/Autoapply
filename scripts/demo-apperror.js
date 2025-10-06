#!/usr/bin/env node
/**
 * Demonstration script for AppError structured error logging
 * This script shows how AppError captures and logs errors with full context
 */

const AppError = require('../src/utils/AppError');
const { Logger } = require('../src/utils/logger');

const logger = new Logger('AppError-Demo');

console.log('='.repeat(80));
console.log('AppError Structured Error Logging Demonstration');
console.log('='.repeat(80));
console.log();

// Example 1: Database error with context
console.log('Example 1: Database Error with Context');
console.log('-'.repeat(80));
try {
    // Simulate a database error
    const dbError = Object.assign(new Error('Connection timeout'), {
        code: 'ETIMEDOUT'
    });
    
    throw AppError.database(
        'Failed to get job analytics',
        {
            module: 'Job',
            method: 'getAnalytics',
            userId: 123,
            period: '30',
            query: 'job_analytics'
        },
        dbError
    );
} catch (error) {
    logger.error('Database operation failed', error.toJSON());
    console.log('\nStructured error output (JSON):');
    console.log(JSON.stringify(error.toJSON(), null, 2));
}

console.log('\n');

// Example 2: API error with context
console.log('Example 2: API Error with Context');
console.log('-'.repeat(80));
try {
    const apiError = Object.assign(new Error('Request failed'), {
        code: 'ECONNREFUSED'
    });
    
    throw AppError.api(
        'File upload failed',
        {
            module: 'AutoApplyAPI',
            endpoint: '/upload',
            userId: 456,
            filesAttempted: 2
        },
        apiError
    );
} catch (error) {
    logger.error('File upload failed', error.toJSON());
    console.log('\nStructured error output (JSON):');
    console.log(JSON.stringify(error.toJSON(), null, 2));
}

console.log('\n');

// Example 3: Error without cause
console.log('Example 3: AppError without cause');
console.log('-'.repeat(80));
try {
    throw AppError.validation('Invalid input data', {
        module: 'UserProfile',
        method: 'update',
        field: 'email',
        value: 'invalid-email'
    });
} catch (error) {
    logger.error('Validation error', error.toJSON());
    console.log('\nStructured error output (JSON):');
    console.log(JSON.stringify(error.toJSON(), null, 2));
}

console.log('\n');
console.log('='.repeat(80));
console.log('Key Benefits:');
console.log('  ✓ Structured error information with context');
console.log('  ✓ Timestamp for each error');
console.log('  ✓ Error code for categorization');
console.log('  ✓ Original cause preserved with stack trace');
console.log('  ✓ Easy to parse and analyze in log aggregation tools');
console.log('='.repeat(80));
