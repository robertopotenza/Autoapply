const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const os = require('os');
const { query } = require('../database/db');
const { Logger } = require('../utils/logger');
const { sendSlackAlert } = require('../utils/slackAlert');

const logger = new Logger('AdminDashboard');

const RUNTIME_CONFIG_PATH = path.join(__dirname, '../../config/runtime.json');

// Initialize global runtime config
if (!globalThis.runtimeConfig) {
    globalThis.runtimeConfig = {
        PERF_LOG_ENABLED: false,
        DEBUG_MODE: false,
        ALERTS_ENABLED: false,
        lastUpdated: null
    };
}

/**
 * Access control middleware for admin dashboard
 * Requires ADMIN_TOKEN in X-Admin-Token header
 */
function adminAccessControl(req, res, next) {
    const adminToken = req.headers['x-admin-token'];
    const expectedToken = process.env.ADMIN_TOKEN;
    
    if (!expectedToken) {
        logger.warn('ADMIN_TOKEN not configured', {
            path: req.path,
            ip: req.ip
        });
        return res.status(403).json({
            error: 'Admin dashboard is disabled',
            message: 'ADMIN_TOKEN not configured'
        });
    }
    
    if (adminToken !== expectedToken) {
        logger.warn('Invalid admin token attempt', {
            path: req.path,
            ip: req.ip,
            hasToken: !!adminToken
        });
        return res.status(403).json({
            error: 'Forbidden',
            message: 'Invalid or missing X-Admin-Token header'
        });
    }
    
    next();
}

/**
 * Load runtime configuration
 */
function loadRuntimeConfig() {
    try {
        if (fs.existsSync(RUNTIME_CONFIG_PATH)) {
            const content = fs.readFileSync(RUNTIME_CONFIG_PATH, 'utf8');
            return JSON.parse(content);
        }
    } catch (error) {
        logger.error('Error loading runtime config', { error: error.message });
    }
    
    // Return defaults
    return {
        PERF_LOG_ENABLED: false,
        DEBUG_MODE: false,
        ALERTS_ENABLED: false,
        lastUpdated: null
    };
}

/**
 * Save runtime configuration
 */
function saveRuntimeConfig(config) {
    try {
        config.lastUpdated = new Date().toISOString();
        fs.writeFileSync(RUNTIME_CONFIG_PATH, JSON.stringify(config, null, 2));
        return true;
    } catch (error) {
        logger.error('Error saving runtime config', { error: error.message });
        return false;
    }
}

/**
 * Apply runtime configuration to environment
 */
function applyRuntimeConfig(config) {
    // Update process.env with new values
    if (config.PERF_LOG_ENABLED !== undefined) {
        process.env.PERF_LOG_ENABLED = config.PERF_LOG_ENABLED.toString();
    }
    if (config.DEBUG_MODE !== undefined) {
        process.env.DEBUG_MODE = config.DEBUG_MODE.toString();
    }
    if (config.ALERTS_ENABLED !== undefined) {
        process.env.ALERTS_ENABLED = config.ALERTS_ENABLED.toString();
    }
    
    // Update globalThis.runtimeConfig for in-memory access
    globalThis.runtimeConfig = {
        ...globalThis.runtimeConfig,
        ...config
    };
    
    logger.info('Runtime configuration applied', config);
}

/**
 * GET /api/admin/status
 * 
 * Returns comprehensive system health and status
 */
