#!/usr/bin/env node

/**
 * Verification script for database initialization changes
 * 
 * This script verifies that:
 * 1. The initializeDatabase function has been updated correctly
 * 2. All migration files exist and are accessible
 * 3. The implementation matches the expected pattern
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Verifying Database Initialization Changes...\n');

// Test 1: Verify db.js has been updated
console.log('Test 1: Verify db.js contains migration execution');
const dbPath = path.join(__dirname, '../src/database/db.js');
const dbContent = fs.readFileSync(dbPath, 'utf8');

const hasRunSqlFile = dbContent.includes('async function runSqlFile(filePath, label)');
const hasMigrationLoop = dbContent.includes('for (const migration of migrations)');
const hasMigration002 = dbContent.includes('002_autoapply_tables.sql');
const hasMigration003 = dbContent.includes('003_add_email_to_profile.sql');
const hasMigration004 = dbContent.includes('004_add_user_id_to_jobs.sql');
const hasMigration005 = dbContent.includes('005_enhanced_autoapply_tables.sql');

console.log(`  ${hasRunSqlFile ? '✅' : '❌'} Has runSqlFile helper function`);
console.log(`  ${hasMigrationLoop ? '✅' : '❌'} Has migration loop in initializeDatabase`);
console.log(`  ${hasMigration002 ? '✅' : '❌'} References migration 002 (autoapply tables)`);
console.log(`  ${hasMigration003 ? '✅' : '❌'} References migration 003 (email to profile)`);
console.log(`  ${hasMigration004 ? '✅' : '❌'} References migration 004 (user_id to jobs)`);
console.log(`  ${hasMigration005 ? '✅' : '❌'} References migration 005 (enhanced tables)`);

const test1Pass = hasRunSqlFile && hasMigrationLoop && hasMigration002 && 
                  hasMigration003 && hasMigration004 && hasMigration005;
console.log(`\n  Result: ${test1Pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 2: Verify all migration files exist
console.log('Test 2: Verify all migration files exist');
const migrationFiles = [
    'database/schema.sql',
    'database/migrations/002_autoapply_tables.sql',
    'database/migrations/003_add_email_to_profile.sql',
    'database/migrations/003_add_password_reset.sql',
    'database/migrations/004_add_user_id_to_jobs.sql',
    'database/migrations/005_enhanced_autoapply_tables.sql'
];

let allFilesExist = true;
for (const file of migrationFiles) {
    const fullPath = path.join(__dirname, '..', file);
    const exists = fs.existsSync(fullPath);
    console.log(`  ${exists ? '✅' : '❌'} ${file}`);
    if (!exists) allFilesExist = false;
}

console.log(`\n  Result: ${allFilesExist ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 3: Verify migration 002 contains expected tables
console.log('Test 3: Verify migration 002 creates AutoApply tables');
const migration002Path = path.join(__dirname, '../database/migrations/002_autoapply_tables.sql');
const migration002Content = fs.readFileSync(migration002Path, 'utf8');

const hasJobsTable = migration002Content.includes('CREATE TABLE IF NOT EXISTS jobs');
const hasApplicationsTable = migration002Content.includes('CREATE TABLE IF NOT EXISTS applications');
const hasJobQueueTable = migration002Content.includes('CREATE TABLE IF NOT EXISTS job_queue');
const hasAutoapplySettingsTable = migration002Content.includes('CREATE TABLE IF NOT EXISTS autoapply_settings');
const hasAtsLogsTable = migration002Content.includes('CREATE TABLE IF NOT EXISTS ats_logs');

console.log(`  ${hasJobsTable ? '✅' : '❌'} Creates jobs table`);
console.log(`  ${hasApplicationsTable ? '✅' : '❌'} Creates applications table`);
console.log(`  ${hasJobQueueTable ? '✅' : '❌'} Creates job_queue table`);
console.log(`  ${hasAutoapplySettingsTable ? '✅' : '❌'} Creates autoapply_settings table`);
console.log(`  ${hasAtsLogsTable ? '✅' : '❌'} Creates ats_logs table`);

const test3Pass = hasJobsTable && hasApplicationsTable && hasJobQueueTable && 
                  hasAutoapplySettingsTable && hasAtsLogsTable;
console.log(`\n  Result: ${test3Pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 4: Verify error handling is in place
console.log('Test 4: Verify error handling');
const hasExistingTablesCheck = dbContent.includes("error.code === '42P07'") || 
                                dbContent.includes("includes('already exists')");
const hasFileExistsCheck = dbContent.includes('fs.existsSync(filePath)');
const hasPoolCheck = dbContent.includes('if (!pool)');

console.log(`  ${hasExistingTablesCheck ? '✅' : '❌'} Handles existing tables gracefully`);
console.log(`  ${hasFileExistsCheck ? '✅' : '❌'} Checks if migration files exist`);
console.log(`  ${hasPoolCheck ? '✅' : '❌'} Checks if database is configured`);

const test4Pass = hasExistingTablesCheck && hasFileExistsCheck && hasPoolCheck;
console.log(`\n  Result: ${test4Pass ? '✅ PASS' : '❌ FAIL'}\n`);

// Test 5: Verify function can be loaded
console.log('Test 5: Verify db module can be loaded');
try {
    const db = require('../src/database/db');
    const hasInitFunction = typeof db.initializeDatabase === 'function';
    const hasQueryFunction = typeof db.query === 'function';
    const hasTransactionFunction = typeof db.transaction === 'function';
    const hasIsDatabaseConfigured = typeof db.isDatabaseConfigured === 'function';
    
    console.log(`  ${hasInitFunction ? '✅' : '❌'} initializeDatabase function exported`);
    console.log(`  ${hasQueryFunction ? '✅' : '❌'} query function exported`);
    console.log(`  ${hasTransactionFunction ? '✅' : '❌'} transaction function exported`);
    console.log(`  ${hasIsDatabaseConfigured ? '✅' : '❌'} isDatabaseConfigured function exported`);
    
    const test5Pass = hasInitFunction && hasQueryFunction && hasTransactionFunction && hasIsDatabaseConfigured;
    console.log(`\n  Result: ${test5Pass ? '✅ PASS' : '❌ FAIL'}\n`);
} catch (error) {
    console.log(`  ❌ Failed to load db module: ${error.message}`);
    console.log(`\n  Result: ❌ FAIL\n`);
}

// Summary
console.log('=' .repeat(60));
console.log('VERIFICATION SUMMARY');
console.log('=' .repeat(60));

const allPassed = test1Pass && allFilesExist && test3Pass && test4Pass;
console.log(`\nOverall: ${allPassed ? '✅ ALL TESTS PASSED' : '❌ SOME TESTS FAILED'}`);

if (allPassed) {
    console.log('\n✨ The database initialization has been successfully updated!');
    console.log('📋 The initializeDatabase function now:');
    console.log('   1. Loads base schema (users, profile, etc.)');
    console.log('   2. Runs migration 002 (jobs, applications, etc.)');
    console.log('   3. Runs migrations 003-005 (additional features)');
    console.log('   4. Handles errors gracefully (idempotent)');
    console.log('\n🚀 When deployed, AutoApply tables will be created automatically!');
} else {
    console.log('\n⚠️  Some verification tests failed. Please review the output above.');
}

console.log('');
process.exit(allPassed ? 0 : 1);
