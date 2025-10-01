const { query } = require('../db');

class JobPreferences {
    static async upsert(userId, data) {
        const result = await query(
            `INSERT INTO job_preferences (
                user_id, remote_jobs, onsite_location, job_types,
                job_titles, seniority_levels, time_zones
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id) DO UPDATE SET
                remote_jobs = EXCLUDED.remote_jobs,
                onsite_location = EXCLUDED.onsite_location,
                job_types = EXCLUDED.job_types,
                job_titles = EXCLUDED.job_titles,
                seniority_levels = EXCLUDED.seniority_levels,
                time_zones = EXCLUDED.time_zones,
                updated_at = NOW()
            RETURNING *`,
            [
                userId,
                JSON.stringify(data.remoteJobs || []),
                data.onsiteLocation || null,
                JSON.stringify(data.jobTypes || []),
                JSON.stringify(data.jobTitles || []),
                JSON.stringify(data.seniorityLevels || []),
                JSON.stringify(data.timeZones || [])
            ]
        );

        return result.rows[0];
    }

    static async findByUserId(userId) {
        const result = await query(
            'SELECT * FROM job_preferences WHERE user_id = $1',
            [userId]
        );

        return result.rows[0];
    }

    static async delete(userId) {
        await query('DELETE FROM job_preferences WHERE user_id = $1', [userId]);
    }
}

module.exports = JobPreferences;
