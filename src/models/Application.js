const db = require('../database/db');
const AppError = require('../utils/AppError');

class Application {
  static async findById(id) {
    try {
      const query = `
        SELECT *,
               application_id as id
        FROM applications 
        WHERE application_id = $1
      `;
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding application by ID: ${error.message}`);
    }
  }

  static async findByUserId(userId, filters = {}) {
    try {
      let query = `
        SELECT a.*,
               a.application_id as id,
               j.job_id,
               j.job_title,
               j.job_title as title,
               j.company_name,
               j.company_name as company,
               j.location
        FROM applications a
        JOIN jobs j ON a.job_id = j.job_id
        WHERE a.user_id = $1
      `;
      const params = [userId];
      let paramCount = 1;

      if (filters.status) {
        paramCount++;
        query += ` AND a.status = $${paramCount}`;
        params.push(filters.status);
      }

      if (filters.company) {
        paramCount++;
        query += ` AND j.company_name ILIKE $${paramCount}`;
        params.push(`%${filters.company}%`);
      }

      query += ` ORDER BY a.applied_at DESC`;

      if (filters.limit) {
        paramCount++;
        query += ` LIMIT $${paramCount}`;
        params.push(filters.limit);
      }

      const result = await db.query(query, params);
      return result.rows;
    } catch (error) {
      throw new Error(`Error finding applications by user ID: ${error.message}`);
    }
  }

  static async create(applicationData) {
    try {
      const query = `
        INSERT INTO applications (
          user_id, job_id, status, applied_at, cover_letter,
          resume_version, screening_answers, ats_data, notes
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const params = [
        applicationData.userId,
        applicationData.jobId,
        applicationData.status || 'pending',
        applicationData.appliedAt || new Date(),
        applicationData.coverLetter,
        applicationData.resumeVersion,
        JSON.stringify(applicationData.screeningAnswers || {}),
        JSON.stringify(applicationData.atsData || {}),
        applicationData.notes
      ];

      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw AppError.database(
        'Failed to create application',
        {
          module: 'Application',
          method: 'create',
          userId: applicationData.userId,
          jobId: applicationData.jobId,
          sqlCode: error.code
        },
        error
      );
    }
  }

  static async updateStatus(id, status, notes = null) {
    try {
      const query = `
        UPDATE applications 
        SET status = $2, notes = COALESCE($3, notes), updated_at = CURRENT_TIMESTAMP
        WHERE application_id = $1 
        RETURNING *
      `;
      const result = await db.query(query, [id, status, notes]);
      
      if (result.rows[0]) {
        // Log status change
        await this.logStatusChange(id, status, notes);
      }
      
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating application status: ${error.message}`);
    }
  }

  static async logStatusChange(applicationId, newStatus, notes = null) {
    try {
      const query = `
        INSERT INTO application_status_history (application_id, status, notes)
        VALUES ($1, $2, $3)
      `;
      await db.query(query, [applicationId, newStatus, notes]);
    } catch (error) {
      console.error('Error logging status change:', error);
      // Don't throw - this is optional logging
    }
  }

  static async getStatusHistory(applicationId) {
    try {
      const query = `
        SELECT * FROM application_status_history 
        WHERE application_id = $1 
        ORDER BY changed_at DESC
      `;
      const result = await db.query(query, [applicationId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting status history: ${error.message}`);
    }
  }

  static async update(id, updates) {
    try {
      const setClause = Object.keys(updates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const query = `UPDATE applications SET ${setClause}, updated_at = CURRENT_TIMESTAMP WHERE application_id = $1 RETURNING *`;
      const params = [id, ...Object.values(updates)];
      
      const result = await db.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating application: ${error.message}`);
    }
  }

  static async delete(id) {
    try {
      const query = 'DELETE FROM applications WHERE application_id = $1 RETURNING *';
      const result = await db.query(query, [id]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error deleting application: ${error.message}`);
    }
  }

