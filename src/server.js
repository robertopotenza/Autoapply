/**
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

// Import utilities and middleware
const { Logger } = require('./utils/logger');
const authenticateToken = require('./middleware/auth').authenticateToken;

// Initialize logger
const logger = new Logger('Server');

// Create Express app
const app = express();
const PORT = process.env.PORT || 3000;

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
        logger.info(' Database connected successfully');

        return pool;
    } catch (error) {
        logger.error(' Database connection failed:', error.message);
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

// CRITICAL FIX: API Routes MUST come BEFORE static file serving
app.use('/api/auth', authRoutes);
app.use('/api/wizard', wizardRoutes);
app.use('/api/autoapply', autoApplyRouter);

// Serve static files AFTER API routes to prevent conflicts
app.use(express.static(path.join(__dirname, '../public')));

// Root endpoint
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Dashboard endpoint
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/dashboard.html'));
});

// Wizard endpoint
app.get('/wizard', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/wizard.html'));
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

// Catch-all for SPA routing
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
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
                logger.info(' Enhanced autoapply features initialized');
            } catch (error) {
                logger.warn('Enhanced autoapply features not available:', error.message);
            }
        }

        // Start HTTP server
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info( Apply Autonomously server running on port );
            logger.info( Dashboard: http://localhost:/dashboard);
            logger.info( Wizard: http://localhost:/wizard);
            logger.info( API: http://localhost:/api);
        });

        // Handle server errors
        server.on('error', (error) => {
            if (error.code === 'EADDRINUSE') {
                logger.error( Port  is already in use);
            } else {
                logger.error(' Server error:', error);
            }
            process.exit(1);
        });

        return server;

    } catch (error) {
        logger.error(' Failed to start server:', error);
        process.exit(1);
    }
}

// Start the server
if (require.main === module) {
    startServer().catch((error) => {
        logger.error(' Fatal error starting server:', error);
        process.exit(1);
    });
}

module.exports = { app, startServer };
