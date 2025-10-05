<<<<<<< HEAD
/**
 * ⚠️ WARNING: THIS IS AN OBSOLETE CONFLICT BACKUP FILE ⚠️
 * 
 * DO NOT USE THIS FILE - IT MAY CONTAIN OUTDATED CONFIGURATIONS
 * 
 * The correct, active server implementation is in: src/server.js
 * 
 * This backup file is kept for reference only and should not be deployed.
 * 
 * ---
 * 
 * Enhanced Auto-Apply Platform Server
 * Integrates existing Apply Autonomously features with new enhanced autoapply functionality
 */

const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const { Pool } = require('pg');
require('dotenv').config();

const { Logger } = require('./utils/logger');
const { initializeEnhancedAutoApply } = require('./enhanced-integration');

// Initialize logger
const logger = new Logger('Server');

// Create Express app
const app = express();
const PORT = process.env.PORT || 8080;

// Security middleware
app.use(helmet({
    contentSecurityPolicy: false, // Disable for development
    crossOriginEmbedderPolicy: false
}));

// CORS configuration
app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
        ? ['https://autoapply-production-1393.up.railway.app']
        : ['http://localhost:3000', 'http://localhost:8080'],
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static file serving
app.use(express.static(path.join(__dirname, '../public')));

// Database connection
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
});

// Test database connection
async function testDatabaseConnection() {
    try {
        const client = await pool.connect();
        await client.query('SELECT NOW()');
        client.release();
        logger.info('Database connection successful');
        return true;
    } catch (error) {
        logger.error('Database connection failed:', error.message);
        return false;
    }
}

// Basic middleware to attach database to requests
app.use((req, res, next) => {
    req.db = pool;
    next();
});

// Health check endpoint
app.get('/health', async (req, res) => {
    try {
        const dbHealthy = await testDatabaseConnection();
        
        res.json({
            status: dbHealthy ? 'healthy' : 'unhealthy',
            timestamp: new Date().toISOString(),
            version: '2.0.0',
            database: dbHealthy ? 'connected' : 'disconnected',
            environment: process.env.NODE_ENV || 'development'
        });
    } catch (error) {
        res.status(500).json({
            status: 'error',
            message: error.message,
            timestamp: new Date().toISOString()
        });
    }
});

// API info endpoint
app.get('/api', (req, res) => {
    res.json({
        name: 'Apply Autonomously Enhanced API',
        version: '2.0.0',
        description: 'Advanced AI-Powered Job Application Automation Platform',
        endpoints: {
            health: 'GET /health',
            api_info: 'GET /api',
            autoapply: {
                start: 'POST /api/autoapply/start',
                stop: 'POST /api/autoapply/stop',
                status: 'GET /api/autoapply/status',
                scan: 'POST /api/autoapply/scan',
                jobs: 'GET /api/autoapply/jobs',
                apply: 'POST /api/autoapply/apply',
                applications: 'GET /api/autoapply/applications',
                stats: 'GET /api/autoapply/stats',
                config: 'GET/POST /api/autoapply/config'
            }
        },
        documentation: '/README.md'
    });
});

// Root endpoint
app.get('/', (req, res) => {
    res.json({
        message: '🚀 Apply Autonomously Enhanced Platform',
        description: 'Advanced AI-Powered Job Application Automation',
        version: '2.0.0',
        status: 'operational',
        features: [
            'Multi-platform job scanning (Indeed, LinkedIn, Glassdoor)',
            'AI-powered job matching with relevance scoring',
            'Intelligent application automation with ATS detection',
            'Magic link authentication system',
            'Comprehensive analytics and reporting',
            'User preference-based filtering',
            'Review and auto application modes'
        ],
        links: {
            health: '/health',
            api: '/api',
            documentation: '/README.md'
        }
    });
});

