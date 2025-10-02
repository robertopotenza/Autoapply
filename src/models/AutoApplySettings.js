const db = require('../database/db');

class AutoApplySettings {
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
        enabled: false,
        maxApplicationsPerDay: 5,
        maxApplicationsPerCompany: 1,
        preferredLocations: [],
        jobTypes: ['full-time'],
        salaryMin: null,
        salaryMax: null,
        seniorityLevel: null,
        excludeCompanies: [],
        includeCompanies: [],
        keywords: [],
        excludeKeywords: [],
        autoGenerateCoverLetter: true,
        customCoverLetterTemplate: null,
        screeningAnswers: {},
        applicationDelay: 300, // 5 minutes between applications
        ...settings
      };

      const query = `
        INSERT INTO autoapply_settings (
          user_id, enabled, max_applications_per_day, max_applications_per_company,
          preferred_locations, job_types, salary_min, salary_max, seniority_level,
          exclude_companies, include_companies, keywords, exclude_keywords,
          auto_generate_cover_letter, custom_cover_letter_template, screening_answers,
          application_delay
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        RETURNING *
      `;

      const params = [
        userId,
        defaultSettings.enabled,
        defaultSettings.maxApplicationsPerDay,
        defaultSettings.maxApplicationsPerCompany,
        JSON.stringify(defaultSettings.preferredLocations),
        JSON.stringify(defaultSettings.jobTypes),
        defaultSettings.salaryMin,
        defaultSettings.salaryMax,
        defaultSettings.seniorityLevel,
        JSON.stringify(defaultSettings.excludeCompanies),
        JSON.stringify(defaultSettings.includeCompanies),
        JSON.stringify(defaultSettings.keywords),
        JSON.stringify(defaultSettings.excludeKeywords),
        defaultSettings.autoGenerateCoverLetter,
        defaultSettings.customCoverLetterTemplate,
        JSON.stringify(defaultSettings.screeningAnswers),
        defaultSettings.applicationDelay
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

      // Convert array/object fields to JSON strings
      const processedUpdates = { ...updates };
      const jsonFields = [
        'preferred_locations', 'job_types', 'exclude_companies', 
        'include_companies', 'keywords', 'exclude_keywords', 'screening_answers'
      ];

      jsonFields.forEach(field => {
        if (processedUpdates[field] !== undefined) {
          processedUpdates[field] = JSON.stringify(processedUpdates[field]);
        }
      });

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
        SET enabled = $2, updated_at = CURRENT_TIMESTAMP 
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
        SELECT s.*, u.email, u.first_name, u.last_name
        FROM autoapply_settings s
        JOIN users u ON s.user_id = u.id
        WHERE s.enabled = true
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
        JOIN jobs j ON a.job_id = j.id
        WHERE a.user_id = $1 AND j.company = $2
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
      if (!settings || !settings.enabled) {
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
      if (!settings || !settings.enabled) {
        return false;
      }

      const companyCount = await this.getCompanyApplicationCount(userId, company);
      return companyCount < settings.max_applications_per_company;
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