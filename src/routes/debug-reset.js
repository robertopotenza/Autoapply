const express = require('express');
const router = express.Router();
const pool = require('../database/pool');

// Simple debug route to get the latest password reset token
router.get('/latest-reset/:email', async (req, res) => {
    try {
        const { email } = req.params;

        // Get the latest password reset token for this email
        const result = await pool.query(`
            SELECT token, email, expires_at, created_at 
            FROM password_reset_tokens 
            WHERE email = $1 
            ORDER BY created_at DESC 
            LIMIT 1
        `, [email]);

        if (result.rows.length === 0) {
            return res.json({
                success: false,
                message: 'No password reset token found for this email'
            });
        }

        const tokenData = result.rows[0];
        
        // Build reset URL
        const protocol = req.headers['x-forwarded-proto'] || (req.secure ? 'https' : 'http');
        const host = req.headers['x-forwarded-host'] || req.headers.host;
        const baseUrl = `${protocol}://${host}`;
        const resetUrl = `${baseUrl}/reset-password.html?token=${tokenData.token}`;

        res.json({
            success: true,
            email: tokenData.email,
            resetLink: resetUrl,
            expiresAt: tokenData.expires_at,
            createdAt: tokenData.created_at,
            note: 'This is a debug endpoint. Use the resetLink to reset your password.'
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Error retrieving reset token',
            error: error.message
        });
    }
});

module.exports = router;
