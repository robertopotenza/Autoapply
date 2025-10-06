const { Pool } = require('pg');
require('dotenv-flow').config();

async function initializeDatabase() {
    if (!process.env.DATABASE_URL && !process.env.PGHOST) {
        console.log('  No database configuration found. Skipping database initialization.');
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
        console.log(' Testing database connection...');
        await pool.query('SELECT NOW()');
        console.log(' Database connection successful');

        // Initialize tables
        console.log(' Initializing database schema...');
        const fs = require('fs');
        const path = require('path');
        
        const schemaPath = path.join(__dirname, '../database/schema.sql');
        const schema = fs.readFileSync(schemaPath, 'utf8');
        
        await pool.query(schema);
        console.log(' Database schema initialized successfully');
        
    } catch (error) {
        console.error(' Database initialization failed:', error.message);
        throw error;
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    initializeDatabase().catch((error) => {
        console.error('Fatal database initialization error:', error);
        process.exit(1);
    });
}

module.exports = { initializeDatabase };
