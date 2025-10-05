const { query } = require('../db');
const bcrypt = require('bcrypt');

const SALT_ROUNDS = 10;

class User {
    static async create(email, password) {
        const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

        const result = await query(
            'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING user_id, email, created_at',
            [email, passwordHash]
        );

        return result.rows[0];
    }

    static async createPasswordless(email) {
        const result = await query(
            'INSERT INTO users (email, password_hash) VALUES ($1, NULL) RETURNING user_id, email, created_at',
            [email]
        );

        return result.rows[0];
    }

    static async findByEmail(email) {
        const result = await query(
            'SELECT user_id, email, password_hash, created_at FROM users WHERE email = $1',
            [email]
        );

        return result.rows[0];
    }

    static async findById(userId) {
        const result = await query(
            'SELECT user_id, email, created_at FROM users WHERE user_id = $1',
            [userId]
        );

        return result.rows[0];
    }

    static async verifyPassword(password, passwordHash) {
        return await bcrypt.compare(password, passwordHash);
    }

    static async updatePassword(userId, newPassword) {
        const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

        await query(
            'UPDATE users SET password_hash = $1, updated_at = NOW() WHERE user_id = $2',
            [passwordHash, userId]
        );
    }

    static async delete(userId) {
        await query('DELETE FROM users WHERE user_id = $1', [userId]);
    }

    static async getCompleteProfile(userId) {
        console.log(`[User.getCompleteProfile] Querying user_complete_profile for user_id: ${userId}`);
        const result = await query(
            'SELECT * FROM user_complete_profile WHERE user_id = $1',
            [userId]
        );

        if (result.rows.length === 0) {
            console.log(`[User.getCompleteProfile] No rows found in user_complete_profile for user_id: ${userId}`);
            console.log(`[User.getCompleteProfile] Hint: Run 'node scripts/verify-database.js --user <email>' to check DB`);
        } else {
            console.log(`[User.getCompleteProfile] Found profile data for user_id: ${userId}`);
        }

        return result.rows[0];
    }
}

module.exports = User;