// Initialize enhanced autoapply features
async function initializeServer() {
    try {
        logger.info('🚀 Starting Apply Autonomously Enhanced Platform');
        
        // Test database connection
        const dbHealthy = await testDatabaseConnection();
        if (!dbHealthy) {
            throw new Error('Database connection failed');
        }
        
        // Initialize enhanced autoapply features
        await initializeEnhancedAutoApply(app);
        
        logger.info('✅ Enhanced autoapply features initialized');
        
        return true;
    } catch (error) {
        logger.error('❌ Server initialization failed:', error.message);
        throw error;
    }
}

// Error handling middleware
app.use((error, req, res, next) => {
    logger.error('Unhandled error:', error.message);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        message: `Route ${req.method} ${req.path} not found`,
        available_endpoints: {
            health: 'GET /health',
            api: 'GET /api',
            root: 'GET /'
        }
    });
});

// Start server
async function startServer() {
    try {
        // Initialize all features
        await initializeServer();
        
        // Start listening
        const server = app.listen(PORT, '0.0.0.0', () => {
            logger.info(`🎯 Server running on port ${PORT}`);
            logger.info(`🌐 Environment: ${process.env.NODE_ENV || 'development'}`);
            logger.info(`🔗 Health check: http://localhost:${PORT}/health`);
            logger.info(`📚 API info: http://localhost:${PORT}/api`);
            logger.info('✅ Apply Autonomously Enhanced Platform ready!');
        });
        
        // Graceful shutdown
        process.on('SIGTERM', () => {
            logger.info('SIGTERM received, shutting down gracefully');
            server.close(() => {
                logger.info('Server closed');
                pool.end(() => {
                    logger.info('Database pool closed');
                    process.exit(0);
                });
            });
        });
        
    } catch (error) {
        logger.error('Failed to start server:', error.message);
=======
require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./utils/logger');
const { initializeDatabase } = require('./database/db');

// Import routes
const authRoutes = require('./routes/auth');
const wizardRoutes = require('./routes/wizard');
const autoApplyRoutes = require('./routes/autoapply');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'data', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/wizard', wizardRoutes);
app.use('/api/autoapply', autoApplyRoutes);

// File upload endpoint (authenticated)
const { authenticateToken } = require('./middleware/auth');

app.post('/api/upload', authenticateToken, upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    try {
        const files = {
            resumePath: req.files?.resume ? req.files.resume[0].path : null,
            coverLetterPath: req.files?.coverLetter ? req.files.coverLetter[0].path : null
        };

        res.json({
            success: true,
            data: files
        });
    } catch (error) {
        logger.error('File upload error:', error);
        res.status(500).json({
            success: false,
            message: 'Error uploading files',
            error: error.message
        });
    }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Initialize database and start server
async function startServer() {
    try {
        // Initialize database tables (if database is configured)
        try {
            await initializeDatabase();
            if (require('./database/db').isDatabaseConfigured()) {
                logger.info('Database initialized successfully');
            }
        } catch (dbError) {
            logger.error('Database initialization failed:', dbError);
            logger.warn('Server will start without database functionality');
            logger.warn('Please configure PostgreSQL credentials in Railway environment variables');
        }

        // Start Express server
        app.listen(PORT, () => {
            logger.info(`Auto-Apply Platform running on port ${PORT}`);
            logger.info(`Landing page: http://localhost:${PORT}`);
            logger.info(`Login: http://localhost:${PORT}/login.html`);
            logger.info(`Signup: http://localhost:${PORT}/signup.html`);

            if (!require('./database/db').isDatabaseConfigured()) {
                logger.warn('⚠️  Database not configured - authentication features will not work');
                logger.warn('⚠️  Set these environment variables: PGHOST, PGUSER, PGPASSWORD, PGDATABASE');
            }
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
>>>>>>> origin/main
        process.exit(1);
    }
}

<<<<<<< HEAD
// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
    logger.error('Uncaught Exception:', error.message);
    process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
    logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
    process.exit(1);
});

// Start the server
startServer();

module.exports = app;
=======
startServer();

module.exports = app;
>>>>>>> origin/main
