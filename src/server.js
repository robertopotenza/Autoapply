﻿/**
 * Comprehensive Apply Autonomously Server
 * Combines enhanced autoapply features with user authentication and management
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { Pool } = require('pg');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const wizardRoutes = require('./routes/wizard');
const { router: autoApplyRouter, initializeOrchestrator } = require('./routes/autoapply');
const debugRoutes = require('./routes/debug');
const debugResetRoutes = require('./routes/debug-reset');

// Import utilities and middleware
const { Logger } = require('./utils/logger');
const authenticateToken = require('./middleware/auth').authenticateToken;

// Initialize logger
const logger = new Logger('Server');

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

// Database connection
let pool = null;

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
        const fs = require('fs');
        const schemaPath = path.join(__dirname, '../database/schema.sql');

        if (fs.existsSync(schemaPath)) {
            const schema = fs.readFileSync(schemaPath, 'utf8');
            await pool.query(schema);
            logger.info('✅ Database schema initialized successfully');
        } else {
            logger.warn('⚠️  Schema file not found at:', schemaPath);
        }

        return pool;
    } catch (error) {
        logger.error('❌ Database initialization failed:', error.message);

        // If error is about existing tables, that's OK
        if (error.code === '42P07') {
            logger.info('ℹ️  Tables already exist, continuing...');
            return pool;
        }

        return null;
    }
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({
        status: 'operational',
        timestamp: new Date().toISOString(),
        database: !!pool,
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
        indexExists: require('fs').existsSync(path.join(__dirname, '../public/index.html')),
        dashboardExists: require('fs').existsSync(path.join(__dirname, '../public/dashboard.html')),
        explicitRoutesActive: true
    });
});

// CRITICAL FIX: API Routes MUST come BEFORE static file serving
app.use('/api/auth', authRoutes);
app.use('/api/wizard', wizardRoutes);
app.use('/api/autoapply', autoApplyRouter);
app.use('/api/debug', debugRoutes);
app.use('/api/debug-reset', debugResetRoutes);

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

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error);
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

// Start server
async function startServer() {
    try {
        // Initialize database
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

        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🎯 Apply Autonomously server running on port ${PORT}`);
            logger.info(`📊 Dashboard: http://localhost:${PORT}/dashboard`);
            logger.info(`🧙‍♂️ Wizard: http://localhost:${PORT}/wizard`);
            logger.info(`🔌 API: http://localhost:${PORT}/api`);
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
