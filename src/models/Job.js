const db = require('../database/db');

class Job {
  static async findById(id) {
    try {
      const query = `
        SELECT *, 
               job_id as id,
               job_title as title,
               company_name as company,
               job_description as description,
               job_url as application_url
        FROM jobs 
        WHERE job_id = $1
      `;
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding job by ID: ${error.message}`);
    }
  }

  static async findByUserId(userId, filters = {}) {
    try {
      let query = `
        SELECT j.*,
               j.job_id as id,
               j.job_title as title,
               j.company_name as company,
               j.job_description as description,
               j.job_url as application_url,
               CASE WHEN a.application_id IS NOT NULL THEN true ELSE false END as already_applied
        FROM jobs j
        LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
        WHERE j.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      if (filters.location) {
        paramCount++;
        query += ` AND j.location ILIKE $${paramCount}`;
        params.push(`%${filters.location}%`);
      }

      if (filters.seniority) {
        paramCount++;
        query += ` AND j.seniority_level = $${paramCount}`;
        params.push(filters.seniority);
      }

      if (filters.jobType) {
        paramCount++;
        query += ` AND j.job_type = $${paramCount}`;
        params.push(filters.jobType);
      }

      if (filters.onlyNew) {
        query += ` AND a.application_id IS NULL`;
      }

      query += ` ORDER BY j.created_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding jobs by user ID: ${error.message}`);
    }
  }

  static async create(jobData) {
    try {
      const query = `
        INSERT INTO jobs (
          user_id, job_title, company_name, location, job_type, seniority_level,
          job_description, requirements, salary_min, salary_max, 
          job_url, ats_type, source, external_id
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      const params = [
        jobData.userId,
        jobData.title || jobData.job_title,
        jobData.company || jobData.company_name,
        jobData.location,
        jobData.jobType || 'full-time',
        jobData.seniorityLevel,
        jobData.description || jobData.job_description,
        jobData.requirements,
        jobData.salaryMin,
        jobData.salaryMax,
        jobData.applicationUrl || jobData.job_url,
        jobData.atsType,
        jobData.source,
        jobData.externalId
      ];

      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating job: ${error.message}`);
    }
  }

  static async update(id, updates) {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const query = `UPDATE jobs SET ${setClause} WHERE job_id = $1 RETURNING *`;
      const params = [id, ...Object.values(updates)];
      
      const result = await db.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating job: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM jobs WHERE job_id = $1 RETURNING *';
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error deleting job: ${error.message}`);
    }
  }

  static async findMatchingJobs(userId, preferences = {}) {
    try {
      let query = `
        SELECT j.*,
               j.job_id as id,
               j.job_title as title,
               j.company_name as company,
               j.job_description as description,
               j.job_url as application_url,
               CASE WHEN a.application_id IS NOT NULL THEN true ELSE false END as already_applied
        FROM jobs j
        LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
        WHERE 1=1
      `;
      const params = [userId];
      let paramCount = 1;

      // Match based on user preferences
      if (preferences.preferredLocations && preferences.preferredLocations.length > 0) {
        paramCount++;
        query += ` AND j.location = ANY($${paramCount})`;
        params.push(preferences.preferredLocations);
      }

      if (preferences.seniorityLevel) {
        paramCount++;
        query += ` AND j.seniority_level = $${paramCount}`;
        params.push(preferences.seniorityLevel);
      }

      if (preferences.jobTypes && preferences.jobTypes.length > 0) {
        paramCount++;
        query += ` AND j.job_type = ANY($${paramCount})`;
        params.push(preferences.jobTypes);
      }

      if (preferences.salaryMin) {
        paramCount++;
        query += ` AND (j.salary_max IS NULL OR j.salary_max >= $${paramCount})`;
        params.push(preferences.salaryMin);
      }

      // Only show jobs that haven't been applied to
      query += ` AND a.application_id IS NULL`;
      
      query += ` ORDER BY j.created_at DESC LIMIT 50`;

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding matching jobs: ${error.message}`);
    }
  }

  static async getStatistics(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_jobs,
          COUNT(CASE WHEN a.application_id IS NOT NULL THEN 1 END) as applied_jobs,
          COUNT(CASE WHEN a.application_id IS NULL THEN 1 END) as available_jobs
        FROM jobs j
        LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
        WHERE j.user_id = $1 OR j.user_id IS NULL
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting job statistics: ${error.message}`);
    }
  }

  static async getAnalytics(userId, period = '30') {
    try {
      const periodDays = parseInt(period) || 30;
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
          COUNT(CASE WHEN j.created_at >= NOW() - INTERVAL '1 day' THEN 1 END) as today,
          COUNT(CASE WHEN a.application_id IS NOT NULL THEN 1 END) as applied,
          COUNT(CASE WHEN a.application_id IS NULL THEN 1 END) as available
        FROM jobs j
        LEFT JOIN applications a ON j.job_id = a.job_id AND a.user_id = $1
        WHERE (j.user_id = $1 OR j.user_id IS NULL)
          -- Filter by dynamic period: INTERVAL '1 day' * $2 calculates period days (e.g., 30 days)
          AND j.created_at >= NOW() - INTERVAL '1 day' * $2
      `;
      
      const result = await db.query(query, [userId, periodDays]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting job analytics: ${error.message}`);
    }
  }
}

module.exports = Job;