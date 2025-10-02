const express = require('express');
const router = express.Router();
const User = require('../database/models/User');
const MagicLink = require('../database/models/MagicLink');
const { generateToken } = require('../middleware/auth');
const emailService = require('../utils/emailService');
const logger = require('../utils/logger');

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/auth/signup
router.post('/signup', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 8 characters long'
            });
        }

        // Check if user already exists
        const existingUser = await User.findByEmail(email);
        if (existingUser) {
            return res.status(409).json({
                success: false,
                message: 'User with this email already exists'
            });
        }

        // Create user
        const user = await User.create(email, password);

        // Generate token
        const token = generateToken(user.user_id, user.email);

        logger.info(`New user registered: ${email}`);

        res.status(201).json({
            success: true,
            message: 'User created successfully',
            data: {
                userId: user.user_id,
                email: user.email,
                token
            }
        });

    } catch (error) {
        logger.error('Signup error:', error);
        res.status(500).json({
            success: false,
            message: 'Error creating user',
            error: error.message
        });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validation
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Email and password are required'
            });
        }

        // Find user
        const user = await User.findByEmail(email);
        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Verify password
        const isValidPassword = await User.verifyPassword(password, user.password_hash);
        if (!isValidPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid email or password'
            });
        }

        // Generate token
        const token = generateToken(user.user_id, user.email);

        logger.info(`User logged in: ${email}`);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                userId: user.user_id,
                email: user.email,
                token
            }
        });

    } catch (error) {
        logger.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Error logging in',
            error: error.message
        });
    }
});

// GET /api/auth/me (get current user info)
router.get('/me', async (req, res) => {
    try {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1];

        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'No token provided'
            });
        }

        const { verifyToken } = require('../middleware/auth');
        const decoded = verifyToken(token);

        if (!decoded) {
            return res.status(403).json({
                success: false,
                message: 'Invalid token'
            });
        }

        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        res.json({
            success: true,
            data: {
                userId: user.user_id,
                email: user.email,
                createdAt: user.created_at
            }
        });

    } catch (error) {
        logger.error('Get user info error:', error);
        res.status(500).json({
            success: false,
            message: 'Error getting user info',
            error: error.message
        });
    }
});

// POST /api/auth/magic-link - Request magic link (passwordless login)
router.post('/magic-link', async (req, res) => {
    try {
        const { email } = req.body;

        // Validation
        if (!email) {
            return res.status(400).json({
                success: false,
                message: 'Email is required'
            });
        }

        if (!EMAIL_REGEX.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid email format'
            });
        }

        // Check if database is configured
        const { isDatabaseConfigured } = require('../database/db');
        if (!isDatabaseConfigured()) {
            return res.status(503).json({
                success: false,
                message: 'Database not configured. Please set up PostgreSQL credentials in environment variables.',
                hint: 'Contact admin to configure PGHOST, PGUSER, PGPASSWORD, and PGDATABASE'
            });
        }

        // Check if user exists, create if not
        let user = await User.findByEmail(email);

        if (!user) {
            // Create passwordless user
            user = await User.createPasswordless(email);
            logger.info(`New passwordless user created: ${email}`);
        }

        // Generate magic link token
        const magicLinkData = await MagicLink.create(email);

        // Build magic link URL - use request host or environment variable
        let baseUrl = process.env.BASE_URL;

        if (!baseUrl) {
            // Auto-detect from request
            const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
            const host = req.headers['x-forwarded-host'] || req.headers.host;
            baseUrl = `${protocol}://${host}`;
        }

        const magicLinkUrl = `${baseUrl}/verify-magic-link.html?token=${magicLinkData.token}`;

        logger.info(`Generated magic link URL: ${magicLinkUrl}`);

        // Send email
        try {
            const emailResult = await emailService.sendMagicLink(email, magicLinkUrl);
            logger.info(`Magic link sent to: ${email} via ${emailResult.mode}`);
        } catch (emailError) {
            logger.error('Error sending magic link email:', emailError);
            // Still return success to user (don't reveal email send failures)
        }

        res.json({
            success: true,
            message: 'Magic link sent! Check your email (or console in dev mode) to continue.',
            // In development, always return the link
            ...(process.env.NODE_ENV !== 'production' && {
                magicLink: magicLinkUrl,
                devNote: 'In development mode, check the server console for the magic link.'
            })
        });

    } catch (error) {
        logger.error('Magic link request error:', error);

        // Provide more specific error messages
        let message = 'Error sending magic link';
        if (error.message && error.message.includes('Database not configured')) {
            message = 'Database not configured. Please contact administrator.';
        } else if (error.code === 'ECONNREFUSED') {
            message = 'Cannot connect to database. Please configure database credentials.';
        }

        res.status(500).json({
            success: false,
            message,
            error: process.env.NODE_ENV !== 'production' ? error.message : undefined
        });
    }
});

// GET /api/auth/verify-magic-link - Verify magic link token
router.get('/verify-magic-link', async (req, res) => {
    try {
        const { token } = req.query;

        if (!token) {
            return res.status(400).json({
                success: false,
                message: 'Token is required'
            });
        }

        // Verify token
        const magicLink = await MagicLink.verify(token);

        if (!magicLink) {
            return res.status(401).json({
                success: false,
                message: 'Invalid or expired magic link'
            });
        }

        // Mark token as used
        await MagicLink.markAsUsed(token);

        // Find user
        const user = await User.findByEmail(magicLink.email);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User not found'
            });
        }

        // Generate JWT token
        const jwtToken = generateToken(user.user_id, user.email);

        logger.info(`User logged in via magic link: ${user.email}`);

        res.json({
            success: true,
            message: 'Login successful',
            data: {
                userId: user.user_id,
                email: user.email,
                token: jwtToken
            }
        });

    } catch (error) {
        logger.error('Magic link verification error:', error);
        res.status(500).json({
            success: false,
            message: 'Error verifying magic link',
            error: error.message
        });
    }
});

module.exports = router;
