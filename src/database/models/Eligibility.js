const { query } = require('../db');

class Eligibility {
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
