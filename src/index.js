require('dotenv').config();
const { CronJob } = require('cron');
const JobScanner = require('./scanner/jobScanner');
const ApplicationEngine = require('./application/applicationEngine');
const LearningSystem = require('./ai/learningSystem');
const logger = require('./utils/logger');

class AutoApply {
  constructor() {
    this.jobScanner = new JobScanner();
    this.applicationEngine = new ApplicationEngine();
    this.learningSystem = new LearningSystem();
    this.scanInterval = process.env.SCAN_INTERVAL_HOURS || 2;
  }

  async start() {
    logger.info('Starting Auto-Apply system...');

    // Initial scan
    await this.runScanCycle();

    // Schedule periodic scans
    const cronPattern = `0 */${this.scanInterval} * * *`;
    const job = new CronJob(cronPattern, async () => {
      await this.runScanCycle();
    });

    job.start();
    logger.info(`Auto-Apply system running. Scanning every ${this.scanInterval} hours.`);
  }

  async runScanCycle() {
    try {
      logger.info('Starting job scan cycle...');

      // Scan for new jobs
      const newJobs = await this.jobScanner.scanJobs();
      logger.info(`Found ${newJobs.length} matching jobs`);

      // Process each job
      for (const job of newJobs) {
        await this.processJob(job);
      }

      logger.info('Scan cycle completed');
    } catch (error) {
      logger.error('Error in scan cycle:', error);
    }
  }

  async processJob(job) {
    try {
      // Prepare application
      const application = await this.applicationEngine.prepareApplication(job);

      // Check automation mode
      const mode = process.env.AUTOMATION_MODE || 'review';

      if (mode === 'auto') {
        // Auto-apply without review
        await this.applicationEngine.submitApplication(application);
        logger.info(`Auto-applied to: ${job.title} at ${job.company}`);

        // Learn from successful application
        await this.learningSystem.recordApplication(application);
      } else {
        // Save for review
        await this.applicationEngine.saveForReview(application);
        logger.info(`Saved for review: ${job.title} at ${job.company}`);
      }
    } catch (error) {
      logger.error(`Error processing job ${job.id}:`, error);
    }
  }
}

// Start the system
const autoApply = new AutoApply();
autoApply.start();
