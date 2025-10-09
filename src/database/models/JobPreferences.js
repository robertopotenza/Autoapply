const { query } = require('../db');

/**
 * JobPreferences Model
 * 
 * Manages wizard Step 1 data in the job_preferences TABLE.
 * 
 * IMPORTANT: This model writes to the job_preferences table, NOT to user_complete_profile.
 * The user_complete_profile is a VIEW that reads from job_preferences (along with other tables).
 * 
 * When you query user_complete_profile and see job preference data (remote_jobs, job_types, etc.),
 * that data is actually stored in THIS table (job_preferences), and the VIEW simply makes it
 * appear as part of a unified profile structure.
 * 
 * @see SCHEMA_ARCHITECTURE.md for architecture details
 * @see src/routes/wizard.js for API endpoint: POST /api/wizard/step1
 */
class JobPreferences {
    /**
     * Insert or update job preferences for a user (wizard Step 1).
     * Uses PostgreSQL's INSERT ... ON CONFLICT DO UPDATE pattern (upsert).
     * 
     * @param {number} userId - The user ID
     * @param {Object} data - Job preferences data
     * @param {Array<string>} data.remoteJobs - Remote work preferences
     * @param {string} data.onsiteLocation - Onsite location preference
     * @param {Array<string>} data.jobTypes - Desired job types
     * @param {Array<string>} data.jobTitles - Desired job titles
     * @param {Array<string>} data.seniorityLevels - Desired seniority levels
     * @param {Array<string>} data.timeZones - Acceptable time zones
     * @returns {Object} The saved job preferences record
     */
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
