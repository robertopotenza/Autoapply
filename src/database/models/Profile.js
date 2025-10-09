const { query } = require('../db');

/**
 * Profile Model
 * 
 * Manages wizard Step 2 data in the profile TABLE.
 * 
 * IMPORTANT: This model writes to the profile table, NOT to user_complete_profile.
 * The user_complete_profile is a VIEW that reads from profile (along with other tables).
 * 
 * When you query user_complete_profile and see profile data (full_name, phone, resume_path, etc.),
 * that data is actually stored in THIS table (profile), and the VIEW simply makes it
 * appear as part of a unified profile structure.
 * 
 * @see SCHEMA_ARCHITECTURE.md for architecture details
 * @see src/routes/wizard.js for API endpoint: POST /api/wizard/step2
 */
class Profile {
    /**
     * Insert or update profile information for a user (wizard Step 2).
     * Uses PostgreSQL's INSERT ... ON CONFLICT DO UPDATE pattern (upsert).
     * 
     * @param {number} userId - The user ID
     * @param {Object} data - Profile data
     * @param {string} data.fullName - User's full name
     * @param {string} data.email - User's email address
     * @param {string} data.resumePath - Path to uploaded resume
     * @param {string} data.coverLetterOption - Cover letter preference
     * @param {string} data.coverLetterPath - Path to uploaded cover letter
     * @param {string} data.phone - Phone number
     * @param {string} data.country - Country
     * @param {string} data.city - City
     * @param {string} data.stateRegion - State or region
     * @param {string} data.postalCode - Postal code
     * @returns {Object} The saved profile record
     */
    static async upsert(userId, data) {
        const result = await query(
            `INSERT INTO profile (
                user_id, full_name, email, resume_path, cover_letter_option,
                cover_letter_path, phone, country, city, state_region, postal_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
                email = EXCLUDED.email,
                resume_path = EXCLUDED.resume_path,
                cover_letter_option = EXCLUDED.cover_letter_option,
                cover_letter_path = EXCLUDED.cover_letter_path,
                phone = EXCLUDED.phone,
                country = EXCLUDED.country,
                city = EXCLUDED.city,
                state_region = EXCLUDED.state_region,
                postal_code = EXCLUDED.postal_code,
                updated_at = NOW()
            RETURNING *`,
            [
                userId,
                data.fullName || null,
                data.email || null,
                data.resumePath || null,
                data.coverLetterOption || null,
                data.coverLetterPath || null,
                data.phone || null,
                data.country || null,
                data.city || null,
                data.stateRegion || null,
                data.postalCode || null
            ]
        );

        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM profile WHERE user_id = $1',
            [userId]
        );

        return result.rows[0];
    }

    static async delete(userId) {
        await query('DELETE FROM profile WHERE user_id = $1', [userId]);
    }
}

module.exports = Profile;
