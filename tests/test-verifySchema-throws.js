#!/usr/bin/env node
/**
 * Test verifySchema function directly to confirm it properly throws errors
 */

const { verifySchema } = require('../src/utils/verifySchema');

console.log('🧪 Testing verifySchema function with missing column\n');

// Create a mock pool that simulates a missing column
const mockPoolMissingColumn = {
    query: async (sql, params) => {
        // Table existence check - all tables exist
        if (sql.includes('information_schema.tables')) {
            return { rows: [{ exists: true }] };
        }
        // Column existence check - simulate missing user_id in jobs table
        if (sql.includes('information_schema.columns')) {
            if (params && params[0] === 'jobs' && params[1] === 'user_id') {
                console.log('   🔍 Checking jobs.user_id: NOT FOUND');
                return { rows: [{ exists: false }] }; // Missing column!
            }
            return { rows: [{ exists: true }] };
        }
        return { rows: [] };
    }
};

// Create a mock pool that simulates a missing table
const mockPoolMissingTable = {
    query: async (sql, params) => {
        // Table existence check - simulate missing applications table
        if (sql.includes('information_schema.tables')) {
            if (params && params[0] === 'applications') {
                console.log('   🔍 Checking applications table: NOT FOUND');
                return { rows: [{ exists: false }] }; // Missing table!
            }
            return { rows: [{ exists: true }] };
        }
        // Won't get to column check since table check fails first
        return { rows: [{ exists: true }] };
    }
};

async function testMissingColumn() {
    console.log('1️⃣  Test: verifySchema with missing column (jobs.user_id)');
    try {
        await verifySchema(mockPoolMissingColumn);
        console.log('   ❌ FAILED: verifySchema should have thrown an error\n');
        return false;
    } catch (error) {
        if (error.message.includes('Missing column jobs.user_id')) {
            console.log('   ✅ PASSED: Correct error thrown');
            console.log('   Error:', error.message, '\n');
            return true;
        } else {
            console.log('   ❌ FAILED: Wrong error message');
            console.log('   Expected: "Missing column jobs.user_id"');
            console.log('   Got:', error.message, '\n');
            return false;
        }
    }
}

async function testMissingTable() {
    console.log('2️⃣  Test: verifySchema with missing table (applications)');
    try {
        await verifySchema(mockPoolMissingTable);
        console.log('   ❌ FAILED: verifySchema should have thrown an error\n');
        return false;
    } catch (error) {
        if (error.message.includes('Missing table: applications')) {
            console.log('   ✅ PASSED: Correct error thrown');
            console.log('   Error:', error.message, '\n');
            return true;
        } else {
            console.log('   ❌ FAILED: Wrong error message');
            console.log('   Expected: "Missing table: applications"');
            console.log('   Got:', error.message, '\n');
            return false;
        }
    }
}

async function testNullPool() {
    console.log('3️⃣  Test: verifySchema with null pool');
    try {
        await verifySchema(null);
        console.log('   ❌ FAILED: verifySchema should have thrown an error\n');
        return false;
    } catch (error) {
        if (error.message.includes('Database pool is not configured')) {
            console.log('   ✅ PASSED: Correct error thrown');
            console.log('   Error:', error.message, '\n');
            return true;
        } else {
            console.log('   ❌ FAILED: Wrong error message');
            console.log('   Expected: "Database pool is not configured"');
            console.log('   Got:', error.message, '\n');
            return false;
        }
    }
}

async function runAllTests() {
    const results = await Promise.all([
        testMissingColumn(),
        testMissingTable(),
        testNullPool()
    ]);
    
    const allPassed = results.every(r => r === true);
    
    if (allPassed) {
        console.log('✅ All tests passed!');
        console.log('   verifySchema correctly throws errors for:');
        console.log('   - Missing columns');
        console.log('   - Missing tables');
        console.log('   - Null/undefined pool');
        process.exit(0);
    } else {
        console.log('❌ Some tests failed');
        process.exit(1);
    }
}

runAllTests();