  static async checkExistingApplication(userId, jobId) {
    try {
      const query = 'SELECT * FROM applications WHERE user_id = $1 AND job_id = $2';
      const result = await db.query(query, [userId, jobId]);
      return result.rows[0] || null;
    } catch (error) {
      throw AppError.database(
        'Failed to check existing application',
        {
          module: 'Application',
          method: 'checkExistingApplication',
          userId,
          jobId,
          sqlCode: error.code
        },
        error
      );
    }
  }

  static async getStatistics(userId) {
    try {
      const query = `
        SELECT 
          COUNT(*) as total_applications,
          COUNT(CASE WHEN status = 'pending' THEN 1 END) as pending,
          COUNT(CASE WHEN status = 'applied' THEN 1 END) as applied,
          COUNT(CASE WHEN status = 'interviewing' THEN 1 END) as interviewing,
          COUNT(CASE WHEN status = 'rejected' THEN 1 END) as rejected,
          COUNT(CASE WHEN status = 'accepted' THEN 1 END) as accepted,
          COUNT(CASE WHEN status = 'failed' THEN 1 END) as failed
        FROM applications
        WHERE user_id = $1
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error getting application statistics: ${error.message}`);
    }
  }

  static async getRecentApplications(userId, limit = 10) {
    try {
      const query = `
        SELECT a.*,
               a.application_id as id,
               j.job_id,
               j.job_title,
               j.job_title as title,
               j.company_name,
               j.company_name as company,
               j.location
        FROM applications a
        JOIN jobs j ON a.job_id = j.job_id
        WHERE a.user_id = $1
        ORDER BY a.applied_at DESC
        LIMIT $2
      `;
      
      const result = await db.query(query, [userId, limit]);
      return result.rows;
    } catch (error) {
      throw AppError.database(
        'Failed to get recent applications',
        {
          module: 'Application',
          method: 'getRecentApplications',
          userId,
          limit,
          sqlCode: error.code
        },
        error
      );
    }
  }

  static async getPendingApplications(userId) {
    try {
      const query = `
        SELECT a.*,
               a.application_id as id,
               j.job_id,
               j.job_title,
               j.job_title as title,
               j.company_name,
               j.company_name as company,
               j.location,
               j.job_url,
               j.job_url as application_url
        FROM applications a
        JOIN jobs j ON a.job_id = j.job_id
        WHERE a.user_id = $1 AND a.status IN ('pending', 'queued')
        ORDER BY a.created_at ASC
      `;
      
      const result = await db.query(query, [userId]);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting pending applications: ${error.message}`);
    }
  }

  static async getAnalytics(userId, period = '30') {
    try {
      const periodDays = parseInt(period) || 30;
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN applied_at >= NOW() - INTERVAL '7 days' THEN 1 END) as this_week,
          COUNT(CASE WHEN applied_at >= NOW() - INTERVAL '1 day' THEN 1 END) as today,
          COUNT(CASE WHEN applied_at >= NOW() - make_interval(days => $2) THEN 1 END) as period_total
        FROM applications
        WHERE user_id = $1
      `;
      
      const result = await db.query(query, [userId, periodDays]);
      return result.rows[0];
    } catch (error) {
      throw AppError.database(
        'Failed to get application analytics',
        {
          module: 'Application',
          method: 'getAnalytics',
          userId,
          period,
          query: 'application_analytics'
        },
        error
      );
    }
  }

  static async getSuccessRate(userId, period = '30') {
    try {
      const periodDays = parseInt(period) || 30;
      const query = `
        SELECT 
          COUNT(*) as total,
          COUNT(CASE WHEN status IN ('accepted', 'interviewing') THEN 1 END) as successful
        FROM applications
        WHERE user_id = $1 
          AND applied_at >= NOW() - make_interval(days => $2)
      `;
      
      const result = await db.query(query, [userId, periodDays]);
      const row = result.rows[0];
      
      if (!row || parseInt(row.total) === 0) {
        return 0;
      }
      
      return Math.round((parseInt(row.successful) / parseInt(row.total)) * 100);
    } catch (error) {
      throw new Error(`Error getting success rate: ${error.message}`);
    }
  }
}

module.exports = Application;