const { query } = require('../db');

class ScreeningAnswers {
    static async upsert(userId, data) {
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
                JSON.stringify(data.languages || []),
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
