const puppeteer = require('puppeteer');const axios = require('axios');const axios = require('axios');

const Job = require('../database/models/Job');

const AutoApplySettings = require('../database/models/AutoApplySettings');const cheerio = require('cheerio');const cheerio = require('cheerio');

const logger = require('../utils/logger');

const puppeteer = require('puppeteer');const puppeteer = require('puppeteer');

class JobScanner {

  constructor() {const Job = require('../database/models/Job');const Job = require('../database/models/Job');

    this.browser = null;

    this.isScanning = false;const AutoApplySettings = require('../database/models/AutoApplySettings');const AutoApplySettings = require('../database/models/AutoApplySettings');

  }

const logger = require('../utils/logger');const logger = require('../utils/logger');

  async scanAllPortals() {

    logger.info('Job scanner functionality - basic implementation');

    return { totalJobsFound: 0, newJobsAdded: 0, duplicatesSkipped: 0, errors: 0 };

  }class JobScanner {class JobScanner {



  async getJobsForUser(userId) {  constructor() {  constructor() {

    try {

      const userSettings = await AutoApplySettings.findByUser(userId);    this.browser = null;    this.browser = null;

      if (!userSettings.is_enabled) {

        return [];    this.isScanning = false;    this.isScanning = false;

      }

      return await Job.getMatchingJobs(userId);    this.scanStats = {    this.scanStats = {

    } catch (error) {

      logger.error(`Error getting jobs for user ${userId}:`, error);      totalJobsFound: 0,      totalJobsFound: 0,

      return [];

    }      newJobsAdded: 0,      newJobsAdded: 0,

  }

}      duplicatesSkipped: 0,      duplicatesSkipped: 0,



module.exports = JobScanner;      errors: 0      errors: 0

    };    };



    // Company career portal configurations    // Company career portal configurations

    this.companyPortals = {    this.companyPortals = {

      'tesla': {      'tesla': {

        baseUrl: 'https://www.tesla.com/careers/search/?country=US',        baseUrl: 'https://www.tesla.com/careers/search/?country=US',

        jobSelector: '.tds-text-body-1',        jobSelector: '.tds-text-body-1',

        titleSelector: '.tds-text--h4',        titleSelector: '.tds-text--h4',

        locationSelector: '.tds-text-body-2',        locationSelector: '.tds-text-body-2',

        atsType: 'workday',        atsType: 'workday',

        scanMethod: 'puppeteer'        scanMethod: 'puppeteer'

      },      },

      'microsoft': {      'microsoft': {

        baseUrl: 'https://careers.microsoft.com/v2/global/en/search',        baseUrl: 'https://careers.microsoft.com/v2/global/en/search',

        jobSelector: '.job-result',        jobSelector: '.job-result',

        titleSelector: '.job-title',        titleSelector: '.job-title',

        locationSelector: '.job-location',        locationSelector: '.job-location',

        atsType: 'icims',        atsType: 'icims',

        scanMethod: 'puppeteer'        scanMethod: 'puppeteer'

      },      },

      'amazon': {      'amazon': {

        baseUrl: 'https://www.amazon.jobs/en/search',        baseUrl: 'https://www.amazon.jobs/en/search',

        jobSelector: '.job-tile',        jobSelector: '.job-tile',

        titleSelector: '.job-tile-title',        titleSelector: '.job-tile-title',

        locationSelector: '.job-tile-location',        locationSelector: '.job-tile-location',

        atsType: 'custom',        atsType: 'custom',

        scanMethod: 'puppeteer'        scanMethod: 'puppeteer'

      },      },

      'google': {      'google': {

        baseUrl: 'https://careers.google.com/jobs/results/',        baseUrl: 'https://careers.google.com/jobs/results/',

        jobSelector: '.VfPpkd-dgl2Hf-ppHlrf-sM5MNb',        jobSelector: '.VfPpkd-dgl2Hf-ppHlrf-sM5MNb',

        titleSelector: '.p1N4Je',        titleSelector: '.p1N4Je',

        locationSelector: '.r0wTof',        locationSelector: '.r0wTof',

        atsType: 'greenhouse',        atsType: 'greenhouse',

        scanMethod: 'puppeteer'        scanMethod: 'puppeteer'

      },      },

      'meta': {      'meta': {

        baseUrl: 'https://www.metacareers.com/jobs/',        baseUrl: 'https://www.metacareers.com/jobs/',

        jobSelector: '.job-posting-item',        jobSelector: '.job-posting-item',

        titleSelector: '.job-posting-item__title',        titleSelector: '.job-posting-item__title',

        locationSelector: '.job-posting-item__location',        locationSelector: '.job-posting-item__location',

        atsType: 'greenhouse',        atsType: 'greenhouse',

        scanMethod: 'puppeteer'        scanMethod: 'puppeteer'

      }      }

    };    };

  }  }



  async initialize() {  async initialize() {

    if (!this.browser) {    if (!this.browser) {

      this.browser = await puppeteer.launch({      this.browser = await puppeteer.launch({

        headless: 'new',        headless: 'new',

        args: [        args: [

          '--no-sandbox',          '--no-sandbox',

          '--disable-setuid-sandbox',          '--disable-setuid-sandbox',

          '--disable-dev-shm-usage',          '--disable-dev-shm-usage',

          '--disable-accelerated-2d-canvas',          '--disable-accelerated-2d-canvas',

          '--disable-gpu',          '--disable-gpu',

          '--window-size=1920x1080'          '--window-size=1920x1080'

        ]        ]

      });      });

      logger.info('Job scanner browser initialized');      logger.info('Job scanner browser initialized');

    }    }

  }  }



  async cleanup() {  async cleanup() {

    if (this.browser) {    if (this.browser) {

      await this.browser.close();      await this.browser.close();

      this.browser = null;      this.browser = null;

      logger.info('Job scanner browser closed');      logger.info('Job scanner browser closed');

    }    }

  }  }



  async scanAllPortals() {  async scanAllPortals() {

    if (this.isScanning) {    if (this.isScanning) {

      logger.warn('Job scan already in progress');      logger.warn('Job scan already in progress');

      return this.scanStats;      return this.scanStats;

    }    }



    this.isScanning = true;    this.isScanning = true;

    this.scanStats = { totalJobsFound: 0, newJobsAdded: 0, duplicatesSkipped: 0, errors: 0 };    this.scanStats = { totalJobsFound: 0, newJobsAdded: 0, duplicatesSkipped: 0, errors: 0 };

        

    try {    try {

      await this.initialize();      await this.initialize();

      logger.info('Starting job scan across all company portals');      logger.info('Starting job scan across all company portals');



      const enabledUsers = await AutoApplySettings.getEnabledUsers();      const enabledUsers = await AutoApplySettings.getEnabledUsers();

      if (enabledUsers.length === 0) {      if (enabledUsers.length === 0) {

        logger.info('No users have autoapply enabled, skipping scan');        logger.info('No users have autoapply enabled, skipping scan');

        return this.scanStats;        return this.scanStats;

      }      }



      for (const [companyName, config] of Object.entries(this.companyPortals)) {      for (const [companyName, config] of Object.entries(this.companyPortals)) {

        try {        try {

          logger.info(`Scanning ${companyName} career portal`);          logger.info(`Scanning ${companyName} career portal`);

          await this.scanCompanyPortal(companyName, config);          await this.scanCompanyPortal(companyName, config);

        } catch (error) {        } catch (error) {

          logger.error(`Error scanning ${companyName}:`, error);          logger.error(`Error scanning ${companyName}:`, error);

          this.scanStats.errors++;          this.scanStats.errors++;

        }        }

      }      }



      logger.info('Job scan completed', this.scanStats);      logger.info('Job scan completed', this.scanStats);

      return this.scanStats;      return this.scanStats;



    } finally {    } finally {

      this.isScanning = false;      this.isScanning = false;

      await this.cleanup();      await this.cleanup();

    }    }

  }  }



  async scanCompanyPortal(companyName, config) {  async scanCompanyPortal(companyName, config) {

    const page = await this.browser.newPage();      // File doesn't exist yet, start fresh

          this.scannedJobs = new Set();

    try {    }

      // Set user agent to avoid bot detection  }

      await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');

        async saveScannedJobs() {

      // Navigate to company career page    try {

      await page.goto(config.baseUrl, {       await fs.mkdir(path.dirname(this.dataPath), { recursive: true });

        waitUntil: 'networkidle2',      await fs.writeFile(

        timeout: 30000         this.dataPath,

      });        JSON.stringify(Array.from(this.scannedJobs), null, 2)

      );

      // Wait for job listings to load    } catch (error) {

      await page.waitForSelector(config.jobSelector, { timeout: 10000 });      logger.error('Error saving scanned jobs:', error);

    }

      // Extract job information  }

      const jobs = await page.evaluate((config, companyName) => {

        const jobElements = document.querySelectorAll(config.jobSelector);  async scanJobs() {

        const extractedJobs = [];    await this.loadConfig();

    await this.loadScannedJobs();

        jobElements.forEach((element, index) => {

          try {    const newJobs = [];

            const titleElement = element.querySelector(config.titleSelector) || element;    const companies = this.config.companies || [];

            const locationElement = element.querySelector(config.locationSelector);

                for (const company of companies) {

            const title = titleElement?.textContent?.trim() || '';      try {

            const location = locationElement?.textContent?.trim() || '';        const jobs = await this.scanCompanyCareerSite(company);

            

            // Try to find job URL        for (const job of jobs) {

            let jobUrl = '';          if (!this.scannedJobs.has(job.id) && this.matchesCriteria(job)) {

            const linkElement = element.querySelector('a') || element.closest('a');            newJobs.push(job);

            if (linkElement) {            this.scannedJobs.add(job.id);

              jobUrl = linkElement.href || linkElement.getAttribute('href') || '';          }

            }        }

      } catch (error) {

            if (title && jobUrl) {        logger.error(`Error scanning ${company.name}:`, error);

              extractedJobs.push({      }

                company_name: companyName,    }

                job_title: title,

                job_url: jobUrl.startsWith('http') ? jobUrl : config.baseUrl + jobUrl,    await this.saveScannedJobs();

                location: location,    return newJobs;

                ats_type: config.atsType,  }

                discovered_at: new Date().toISOString()

              });  async scanCompanyCareerSite(company) {

            }    // This is a simplified implementation

          } catch (error) {    // In production, you'd need specific scrapers for each company's career site

            console.log('Error extracting job info:', error);    const response = await axios.get(company.careerUrl, {

          }      headers: {

        });        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

      }

        return extractedJobs;    });

      }, config, companyName);

    const $ = cheerio.load(response.data);

      logger.info(`Found ${jobs.length} jobs at ${companyName}`);    const jobs = [];

      this.scanStats.totalJobsFound += jobs.length;

    // Generic job extraction (customize per company)

      // Save new jobs to database    $('a[href*="job"], a[href*="career"], .job-listing').each((i, element) => {

      for (const jobData of jobs) {      const $el = $(element);

        try {      const title = $el.text().trim();

          // Check if job already exists      const url = $el.attr('href');

          const existingJob = await Job.findByUrl(jobData.job_url);

                if (title && url) {

          if (existingJob) {        jobs.push({

            this.scanStats.duplicatesSkipped++;          id: `${company.name}-${url}`,

            // Update last_checked timestamp          title,

            await Job.markAsChecked(existingJob.job_id);          company: company.name,

          } else {          url: url.startsWith('http') ? url : `${company.baseUrl}${url}`,

            // Extract additional job details if needed          location: '',

            const enhancedJobData = await this.extractJobDetails(page, jobData);          seniority: '',

                      scannedAt: new Date().toISOString()

            // Create new job entry        });

            await Job.create(enhancedJobData);      }

            this.scanStats.newJobsAdded++;    });

            logger.info(`Added new job: ${jobData.job_title} at ${jobData.company_name}`);

          }    return jobs;

        } catch (error) {  }

          logger.error(`Error saving job: ${jobData.job_title}`, error);

          this.scanStats.errors++;  matchesCriteria(job) {

        }    const criteria = this.config.jobCriteria;

      }

    // Check excluded keywords

    } catch (error) {    if (criteria.excludeKeywords) {

      logger.error(`Error scanning ${companyName} portal:`, error);      const lowerTitle = job.title.toLowerCase();

      this.scanStats.errors++;      if (criteria.excludeKeywords.some(kw => lowerTitle.includes(kw.toLowerCase()))) {

    } finally {        return false;

      await page.close();      }

    }    }

  }

    // Check excluded companies

  async extractJobDetails(page, basicJobData) {    if (criteria.excludeCompanies && criteria.excludeCompanies.includes(job.company)) {

    // Try to extract more detailed information by visiting the job page      return false;

    try {    }

      const jobPage = await this.browser.newPage();

      await jobPage.goto(basicJobData.job_url, {     // Check title match

        waitUntil: 'networkidle2',    if (criteria.titles && criteria.titles.length > 0) {

        timeout: 15000       const titleMatch = criteria.titles.some(title =>

      });        job.title.toLowerCase().includes(title.toLowerCase())

      );

      const jobDetails = await jobPage.evaluate(() => {      if (!titleMatch) return false;

        // Generic extraction - could be customized per ATS type    }

        const descriptionSelectors = [

          '.job-description',    // Check keywords

          '.job-details',    if (criteria.keywords && criteria.keywords.length > 0) {

          '.job-content',      const keywordMatch = criteria.keywords.some(keyword =>

          '[class*="description"]',        job.title.toLowerCase().includes(keyword.toLowerCase())

          '[id*="description"]'      );

        ];      if (!keywordMatch) return false;

    }

        const requirementsSelectors = [

          '.job-requirements',    return true;

          '.requirements',  }

          '[class*="requirement"]',}

          '[id*="requirement"]'

        ];module.exports = JobScanner;


        let description = '';
        let requirements = '';

        // Try to find job description
        for (const selector of descriptionSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            description = element.textContent?.trim() || '';
            break;
          }
        }

        // Try to find requirements
        for (const selector of requirementsSelectors) {
          const element = document.querySelector(selector);
          if (element) {
            requirements = element.textContent?.trim() || '';
            break;
          }
        }

        // Try to extract salary information
        const salaryText = document.body.textContent;
        const salaryMatch = salaryText.match(/\$[\d,]+(?:\s*-\s*\$[\d,]+)?(?:\s*(?:per|\/)\s*year)?/i);
        
        return {
          job_description: description,
          requirements: requirements,
          salaryInfo: salaryMatch ? salaryMatch[0] : null
        };
      });

      await jobPage.close();

      // Parse salary information if available
      let salary_min = null;
      let salary_max = null;
      
      if (jobDetails.salaryInfo) {
        const salaryNumbers = jobDetails.salaryInfo.match(/\d+/g);
        if (salaryNumbers && salaryNumbers.length >= 1) {
          salary_min = parseInt(salaryNumbers[0].replace(/,/g, ''));
          salary_max = salaryNumbers.length > 1 ? parseInt(salaryNumbers[1].replace(/,/g, '')) : salary_min;
        }
      }

      // Determine seniority level from job title and description
      const seniority_level = this.determineSeniorityLevel(basicJobData.job_title, jobDetails.job_description);
      
      // Determine job type
      const job_type = this.determineJobType(basicJobData.job_title, jobDetails.job_description);

      return {
        ...basicJobData,
        job_description: jobDetails.job_description,
        requirements: jobDetails.requirements,
        salary_min,
        salary_max,
        seniority_level,
        job_type,
        posted_date: new Date().toISOString().split('T')[0] // Today's date as fallback
      };

    } catch (error) {
      logger.warn(`Could not extract detailed job info for ${basicJobData.job_url}:`, error.message);
      
      // Return basic data with inferred information
      return {
        ...basicJobData,
        seniority_level: this.determineSeniorityLevel(basicJobData.job_title),
        job_type: this.determineJobType(basicJobData.job_title),
        posted_date: new Date().toISOString().split('T')[0]
      };
    }
  }

  determineSeniorityLevel(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('senior') || text.includes('sr.') || text.includes('lead') || text.includes('principal')) {
      return 'senior';
    } else if (text.includes('junior') || text.includes('jr.') || text.includes('entry') || text.includes('associate')) {
      return 'entry';
    } else if (text.includes('director') || text.includes('vp') || text.includes('vice president') || text.includes('executive')) {
      return 'executive';
    } else {
      return 'mid';
    }
  }

  determineJobType(title, description = '') {
    const text = (title + ' ' + description).toLowerCase();
    
    if (text.includes('contract') || text.includes('contractor') || text.includes('freelance')) {
      return 'contract';
    } else if (text.includes('part-time') || text.includes('part time')) {
      return 'part-time';
    } else if (text.includes('intern') || text.includes('internship')) {
      return 'internship';
    } else {
      return 'full-time';
    }
  }

  async getJobsForUser(userId) {
    try {
      // Get user preferences and settings
      const userSettings = await AutoApplySettings.findByUser(userId);
      
      if (!userSettings.is_enabled) {
        return [];
      }

      // Get matching jobs based on user criteria
      const matchingJobs = await Job.getMatchingJobs(userId);
      
      // Filter jobs based on autoapply settings
      const filteredJobs = [];
      
      for (const job of matchingJobs) {
        const shouldMatch = await AutoApplySettings.shouldJobMatch(userId, job);
        if (shouldMatch.matches) {
          filteredJobs.push(job);
        }
      }

      return filteredJobs;
    } catch (error) {
      logger.error(`Error getting jobs for user ${userId}:`, error);
      return [];
    }
  }

  async scheduleNextScan() {
    // Get the minimum scan frequency from all enabled users
    const enabledUsers = await AutoApplySettings.getEnabledUsers();
    
    if (enabledUsers.length === 0) {
      logger.info('No users enabled for autoapply, skipping scan scheduling');
      return;
    }

    const minFrequency = Math.min(...enabledUsers.map(user => user.scan_frequency_hours));
    const nextScanTime = new Date(Date.now() + minFrequency * 60 * 60 * 1000);
    
    logger.info(`Next job scan scheduled for ${nextScanTime.toISOString()}`);
    
    setTimeout(() => {
      this.scanAllPortals();
    }, minFrequency * 60 * 60 * 1000);
  }
}

module.exports = JobScanner;