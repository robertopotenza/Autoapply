const express = require('express');
const router = express.Router();
const UserProfile = require('../services/UserProfile');
const AutoApplySettings = require('../database/models/AutoApplySettings');
const Application = require('../database/models/Application');
const Job = require('../database/models/Job');
const auth = require('../middleware/auth');

// Get complete user profile for autoapply
router.get('/profile', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const profile = await UserProfile.getCompleteProfile(userId);
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'User profile not found. Please complete the setup wizard.'
      });
    }

    res.json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error('Error getting user profile:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving user profile'
    });
  }
});

// Get application readiness status
router.get('/readiness', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const readiness = await UserProfile.getApplicationReadiness(userId);
    
    res.json({
      success: true,
      data: readiness
    });
  } catch (error) {
    console.error('Error checking application readiness:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking application readiness'
    });
  }
});

// Get autoapply settings
router.get('/settings', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = await AutoApplySettings.findByUser(userId);
    
    res.json({
      success: true,
      data: settings
    });
  } catch (error) {
    console.error('Error getting autoapply settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving autoapply settings'
    });
  }
});

// Update autoapply settings
router.post('/settings', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settingsData = req.body;
    
    const settings = await AutoApplySettings.create(userId, settingsData);
    
    res.json({
      success: true,
      message: 'AutoApply settings updated successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error updating autoapply settings:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating autoapply settings'
    });
  }
});

// Enable autoapply
router.post('/enable', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    
    // Check if profile is complete
    const readiness = await UserProfile.getApplicationReadiness(userId);
    if (!readiness.profileComplete) {
      return res.status(400).json({
        success: false,
        message: 'Profile incomplete. Please complete the setup wizard first.',
        missingFields: readiness.missingFields
      });
    }
    
    const settings = await AutoApplySettings.enable(userId);
    
    res.json({
      success: true,
      message: 'AutoApply enabled successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error enabling autoapply:', error);
    res.status(500).json({
      success: false,
      message: 'Error enabling autoapply'
    });
  }
});

// Disable autoapply
router.post('/disable', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const settings = await AutoApplySettings.disable(userId);
    
    res.json({
      success: true,
      message: 'AutoApply disabled successfully',
      data: settings
    });
  } catch (error) {
    console.error('Error disabling autoapply:', error);
    res.status(500).json({
      success: false,
      message: 'Error disabling autoapply'
    });
  }
});

// Get user applications
router.get('/applications', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 50, offset = 0 } = req.query;
    
    const filters = { limit: parseInt(limit) };
    if (status) filters.status = status;
    
    const applications = await Application.findByUser(userId, filters);
    const stats = await Application.getUserStats(userId);
    
    res.json({
      success: true,
      data: {
        applications: applications,
        stats: stats,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });
  } catch (error) {
    console.error('Error getting user applications:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving applications'
    });
  }
});

// Get matching jobs for user
router.get('/matching-jobs', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 20 } = req.query;
    
    const matchingJobs = await Job.getMatchingJobs(userId);
    
    // Filter jobs based on autoapply settings
    const settings = await AutoApplySettings.findByUser(userId);
    const filteredJobs = [];
    
    for (const job of matchingJobs.slice(0, limit)) {
      const shouldMatch = await AutoApplySettings.shouldJobMatch(userId, job);
      if (shouldMatch.matches) {
        filteredJobs.push({
          ...job,
          matchReason: 'Matches your preferences'
        });
      }
    }
    
    res.json({
      success: true,
      data: {
        jobs: filteredJobs,
        total: filteredJobs.length,
        autoApplyEnabled: settings.is_enabled
      }
    });
  } catch (error) {
    console.error('Error getting matching jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving matching jobs'
    });
  }
});

// Get application limits status
router.get('/limits', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const canApply = await AutoApplySettings.canUserApplyToday(userId);
    const settings = await AutoApplySettings.findByUser(userId);
    
    res.json({
      success: true,
      data: {
        canApply: canApply.canApply,
        reason: canApply.reason,
        dailyRemaining: canApply.dailyRemaining,
        weeklyRemaining: canApply.weeklyRemaining,
        limits: {
          dailyLimit: settings.max_applications_per_day,
          weeklyLimit: settings.max_applications_per_week
        }
      }
    });
  } catch (error) {
    console.error('Error checking application limits:', error);
    res.status(500).json({
      success: false,
      message: 'Error checking application limits'
    });
  }
});

// Test job application (without actually applying)
router.post('/test-application/:jobId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;
    
    // Get job data
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Create application package
    const applicationPackage = await UserProfile.createApplicationPackage(userId, job);
    
    res.json({
      success: true,
      message: 'Application package created successfully (test mode)',
      data: {
        job: job,
        userData: applicationPackage.userData,
        applicationData: {
          ...applicationPackage.applicationData,
          coverLetter: applicationPackage.applicationData.coverLetter.substring(0, 200) + '...' // Truncate for preview
        }
      }
    });
  } catch (error) {
    console.error('Error testing application:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating test application'
    });
  }
});

// Manual job application trigger
router.post('/apply/:jobId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const jobId = req.params.jobId;
    
    // Check if user can apply
    const canApply = await AutoApplySettings.canUserApplyToday(userId);
    if (!canApply.canApply) {
      return res.status(429).json({
        success: false,
        message: canApply.reason
      });
    }
    
    // Check if already applied
    const existingApplication = await Application.checkDuplicateApplication(userId, jobId);
    if (existingApplication) {
      return res.status(409).json({
        success: false,
        message: 'You have already applied to this job'
      });
    }
    
    // Get job data
    const job = await Job.findById(jobId);
    if (!job) {
      return res.status(404).json({
        success: false,
        message: 'Job not found'
      });
    }
    
    // Create application record
    const application = await Application.create({
      user_id: userId,
      job_id: jobId,
      application_mode: 'manual'
    });
    
    res.json({
      success: true,
      message: 'Application initiated successfully',
      data: {
        applicationId: application.application_id,
        job: job,
        status: 'pending'
      }
    });
  } catch (error) {
    console.error('Error initiating job application:', error);
    res.status(500).json({
      success: false,
      message: 'Error initiating job application'
    });
  }
});

// Get application history with details
router.get('/application/:applicationId', auth, async (req, res) => {
  try {
    const userId = req.user.userId;
    const applicationId = req.params.applicationId;
    
    const application = await Application.findById(applicationId);
    if (!application || application.user_id !== userId) {
      return res.status(404).json({
        success: false,
        message: 'Application not found'
      });
    }
    
    const statusHistory = await Application.getStatusHistory(applicationId);
    
    res.json({
      success: true,
      data: {
        application: application,
        statusHistory: statusHistory
      }
    });
  } catch (error) {
    console.error('Error getting application details:', error);
    res.status(500).json({
      success: false,
      message: 'Error retrieving application details'
    });
  }
});

module.exports = router;