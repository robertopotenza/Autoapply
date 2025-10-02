const db = require('../db');

class Application {
  static async create(applicationData) {
    const {
      user_id,
      job_id,
      application_mode = 'auto',
      resume_used,
      cover_letter_used,
      screening_answers_used,
      application_data
    } = applicationData;

    const query = `
      INSERT INTO applications (
        user_id, job_id, application_mode, resume_used, 
        cover_letter_used, screening_answers_used, application_data
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const values = [
      user_id, job_id, application_mode, resume_used,
      cover_letter_used, JSON.stringify(screening_answers_used),
      JSON.stringify(application_data)
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findById(applicationId) {
    const query = `
      SELECT a.*, j.company_name, j.job_title, j.job_url, j.ats_type
      FROM applications a
      JOIN jobs j ON a.job_id = j.job_id
      WHERE a.application_id = $1
    `;
    const result = await db.query(query, [applicationId]);
    return result.rows[0];
  }

  static async findByUser(userId, filters = {}) {
    let query = `
      SELECT a.*, j.company_name, j.job_title, j.job_url, j.ats_type, j.location
      FROM applications a
      JOIN jobs j ON a.job_id = j.job_id
      WHERE a.user_id = $1
    `;
    const values = [userId];
    let paramCount = 1;

    if (filters.status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      values.push(filters.status);
    }

    if (filters.application_mode) {
      paramCount++;
      query += ` AND a.application_mode = $${paramCount}`;
      values.push(filters.application_mode);
    }

    if (filters.date_from) {
      paramCount++;
      query += ` AND a.applied_at >= $${paramCount}`;
      values.push(filters.date_from);
    }

    if (filters.date_to) {
      paramCount++;
      query += ` AND a.applied_at <= $${paramCount}`;
      values.push(filters.date_to);
    }

    query += ' ORDER BY a.created_at DESC';

    if (filters.limit) {
      paramCount++;
      query += ` LIMIT $${paramCount}`;
      values.push(filters.limit);
    }

    const result = await db.query(query, values);
    return result.rows;
  }

  static async updateStatus(applicationId, newStatus, statusMessage = null) {
    const client = await db.getClient();
    
    try {
      await client.query('BEGIN');
      
      // Get current status
      const currentResult = await client.query(
        'SELECT status FROM applications WHERE application_id = $1',
        [applicationId]
      );
      
      if (currentResult.rows.length === 0) {
        throw new Error('Application not found');
      }
      
      const oldStatus = currentResult.rows[0].status;
      
      // Update application status
      const updateQuery = `
        UPDATE applications 
        SET status = $1, updated_at = NOW()
        ${newStatus === 'applied' ? ', applied_at = NOW()' : ''}
        WHERE application_id = $2
        RETURNING *
      `;
      
      const updateResult = await client.query(updateQuery, [newStatus, applicationId]);
      
      // Log status change
      await client.query(`
        INSERT INTO application_status_history (
          application_id, old_status, new_status, status_message
        ) VALUES ($1, $2, $3, $4)
      `, [applicationId, oldStatus, newStatus, statusMessage]);
      
      await client.query('COMMIT');
      return updateResult.rows[0];
      
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  static async markAsApplied(applicationId, confirmationNumber = null) {
    const query = `
      UPDATE applications 
      SET status = 'applied', applied_at = NOW(), confirmation_number = $2, updated_at = NOW()
      WHERE application_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [applicationId, confirmationNumber]);
    
    // Log the status change
    if (result.rows.length > 0) {
      await this.updateStatus(applicationId, 'applied', `Application submitted${confirmationNumber ? ` with confirmation: ${confirmationNumber}` : ''}`);
    }
    
    return result.rows[0];
  }

  static async markAsFailed(applicationId, errorMessage) {
    const query = `
      UPDATE applications 
      SET error_message = $2, retry_count = retry_count + 1, 
          last_retry_at = NOW(), updated_at = NOW()
      WHERE application_id = $1
      RETURNING *
    `;
    
    const result = await db.query(query, [applicationId, errorMessage]);
    return result.rows[0];
  }

  static async getUserStats(userId) {
    const query = `
      SELECT * FROM user_application_stats WHERE user_id = $1
    `;
    
    const result = await db.query(query, [userId]);
    return result.rows[0] || {
      user_id: userId,
      total_applications: 0,
      applications_submitted: 0,
      interviews_received: 0,
      offers_received: 0,
      rejections_received: 0,
      applications_this_week: 0,
      applications_today: 0
    };
  }

  static async getStatusHistory(applicationId) {
    const query = `
      SELECT * FROM application_status_history 
      WHERE application_id = $1 
      ORDER BY changed_at DESC
    `;
    
    const result = await db.query(query, [applicationId]);
    return result.rows;
  }

  static async checkDuplicateApplication(userId, jobId) {
    const query = `
      SELECT * FROM applications 
      WHERE user_id = $1 AND job_id = $2
    `;
    
    const result = await db.query(query, [userId, jobId]);
    return result.rows[0];
  }

  static async getPendingApplications(limit = 100) {
    const query = `
      SELECT a.*, j.company_name, j.job_title, j.job_url, j.ats_type
      FROM applications a
      JOIN jobs j ON a.job_id = j.job_id
      WHERE a.status = 'pending'
      ORDER BY a.created_at ASC
      LIMIT $1
    `;
    
    const result = await db.query(query, [limit]);
    return result.rows;
  }
}

module.exports = Application;