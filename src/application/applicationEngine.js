const fs = require('fs').promises;
const path = require('path');
const AIContentGenerator = require('../ai/contentGenerator');
const logger = require('../utils/logger');

class ApplicationEngine {
  constructor() {
    this.configPath = path.join(process.cwd(), 'config.json');
    this.reviewPath = path.join(process.cwd(), 'data', 'review');
    this.contentGenerator = new AIContentGenerator();
    this.config = null;
  }

  async loadConfig() {
    const data = await fs.readFile(this.configPath, 'utf8');
    this.config = JSON.parse(data);
  }

  async prepareApplication(job) {
    await this.loadConfig();

    logger.info(`Preparing application for: ${job.title} at ${job.company}`);

    // Generate customized content
    const coverLetter = await this.contentGenerator.generateCoverLetter(
      job,
      this.config.profile
    );

    const screeningAnswers = await this.contentGenerator.generateScreeningAnswers(
      job,
      this.config.profile,
      this.config.screeningAnswers
    );

    return {
      job,
      profile: this.config.profile,
      coverLetter,
      screeningAnswers,
      createdAt: new Date().toISOString()
    };
  }

  async submitApplication(application) {
    // In production, this would interact with the actual job application system
    // For now, we'll log and save the application

    logger.info(`Submitting application for: ${application.job.title}`);

    const submissionsPath = path.join(process.cwd(), 'data', 'submissions');
    await fs.mkdir(submissionsPath, { recursive: true });

    const filename = `${application.job.company}-${Date.now()}.json`;
    await fs.writeFile(
      path.join(submissionsPath, filename),
      JSON.stringify(application, null, 2)
    );

    logger.info('Application submitted successfully');
    return { success: true, submittedAt: new Date().toISOString() };
  }

  async saveForReview(application) {
    await fs.mkdir(this.reviewPath, { recursive: true });

    const filename = `${application.job.company}-${Date.now()}.json`;
    await fs.writeFile(
      path.join(this.reviewPath, filename),
      JSON.stringify(application, null, 2)
    );

    logger.info('Application saved for review');
  }

  async getApplicationsForReview() {
    try {
      const files = await fs.readdir(this.reviewPath);
      const applications = [];

      for (const file of files) {
        if (file.endsWith('.json')) {
          const data = await fs.readFile(path.join(this.reviewPath, file), 'utf8');
          applications.push(JSON.parse(data));
        }
      }

      return applications;
    } catch (error) {
      return [];
    }
  }

  async approveApplication(applicationId) {
    const files = await fs.readdir(this.reviewPath);

    for (const file of files) {
      if (file.includes(applicationId)) {
        const data = await fs.readFile(path.join(this.reviewPath, file), 'utf8');
        const application = JSON.parse(data);

        // Submit the approved application
        await this.submitApplication(application);

        // Remove from review folder
        await fs.unlink(path.join(this.reviewPath, file));

        return { success: true };
      }
    }

    return { success: false, error: 'Application not found' };
  }
}

module.exports = ApplicationEngine;
