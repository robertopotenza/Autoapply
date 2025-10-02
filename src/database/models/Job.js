const db = require('../db');

class Job {
  static async create(jobData) {
    const {
      company_name,
      job_title,
      job_url,
      ats_type,
      location,
      job_type,
      seniority_level,
      salary_min,
      salary_max,
      job_description,
      requirements,
      benefits,
      posted_date,
      application_deadline
    } = jobData;

    const query = `
      INSERT INTO jobs (
        company_name, job_title, job_url, ats_type, location, job_type,
        seniority_level, salary_min, salary_max, job_description, 
        requirements, benefits, posted_date, application_deadline
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;

    const values = [
      company_name, job_title, job_url, ats_type, location, job_type,
      seniority_level, salary_min, salary_max, job_description,
      requirements, benefits, posted_date, application_deadline
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findById(jobId) {
    const query = 'SELECT * FROM jobs WHERE job_id = $1';
    const result = await db.query(query, [jobId]);
    return result.rows[0];
  }

  static async findByUrl(jobUrl) {
    const query = 'SELECT * FROM jobs WHERE job_url = $1';
    const result = await db.query(query, [jobUrl]);
    return result.rows[0];
  }

  static async findActiveJobs(filters = {}) {
    let query = `
      SELECT * FROM jobs 
      WHERE is_active = TRUE
    `;
    const values = [];
    let paramCount = 0;

    if (filters.ats_type) {
      paramCount++;
      query += ` AND ats_type = $${paramCount}`;
      values.push(filters.ats_type);
    }

    if (filters.company_name) {
      paramCount++;
      query += ` AND LOWER(company_name) LIKE LOWER($${paramCount})`;
      values.push(`%${filters.company_name}%`);
    }

    if (filters.job_title) {
      paramCount++;
      query += ` AND LOWER(job_title) LIKE LOWER($${paramCount})`;
      values.push(`%${filters.job_title}%`);
    }

    if (filters.location) {
      paramCount++;
      query += ` AND LOWER(location) LIKE LOWER($${paramCount})`;
      values.push(`%${filters.location}%`);
    }

    if (filters.seniority_level) {
      paramCount++;
      query += ` AND seniority_level = $${paramCount}`;
      values.push(filters.seniority_level);
    }

    query += ' ORDER BY posted_date DESC, discovered_at DESC';

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  static async getMatchingJobs(userId) {
    const query = `
      SELECT j.*, jp.job_titles, jp.job_types, jp.seniority_levels, 
             jp.remote_jobs, jp.onsite_location, e.expected_salary
      FROM jobs j
      CROSS JOIN job_preferences jp
      CROSS JOIN eligibility e
      WHERE jp.user_id = $1 
        AND e.user_id = $1
        AND j.is_active = TRUE
        AND (j.application_deadline IS NULL OR j.application_deadline >= CURRENT_DATE)
        AND NOT EXISTS (
          SELECT 1 FROM applications a 
          WHERE a.job_id = j.job_id AND a.user_id = $1
        )
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows;
  }

  static async update(jobId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE jobs 
      SET ${setClause}, updated_at = NOW()
      WHERE job_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [jobId, ...values]);
    return result.rows[0];
  }

  static async deactivate(jobId) {
    const query = `
      UPDATE jobs 
      SET is_active = FALSE, updated_at = NOW()
      WHERE job_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [jobId]);
    return result.rows[0];
  }

  static async markAsChecked(jobId) {
    const query = `
      UPDATE jobs 
      SET last_checked = NOW()
      WHERE job_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [jobId]);
    return result.rows[0];
  }
}

module.exports = Job;