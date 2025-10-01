const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs').promises;
const logger = require('./utils/logger');

const app = express();
const PORT = process.env.PORT || 3000;

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: async (req, file, cb) => {
        const uploadDir = path.join(process.cwd(), 'data', 'uploads');
        await fs.mkdir(uploadDir, { recursive: true });
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = /pdf|doc|docx/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype && extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only PDF, DOC, and DOCX files are allowed'));
        }
    }
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// API endpoint to save configuration
app.post('/api/config', upload.fields([
    { name: 'resume', maxCount: 1 },
    { name: 'coverLetter', maxCount: 1 }
]), async (req, res) => {
    try {
        logger.info('Received configuration submission');

        const configData = {
            // Step 1: Work Location & Jobs
            remoteCountries: req.body['remote-countries-input']?.split(',').filter(Boolean) || [],
            onsiteRegion: req.body['onsite-region'] || '',
            jobTypes: req.body['job-types']?.split(',').filter(Boolean) || [],
            jobTitles: req.body['job-titles']?.split(',').filter(Boolean) || [],

            // Step 2: Seniority & Time Zones
            seniorityLevels: req.body['seniority-levels']?.split(',').filter(Boolean) || [],
            timeZones: req.body['timezones-input']?.split(',').filter(Boolean) || [],

            // Step 3: Resume, Cover Letter, Contact Info
            resumePath: req.files?.resume ? req.files.resume[0].path : '',
            coverLetterOption: req.body['cover-letter-option'] || '',
            coverLetterPath: req.files?.coverLetter ? req.files.coverLetter[0].path : '',
            fullName: req.body['full-name'] || '',
            email: req.body['email'] || '',
            phone: `${req.body['country-code'] || ''}${req.body['phone'] || ''}`,
            location: {
                country: req.body['location-country'] || '',
                city: req.body['location-city'] || '',
                state: req.body['location-state'] || '',
                postalCode: req.body['location-postal'] || ''
            },

            // Step 4: Job & Eligibility Details
            currentJobTitle: req.body['current-job-title'] || '',
            availability: req.body['availability'] || '',
            eligibleCountries: req.body['eligible-countries']?.split(',').filter(Boolean) || [],
            visaSponsorship: req.body['visa-sponsorship'] || '',
            nationalities: req.body['nationalities']?.split(',').filter(Boolean) || [],
            currentSalary: req.body['current-salary'] || '',
            expectedSalary: req.body['expected-salary'] || '',

            // Additional Screening Questions
            experienceSummary: req.body['experience-summary'] || '',
            hybridPreference: req.body['hybrid-preference'] || '',
            travelComfortable: req.body['travel-comfortable'] || '',
            relocationOpen: req.body['relocation-open'] || '',
            languages: req.body['languages-input']?.split(',').filter(Boolean) || [],
            dateOfBirth: req.body['date-of-birth'] || '',
            gpa: req.body['gpa'] || '',
            age18: req.body['age-18'] || '',
            gender: req.body['gender'] || '',
            disability: req.body['disability'] || '',
            military: req.body['military'] || '',
            ethnicity: req.body['ethnicity'] || '',
            licenses: req.body['no-license'] === 'on' ? 'None' : req.body['licenses'] || '',

            createdAt: new Date().toISOString()
        };

        // Save to config.json
        const configPath = path.join(process.cwd(), 'config.json');
        const existingConfig = await loadConfig();

        const updatedConfig = {
            ...existingConfig,
            jobCriteria: {
                titles: configData.jobTitles,
                keywords: [],
                locations: [
                    ...configData.remoteCountries.map(c => `${c} (Remote)`),
                    configData.onsiteRegion
                ].filter(Boolean),
                seniority: configData.seniorityLevels,
                excludeKeywords: existingConfig.jobCriteria?.excludeKeywords || [],
                excludeCompanies: existingConfig.jobCriteria?.excludeCompanies || []
            },
            profile: {
                resumePath: configData.resumePath,
                name: configData.fullName,
                email: configData.email,
                phone: configData.phone,
                location: configData.location,
                currentJobTitle: configData.currentJobTitle,
                education: existingConfig.profile?.education || [],
                workHistory: existingConfig.profile?.workHistory || [],
                skills: existingConfig.profile?.skills || [],
                certifications: existingConfig.profile?.certifications || [],
                experienceSummary: configData.experienceSummary,
                languages: configData.languages,
                gpa: configData.gpa
            },
            screeningAnswers: {
                workAuthorization: configData.eligibleCountries.join(', '),
                requireSponsorship: configData.visaSponsorship === 'yes' ? 'Yes' : 'No',
                willingToRelocate: configData.relocationOpen,
                expectedSalary: configData.expectedSalary,
                availability: configData.availability,
                hybridPreference: configData.hybridPreference,
                travelComfortable: configData.travelComfortable,
                currentSalary: configData.currentSalary,
                nationalities: configData.nationalities,
                dateOfBirth: configData.dateOfBirth,
                age18: configData.age18,
                gender: configData.gender,
                disability: configData.disability,
                military: configData.military,
                ethnicity: configData.ethnicity,
                licenses: configData.licenses
            },
            companies: existingConfig.companies || []
        };

        await fs.writeFile(configPath, JSON.stringify(updatedConfig, null, 2));

        logger.info('Configuration saved successfully');

        res.json({
            success: true,
            message: 'Configuration saved successfully'
        });

    } catch (error) {
        logger.error('Error saving configuration:', error);
        res.status(500).json({
            success: false,
            message: 'Error saving configuration',
            error: error.message
        });
    }
});

async function loadConfig() {
    try {
        const configPath = path.join(process.cwd(), 'config.json');
        const data = await fs.readFile(configPath, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        return {};
    }
}

// Serve the configuration UI
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
    logger.info(`Configuration UI server running on port ${PORT}`);
    logger.info(`Open http://localhost:${PORT} to configure your job preferences`);
});

module.exports = app;
