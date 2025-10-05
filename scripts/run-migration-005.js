const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        console.log('❌ No database configuration found.');
        console.log('   Please set DATABASE_URL or PGHOST environment variables.');
        return;
    }

    const pool = new Pool({
        connectionString: process.env.DATABASE_URL || undefined,
        host: process.env.PGHOST,
        user: process.env.PGUSER || 'postgres',
        password: process.env.PGPASSWORD,
        database: process.env.PGDATABASE || 'railway',
        port: process.env.PGPORT || 5432,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        // Test connection
        console.log('🔌 Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log('✅ Database connection successful');

        // Run migration 005
        console.log('🚀 Running migration 005_enhanced_autoapply_tables...');
        const migrationPath = path.join(__dirname, '../database/migrations/005_enhanced_autoapply_tables.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(migrationSQL);
        console.log('✅ Migration 005_enhanced_autoapply_tables completed successfully');
        
        // Verify the tables were created
        const tables = [
            'autoapply_sessions',
            'user_autoapply_status',
            'autoapply_config',
            'application_templates',
            'job_board_cookies',
            'application_logs'
        ];
        
        console.log('\n📋 Verifying created tables:');
        for (const table of tables) {
            const result = await pool.query(`
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_name = $1
                )
            `, [table]);
            
            if (result.rows[0].exists) {
                console.log(`   ✅ ${table}`);
            } else {
                console.log(`   ⚠️  ${table} not found`);
            }
        }
        
        // Verify the view was created
        console.log('\n📊 Verifying views:');
        const viewResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_name = 'user_autoapply_stats'
            )
        `);
        
        if (viewResult.rows[0].exists) {
            console.log('   ✅ user_autoapply_stats view');
        } else {
            console.log('   ⚠️  user_autoapply_stats view not found');
        }
        
        // Verify the function was created
        console.log('\n🔧 Verifying functions:');
        const functionResult = await pool.query(`
            SELECT EXISTS (
                SELECT FROM pg_proc 
                WHERE proname = 'cleanup_old_autoapply_data'
            )
        `);
        
        if (functionResult.rows[0].exists) {
            console.log('   ✅ cleanup_old_autoapply_data function');
        } else {
            console.log('   ⚠️  cleanup_old_autoapply_data function not found');
        }
        
        console.log('\n✅ Migration completed successfully!\n');
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
        console.error('Error details:', error);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    runMigration().catch((error) => {
        console.error('Fatal migration error:', error);
        process.exit(1);
    });
}

module.exports = { runMigration };
