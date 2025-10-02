const db = require('../db');

class AutoApplySettings {
  static async create(userId, settingsData = {}) {
    const {
      is_enabled = false,
      mode = 'review',
      max_applications_per_day = 10,
      max_applications_per_week = 50,
      scan_frequency_hours = 2,
      preferred_ats = ['workday', 'greenhouse', 'taleo', 'icims'],
      excluded_companies = [],
      required_keywords = [],
      excluded_keywords = [],
      min_salary = null,
      max_commute_miles = null
    } = settingsData;

    const query = `
      INSERT INTO autoapply_settings (
        user_id, is_enabled, mode, max_applications_per_day, max_applications_per_week,
        scan_frequency_hours, preferred_ats, excluded_companies, required_keywords,
        excluded_keywords, min_salary, max_commute_miles
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      ON CONFLICT (user_id) DO UPDATE SET
        is_enabled = EXCLUDED.is_enabled,
        mode = EXCLUDED.mode,
        max_applications_per_day = EXCLUDED.max_applications_per_day,
        max_applications_per_week = EXCLUDED.max_applications_per_week,
        scan_frequency_hours = EXCLUDED.scan_frequency_hours,
        preferred_ats = EXCLUDED.preferred_ats,
        excluded_companies = EXCLUDED.excluded_companies,
        required_keywords = EXCLUDED.required_keywords,
        excluded_keywords = EXCLUDED.excluded_keywords,
        min_salary = EXCLUDED.min_salary,
        max_commute_miles = EXCLUDED.max_commute_miles,
        updated_at = NOW()
      RETURNING *
    `;

    const values = [
      userId, is_enabled, mode, max_applications_per_day, max_applications_per_week,
      scan_frequency_hours, JSON.stringify(preferred_ats), JSON.stringify(excluded_companies),
      JSON.stringify(required_keywords), JSON.stringify(excluded_keywords), min_salary, max_commute_miles
    ];

    const result = await db.query(query, values);
    return result.rows[0];
  }

  static async findByUser(userId) {
    const query = 'SELECT * FROM autoapply_settings WHERE user_id = $1';
    const result = await db.query(query, [userId]);
    
    if (result.rows.length === 0) {
      // Return default settings if none exist
      return {
        user_id: userId,
        is_enabled: false,
        mode: 'review',
        max_applications_per_day: 10,
        max_applications_per_week: 50,
        scan_frequency_hours: 2,
        preferred_ats: ['workday', 'greenhouse', 'taleo', 'icims'],
        excluded_companies: [],
        required_keywords: [],
        excluded_keywords: [],
        min_salary: null,
        max_commute_miles: null
      };
    }
    
    return result.rows[0];
  }

  static async update(userId, updateData) {
    const fields = Object.keys(updateData);
    const values = Object.values(updateData);
    
    // Convert arrays to JSON strings for JSONB columns
    const jsonFields = ['preferred_ats', 'excluded_companies', 'required_keywords', 'excluded_keywords'];
    fields.forEach((field, index) => {
      if (jsonFields.includes(field) && Array.isArray(values[index])) {
        values[index] = JSON.stringify(values[index]);
      }
    });
    
    const setClause = fields.map((field, index) => `${field} = $${index + 2}`).join(', ');
    
    const query = `
      UPDATE autoapply_settings 
      SET ${setClause}, updated_at = NOW()
      WHERE user_id = $1
      RETURNING *
    `;

    const result = await db.query(query, [userId, ...values]);
    return result.rows[0];
  }

  static async enable(userId) {
    return this.update(userId, { is_enabled: true });
  }

  static async disable(userId) {
    return this.update(userId, { is_enabled: false });
  }

  static async setMode(userId, mode) {
    if (!['auto', 'review'].includes(mode)) {
      throw new Error('Invalid mode. Must be "auto" or "review"');
    }
    return this.update(userId, { mode });
  }

  static async getEnabledUsers() {
    const query = `
      SELECT as.*, u.email, u.user_id
      FROM autoapply_settings as
      JOIN users u ON as.user_id = u.user_id
      WHERE as.is_enabled = TRUE
    `;
    
    const result = await db.query(query);
    return result.rows;
  }

  static async canUserApplyToday(userId) {
    const settings = await this.findByUser(userId);
    
    if (!settings.is_enabled) {
      return { canApply: false, reason: 'AutoApply is disabled' };
    }

    // Check daily limit
    const todayQuery = `
      SELECT COUNT(*) as count
      FROM applications
      WHERE user_id = $1 AND applied_at >= CURRENT_DATE
    `;
    
    const todayResult = await db.query(todayQuery, [userId]);
    const todayCount = parseInt(todayResult.rows[0].count);
    
    if (todayCount >= settings.max_applications_per_day) {
      return { 
        canApply: false, 
        reason: `Daily limit reached (${todayCount}/${settings.max_applications_per_day})` 
      };
    }

    // Check weekly limit
    const weekQuery = `
      SELECT COUNT(*) as count
      FROM applications
      WHERE user_id = $1 AND applied_at >= CURRENT_DATE - INTERVAL '7 days'
    `;
    
    const weekResult = await db.query(weekQuery, [userId]);
    const weekCount = parseInt(weekResult.rows[0].count);
    
    if (weekCount >= settings.max_applications_per_week) {
      return { 
        canApply: false, 
        reason: `Weekly limit reached (${weekCount}/${settings.max_applications_per_week})` 
      };
    }

    return { 
      canApply: true, 
      dailyRemaining: settings.max_applications_per_day - todayCount,
      weeklyRemaining: settings.max_applications_per_week - weekCount
    };
  }

  static async shouldJobMatch(userId, job) {
    const settings = await this.findByUser(userId);
    
    // Check if company is excluded
    if (settings.excluded_companies && settings.excluded_companies.includes(job.company_name.toLowerCase())) {
      return { matches: false, reason: 'Company is in exclusion list' };
    }

    // Check salary requirements
    if (settings.min_salary && job.salary_max && job.salary_max < settings.min_salary) {
      return { matches: false, reason: 'Salary below minimum requirement' };
    }

    // Check required keywords
    if (settings.required_keywords && settings.required_keywords.length > 0) {
      const jobText = `${job.job_title} ${job.job_description} ${job.requirements}`.toLowerCase();
      const hasRequiredKeyword = settings.required_keywords.some(keyword => 
        jobText.includes(keyword.toLowerCase())
      );
      
      if (!hasRequiredKeyword) {
        return { matches: false, reason: 'Missing required keywords' };
      }
    }

    // Check excluded keywords
    if (settings.excluded_keywords && settings.excluded_keywords.length > 0) {
      const jobText = `${job.job_title} ${job.job_description} ${job.requirements}`.toLowerCase();
      const hasExcludedKeyword = settings.excluded_keywords.some(keyword => 
        jobText.includes(keyword.toLowerCase())
      );
      
      if (hasExcludedKeyword) {
        return { matches: false, reason: 'Contains excluded keywords' };
      }
    }

    // Check preferred ATS
    if (job.ats_type && settings.preferred_ats && !settings.preferred_ats.includes(job.ats_type)) {
      return { matches: false, reason: 'ATS not in preferred list' };
    }

    return { matches: true };
  }
}

module.exports = AutoApplySettings;