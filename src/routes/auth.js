const express = require('express');
const router = express.Router();
const User = require('../database/models/User');
const { generateToken } = require('../middleware/auth');
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

module.exports = router;
