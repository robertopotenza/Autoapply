const { query } = require('../db');
const bcrypt = require('bcrypt');
const { Logger } = require('../../utils/logger');
const AppError = require('../../utils/AppError');

const SALT_ROUNDS = 10;
const logger = new Logger('User');

class User {
    static async create(email, password) {
        try {
            const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

            const result = await query(
                'INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING user_id, email, created_at',
                [email, passwordHash]
            );

            return result.rows[0];
        } catch (error) {
            throw AppError.database(
                'Failed to create user',
                {
                    module: 'User',
                    method: 'create',
                    email,
                    sqlCode: error.code
                },
                error
            );
        }
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

    /**
     * Get complete user profile by reading from the user_complete_profile VIEW.
     * 
     * IMPORTANT: user_complete_profile is a PostgreSQL VIEW (not a table).
     * It aggregates data from:
     * - job_preferences table
     * - profile table
     * - eligibility table
     * - screening_answers table
     * 
     * The VIEW does not store data - it's just a convenient read interface
     * that JOINs the normalized tables.
     * 
     * @param {number} userId - The user ID to fetch profile for
     * @returns {Object} Complete user profile data
     */
    static async getCompleteProfile(userId) {
        try {
            logger.info(`Querying user_complete_profile for user_id: ${userId}`);
            const result = await query(
                'SELECT * FROM user_complete_profile WHERE user_id = $1',
                [userId]
            );

            if (result.rows.length === 0) {
                logger.warn(`No rows found in user_complete_profile for user_id: ${userId}`);
                logger.info(`Hint: Run 'node scripts/verify-database.js --user <email>' to check DB`);
            } else {
                logger.info(`Found profile data for user_id: ${userId}`);
            }

            return result.rows[0];
        } catch (error) {
            throw AppError.database(
                'Failed to get user complete profile',
                {
                    module: 'User',
                    method: 'getCompleteProfile',
                    userId,
                    sqlCode: error.code
                },
                error
            );
        }
    }
}

module.exports = User;
