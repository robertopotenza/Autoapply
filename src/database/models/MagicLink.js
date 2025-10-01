const { query } = require('../db');
const crypto = require('crypto');

class MagicLink {
    static async create(email) {
        // Generate secure random token
        const token = crypto.randomBytes(32).toString('hex');

        // Token expires in 15 minutes
        const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

        const result = await query(
            `INSERT INTO magic_link_tokens (email, token, expires_at)
             VALUES ($1, $2, $3)
             RETURNING id, email, token, expires_at`,
            [email, token, expiresAt]
        );

        return result.rows[0];
    }

    static async verify(token) {
        const result = await query(
            `SELECT * FROM magic_link_tokens
             WHERE token = $1
             AND used = FALSE
             AND expires_at > NOW()`,
            [token]
        );

        return result.rows[0];
    }

    static async markAsUsed(token) {
        await query(
            `UPDATE magic_link_tokens
             SET used = TRUE
             WHERE token = $1`,
            [token]
        );
    }

    static async cleanup() {
        // Delete expired tokens (older than 1 hour)
        await query(
            `DELETE FROM magic_link_tokens
             WHERE expires_at < NOW() - INTERVAL '1 hour'`
        );
    }

    static async deleteByEmail(email) {
        await query(
            `DELETE FROM magic_link_tokens
             WHERE email = $1`,
            [email]
        );
    }
}

module.exports = MagicLink;
