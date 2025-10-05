const db = require('../database/db');

class AutoApplySettings {
  static getDefaultSettings(userId = null) {
    return {
      user_id: userId,
      is_enabled: false,
      mode: 'review',
      max_applications_per_day: 10,
      max_applications_per_company: 1,
      max_applications_per_week: 50,
      min_match_score: 70,
      scan_frequency_hours: 2,
      preferred_locations: [],
      job_types: ['full-time'],
      salary_min: null,
      salary_max: null,
      seniority_level: null,
      exclude_companies: [],
      include_companies: [],
      keywords: [],
      exclude_keywords: [],
      auto_generate_cover_letter: true,
      custom_cover_letter_template: null,
      screening_answers: {},
      application_delay: 300
    };
  }

  static async findByUserId(userId) {
    try {
      const query = 'SELECT * FROM autoapply_settings WHERE user_id = $1';
      const result = await db.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error finding autoapply settings: ${error.message}`);
    }
  }

  static async create(userId, settings = {}) {
    try {
      const defaultSettings = {
        ...this.getDefaultSettings(userId),
        ...settings
      };

      const query = `
        INSERT INTO autoapply_settings (
          user_id, is_enabled, max_applications_per_day, max_applications_per_week,
          scan_frequency_hours, preferred_ats, excluded_companies, required_keywords,
          excluded_keywords, min_salary, max_commute_miles
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        RETURNING *
      `;

      const params = [
        userId,
        defaultSettings.is_enabled || defaultSettings.enabled || false,
        defaultSettings.max_applications_per_day,
        defaultSettings.max_applications_per_week,
        defaultSettings.scan_frequency_hours,
        JSON.stringify(defaultSettings.preferred_ats || ['workday', 'greenhouse', 'taleo', 'icims']),
        JSON.stringify(defaultSettings.excluded_companies || defaultSettings.exclude_companies || []),
        JSON.stringify(defaultSettings.required_keywords || defaultSettings.keywords || []),
        JSON.stringify(defaultSettings.excluded_keywords || defaultSettings.exclude_keywords || []),
        defaultSettings.min_salary || defaultSettings.salary_min,
        defaultSettings.max_commute_miles
      ];

      const result = await db.query(query, params);
      return result.rows[0];
    } catch (error) {
      throw new Error(`Error creating autoapply settings: ${error.message}`);
    }
  }

  static async update(userId, updates) {
    try {
      // First check if settings exist
      const existing = await this.findByUserId(userId);
      if (!existing) {
        // Create new settings if they don't exist
        return await this.create(userId, updates);
      }

      // Convert array/object fields to JSON strings and map legacy fields
      const processedUpdates = {};
      const jsonFields = [
        'preferred_ats', 'excluded_companies', 'required_keywords', 'excluded_keywords'
      ];

      // Map legacy field names to new schema
      if (updates.enabled !== undefined) {
        processedUpdates.is_enabled = updates.enabled;
      }
      if (updates.is_enabled !== undefined) {
        processedUpdates.is_enabled = updates.is_enabled;
      }
      if (updates.exclude_companies !== undefined) {
        processedUpdates.excluded_companies = JSON.stringify(updates.exclude_companies);
      }
      if (updates.excluded_companies !== undefined) {
        processedUpdates.excluded_companies = JSON.stringify(updates.excluded_companies);
      }
      if (updates.keywords !== undefined) {
        processedUpdates.required_keywords = JSON.stringify(updates.keywords);
      }
      if (updates.required_keywords !== undefined) {
        processedUpdates.required_keywords = JSON.stringify(updates.required_keywords);
      }
      if (updates.exclude_keywords !== undefined) {
        processedUpdates.excluded_keywords = JSON.stringify(updates.exclude_keywords);
      }
      if (updates.excluded_keywords !== undefined) {
        processedUpdates.excluded_keywords = JSON.stringify(updates.excluded_keywords);
      }
      if (updates.salary_min !== undefined) {
        processedUpdates.min_salary = updates.salary_min;
      }
      if (updates.min_salary !== undefined) {
        processedUpdates.min_salary = updates.min_salary;
      }

      // Handle other fields
      const directFields = [
        'max_applications_per_day', 'max_applications_per_week', 
        'scan_frequency_hours', 'max_commute_miles', 'mode'
      ];
      
      directFields.forEach(field => {
        if (updates[field] !== undefined) {
          processedUpdates[field] = updates[field];
        }
      });

      if (updates.preferred_ats !== undefined) {
        processedUpdates.preferred_ats = JSON.stringify(updates.preferred_ats);
      }

      if (Object.keys(processedUpdates).length === 0) {
        return existing;
      }

      const setClause = Object.keys(processedUpdates)
        .map((key, index) => `${key} = $${index + 2}`)
        .join(', ');
      
      const query = `
        UPDATE autoapply_settings 
        SET ${setClause}, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $1 
        RETURNING *
      `;
      const params = [userId, ...Object.values(processedUpdates)];
      
      const result = await db.query(query, params);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error updating autoapply settings: ${error.message}`);
    }
  }

