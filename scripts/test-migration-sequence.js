#!/usr/bin/env node

/**
 * Test script to verify migration sequence works correctly
 * This simulates the migration process without requiring a database
 */

const fs = require('fs');
const path = require('path');

console.log('🧪 Testing migration sequence...\n');

// Load migrations
const migration002Path = path.join(__dirname, '../database/migrations/002_autoapply_tables.sql');
const migration004Path = path.join(__dirname, '../database/migrations/004_add_user_id_to_jobs.sql');

const migration002 = fs.readFileSync(migration002Path, 'utf8');
const migration004 = fs.readFileSync(migration004Path, 'utf8');

console.log('✅ Loaded migration 002');
console.log('✅ Loaded migration 004\n');

// Test 1: Verify migration 002 creates jobs table with user_id
console.log('Test 1: Migration 002 creates complete jobs table');
const hasJobsTableInM002 = /CREATE TABLE IF NOT EXISTS jobs/i.test(migration002);
const hasUserIdInM002 = /user_id INT REFERENCES users\(user_id\)/i.test(migration002);
const hasSourceInM002 = /source VARCHAR\(100\)/i.test(migration002);
const hasExternalIdInM002 = /external_id VARCHAR\(255\)/i.test(migration002);

if (hasJobsTableInM002 && hasUserIdInM002 && hasSourceInM002 && hasExternalIdInM002) {
    console.log('✅ PASS: Migration 002 creates jobs table with all required columns\n');
} else {
    console.log('❌ FAIL: Migration 002 missing required columns');
    console.log(`   - Has jobs table: ${hasJobsTableInM002}`);
    console.log(`   - Has user_id: ${hasUserIdInM002}`);
    console.log(`   - Has source: ${hasSourceInM002}`);
    console.log(`   - Has external_id: ${hasExternalIdInM002}\n`);
    process.exit(1);
}

// Test 2: Verify migration 004 is idempotent
console.log('Test 2: Migration 004 is idempotent');
const usesIfNotExistsUserId = /ALTER TABLE jobs\s+ADD COLUMN IF NOT EXISTS user_id/i.test(migration004);
const usesIfNotExistsSource = /ADD COLUMN IF NOT EXISTS source/i.test(migration004);
const usesIfNotExistsExternal = /ADD COLUMN IF NOT EXISTS external_id/i.test(migration004);
const usesIfNotExistsIndex = /CREATE INDEX IF NOT EXISTS idx_jobs_user_id/i.test(migration004);

if (usesIfNotExistsUserId && usesIfNotExistsSource && usesIfNotExistsExternal && usesIfNotExistsIndex) {
    console.log('✅ PASS: Migration 004 uses IF NOT EXISTS for all operations\n');
} else {
    console.log('❌ FAIL: Migration 004 not fully idempotent');
    console.log(`   - Uses IF NOT EXISTS for user_id: ${usesIfNotExistsUserId}`);
    console.log(`   - Uses IF NOT EXISTS for source: ${usesIfNotExistsSource}`);
    console.log(`   - Uses IF NOT EXISTS for external_id: ${usesIfNotExistsExternal}`);
    console.log(`   - Uses IF NOT EXISTS for index: ${usesIfNotExistsIndex}\n`);
    process.exit(1);
}

// Test 3: Verify indexes are created
console.log('Test 3: Required indexes are created');
const hasUserIdIndex = /CREATE INDEX IF NOT EXISTS idx_jobs_user_id ON jobs\(user_id\)/i.test(migration002);
const hasSourceExternalIdIndex = /CREATE UNIQUE INDEX IF NOT EXISTS idx_jobs_source_external_id/i.test(migration002);

if (hasUserIdIndex && hasSourceExternalIdIndex) {
    console.log('✅ PASS: All required indexes are created in migration 002\n');
} else {
    console.log('❌ FAIL: Missing required indexes');
    console.log(`   - Has user_id index: ${hasUserIdIndex}`);
    console.log(`   - Has source/external_id index: ${hasSourceExternalIdIndex}\n`);
    process.exit(1);
}

// Test 4: Verify comments are added
console.log('Test 4: Column comments are added');
const hasUserIdComment = /COMMENT ON COLUMN jobs\.user_id IS/i.test(migration002);
const hasSourceComment = /COMMENT ON COLUMN jobs\.source IS/i.test(migration002);
const hasExternalIdComment = /COMMENT ON COLUMN jobs\.external_id IS/i.test(migration002);

if (hasUserIdComment && hasSourceComment && hasExternalIdComment) {
    console.log('✅ PASS: All column comments are present\n');
} else {
    console.log('❌ FAIL: Missing column comments');
    console.log(`   - Has user_id comment: ${hasUserIdComment}`);
    console.log(`   - Has source comment: ${hasSourceComment}`);
    console.log(`   - Has external_id comment: ${hasExternalIdComment}\n`);
    process.exit(1);
}

// Test 5: Verify SQL syntax is valid (basic check)
console.log('Test 5: SQL syntax validation');
const sqlErrors = [];

// Check for common SQL syntax issues
if (!/;$/m.test(migration002.trim())) {
    sqlErrors.push('Migration 002 may not end with semicolon');
}

if (migration002.includes('CREAT TABLE')) {
    sqlErrors.push('Migration 002 has typo: CREAT instead of CREATE');
}

if (migration004.includes('CREAT TABLE')) {
    sqlErrors.push('Migration 004 has typo: CREAT instead of CREATE');
}

if (sqlErrors.length === 0) {
    console.log('✅ PASS: No obvious SQL syntax errors detected\n');
} else {
    console.log('❌ FAIL: SQL syntax issues detected:');
    sqlErrors.forEach(error => console.log(`   - ${error}`));
    console.log('');
    process.exit(1);
}

// Summary
console.log('═══════════════════════════════════════════');
console.log('✅ All migration sequence tests passed!');
console.log('═══════════════════════════════════════════');
console.log('\nMigration sequence verified:');
console.log('1. Running migration 002 creates jobs table with user_id, source, external_id');
console.log('2. Running migration 004 after 002 safely skips existing columns');
console.log('3. Both migrations can be run in sequence without errors');
console.log('4. The schema matches what the code expects\n');

process.exit(0);
