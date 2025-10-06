/**
 * Railway-Specific Server Entry Point
 * Addresses potential routing and port binding issues
 */

// Load environment variables first using dotenv-flow for environment-specific configs
require('dotenv-flow').config();

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');

// Initialize Sentry for error tracking (if configured)
let Sentry = null;
if (process.env.SENTRY_DSN) {
    Sentry = require('@sentry/node');
    // Validate tracesSampleRate to be a number between 0 and 1
    let tracesSampleRate = 1.0;
    if (process.env.SENTRY_TRACES_SAMPLE_RATE) {
        const parsedRate = parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE);
        if (!isNaN(parsedRate) && parsedRate >= 0 && parsedRate <= 1) {
            tracesSampleRate = parsedRate;
        } else {
            console.warn(`[Sentry] Invalid SENTRY_TRACES_SAMPLE_RATE: "${process.env.SENTRY_TRACES_SAMPLE_RATE}". Using default value 1.0.`);
        }
    }
    Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',
        tracesSampleRate: tracesSampleRate,
    });
    console.log('✅ Sentry initialized for error tracking');
}

// Import routes
const authRoutes = require('./routes/auth');
const wizardRoutes = require('./routes/wizard');
const { router: autoApplyRouter, initializeOrchestrator } = require('./routes/autoapply');
const debugRoutes = require('./routes/debug');
const debugResetRoutes = require('./routes/debug-reset');

// Import utilities and middleware
const { Logger } = require('./utils/logger');

// Initialize logger
const logger = new Logger('Railway-Server');

// Create Express app
const app = express();

// RAILWAY-SPECIFIC PORT CONFIGURATION
const PORT = parseInt(process.env.PORT) || 8080;

// Enhanced Railway debugging
logger.info(`🚀 RAILWAY DEPLOYMENT - ${new Date().toISOString()}`);
logger.info(`🔍 Railway Environment Variables:`);
logger.info(`   PORT: ${process.env.PORT}`);
logger.info(`   NODE_ENV: ${process.env.NODE_ENV}`);
logger.info(`   RAILWAY_ENVIRONMENT: ${process.env.RAILWAY_ENVIRONMENT}`);
logger.info(`   RAILWAY_PROJECT_ID: ${process.env.RAILWAY_PROJECT_ID}`);
logger.info(`   RAILWAY_SERVICE_ID: ${process.env.RAILWAY_SERVICE_ID}`);
logger.info(`🎯 Server will bind to: 0.0.0.0:${PORT}`);

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://autoapply-production-1393.up.railway.app'] 
        : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Request logging for debugging
app.use((req, res, next) => {
    logger.info(`📥 ${req.method} ${req.path} from ${req.ip}`);
    next();
});

// Import shared database pool
const pool = require('./database/pool');

async function initializeDatabase() {
    try {
        if (!process.env.DATABASE_URL) {
            logger.warn('⚠️ DATABASE_URL not found - running without database');
            return;
        }

        // Use the shared pool from pool.js (already configured with SSL, etc.)
        // Test database connection
        const testResult = await pool.query('SELECT NOW() as timestamp');
        logger.info(`✅ Database connected successfully: ${testResult.rows[0].timestamp}`);
        
        // Add database to request object
        app.use((req, res, next) => {
            req.db = pool;
            next();
        });
    } catch (error) {
        logger.error('❌ Database connection failed:', error.message);
        throw error;
    }
}

// Health check endpoint (HIGHEST PRIORITY)
app.get('/health', (req, res) => {
    logger.info('🏥 Health check requested');
    res.status(200).json({ 
        status: 'operational', 
        timestamp: new Date().toISOString(),
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        database: !!pool,
        railway: {
            project: process.env.RAILWAY_PROJECT_ID || 'unknown',
            service: process.env.RAILWAY_SERVICE_ID || 'unknown',
            environment: process.env.RAILWAY_ENVIRONMENT || 'unknown'
        }
    });
});

// Root endpoint test
app.get('/', (req, res) => {
    logger.info('🏠 Root endpoint accessed');
    res.status(200).json({
        message: 'Apply Autonomously Server - Railway Deployment',
        timestamp: new Date().toISOString(),
        status: 'operational',
        port: PORT,
        endpoints: {
            health: '/health',
            dashboard: '/dashboard.html',
            wizard: '/wizard.html',
            api: '/api'
        }
    });
});

