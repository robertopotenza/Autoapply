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
        process.exit(1);
    }
}

startServer();

module.exports = app;
