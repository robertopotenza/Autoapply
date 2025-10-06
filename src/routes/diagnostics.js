const express = require('express');
const os = require('os');
const router = express.Router();

const { createLogger, getRecentLogs, logError } = require('../utils/logger');

const diagnosticsLogger = createLogger('diagnostics');

function maskDatabaseUrl(value) {
    if (!value || typeof value !== 'string') {
        return value;
    }

    if (!value.includes('postgres')) {
        return value;
    }

    return value.replace(/(postgres(?:ql)?:\/\/)([^:@]+)(?=:[^@]+@)/i, '$1****');
}

async function checkDatabase(pool) {
    if (!pool) {
        return { status: 'disconnected' };
    }

    try {
        await pool.query('SELECT 1');
        return { status: 'connected' };
    } catch (error) {
        diagnosticsLogger.logError(error, { stage: 'diagnostics', check: 'database' });
        return { status: 'error', error: error.message };
    }
}

router.get('/', async (req, res) => {
    try {
        const pool = req.app.locals?.db;
        const dbStatus = await checkDatabase(pool);

        const payload = {
            status: dbStatus.status === 'connected' ? 'ok' : 'degraded',
            db: dbStatus.status,
            uptime: Math.round(process.uptime()),
            timestamp: new Date().toISOString(),
            env: {
                NODE_ENV: process.env.NODE_ENV || 'development',
                DEBUG: process.env.DEBUG === 'true',
                DATABASE_URL: maskDatabaseUrl(process.env.DATABASE_URL),
                HOSTNAME: os.hostname()
            },
            logs: getRecentLogs(20)
        };

        if (dbStatus.error) {
            payload.db_error = dbStatus.error;
        }

        res.json(payload);
    } catch (error) {
        logError(error, 'route:diagnostics');
        res.status(500).json({
            status: 'error',
            message: 'Diagnostics check failed'
        });
    }
});

module.exports = router;
