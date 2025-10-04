const { query } = require('../db');
const crypto = require('crypto');

class PasswordReset {
    /**
     * Create a password reset token for a user
     * @param {string} email - User's email address
     * @returns {Promise<Object>} - Reset token data
     */
    static async create(email) {
        // Generate secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // Token expires in 1 hour
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        const result = await query(
            `INSERT INTO password_reset_tokens (email, token, expires_at)
             VALUES ($1, $2, $3)
             RETURNING token, email, expires_at, created_at`,
            [email, token, expiresAt]
        );

        return result.rows[0];
    }

    /**
     * Verify a password reset token
     * @param {string} token - Reset token to verify
     * @returns {Promise<Object|null>} - Token data if valid, null if invalid/expired
     */
    static async verify(token) {
        const result = await query(
            `SELECT token, email, expires_at, used_at
             FROM password_reset_tokens
             WHERE token = $1
             AND expires_at > NOW()
             AND used_at IS NULL`,
            [token]
        );

        return result.rows[0] || null;
    }

    /**
     * Mark a reset token as used
     * @param {string} token - Reset token to mark as used
     */
    static async markAsUsed(token) {
        await query(
            'UPDATE password_reset_tokens SET used_at = NOW() WHERE token = $1',
            [token]
        );
    }

    /**
     * Clean up expired tokens (older than 24 hours)
     * This can be called periodically to keep the table clean
     */
    static async cleanupExpired() {
        await query(
            'DELETE FROM password_reset_tokens WHERE expires_at < NOW() - INTERVAL \'24 hours\'',
            []
        );
    }
}

module.exports = PasswordReset;
