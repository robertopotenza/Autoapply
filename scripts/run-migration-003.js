const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv-flow').config();

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

        // Run migration 003
        console.log('🚀 Running migration 003_add_email_to_profile...');
        const migrationPath = path.join(__dirname, '../database/migrations/003_add_email_to_profile.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
        
        await pool.query(migrationSQL);
        console.log('✅ Migration 003_add_email_to_profile completed successfully');
        
        // Verify the column was added
        const result = await pool.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'profile' AND column_name = 'email'
        `);
        
        if (result.rows.length > 0) {
            console.log('✅ Verified: email column exists in profile table');
        } else {
            console.log('⚠️  Warning: email column not found after migration');
        }
        
    } catch (error) {
        console.error('❌ Migration failed:', error.message);
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
