const { query } = require('../db');

class Profile {
    static async upsert(userId, data) {
        const result = await query(
            `INSERT INTO profile (
                user_id, full_name, resume_path, cover_letter_option,
                cover_letter_path, phone, country, city, state_region, postal_code
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
            ON CONFLICT (user_id) DO UPDATE SET
                full_name = EXCLUDED.full_name,
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
