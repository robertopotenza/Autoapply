/**
 * Schema Verification Utility
 * Verifies that critical database tables and columns exist
 * Throws clear errors if schema is incompatible
 */

const { Logger } = require('./logger');
const logger = new Logger('SchemaVerify');

/**
 * Define critical tables and their required columns
 */
const requiredColumns = {
    users: ['user_id', 'email', 'password_hash', 'created_at'],
    profile: ['user_id', 'full_name', 'email', 'phone'],
    job_preferences: ['user_id', 'job_titles', 'locations', 'employment_type'],
    jobs: ['job_id', 'user_id', 'job_title', 'company_name', 'job_url', 'created_at'],
    applications: ['application_id', 'user_id', 'job_id', 'status', 'applied_at'],
    eligibility: ['user_id', 'work_authorization', 'security_clearance'],
    screening_answers: ['user_id', 'experience_summary', 'languages']
};

/**
 * Verify that all required tables and columns exist in the database
 * @param {Object} pool - PostgreSQL connection pool
 * @throws {Error} if schema verification fails
 */
async function verifySchema(pool) {
    if (!pool) {
        throw new Error('Database pool is not configured');
    }

    logger.info('🔍 Starting schema verification...');
    
    try {
        // Verify each table and its columns
        for (const [tableName, columns] of Object.entries(requiredColumns)) {
            // Check if table exists
            const tableCheck = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [tableName]);
            
            if (!tableCheck.rows[0].exists) {
                throw new Error(`❌ Missing table: ${tableName} — run migrations or check schema.sql`);
            }
            
            logger.debug(`✅ Table ${tableName} exists`);
            
            // Check each required column
            for (const columnName of columns) {
                const columnCheck = await pool.query(`
                    SELECT EXISTS (
                        SELECT FROM information_schema.columns 
                        WHERE table_name = $1 AND column_name = $2
                    )
                `, [tableName, columnName]);
                
                if (!columnCheck.rows[0].exists) {
                    throw new Error(`❌ Missing column ${tableName}.${columnName} — run migrations or check schema.sql`);
                }
            }
            
            logger.debug(`✅ All required columns exist for ${tableName}`);
        }
        
        logger.info('✅ Schema verification passed - all required tables and columns exist');
        return true;
        
    } catch (error) {
        logger.error('❌ Schema verification failed:', error.message);
        throw error;
    }
}

/**
 * Verify schema with graceful error handling for optional dependencies
 * @param {Object} pool - PostgreSQL connection pool
 * @returns {boolean} true if verification passed, false otherwise
 */
async function verifySchemaGraceful(pool) {
    try {
        await verifySchema(pool);
        return true;
    } catch (error) {
        logger.error('Schema verification failed:', error.message);
        return false;
    }
}

module.exports = {
    verifySchema,
    verifySchemaGraceful,
    requiredColumns
};