router.get('/status', adminAccessControl, async (req, res) => {
    try {
        const uptime = process.uptime();
        const memoryUsage = process.memoryUsage();
        
        // Get database status
        let dbStatus = 'disconnected';
        let schemaStatus = 'unknown';
        
        try {
            const result = await query('SELECT 1 as connected');
            dbStatus = result.rows.length > 0 ? 'connected' : 'error';
            
            // Check if key tables exist
            const tableCheck = await query(`
                SELECT COUNT(*) as count
                FROM information_schema.tables
                WHERE table_schema = 'public'
                AND table_name IN ('users', 'user_profile', 'screening_answers')
            `);
            
            schemaStatus = tableCheck.rows[0].count >= 3 ? 'valid' : 'incomplete';
        } catch (error) {
            dbStatus = 'error';
            schemaStatus = 'error';
        }
        
        // Get recent errors from logs
        const recentErrors = [];
        try {
            const errorLogPath = findLogFile('error');
            if (errorLogPath && fs.existsSync(errorLogPath)) {
                const content = fs.readFileSync(errorLogPath, 'utf8');
                const lines = content.split('\n').filter(line => line.trim()).slice(-10);
                
                lines.forEach(line => {
                    try {
                        const entry = JSON.parse(line);
                        recentErrors.push({
                            timestamp: entry.timestamp,
                            message: entry.message,
                            level: entry.level
                        });
                    } catch (e) {
                        // Skip invalid JSON
                    }
                });
            }
        } catch (error) {
            // Error reading log file
        }
        
        res.json({
            uptime: {
                seconds: Math.floor(uptime),
                formatted: formatUptime(uptime)
            },
            memory: {
                heapUsed: Math.floor(memoryUsage.heapUsed / 1024 / 1024),
                heapTotal: Math.floor(memoryUsage.heapTotal / 1024 / 1024),
                rss: Math.floor(memoryUsage.rss / 1024 / 1024),
                external: Math.floor(memoryUsage.external / 1024 / 1024)
            },
            system: {
                platform: os.platform(),
                arch: os.arch(),
                nodeVersion: process.version,
                cpus: os.cpus().length,
                totalMemory: Math.floor(os.totalmem() / 1024 / 1024),
                freeMemory: Math.floor(os.freemem() / 1024 / 1024)
            },
            database: {
                status: dbStatus,
                schemaStatus
            },
            recentErrors: recentErrors.slice(0, 5),
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error getting system status', {
            error: error.message,
            stack: error.stack
        });
        res.status(500).json({
            error: 'Failed to get system status',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/config
 * 
 * Returns current runtime configuration
 */
router.get('/config', adminAccessControl, (req, res) => {
    try {
        const config = loadRuntimeConfig();
        
        // Also include current environment values
        const currentEnv = {
            PERF_LOG_ENABLED: process.env.PERF_LOG_ENABLED === 'true',
            DEBUG_MODE: process.env.DEBUG_MODE === 'true',
            ALERTS_ENABLED: process.env.ALERTS_ENABLED === 'true',
            NODE_ENV: process.env.NODE_ENV || 'development'
        };
        
        res.json({
            saved: config,
            current: currentEnv,
            isProduction: process.env.NODE_ENV === 'production'
        });
    } catch (error) {
        logger.error('Error getting config', { error: error.message });
        res.status(500).json({
            error: 'Failed to get configuration',
            message: error.message
        });
    }
});

/**
 * PUT /api/admin/config
 * 
 * Updates runtime configuration
 * 
 * Request body:
 * {
 *   PERF_LOG_ENABLED: boolean,
 *   DEBUG_MODE: boolean,
 *   ALERTS_ENABLED: boolean
 * }
 */
router.put('/config', adminAccessControl, async (req, res) => {
    try {
        const { PERF_LOG_ENABLED, DEBUG_MODE, ALERTS_ENABLED } = req.body;
        
        const config = loadRuntimeConfig();
        
        // Update only provided values
        if (PERF_LOG_ENABLED !== undefined) {
            config.PERF_LOG_ENABLED = Boolean(PERF_LOG_ENABLED);
        }
        if (DEBUG_MODE !== undefined) {
            config.DEBUG_MODE = Boolean(DEBUG_MODE);
        }
        if (ALERTS_ENABLED !== undefined) {
            config.ALERTS_ENABLED = Boolean(ALERTS_ENABLED);
        }
        
        // Save configuration
        if (!saveRuntimeConfig(config)) {
            const errorMsg = 'Failed to save configuration to file';
            logger.error(errorMsg);
            
            // Send Slack alert on failure
            try {
                await sendSlackAlert('Config update failed: Unable to write to config/runtime.json', {
                    error: 'EACCES - Failed to write config file',
                    environment: process.env.NODE_ENV
                });
            } catch (alertError) {
                logger.error('Failed to send Slack alert', { error: alertError.message });
            }
            
            return res.status(500).json({
                error: 'Failed to save configuration'
            });
        }
        
        // Apply to runtime
        applyRuntimeConfig(config);
        
        logger.info('Configuration updated', {
            updatedBy: req.ip,
            newConfig: config
        });
        
        res.json({
            success: true,
            config,
            message: 'Configuration updated successfully'
        });
    } catch (error) {
        logger.error('Error updating config', { error: error.message });
        
        // Send Slack alert on error
        try {
            await sendSlackAlert('Config update failed with exception', {
                error: error,
                environment: process.env.NODE_ENV
            });
        } catch (alertError) {
            logger.error('Failed to send Slack alert', { error: alertError.message });
        }
        
        res.status(500).json({
            error: 'Failed to update configuration',
            message: error.message
        });
    }
});

/**
 * POST /api/admin/config/update
 * 
 * Updates runtime configuration with immediate sync to memory
 * 
 * Request body:
 * {
 *   PERF_LOG_ENABLED: boolean,
 *   DEBUG_MODE: boolean,
 *   ALERTS_ENABLED: boolean
 * }
 * 
 * Returns:
 * {
 *   success: true,
 *   config: { updated config with all values }
 * }
 */
router.post('/config/update', adminAccessControl, async (req, res) => {
    try {
        const updates = req.body;
        
        // Load current config
        const config = loadRuntimeConfig();
        
        // Update only provided values
        if (updates.PERF_LOG_ENABLED !== undefined) {
            config.PERF_LOG_ENABLED = Boolean(updates.PERF_LOG_ENABLED);
        }
        if (updates.DEBUG_MODE !== undefined) {
            config.DEBUG_MODE = Boolean(updates.DEBUG_MODE);
        }
        if (updates.ALERTS_ENABLED !== undefined) {
            config.ALERTS_ENABLED = Boolean(updates.ALERTS_ENABLED);
        }
        
        // Save to file
        if (!saveRuntimeConfig(config)) {
            const errorMsg = 'Failed to write config/runtime.json';
            logger.error(errorMsg, { config });
            
            // Send Slack alert on file write failure
            try {
                await sendSlackAlert('🚨 AutoApply Admin Config Sync Failed', {
                    error: 'EACCES – Failed to write config/runtime.json',
                    environment: process.env.NODE_ENV
                });
            } catch (alertError) {
                logger.error('Failed to send Slack alert', { error: alertError.message });
            }
            
            return res.status(500).json({
                success: false,
                error: errorMsg
            });
        }
        
        // Update globalThis.runtimeConfig for immediate in-memory sync
        globalThis.runtimeConfig = {
            ...globalThis.runtimeConfig,
            ...config
        };
        
        // Apply to runtime environment
        applyRuntimeConfig(config);
        
        logger.info('Configuration updated via /config/update', {
            updatedBy: req.ip,
            updates,
            newConfig: config
        });
        
        res.json({
            success: true,
            config
        });
    } catch (error) {
        logger.error('Admin config update failed', { error: error.message, stack: error.stack });
        
        // Send Slack alert on exception
        try {
            await sendSlackAlert(`🚨 Config update failed: ${error.message}`, {
                error: error,
                environment: process.env.NODE_ENV
            });
        } catch (alertError) {
            logger.error('Failed to send Slack alert', { error: alertError.message });
        }
        
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});

/**
 * GET /api/admin/config/current
 * 
 * Returns the latest runtime configuration from memory
 * 
 * Returns:
 * {
 *   PERF_LOG_ENABLED: boolean,
 *   DEBUG_MODE: boolean,
 *   ALERTS_ENABLED: boolean,
 *   lastUpdated: string (ISO timestamp)
 * }
 */
router.get('/config/current', adminAccessControl, (req, res) => {
    try {
        // Return current in-memory config
        const currentConfig = globalThis.runtimeConfig || loadRuntimeConfig();
        
        res.json(currentConfig);
    } catch (error) {
        logger.error('Error getting current config', { error: error.message });
        res.status(500).json({
            error: 'Failed to get current configuration',
            message: error.message
        });
    }
});

/**
 * GET /api/admin/logs
 * 
 * Returns recent log entries
 * 
 * Query parameters:
 * - type: 'combined' | 'error' (default: 'combined')
 * - lines: number of lines to return (default: 50, max: 500)
 */
router.get('/logs', adminAccessControl, (req, res) => {
    try {
        const type = req.query.type || 'combined';
        const lines = Math.min(parseInt(req.query.lines || '50', 10), 500);
        
        const logPath = findLogFile(type);
        
        if (!logPath || !fs.existsSync(logPath)) {
            return res.json({
                logs: [],
                message: 'Log file not found'
            });
        }
        
        const content = fs.readFileSync(logPath, 'utf8');
        const logLines = content.split('\n').filter(line => line.trim()).slice(-lines);
        
        const parsedLogs = [];
        logLines.forEach(line => {
            try {
                parsedLogs.push(JSON.parse(line));
            } catch (e) {
                // If not JSON, add as raw text
                parsedLogs.push({ raw: line });
            }
        });
        
        res.json({
            logs: parsedLogs,
            count: parsedLogs.length,
            type,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        logger.error('Error reading logs', { error: error.message });
        res.status(500).json({
            error: 'Failed to read logs',
            message: error.message
        });
    }
});

/**
 * Helper function to find the correct log file path
 * In production, logs are date-stamped (e.g., error-2025-10-09.log)
 * In development, logs are simple (e.g., error.log)
 */
function findLogFile(type) {
    const logsDir = path.join(__dirname, '../../logs');
    
    // In development, use simple log files
    if (process.env.NODE_ENV !== 'production') {
        return path.join(logsDir, `${type}.log`);
    }
    
    // In production, find the most recent date-stamped log file
    try {
        const files = fs.readdirSync(logsDir);
        const pattern = new RegExp(`^${type}-\\d{4}-\\d{2}-\\d{2}\\.log$`);
        const matchingFiles = files.filter(file => pattern.test(file));
        
        if (matchingFiles.length === 0) {
            return null;
        }
        
        // Sort by date (newest first) and return the most recent
        matchingFiles.sort().reverse();
        return path.join(logsDir, matchingFiles[0]);
    } catch (error) {
        logger.error('Error finding log file', { error: error.message, type });
        return null;
    }
}

/**
 * Helper function to format uptime
 */
function formatUptime(seconds) {
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    const parts = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    parts.push(`${secs}s`);
    
    return parts.join(' ');
}

// Initialize runtime config on startup
const initialConfig = loadRuntimeConfig();
applyRuntimeConfig(initialConfig);
globalThis.runtimeConfig = initialConfig;
logger.info('Admin dashboard initialized with runtime config', initialConfig);

module.exports = router;
