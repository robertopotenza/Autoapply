/**
 * Comprehensive Apply Autonomously Server
 * Combines enhanced autoapply features with user authentication and management
 */

// Load environment variables first using dotenv-flow for environment-specific configs
require('dotenv-flow').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Pool } = require('pg');

// Initialize Sentry for error tracking (if configured)
let Sentry = null;
if (process.env.SENTRY_DSN) {
    Sentry = require('@sentry/node');
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: (() => {
            const rate = process.env.SENTRY_TRACES_SAMPLE_RATE;
            const parsed = rate !== undefined ? parseFloat(rate) : 1.0;
            return (!isNaN(parsed) && parsed >= 0 && parsed <= 1) ? parsed : 1.0;
        })(),
    });
    console.log('✅ Sentry initialized for error tracking');
}

// Import routes
const authRoutes = require('./routes/auth');
const wizardRoutes = require('./routes/wizard');
const { router: autoApplyRouter, initializeOrchestrator } = require('./routes/autoapply');
const debugRoutes = require('./routes/debug');
const debugResetRoutes = require('./routes/debug-reset');
const diagnosticsRoutes = require('./routes/diagnostics');

// Import utilities and middleware
const { Logger } = require('./utils/logger');
const { verifySchema } = require('./utils/verifySchema');
const authenticateToken = require('./middleware/auth').authenticateToken;
const traceIdMiddleware = require('./middleware/traceId');

// Initialize logger
const logger = new Logger('Server');

// Global error handlers - must be set up early
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception', {
        error: err.message,
        stack: err.stack,
        name: err.name,
        code: err.code
    });
    // Give logger time to flush, then exit
    setTimeout(() => {
        process.exit(1);
    }, 1000);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection', {
        reason: reason instanceof Error ? {
            message: reason.message,
            stack: reason.stack,
            name: reason.name
        } : reason,
        promise: promise.toString()
    });
});

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

// Add traceId middleware early - after body parsers, before routes
app.use(traceIdMiddleware(logger));

// Database connection
let pool = null;

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
            logger.error(`❌ Migration ${label} failed on statement:\n${statement}`);
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

        // Verify schema compatibility
        logger.info('🔍 Verifying schema compatibility...');
        try {
            await verifySchema(pool);
            logger.info('✅ Schema verified — starting server...');
        } catch (error) {
            logger.error('❌ Schema verification failed:', error.message);
            // Close pool before re-throwing
            await pool.end();
            throw error;
        }

        return pool;
    } catch (error) {
        logger.error('❌ Database initialization failed:', error.message);

        // If error is about existing tables, that's OK
        if (error.code === '42P07') {
            logger.info('ℹ️  Tables already exist, continuing...');
            return pool;
        }

        // For schema verification failures and other critical errors, re-throw
        // to prevent server from starting
        throw error;
    }
}

// Track initialization state
let isInitializing = true;
let initializationError = null;

// Health check endpoint - Always responds 200 to pass Railway health checks
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        database: !!pool,
        initializing: isInitializing,
        initializationError: initializationError ? initializationError.message : null,
        environment: process.env.NODE_ENV || 'development'
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
        logger.error('Error serving index.html:', error);
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
        logger.error('Error serving dashboard.html:', error);
        res.status(500).send('Error loading dashboard');
    }
});

app.get('/dashboard.html', (req, res) => {
    try {
        const dashboardPath = path.join(__dirname, '../public/dashboard.html');
        logger.info(`Serving dashboard.html from: ${dashboardPath}`);
        res.sendFile(dashboardPath);
    } catch (error) {
        logger.error('Error serving dashboard.html:', error);
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
        logger.error('Error serving wizard.html:', error);
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
        logger.error('Error serving login.html:', error);
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
        logger.error('Error serving signup.html:', error);
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
        logger.error('Error serving applications.html:', error);
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
        logger.error('Error serving index.html:', error);
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
        logger.error('Error in catch-all route:', error);
        res.status(500).send('Error loading application');
    }
});

// Sentry error handler must be before any other error middleware
if (Sentry) {
    app.use(Sentry.expressErrorHandler());
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
    // Log the error with structured context
    if (error.toJSON && typeof error.toJSON === 'function') {
        // This is an AppError with structured information
        logger.error('Request error (AppError)', error.toJSON());
    } else {
        // Standard error
        logger.error('Request error', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            path: req.path,
            method: req.method
        });
    }
    
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// Graceful shutdown
process.on('SIGTERM', async () => {
    logger.info('SIGTERM received, shutting down gracefully');

    if (pool) {
        await pool.end();
        logger.info('Database connections closed');
    }

    process.exit(0);
});

process.on('SIGINT', async () => {
    logger.info('SIGINT received, shutting down gracefully');

    if (pool) {
        await pool.end();
        logger.info('Database connections closed');
    }

    process.exit(0);
});

// Initialize database asynchronously (non-blocking)
async function initializeDatabaseAsync() {
    try {
        logger.info('🔄 Starting database initialization...');
        pool = await initializeDatabase();

        if (pool) {
            // Attach database to app for middleware
            app.locals.db = pool;

            // Initialize enhanced autoapply features if available
            try {
                initializeOrchestrator(pool);
                logger.info('🚀 Enhanced autoapply features initialized');
            } catch (error) {
                logger.warn('⚠️  Enhanced autoapply features not available:', error.message);
            }
        }

        isInitializing = false;
        logger.info('✅ Database initialization completed');
    } catch (error) {
        logger.error('❌ Database initialization failed:', error);
        initializationError = error;
        isInitializing = false;
        // Don't exit - allow server to continue running without database.
        // ⚠️ Implications:
        //   - Endpoints/features that require database access (e.g., authentication, user management, autoapply features)
        //     will be unavailable or may return errors until the database is initialized.
        //   - Health check and static endpoints will continue to function.
        //   - Dashboard, wizard, and API routes that depend on database queries will fail or be degraded.
        //   - See documentation for details on which routes require database connectivity.
    }
}

// Start server
async function startServer() {
    try {
        // Start HTTP server FIRST (before database initialization)
        // This allows health checks to pass immediately
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🎯 Apply Autonomously server running on port ${PORT}`);
            logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
            logger.info(`🧙‍♂️ Wizard: http://localhost:${PORT}/wizard`);
            logger.info(`🔌 API: http://localhost:${PORT}/api`);
            logger.info(`💚 Health: http://localhost:${PORT}/health`);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error(`❌ Port ${PORT} is already in use`);
            } else {
                logger.error('❌ Server error:', error);
            }
            process.exit(1);
        });

        // Initialize database asynchronously AFTER server is listening
        // This prevents blocking the health check endpoint
        initializeDatabaseAsync();

        return server;

    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer().catch((error) => {
        logger.error('❌ Fatal error starting server:', error);
        process.exit(1);
    });
}

module.exports = { app, startServer };
