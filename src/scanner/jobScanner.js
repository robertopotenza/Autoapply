const Job = require('../database/models/Job');
const AutoApplySettings = require('../database/models/AutoApplySettings');
const logger = require('../utils/logger');

class JobScanner {
  constructor() {
    this.isScanning = false;
    this.scanStats = {
      totalJobsFound: 0,
      newJobsAdded: 0,
      duplicatesSkipped: 0,
      errors: 0
    };
  }

  async scanAllPortals() {
    if (this.isScanning) {
      logger.warn('Job scan already in progress');
      return this.scanStats;
    }

    this.isScanning = true;
    this.scanStats = { totalJobsFound: 0, newJobsAdded: 0, duplicatesSkipped: 0, errors: 0 };
    
    try {
      logger.info('Starting job scan across company portals');

      const enabledUsers = await AutoApplySettings.getEnabledUsers();
      if (enabledUsers.length === 0) {
        logger.info('No users have autoapply enabled, skipping scan');
        return this.scanStats;
      }

      // For now, create some sample jobs for testing
      await this.createSampleJobs();

      logger.info('Job scan completed', this.scanStats);
      return this.scanStats;

    } finally {
      this.isScanning = false;
    }
  }

  async createSampleJobs() {
    // Create some sample job postings for testing
    const sampleJobs = [
      {
        company_name: 'Tesla',
        job_title: 'Senior Software Engineer',
        job_url: 'https://www.tesla.com/careers/job/senior-software-engineer-12345',
        ats_type: 'workday',
        location: 'Palo Alto, CA',
        job_type: 'full-time',
        seniority_level: 'senior',
        salary_min: 120000,
        salary_max: 180000,
        job_description: 'Join Tesla\'s software team to develop cutting-edge automotive software solutions.',
        requirements: '5+ years of software development experience, Python, JavaScript, React',
        posted_date: new Date().toISOString().split('T')[0]
      },
      {
        company_name: 'Microsoft',
        job_title: 'Product Manager',
        job_url: 'https://careers.microsoft.com/job/product-manager-67890',
        ats_type: 'icims',
        location: 'Seattle, WA',
        job_type: 'full-time',
        seniority_level: 'mid',
        salary_min: 100000,
        salary_max: 150000,
        job_description: 'Lead product development initiatives in Microsoft\'s cloud division.',
        requirements: '3+ years of product management experience, Technical background preferred',
        posted_date: new Date().toISOString().split('T')[0]
      },
      {
        company_name: 'Google',
        job_title: 'Data Scientist',
        job_url: 'https://careers.google.com/job/data-scientist-54321',
        ats_type: 'greenhouse',
        location: 'Mountain View, CA',
        job_type: 'full-time',
        seniority_level: 'mid',
        salary_min: 130000,
        salary_max: 200000,
        job_description: 'Analyze large datasets to derive insights for Google\'s products.',
        requirements: 'PhD in Data Science or related field, Python, R, Machine Learning experience',
        posted_date: new Date().toISOString().split('T')[0]
      },
      {
        company_name: 'Amazon',
        job_title: 'Software Development Engineer',
        job_url: 'https://www.amazon.jobs/job/sde-98765',
        ats_type: 'custom',
        location: 'Remote',
        job_type: 'full-time',
        seniority_level: 'entry',
        salary_min: 90000,
        salary_max: 140000,
        job_description: 'Build scalable systems for Amazon\'s e-commerce platform.',
        requirements: 'Bachelor\'s degree in Computer Science, Java, AWS experience preferred',
        posted_date: new Date().toISOString().split('T')[0]
      }
    ];

    for (const jobData of sampleJobs) {
      try {
        // Check if job already exists
        const existingJob = await Job.findByUrl(jobData.job_url);
        
        if (existingJob) {
          this.scanStats.duplicatesSkipped++;
          await Job.markAsChecked(existingJob.job_id);
        } else {
          // Create new job entry
          await Job.create(jobData);
          this.scanStats.newJobsAdded++;
          logger.info(`Added sample job: ${jobData.job_title} at ${jobData.company_name}`);
        }
        
        this.scanStats.totalJobsFound++;
      } catch (error) {
        logger.error(`Error creating sample job: ${jobData.job_title}`, error);
        this.scanStats.errors++;
      }
    }
  }

  async getJobsForUser(userId) {
    try {
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
