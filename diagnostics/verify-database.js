#!/usr/bin/env node

const path = require('path');
const { Pool } = require('pg');
const { logError, logInfo } = require('../src/utils/logger');

const REQUIRED_TABLES = {
    users: ['id', 'email', 'password_hash'],
    jobs: ['id', 'title', 'company'],
    applications: ['id', 'user_id', 'job_id'],
    screening_answers: ['id', 'application_id', 'question', 'answer']
};

function maskConnection(url) {
    if (!url) {
        return 'not-set';
    }

    return url.replace(/(postgres(?:ql)?:\/\/)([^:@]+)(?=:[^@]+@)/i, '$1****');
}

async function verifyDatabaseSchema() {
    const connectionString = process.env.DATABASE_URL || process.env.RAILWAY_DATABASE_URL;

    if (!connectionString) {
        throw new Error('DATABASE_URL is not configured');
    }

    const pool = new Pool({
        connectionString,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    try {
        await pool.query('SELECT 1');

        for (const [table, columns] of Object.entries(REQUIRED_TABLES)) {
            const result = await pool.query(
                `SELECT column_name FROM information_schema.columns WHERE table_name = $1`,
                [table]
            );

            const existingColumns = result.rows.map((row) => row.column_name);
            const missingColumns = columns.filter((column) => !existingColumns.includes(column));

            if (missingColumns.length > 0) {
                throw new Error(`Table '${table}' is missing columns: ${missingColumns.join(', ')}`);
            }
        }

        logInfo('✅ Database schema verification passed', 'diagnostics:verify-database', {
            database_url: maskConnection(connectionString)
        });
    } finally {
        await pool.end();
    }
}

if (require.main === module) {
    verifyDatabaseSchema()
        .then(() => {
            console.log('✅ verify-database: success');
            process.exit(0);
        })
        .catch((error) => {
            logError(error, 'diagnostics:verify-database', {
                database_url: maskConnection(process.env.DATABASE_URL)
            });
            console.error('❌ verify-database: failed');
            console.error(error.message);
            process.exit(1);
        });
}

module.exports = { verifyDatabaseSchema };
