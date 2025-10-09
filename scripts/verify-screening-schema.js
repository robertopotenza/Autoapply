#!/usr/bin/env node
/**
 * Verification script to check user_complete_profile schema
 * This script determines if user_complete_profile is a VIEW or TABLE
 * and verifies where screening data is actually stored.
 */

const { query } = require('../src/database/db');
const { Logger } = require('../src/utils/logger');
const logger = new Logger('VerifyScreeningSchema');

async function verifySchema() {
    try {
        logger.info('=== Verifying Schema Structure ===\n');

        // Check if user_complete_profile is a view or table
        logger.info('1. Checking if user_complete_profile is a VIEW or TABLE...');
        const viewCheck = await query(`
            SELECT 
                table_name,
                table_type
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = 'user_complete_profile'
        `);

        if (viewCheck.rows.length === 0) {
            logger.error('❌ user_complete_profile does not exist!');
            return;
        }

        const tableType = viewCheck.rows[0].table_type;
        logger.info(`✅ user_complete_profile is a ${tableType}`);
        console.log('');

        // Check if screening_answers table exists
        logger.info('2. Checking if screening_answers table exists...');
        const screeningTableCheck = await query(`
            SELECT EXISTS (
                SELECT 1 
                FROM information_schema.tables 
                WHERE table_schema = 'public' 
                AND table_name = 'screening_answers'
            )
        `);

        const screeningExists = screeningTableCheck.rows[0].exists;
        if (screeningExists) {
            logger.info('✅ screening_answers table EXISTS');
            
            // Check if it has data
            const countResult = await query('SELECT COUNT(*) as count FROM screening_answers');
            const rowCount = countResult.rows[0].count;
            logger.info(`   - Contains ${rowCount} rows`);
        } else {
            logger.warn('⚠️  screening_answers table does NOT exist');
        }
        console.log('');

        // If user_complete_profile is a VIEW, show its definition
        if (tableType === 'VIEW') {
            logger.info('3. user_complete_profile VIEW definition:');
            const viewDef = await query(`
                SELECT view_definition 
                FROM information_schema.views 
                WHERE table_schema = 'public' 
                AND table_name = 'user_complete_profile'
            `);
            
            if (viewDef.rows.length > 0) {
                const definition = viewDef.rows[0].view_definition;
                // Check if it references screening_answers
                if (definition.includes('screening_answers')) {
                    logger.info('✅ VIEW references screening_answers table');
                } else {
                    logger.warn('⚠️  VIEW does NOT reference screening_answers table');
                }
            }
        } else if (tableType === 'BASE TABLE') {
            // It's a table - check its columns
            logger.info('3. user_complete_profile TABLE columns:');
            const columns = await query(`
                SELECT column_name, data_type 
                FROM information_schema.columns 
                WHERE table_schema = 'public' 
                AND table_name = 'user_complete_profile'
                AND column_name IN ('languages', 'disability_status', 'gender_identity', 'military_service')
                ORDER BY column_name
            `);
            
            if (columns.rows.length > 0) {
                logger.info('✅ TABLE has screening-related columns:');
                columns.rows.forEach(col => {
                    logger.info(`   - ${col.column_name}: ${col.data_type}`);
                });
            } else {
                logger.warn('⚠️  TABLE does NOT have screening-related columns');
            }
        }
        console.log('');

        // Test query to see where data actually comes from
        logger.info('4. Testing data retrieval for a sample user...');
        const sampleUser = await query(`
            SELECT user_id FROM users LIMIT 1
        `);

        if (sampleUser.rows.length > 0) {
            const userId = sampleUser.rows[0].user_id;
            logger.info(`   Using user_id: ${userId}`);

            // Check if data exists in screening_answers
            if (screeningExists) {
                const screeningData = await query(
                    'SELECT languages, disability_status FROM screening_answers WHERE user_id = $1',
                    [userId]
                );
                
                if (screeningData.rows.length > 0) {
                    logger.info('✅ Data found in screening_answers table');
                } else {
                    logger.info('ℹ️  No data in screening_answers for this user');
                }
            }

            // Check if data exists in user_complete_profile
            const completeProfile = await query(
                'SELECT languages, disability_status FROM user_complete_profile WHERE user_id = $1',
                [userId]
            );
            
            if (completeProfile.rows.length > 0) {
                logger.info('✅ Data found in user_complete_profile');
            } else {
                logger.info('ℹ️  No data in user_complete_profile for this user');
            }
        } else {
            logger.warn('⚠️  No users found in database for testing');
        }
        console.log('');

        // Summary
        logger.info('=== SUMMARY ===');
        if (tableType === 'VIEW' && screeningExists) {
            logger.info('✅ CURRENT ARCHITECTURE:');
            logger.info('   - user_complete_profile is a VIEW');
            logger.info('   - screening_answers is a separate TABLE');
            logger.info('   - The VIEW joins data from screening_answers');
            logger.info('   - This is the CORRECT multi-table normalized design');
        } else if (tableType === 'BASE TABLE') {
            logger.info('⚠️  SCHEMA HAS EVOLVED:');
            logger.info('   - user_complete_profile is now a TABLE');
            logger.info('   - screening_answers may be redundant');
            logger.info('   - All data is stored in user_complete_profile');
        }

        process.exit(0);
    } catch (error) {
        logger.error('Error verifying schema:', error);
        process.exit(1);
    }
}

// Run the verification
verifySchema();
