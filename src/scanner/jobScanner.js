const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

class JobScanner {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.dataPath = path.join(process.cwd(), 'data', 'scanned_jobs.json');
    this.config = null;
    this.scannedJobs = new Set();
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.configPath, 'utf8');
      this.config = JSON.parse(data);
    } catch (error) {
      logger.error('Error loading config:', error);
      throw error;
    }
  }

  async loadScannedJobs() {
    try {
      const data = await fs.readFile(this.dataPath, 'utf8');
      const jobs = JSON.parse(data);
      this.scannedJobs = new Set(jobs);
    } catch (error) {
      // File doesn't exist yet, start fresh
      this.scannedJobs = new Set();
    }
  }

  async saveScannedJobs() {
    try {
      await fs.mkdir(path.dirname(this.dataPath), { recursive: true });
      await fs.writeFile(
        this.dataPath,
        JSON.stringify(Array.from(this.scannedJobs), null, 2)
      );
    } catch (error) {
      logger.error('Error saving scanned jobs:', error);
    }
  }

  async scanJobs() {
    await this.loadConfig();
    await this.loadScannedJobs();

    const newJobs = [];
    const companies = this.config.companies || [];

    for (const company of companies) {
      try {
        const jobs = await this.scanCompanyCareerSite(company);

        for (const job of jobs) {
          if (!this.scannedJobs.has(job.id) && this.matchesCriteria(job)) {
            newJobs.push(job);
            this.scannedJobs.add(job.id);
          }
        }
      } catch (error) {
        logger.error(`Error scanning ${company.name}:`, error);
      }
    }

    await this.saveScannedJobs();
    return newJobs;
  }

  async scanCompanyCareerSite(company) {
    // This is a simplified implementation
    // In production, you'd need specific scrapers for each company's career site
    const response = await axios.get(company.careerUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    const $ = cheerio.load(response.data);
    const jobs = [];

    // Generic job extraction (customize per company)
    $('a[href*="job"], a[href*="career"], .job-listing').each((i, element) => {
      const $el = $(element);
      const title = $el.text().trim();
      const url = $el.attr('href');

      if (title && url) {
        jobs.push({
          id: `${company.name}-${url}`,
          title,
          company: company.name,
          url: url.startsWith('http') ? url : `${company.baseUrl}${url}`,
          location: '',
          seniority: '',
          scannedAt: new Date().toISOString()
        });
      }
    });

    return jobs;
  }

  matchesCriteria(job) {
    const criteria = this.config.jobCriteria;

    // Check excluded keywords
    if (criteria.excludeKeywords) {
      const lowerTitle = job.title.toLowerCase();
      if (criteria.excludeKeywords.some(kw => lowerTitle.includes(kw.toLowerCase()))) {
        return false;
      }
    }

    // Check excluded companies
    if (criteria.excludeCompanies && criteria.excludeCompanies.includes(job.company)) {
      return false;
    }

    // Check title match
    if (criteria.titles && criteria.titles.length > 0) {
      const titleMatch = criteria.titles.some(title =>
        job.title.toLowerCase().includes(title.toLowerCase())
      );
      if (!titleMatch) return false;
    }

    // Check keywords
    if (criteria.keywords && criteria.keywords.length > 0) {
      const keywordMatch = criteria.keywords.some(keyword =>
        job.title.toLowerCase().includes(keyword.toLowerCase())
      );
      if (!keywordMatch) return false;
    }

    return true;
  }
}

module.exports = JobScanner;