// Test deployment endpoint
app.get('/test-deployment', (req, res) => {
    logger.info('🧪 Test deployment endpoint accessed');
    res.status(200).json({
        message: 'RAILWAY ROUTING TEST - SUCCESS',
        timestamp: new Date().toISOString(),
        deployment: {
            id: 'RAILWAY-ROUTING-FIX-' + Date.now(),
            port: PORT,
            host: '0.0.0.0',
            environment: process.env.NODE_ENV,
            railway_vars: Object.keys(process.env).filter(k => k.includes('RAILWAY'))
        }
    });
});

// API Routes (before static files)
app.use('/api/auth', authRoutes);
app.use('/api/wizard', wizardRoutes);
app.use('/api/autoapply', autoApplyRouter);
app.use('/api/debug', debugRoutes);
app.use('/api/debug-reset', debugResetRoutes);

// Static file serving
app.use(express.static(path.join(__dirname, '../public')));

// Explicit HTML file routes
app.get('/dashboard.html', (req, res) => {
    logger.info('📊 Dashboard requested');
    const dashboardPath = path.join(__dirname, '../public/dashboard.html');
    res.sendFile(dashboardPath);
});

app.get('/wizard.html', (req, res) => {
    logger.info('🧙‍♂️ Wizard requested');
    const wizardPath = path.join(__dirname, '../public/wizard.html');
    res.sendFile(wizardPath);
});

app.get('/login.html', (req, res) => {
    logger.info('🔐 Login requested');
    const loginPath = path.join(__dirname, '../public/login.html');
    res.sendFile(loginPath);
});

// Catch-all route for debugging
app.use('*', (req, res) => {
    logger.warn(`❓ Unmatched route: ${req.method} ${req.originalUrl}`);
    res.status(404).json({
        error: 'Route not found',
        method: req.method,
        path: req.originalUrl,
        timestamp: new Date().toISOString(),
        availableEndpoints: [
            '/health',
            '/test-deployment',
            '/',
            '/dashboard.html',
            '/wizard.html',
            '/api/auth/*',
            '/api/wizard/*',
            '/api/autoapply/*'
        ]
    });
});

// Sentry error handler must be before any other error middleware
if (Sentry) {
    app.use(Sentry.expressErrorHandler());
}

// Error handling
app.use((error, req, res, next) => {
    logger.error('💥 Unhandled error:', error);
    
    res.status(500).json({
        error: 'Internal server error',
        message: error.message,
        timestamp: new Date().toISOString()
    });
});

// Server startup with enhanced error handling
async function startServer() {
    try {
        logger.info('🚀 Starting Railway server...');
        
        // Initialize database
        await initializeDatabase();
        
        // Initialize autoapply orchestrator if available
        try {
            if (typeof initializeOrchestrator === 'function') {
                await initializeOrchestrator(pool);
                logger.info('✅ AutoApply orchestrator initialized');
            }
        } catch (orchError) {
            logger.warn('⚠️ AutoApply orchestrator initialization failed:', orchError.message);
        }
        
        // Start HTTP server with enhanced Railway binding
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info('🎯 Railway server running successfully!');
            logger.info(`🌐 Port: ${PORT}`);
            logger.info(`🔗 Health: http://localhost:${PORT}/health`);
            logger.info(`🔗 Test: http://localhost:${PORT}/test-deployment`);
            logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
        });
        
        server.on('error', (error) => {
            logger.error('❌ Server startup error:', error);
            process.exit(1);
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('📴 Received SIGTERM, shutting down gracefully');
            server.close(() => {
                if (pool) {
                    pool.end();
                }
                process.exit(0);
            });
        });
        
        // Capture unhandled exceptions and rejections
        process.on('unhandledRejection', (reason, promise) => {
            logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
            
            if (Sentry) {
                Sentry.captureException(reason);
            }
        });

        process.on('uncaughtException', (error) => {
            logger.error('Uncaught Exception:', error);
            
            if (Sentry) {
                Sentry.captureException(error);
            }
            
            // Give Sentry time to send the error before exiting
            setTimeout(() => {
                process.exit(1);
            }, 1000);
        });
        
        return server;
        
    } catch (error) {
        logger.error('💥 Failed to start server:', error);
        process.exit(1);
    }
}

// Start server immediately
if (require.main === module) {
    startServer().catch(error => {
        console.error('❌ Critical startup failure:', error);
        process.exit(1);
    });
}

module.exports = { app, startServer };