const { query } = require('../db');
const { Logger } = require('../../utils/logger');
const logger = new Logger('ScreeningAnswers');

/**
 * ScreeningAnswers Model
 * 
 * Manages screening question data in the screening_answers TABLE.
 * 
 * IMPORTANT: This model writes to the screening_answers table, NOT to user_complete_profile.
 * The user_complete_profile is a VIEW that reads from screening_answers (along with other tables).
 * 
 * When you query user_complete_profile and see screening data (languages, disability_status, etc.),
 * that data is actually stored in THIS table (screening_answers), and the VIEW simply makes it
 * appear as part of a unified profile structure.
 */
class ScreeningAnswers {
    /**
     * Insert or update screening answers for a user.
     * Uses PostgreSQL's INSERT ... ON CONFLICT DO UPDATE pattern (upsert).
     * 
     * @param {number} userId - The user ID
     * @param {Object} data - Screening answers data
     * @returns {Object} The saved screening answers record
     */
    static async upsert(userId, data) {
        // Log what we're about to insert for debugging
        const languagesJson = JSON.stringify(data.languages || []);
        logger.debug(`Upserting screening answers for user ${userId}:`, {
            languages: data.languages,
            languagesJson,
            disabilityStatus: data.disabilityStatus
        });
        
        const result = await query(
            `INSERT INTO screening_answers (
                user_id, experience_summary, hybrid_preference, travel,
                relocation, languages, date_of_birth, gpa, is_adult,
                gender_identity, disability_status, military_service,
                ethnicity, driving_license
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (user_id) DO UPDATE SET
                experience_summary = EXCLUDED.experience_summary,
                hybrid_preference = EXCLUDED.hybrid_preference,
                travel = EXCLUDED.travel,
                relocation = EXCLUDED.relocation,
                languages = EXCLUDED.languages,
                date_of_birth = EXCLUDED.date_of_birth,
                gpa = EXCLUDED.gpa,
                is_adult = EXCLUDED.is_adult,
                gender_identity = EXCLUDED.gender_identity,
                disability_status = EXCLUDED.disability_status,
                military_service = EXCLUDED.military_service,
                ethnicity = EXCLUDED.ethnicity,
                driving_license = EXCLUDED.driving_license,
                updated_at = NOW()
            RETURNING *`,
            [
                userId,
                data.experienceSummary || null,
                data.hybridPreference || null,
                data.travel || null,
                data.relocation || null,
                languagesJson,
                data.dateOfBirth || null,
                data.gpa || null,
                data.isAdult || null,
                data.genderIdentity || null,
                data.disabilityStatus || null,
                data.militaryService || null,
                data.ethnicity || null,
                data.drivingLicense || null
            ]
        );

        logger.debug(`Screening answers saved for user ${userId}. Result:`, {
            languages: result.rows[0].languages,
            disability_status: result.rows[0].disability_status
        });

        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM screening_answers WHERE user_id = $1',
            [userId]
        );

        return result.rows[0];
    }

    static async delete(userId) {
        await query('DELETE FROM screening_answers WHERE user_id = $1', [userId]);
    }
}

module.exports = ScreeningAnswers;
