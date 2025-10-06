﻿/**
 * Comprehensive Apply Autonomously Server
 * Combines enhanced autoapply features with user authentication and management
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const wizardRoutes = require('./routes/wizard');
const { router: autoApplyRouter, initializeOrchestrator } = require('./routes/autoapply');
const debugRoutes = require('./routes/debug');
const debugResetRoutes = require('./routes/debug-reset');
const diagnosticsRoutes = require('./routes/diagnostics');

// Import utilities and middleware
const { createLogger, logError } = require('./utils/logger');
const { verifyDatabaseSchema } = require('../diagnostics/verify-database');

// Initialize logger
const logger = createLogger('server');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

// Debug Railway environment - FORCE CACHE REFRESH v3.0 - CRITICAL FIX
const DEPLOYMENT_ID = `CRITICAL-HTML-FIX-${Date.now()}`;
logger.info(`🔍 Environment Debug - DEPLOYMENT ${DEPLOYMENT_ID}:`);
logger.info(`   NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(`   PORT (Railway): ${process.env.PORT}`);
logger.info(`   PORT (Used): ${PORT}`);
logger.info(`   Railway Internal: ${process.env.RAILWAY_ENVIRONMENT || 'Not set'}`);
logger.info(`   All ENV vars: ${Object.keys(process.env).filter(k => k.includes('PORT') || k.includes('RAILWAY')).join(', ')}`);
logger.info(`   🚀 DEPLOYMENT ID: ${DEPLOYMENT_ID} - ${new Date().toISOString()}`);

// Middleware
app.use(cors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

if (process.env.DEBUG === 'true') {
    app.use((req, res, next) => {
        console.log(`[DEBUG] ${req.method} ${req.originalUrl}`);
        next();
    });
}

// Database connection
let pool = null;
let serverInstance = null;
let shuttingDown = false;

// Helper function to split SQL statements
function splitSqlStatements(sql) {
    return sql
        // Remove line comments
        .replace(/--.*$/gm, '')
        // Remove block comments
        .replace(/\/\*[\s\S]*?\*\//gm, '')
        .split(/;\s*(?:\r?\n|$)/)
        .map(statement => statement.trim())
        .filter(statement => statement.length > 0);
}

// Helper function to run a migration file
async function runMigrationFile(pool, migrationPath, label) {
    if (!fs.existsSync(migrationPath)) {
        logger.warn(`⚠️  Migration file not found: ${label}`);
        return;
    }

    logger.info(`🔄 Running migration: ${label}...`);
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    const statements = splitSqlStatements(sql);

    for (const statement of statements) {
        try {
            await pool.query(statement);
        } catch (error) {
            // If table already exists, that's OK
            if (error.code === '42P07') {
                continue;
            }
            logger.logError(error, { stage: 'migration', label, statement });
            throw error;
        }
    }

    logger.info(`✅ Migration ${label} completed (${statements.length} statements)`);
}

async function initializeDatabase() {
    try {
        if (!process.env.DATABASE_URL) {
            logger.warn('DATABASE_URL not found, some features may be limited');
            return null;
        }

        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
        });

        // Test connection
        await pool.query('SELECT NOW()');
        logger.info('✅ Database connected successfully');

        // Initialize database schema
        const schemaPath = path.join(__dirname, '../database/schema.sql');

        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schema);
            logger.info('✅ Database schema initialized successfully');
        } else {
            logger.warn('⚠️  Schema file not found at:', schemaPath);
        }

        // Run migrations
        logger.info('🔄 Running database migrations...');
        const migrationsDir = path.join(__dirname, '../database/migrations');
        
        if (fs.existsSync(migrationsDir)) {
            // Get all migration files in order
            const migrationFiles = fs.readdirSync(migrationsDir)
                .filter(file => file.endsWith('.sql'))
                .sort(); // Sort to ensure correct order
            
            for (const migrationFile of migrationFiles) {
                const migrationPath = path.join(migrationsDir, migrationFile);
                await runMigrationFile(pool, migrationPath, migrationFile);
            }
            
            logger.info('✅ All migrations completed successfully');
        } else {
            logger.warn('⚠️  Migrations directory not found');
        }

        return pool;
    } catch (error) {
        logger.logError(error, { stage: 'initializeDatabase' });

        // If error is about existing tables, that's OK
        if (error.code === '42P07') {
            logger.info('ℹ️  Tables already exist, continuing...');
            return pool;
        }

        return null;
    }
}

async function shutdownGracefully(reason) {
    if (shuttingDown) {
        return;
    }

    shuttingDown = true;

    const details =
        typeof reason === 'string'
            ? { signal: reason }
            : { message: reason && reason.message ? reason.message : reason };

    logger.warn('Initiating graceful shutdown', details);

    if (serverInstance) {
        try {
            await new Promise((resolve) => serverInstance.close(resolve));
            logger.info('HTTP server closed');
        } catch (error) {
            logger.logError(error, { stage: 'shutdown', action: 'close-server' });
        }
    }

    if (pool) {
        try {
            await pool.end();
            logger.info('Database connections closed');
        } catch (error) {
            logger.logError(error, { stage: 'shutdown', action: 'close-database' });
        }
    }

    const exitCode = typeof reason === 'string' ? 0 : 1;
    process.exit(exitCode);
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        uptime: Math.round(process.uptime()),
        db: pool ? 'connected' : 'disconnected'
    });
});

// Test endpoint to verify deployment updates
app.get('/test-deployment', (req, res) => {
    res.json({
        message: 'CRITICAL HTML FIX DEPLOYMENT - October 4, 2025 - Version 3.0',
        timestamp: new Date().toISOString(),
        deploymentId: DEPLOYMENT_ID,
        staticFilesPath: path.join(__dirname, '../public'),
        indexExists: fs.existsSync(path.join(__dirname, '../public/index.html')),
        dashboardExists: fs.existsSync(path.join(__dirname, '../public/dashboard.html')),
        explicitRoutesActive: true
    });
});

// CRITICAL FIX: API Routes MUST come BEFORE static file serving
app.use('/api/auth', authRoutes);
app.use('/api/wizard', wizardRoutes);
app.use('/api/autoapply', autoApplyRouter);
app.use('/api/debug', debugRoutes);
app.use('/api/debug-reset', debugResetRoutes);
app.use('/api/diagnostics', diagnosticsRoutes);

// Serve static files AFTER API routes to prevent conflicts
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint - Force serve index.html
app.get('/', (req, res) => {
    try {
        const indexPath = path.join(__dirname, '../public/index.html');
        logger.info(`Serving index.html from: ${indexPath}`);
        res.sendFile(indexPath);
    } catch (error) {
        logger.logError(error, { route: '/', action: 'serve-index' });
        res.status(500).send('Error loading application');
    }
});

// CRITICAL FIX: Explicit routes for ALL HTML files to fix Railway static file serving
// Dashboard endpoints (both /dashboard and /dashboard.html)
app.get('/dashboard', (req, res) => {
    try {
        const dashboardPath = path.join(__dirname, '../public/dashboard.html');
        logger.info(`Serving dashboard.html from: ${dashboardPath}`);
        res.sendFile(dashboardPath);
    } catch (error) {
        logger.logError(error, { route: '/dashboard', action: 'serve-dashboard' });
        res.status(500).send('Error loading dashboard');
    }
});

app.get('/dashboard.html', (req, res) => {
    try {
        const dashboardPath = path.join(__dirname, '../public/dashboard.html');
        logger.info(`Serving dashboard.html from: ${dashboardPath}`);
        res.sendFile(dashboardPath);
    } catch (error) {
        logger.logError(error, { route: '/dashboard.html', action: 'serve-dashboard' });
        res.status(500).send('Error loading dashboard');
    }
});

// Wizard endpoint (handles both /wizard and /wizard.html)
app.get('/wizard(.html)?', (req, res) => {
    try {
        const wizardPath = path.join(__dirname, '../public/wizard.html');
        logger.info(`Serving wizard.html from: ${wizardPath}`);
        res.sendFile(wizardPath);
    } catch (error) {
        logger.logError(error, { route: '/wizard', action: 'serve-wizard' });
        res.status(500).send('Error loading wizard');
    }
});

// Login endpoints
app.get('/login.html', (req, res) => {
    try {
        const loginPath = path.join(__dirname, '../public/login.html');
        logger.info(`Serving login.html from: ${loginPath}`);
        res.sendFile(loginPath);
    } catch (error) {
        logger.logError(error, { route: '/login.html', action: 'serve-login' });
        res.status(500).send('Error loading login');
    }
});

// Signup endpoints
app.get('/signup.html', (req, res) => {
    try {
        const signupPath = path.join(__dirname, '../public/signup.html');
        logger.info(`Serving signup.html from: ${signupPath}`);
        res.sendFile(signupPath);
    } catch (error) {
        logger.logError(error, { route: '/signup.html', action: 'serve-signup' });
        res.status(500).send('Error loading signup');
    }
});

// Applications endpoint (handles both /applications and /applications.html)
app.get('/applications(.html)?', (req, res) => {
    try {
        const applicationsPath = path.join(__dirname, '../public/applications.html');
        logger.info(`Serving applications.html from: ${applicationsPath}`);
        res.sendFile(applicationsPath);
    } catch (error) {
        logger.logError(error, { route: '/applications', action: 'serve-applications' });
        res.status(500).send('Error loading applications');
    }
});

// Index.html endpoint
app.get('/index.html', (req, res) => {
    try {
        const indexPath = path.join(__dirname, '../public/index.html');
        logger.info(`Serving index.html from: ${indexPath}`);
        res.sendFile(indexPath);
    } catch (error) {
        logger.logError(error, { route: '/index.html', action: 'serve-index' });
        res.status(500).send('Error loading index');
    }
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Apply Autonomously API',
        version: '2.0.0',
        description: 'Enhanced autoapply platform with user authentication',
        endpoints: {
            auth: '/api/auth',
            wizard: '/api/wizard',
            autoapply: '/api/autoapply'
        },
        documentation: '/api/docs'
    });
});

// Catch-all for SPA routing - Force serve index.html for all unmatched routes
app.get('*', (req, res) => {
    try {
        const indexPath = path.join(__dirname, '../public/index.html');
        logger.info(`Catch-all serving index.html for route: ${req.path}`);
        res.sendFile(indexPath);
    } catch (error) {
        logger.logError(error, { route: req.path, action: 'catch-all' });
        res.status(500).send('Error loading application');
    }
});

// Error handling middleware
app.use((error, req, res, next) => {
    logger.logError(error, { route: req.originalUrl, stage: 'error-middleware' });
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGTERM', () => shutdownGracefully('SIGTERM'));
process.on('SIGINT', () => shutdownGracefully('SIGINT'));

process.on('unhandledRejection', (reason) => {
    logError(reason instanceof Error ? reason : new Error(String(reason)), 'process:unhandledRejection');
    shutdownGracefully(reason);
});

process.on('uncaughtException', (error) => {
    logError(error, 'process:uncaughtException');
    shutdownGracefully(error);
});

// Start server
async function startServer() {
    try {
        pool = await initializeDatabase();

        if (!pool) {
            throw new Error('Database initialization failed');
        }

        await verifyDatabaseSchema({ pool, logger });
        logger.info('✅ Database schema verified');

        app.locals.db = pool;

        try {
            initializeOrchestrator(pool);
            logger.info('🚀 Enhanced autoapply features initialized');
        } catch (error) {
            logger.logError(error, { stage: 'initializeOrchestrator' });
        }

        serverInstance = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🎯 Apply Autonomously server running on port ${PORT}`);
            logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
            logger.info(`🧙‍♂️ Wizard: http://localhost:${PORT}/wizard`);
            logger.info(`🔌 API: http://localhost:${PORT}/api`);
        });

        serverInstance.on('error', (error) => {
            if (error && error.code === 'EADDRINUSE') {
                logger.logError(error, { stage: 'server-listen', code: 'EADDRINUSE', port: PORT });
            } else {
                logger.logError(error, { stage: 'server-listen' });
            }
            shutdownGracefully(error);
        });

        return serverInstance;
    } catch (error) {
        logger.logError(error, { stage: 'startServer' });
        throw error;
    }
}

// Start the server
if (require.main === module) {
    startServer().catch(async (error) => {
        logError(error, 'startup');
        await shutdownGracefully(error);
    });
}

module.exports = { app, startServer };
