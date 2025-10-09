const { query } = require('../db');

/**
 * Eligibility Model
 * 
 * Manages wizard Step 3 data in the eligibility TABLE.
 * 
 * IMPORTANT: This model writes to the eligibility table, NOT to user_complete_profile.
 * The user_complete_profile is a VIEW that reads from eligibility (along with other tables).
 * 
 * When you query user_complete_profile and see eligibility data (current_job_title, 
 * availability, visa_sponsorship, etc.), that data is actually stored in THIS table 
 * (eligibility), and the VIEW simply makes it appear as part of a unified profile structure.
 * 
 * @see SCHEMA_ARCHITECTURE.md for architecture details
 * @see src/routes/wizard.js for API endpoint: POST /api/wizard/step3
 */
class Eligibility {
    /**
     * Insert or update eligibility information for a user (wizard Step 3).
     * Uses PostgreSQL's INSERT ... ON CONFLICT DO UPDATE pattern (upsert).
     * 
     * @param {number} userId - The user ID
     * @param {Object} data - Eligibility data
     * @param {string} data.currentJobTitle - Current job title
     * @param {string} data.availability - When user can start
     * @param {Array<string>} data.eligibleCountries - Countries eligible to work in
     * @param {string} data.visaSponsorship - Visa sponsorship requirements
     * @param {Array<string>} data.nationality - User's nationality/nationalities
     * @param {number} data.currentSalary - Current salary
     * @param {number} data.expectedSalary - Expected/desired salary
     * @returns {Object} The saved eligibility record
     */
    static async upsert(userId, data) {
        const result = await query(
            `INSERT INTO eligibility (
                user_id, current_job_title, availability, eligible_countries,
                visa_sponsorship, nationality, current_salary, expected_salary
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (user_id) DO UPDATE SET
                current_job_title = EXCLUDED.current_job_title,
                availability = EXCLUDED.availability,
                eligible_countries = EXCLUDED.eligible_countries,
                visa_sponsorship = EXCLUDED.visa_sponsorship,
                nationality = EXCLUDED.nationality,
                current_salary = EXCLUDED.current_salary,
                expected_salary = EXCLUDED.expected_salary,
                updated_at = NOW()
            RETURNING *`,
            [
                userId,
                data.currentJobTitle || null,
                data.availability || null,
                JSON.stringify(data.eligibleCountries || []),
                data.visaSponsorship || null,
                JSON.stringify(data.nationality || []),
                data.currentSalary || null,
                data.expectedSalary || null
            ]
        );

        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM eligibility WHERE user_id = $1',
            [userId]
        );

        return result.rows[0];
    }

    static async delete(userId) {
        await query('DELETE FROM eligibility WHERE user_id = $1', [userId]);
    }
}

module.exports = Eligibility;
