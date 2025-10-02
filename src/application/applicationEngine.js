const ATSIntegrator = require('../ats/ATSIntegrator');const fs = require('fs').promises;

const UserProfile = require('../services/UserProfile');const path = require('path');

const Application = require('../database/models/Application');const AIContentGenerator = require('../ai/contentGenerator');

const AutoApplySettings = require('../database/models/AutoApplySettings');const logger = require('../utils/logger');

const AIContentGenerator = require('../ai/contentGenerator');

const logger = require('../utils/logger');class ApplicationEngine {

  constructor() {

class ApplicationEngine {    this.configPath = path.join(process.cwd(), 'config.json');

  constructor() {    this.reviewPath = path.join(process.cwd(), 'data', 'review');

    this.atsIntegrator = new ATSIntegrator();    this.contentGenerator = new AIContentGenerator();

    this.contentGenerator = new AIContentGenerator();    this.config = null;

  }  }



  async processApplication(userId, jobId) {  async loadConfig() {

    try {    const data = await fs.readFile(this.configPath, 'utf8');

      logger.info(`Processing application for user ${userId} to job ${jobId}`);    this.config = JSON.parse(data);

  }

      // Check if user can apply

      const canApply = await AutoApplySettings.canUserApplyToday(userId);  async prepareApplication(job) {

      if (!canApply.canApply) {    await this.loadConfig();

        throw new Error(canApply.reason);

      }    logger.info(`Preparing application for: ${job.title} at ${job.company}`);



      // Check for duplicate application    // Generate customized content

      const existingApplication = await Application.checkDuplicateApplication(userId, jobId);    const coverLetter = await this.contentGenerator.generateCoverLetter(

      if (existingApplication) {      job,

        throw new Error('Already applied to this job');      this.config.profile

      }    );



      // Get job data    const screeningAnswers = await this.contentGenerator.generateScreeningAnswers(

      const Job = require('../database/models/Job');      job,

      const job = await Job.findById(jobId);      this.config.profile,

      if (!job) {      this.config.screeningAnswers

        throw new Error('Job not found');    );

      }

    return {

      // Create application package using saved user profile      job,

      const applicationPackage = await UserProfile.createApplicationPackage(userId, job);      profile: this.config.profile,

            coverLetter,

      // Create application record      screeningAnswers,

      const application = await Application.create({      createdAt: new Date().toISOString()

        user_id: userId,    };

        job_id: jobId,  }

        application_mode: 'auto',

        resume_used: applicationPackage.applicationData.resumePath,  async submitApplication(application) {

        cover_letter_used: applicationPackage.applicationData.coverLetterPath,    // In production, this would interact with the actual job application system

        screening_answers_used: applicationPackage.applicationData.screeningAnswers,    // For now, we'll log and save the application

        application_data: applicationPackage.applicationData

      });    logger.info(`Submitting application for: ${application.job.title}`);



      // Get user settings to determine if this should be auto-applied or reviewed    const submissionsPath = path.join(process.cwd(), 'data', 'submissions');

      const settings = await AutoApplySettings.findByUser(userId);    await fs.mkdir(submissionsPath, { recursive: true });

      

      if (settings.mode === 'review') {    const filename = `${application.job.company}-${Date.now()}.json`;

        // Mark for review    await fs.writeFile(

        await Application.updateStatus(application.application_id, 'pending', 'Pending user review');      path.join(submissionsPath, filename),

              JSON.stringify(application, null, 2)

        return {    );

          success: true,

          mode: 'review',    logger.info('Application submitted successfully');

          message: 'Application prepared for review',    return { success: true, submittedAt: new Date().toISOString() };

          applicationId: application.application_id,  }

          data: applicationPackage

        };  async saveForReview(application) {

      } else {    await fs.mkdir(this.reviewPath, { recursive: true });

        // Auto-apply immediately

        const result = await this.executeApplication(application.application_id, applicationPackage);    const filename = `${application.job.company}-${Date.now()}.json`;

        return result;    await fs.writeFile(

      }      path.join(this.reviewPath, filename),

      JSON.stringify(application, null, 2)

    } catch (error) {    );

      logger.error('Error processing application:', error);

      throw error;    logger.info('Application saved for review');

    }  }

  }

  async getApplicationsForReview() {

  async executeApplication(applicationId, applicationPackage) {    try {

    try {      const files = await fs.readdir(this.reviewPath);

      logger.info(`Executing application ${applicationId}`);      const applications = [];



      // Update status to processing      for (const file of files) {

      await Application.updateStatus(applicationId, 'processing', 'Applying to job...');        if (file.endsWith('.json')) {

          const data = await fs.readFile(path.join(this.reviewPath, file), 'utf8');

      // Use ATS integrator to submit application          applications.push(JSON.parse(data));

      const result = await this.atsIntegrator.applyToJob(        }

        applicationPackage.jobData,      }

        applicationPackage.userData,

        applicationPackage.applicationData      return applications;

      );    } catch (error) {

      return [];

      if (result.success) {    }

        // Mark as successfully applied  }

        await Application.markAsApplied(applicationId, result.confirmationNumber);

          async approveApplication(applicationId) {

        logger.info(`Application ${applicationId} submitted successfully`);    const files = await fs.readdir(this.reviewPath);

        return {

          success: true,    for (const file of files) {

          mode: 'auto',      if (file.includes(applicationId)) {

          message: 'Application submitted successfully',        const data = await fs.readFile(path.join(this.reviewPath, file), 'utf8');

          applicationId: applicationId,        const application = JSON.parse(data);

          confirmationNumber: result.confirmationNumber

        };        // Submit the approved application

      } else {        await this.submitApplication(application);

        // Mark as failed

        await Application.markAsFailed(applicationId, result.message);        // Remove from review folder

                await fs.unlink(path.join(this.reviewPath, file));

        return {

          success: false,        return { success: true };

          message: result.message,      }

          applicationId: applicationId    }

        };

      }    return { success: false, error: 'Application not found' };

  }

    } catch (error) {}

      logger.error('Error executing application:', error);

      module.exports = ApplicationEngine;

      // Mark application as failed
      await Application.markAsFailed(applicationId, error.message);
      
      throw error;
    }
  }

  async approveApplication(userId, applicationId) {
    try {
      // Verify the application belongs to the user
      const application = await Application.findById(applicationId);
      if (!application || application.user_id !== userId) {
        throw new Error('Application not found or access denied');
      }

      if (application.status !== 'pending') {
        throw new Error(`Application is ${application.status}, cannot approve`);
      }

      // Recreate application package from stored data
      const Job = require('../database/models/Job');
      const job = await Job.findById(application.job_id);
      const applicationPackage = await UserProfile.createApplicationPackage(userId, job);

      // Execute the application
      const result = await this.executeApplication(applicationId, applicationPackage);
      return result;

    } catch (error) {
      logger.error('Error approving application:', error);
      throw error;
    }
  }

  async getUserApplicationStats(userId) {
    try {
      const stats = await Application.getUserStats(userId);
      const canApply = await AutoApplySettings.canUserApplyToday(userId);
      const settings = await AutoApplySettings.findByUser(userId);

      return {
        ...stats,
        limits: {
          dailyLimit: settings.max_applications_per_day,
          weeklyLimit: settings.max_applications_per_week,
          dailyRemaining: canApply.dailyRemaining || 0,
          weeklyRemaining: canApply.weeklyRemaining || 0
        },
        canApply: canApply.canApply,
        canApplyReason: canApply.reason,
        autoApplyEnabled: settings.is_enabled,
        autoApplyMode: settings.mode
      };
    } catch (error) {
      logger.error('Error getting user application stats:', error);
      throw error;
    }
  }
}

module.exports = ApplicationEngine;