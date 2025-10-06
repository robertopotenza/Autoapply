#!/usr/bin/env node

/**
 * Demo script showing the database initialization flow
 * This simulates what happens when the server starts
 */

const fs = require('fs');
const path = require('path');

console.log('\n═══════════════════════════════════════════════════════════');
console.log('     DATABASE INITIALIZATION FLOW DEMONSTRATION');
console.log('═══════════════════════════════════════════════════════════\n');

console.log('This demonstrates what happens when the server starts:\n');

// Step 1: Database configuration check
console.log('1️⃣  Checking database configuration...');
console.log('   → DATABASE_URL or PG* environment variables detected');
console.log('   → Pool connection created');
console.log('   ✅ Database configured\n');

// Step 2: Connection test
console.log('2️⃣  Testing database connection...');
console.log('   → Running: SELECT NOW()');
console.log('   ✅ Database connection successful\n');

// Step 3: Load base schema
console.log('3️⃣  Loading base schema...');
const schemaPath = path.join(__dirname, '../database/schema.sql');
const schemaExists = fs.existsSync(schemaPath);
console.log(`   → File: database/schema.sql`);
console.log(`   → ${schemaExists ? 'Found' : 'Not found'}`);
if (schemaExists) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    const tableCount = (schema.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
    console.log(`   → Creating ${tableCount} base tables:`);
    console.log('     • users (authentication)');
    console.log('     • profile (user info)');
    console.log('     • job_preferences (search criteria)');
    console.log('     • eligibility (work authorization)');
    console.log('     • screening_answers (additional info)');
    console.log('     • magic_link_tokens');
    console.log('     • password_reset_tokens');
    console.log('   ✅ Base schema executed successfully\n');
}

// Step 4: Run migrations
console.log('4️⃣  Running migrations...\n');

const migrations = [
    {
        file: 'database/migrations/002_autoapply_tables.sql',
        label: 'Migration 002: AutoApply tables',
        tables: ['jobs', 'applications', 'job_queue', 'autoapply_settings', 'application_status_history', 'ats_logs']
    },
    {
        file: 'database/migrations/003_add_email_to_profile.sql',
        label: 'Migration 003: Add email to profile',
        tables: ['profile (add email column)']
    },
    {
        file: 'database/migrations/003_add_password_reset.sql',
        label: 'Migration 003b: Password reset tokens',
        tables: ['password_reset_tokens (if not exists)']
    },
    {
        file: 'database/migrations/004_add_user_id_to_jobs.sql',
        label: 'Migration 004: Add user_id to jobs',
        tables: ['jobs (add user_id, source, external_id)']
    },
    {
        file: 'database/migrations/005_enhanced_autoapply_tables.sql',
        label: 'Migration 005: Enhanced autoapply tables',
        tables: ['autoapply_sessions', 'user_autoapply_status', 'autoapply_config', 'application_templates', 'job_board_cookies', 'application_logs']
    }
];

let migrationNumber = 1;
for (const migration of migrations) {
    const fullPath = path.join(__dirname, '..', migration.file);
    const exists = fs.existsSync(fullPath);
    
    console.log(`   ${migrationNumber}. ${migration.label}`);
    console.log(`      → File: ${migration.file}`);
    console.log(`      → Status: ${exists ? '✓ Found' : '✗ Not found'}`);
    
    if (exists) {
        console.log(`      → Creating/updating tables:`);
        for (const table of migration.tables) {
            console.log(`        • ${table}`);
        }
        console.log(`      ✅ Migration executed successfully\n`);
    } else {
        console.log(`      ⚠️  Skipped (file not found)\n`);
    }
    
    migrationNumber++;
}

// Step 5: Summary
console.log('5️⃣  Database initialization complete!\n');

// Count total tables
let totalTables = 0;
if (schemaExists) {
    const schema = fs.readFileSync(schemaPath, 'utf8');
    totalTables += (schema.match(/CREATE TABLE IF NOT EXISTS/g) || []).length;
}

for (const migration of migrations) {
    const fullPath = path.join(__dirname, '..', migration.file);
    if (fs.existsSync(fullPath)) {
        totalTables += migration.tables.length;
    }
}

console.log('═══════════════════════════════════════════════════════════');
console.log('                    SUMMARY');
console.log('═══════════════════════════════════════════════════════════');
console.log(`✅ Base schema loaded`);
console.log(`✅ ${migrations.length} migrations executed`);
console.log(`✅ ~${totalTables} tables created/updated`);
console.log('\n📊 Key Tables Now Available:');
console.log('   • User Management: users, profile, job_preferences');
console.log('   • AutoApply Core: jobs, applications, job_queue');
console.log('   • Settings: autoapply_settings, autoapply_config');
console.log('   • Tracking: application_status_history, ats_logs');
console.log('   • Sessions: autoapply_sessions, user_autoapply_status');
console.log('   • Templates: application_templates, job_board_cookies');
console.log('\n🎉 The application is ready to use AutoApply features!\n');

console.log('═══════════════════════════════════════════════════════════\n');
