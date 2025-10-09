const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const JobPreferences = require('../database/models/JobPreferences');
const Profile = require('../database/models/Profile');
const Eligibility = require('../database/models/Eligibility');
const ScreeningAnswers = require('../database/models/ScreeningAnswers');
const { Logger } = require('../utils/logger');
const logger = new Logger('UserProfile');

// All profile routes require authentication
router.use(authenticateToken);

/**
 * POST /api/user/profile
 * Accepts the full user profile object and upserts each section into its table.
 */
router.post('/profile', async (req, res) => {
    try {
        const userId = req.user.userId;
        const data = req.body;
        logger.info(`[POST /profile] Saving unified profile for user ${userId}`);

        // Upsert each section
        await JobPreferences.upsert(userId, {
            remoteJobs: data.remoteJobs || [],
            onsiteLocation: data.onsiteLocation || '',
            jobTypes: data.jobTypes || [],
            jobTitles: data.jobTitles || [],
            seniorityLevels: data.seniorityLevels || [],
            timeZones: data.timeZones || []
        });
        await Profile.upsert(userId, {
            fullName: data.fullName || '',
            email: data.email || '',
            resumePath: data.resumePath || '',
            coverLetterOption: data.coverLetterOption || '',
            coverLetterPath: data.coverLetterPath || '',
            phone: data.phone || '',
            country: data.country || '',
            city: data.city || '',
            stateRegion: data.stateRegion || '',
            postalCode: data.postalCode || ''
        });
        await Eligibility.upsert(userId, {
            currentJobTitle: data.currentJobTitle || '',
            availability: data.availability || '',
            eligibleCountries: data.eligibleCountries || [],
            visaSponsorship: data.visaSponsorship === 'yes',
            nationality: data.nationality || [],
            currentSalary: data.currentSalary || null,
            expectedSalary: data.expectedSalary || null
        });
        await ScreeningAnswers.upsert(userId, {
            experienceSummary: data.experienceSummary || '',
            hybridPreference: data.hybridPreference || '',
            travel: data.travel || '',
            relocation: data.relocation || '',
            languages: data.languages || [],
            dateOfBirth: data.dateOfBirth || null,
            gpa: data.gpa || null,
            isAdult: data.isAdult === 'yes',
            genderIdentity: data.genderIdentity || '',
            disabilityStatus: data.disabilityStatus || '',
            militaryService: data.militaryService || '',
            ethnicity: data.ethnicity || '',
            drivingLicense: data.drivingLicense || ''
        });

        logger.info(`[POST /profile] Unified profile saved for user ${userId}`);
        res.json({ success: true, message: 'Profile saved successfully' });
    } catch (error) {
        logger.error('Error saving unified profile:', error);
        res.status(500).json({ success: false, message: 'Error saving profile', error: error.message });
    }
});

module.exports = router;