  static async toggleEnabled(userId, enabled) {
    try {
      const query = `
        UPDATE autoapply_settings 
        SET is_enabled = $2, updated_at = CURRENT_TIMESTAMP 
        WHERE user_id = $1 
        RETURNING *
      `;
      const result = await db.query(query, [userId, enabled]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error toggling autoapply settings: ${error.message}`);
    }
  }

  static async getEnabledUsers() {
    try {
      const query = `
        SELECT s.*, u.email
        FROM autoapply_settings s
        JOIN users u ON s.user_id = u.user_id
        WHERE s.is_enabled = true
      `;
      const result = await db.query(query);
      return result.rows;
    } catch (error) {
      throw new Error(`Error getting enabled users: ${error.message}`);
    }
  }

  static async getDailyApplicationCount(userId, date = null) {
    try {
      const targetDate = date || new Date().toISOString().split('T')[0];
      const query = `
        SELECT COUNT(*) as count
        FROM applications
        WHERE user_id = $1 
        AND DATE(applied_at) = $2
      `;
      const result = await db.query(query, [userId, targetDate]);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      throw new Error(`Error getting daily application count: ${error.message}`);
    }
  }

  static async getCompanyApplicationCount(userId, company) {
    try {
      const query = `
        SELECT COUNT(*) as count
        FROM applications a
        JOIN jobs j ON a.job_id = j.job_id
        WHERE a.user_id = $1 AND j.company_name = $2
      `;
      const result = await db.query(query, [userId, company]);
      return parseInt(result.rows[0].count) || 0;
    } catch (error) {
      throw new Error(`Error getting company application count: ${error.message}`);
    }
  }

  static async canApplyToday(userId) {
    try {
      const settings = await this.findByUserId(userId);
      if (!settings || !settings.is_enabled) {
        return false;
      }

      const dailyCount = await this.getDailyApplicationCount(userId);
      return dailyCount < settings.max_applications_per_day;
    } catch (error) {
      throw new Error(`Error checking if user can apply today: ${error.message}`);
    }
  }

  static async canApplyToCompany(userId, company) {
    try {
      const settings = await this.findByUserId(userId);
      if (!settings || !settings.is_enabled) {
        return false;
      }

      const companyCount = await this.getCompanyApplicationCount(userId, company);
      return companyCount < (settings.max_applications_per_company || 1);
    } catch (error) {
      throw new Error(`Error checking if user can apply to company: ${error.message}`);
    }
  }

  static async getDefaultScreeningAnswers(userId) {
    try {
      const settings = await this.findByUserId(userId);
      if (!settings || !settings.screening_answers) {
        return {};
      }

      return typeof settings.screening_answers === 'string' 
        ? JSON.parse(settings.screening_answers)
        : settings.screening_answers;
    } catch (error) {
      throw new Error(`Error getting default screening answers: ${error.message}`);
    }
  }

  static async delete(userId) {
    try {
      const query = 'DELETE FROM autoapply_settings WHERE user_id = $1 RETURNING *';
      const result = await db.query(query, [userId]);
      return result.rows[0] || null;
    } catch (error) {
      throw new Error(`Error deleting autoapply settings: ${error.message}`);
    }
  }
}

module.exports = AutoApplySettings;