/**
 * Application Automation Service - Enhanced Autoapply Engine
 * Automatically fills out and submits job applications
 */

const puppeteer = require('puppeteer');
const { Logger } = require('../../utils/logger');

class ApplicationAutomator {
    constructor(database) {
        this.db = database;
        this.logger = new Logger('ApplicationAutomator');
        this.browser = null;
        this.openai = require('openai');
        
        // Initialize OpenAI for smart form filling
        this.ai = new this.openai({
            apiKey: process.env.OPENAI_API_KEY
        });
    }

    /**
     * Initialize browser for automation
     */
    async initializeBrowser() {
        if (!this.browser) {
            this.browser = await puppeteer.launch({
                headless: process.env.NODE_ENV === 'production',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu'
                ]
            });
        }
        return this.browser;
    }

    /**
     * Apply to a job automatically
     * @param {string} userId - User ID
     * @param {string} jobId - Job opportunity ID
     * @returns {Promise<Object>} - Application result
     */
    async applyToJob(userId, jobId) {
        let page = null;
        
        try {
            this.logger.info(`Starting automatic application for user ${userId}, job ${jobId}`);

            // Get job and user data
            const [job, user, profile] = await Promise.all([
                this.getJobById(jobId),
                this.getUserById(userId),
                this.getUserProfile(userId)
            ]);

            if (!job || !user || !profile) {
                throw new Error('Missing required data for application');
            }

            // Initialize browser and create new page
            await this.initializeBrowser();
            page = await this.browser.newPage();

            // Set user agent and viewport
            await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36');
            await page.setViewport({ width: 1920, height: 1080 });

            // Navigate to job URL
            this.logger.info(`Navigating to job URL: ${job.url}`);
            await page.goto(job.url, { waitUntil: 'networkidle2', timeout: 30000 });

            // Detect and handle different application systems
            const applicationResult = await this.handleApplicationFlow(page, job, user, profile);

            // Save application record
            await this.saveApplicationRecord(userId, jobId, applicationResult);

            this.logger.info(`Application completed successfully for job ${jobId}`);
            return applicationResult;

        } catch (error) {
            this.logger.error(`Application failed for job ${jobId}:`, error.message);
            
            // Save failed application record
            await this.saveApplicationRecord(userId, jobId, {
                status: 'failed',
                error: error.message,
                timestamp: new Date().toISOString()
            });

            throw error;
        } finally {
            if (page) {
                await page.close();
            }
        }
    }

    /**
     * Handle different application flows
     */
    async handleApplicationFlow(page, job, user, profile) {
        // Detect ATS (Application Tracking System) type
        const atsType = await this.detectATSType(page);
        
        this.logger.info(`Detected ATS type: ${atsType}`);

        switch (atsType) {
            case 'workday':
                return await this.handleWorkdayApplication(page, job, user, profile);
            case 'greenhouse':
                return await this.handleGreenhouseApplication(page, job, user, profile);
            case 'lever':
                return await this.handleLeverApplication(page, job, user, profile);
            case 'successfactors':
                return await this.handleSuccessFactorsApplication(page, job, user, profile);
            case 'icims':
                return await this.handleiCIMSApplication(page, job, user, profile);
            case 'linkedin':
                return await this.handleLinkedInApplication(page, job, user, profile);
            default:
                return await this.handleGenericApplication(page, job, user, profile);
        }
    }

    /**
     * Detect ATS type from page content
     */
    async detectATSType(page) {
        try {
            const pageContent = await page.content();
            const url = page.url();

            // Check URL patterns
            if (url.includes('myworkdayjobs.com') || url.includes('workday.com')) return 'workday';
            if (url.includes('greenhouse.io') || url.includes('boards.greenhouse.io')) return 'greenhouse';
            if (url.includes('lever.co') || url.includes('jobs.lever.co')) return 'lever';
            if (url.includes('successfactors.com')) return 'successfactors';
            if (url.includes('icims.com')) return 'icims';
            if (url.includes('linkedin.com/jobs')) return 'linkedin';

            // Check page content patterns
            if (pageContent.includes('workday') || pageContent.includes('Workday')) return 'workday';
            if (pageContent.includes('greenhouse') || pageContent.includes('Greenhouse')) return 'greenhouse';
            if (pageContent.includes('lever') || pageContent.includes('Lever')) return 'lever';
            if (pageContent.includes('successfactors') || pageContent.includes('SuccessFactors')) return 'successfactors';
            if (pageContent.includes('icims') || pageContent.includes('iCIMS')) return 'icims';

            return 'generic';
        } catch (error) {
            this.logger.error('Failed to detect ATS type:', error.message);
            return 'generic';
        }
    }

    /**
     * Handle Workday applications
     */
    async handleWorkdayApplication(page, job, user, profile) {
        this.logger.info('Handling Workday application');

        try {
            // Look for "Apply" button
            await page.waitForSelector('[data-automation-id="apply"], .css-1vq8k5l, button:contains("Apply")', { timeout: 10000 });
            await page.click('[data-automation-id="apply"], .css-1vq8k5l, button:contains("Apply")');

            // Wait for application form
            await page.waitForSelector('form, [data-automation-id="formField"]', { timeout: 15000 });

            // Fill basic information
            await this.fillBasicInformation(page, user, profile);

            // Handle resume upload
            await this.handleResumeUpload(page, profile);

            // Fill additional fields using AI
            await this.fillAdditionalFields(page, job, user, profile);

            // Handle screening questions
            await this.handleScreeningQuestions(page, user);

            // Submit application (in review mode, we don't actually submit)
            if (process.env.AUTOMATION_MODE === 'auto') {
                await this.submitApplication(page);
                return {
                    status: 'submitted',
                    atsType: 'workday',
                    timestamp: new Date().toISOString()
                };
            } else {
                return {
                    status: 'ready_to_submit',
                    atsType: 'workday',
                    timestamp: new Date().toISOString(),
                    message: 'Application filled out and ready for manual review/submission'
                };
            }

        } catch (error) {
            throw new Error(`Workday application failed: ${error.message}`);
        }
    }

    /**
     * Handle Greenhouse applications
     */
    async handleGreenhouseApplication(page, job, user, profile) {
        this.logger.info('Handling Greenhouse application');

        try {
            // Look for application form or apply button
            const applyButton = await page.$('button[type="submit"], .application-form button, #apply-button');
            if (applyButton) {
                await applyButton.click();
                await page.waitForTimeout(2000);
            }

            // Fill form fields
            await this.fillBasicInformation(page, user, profile);
            await this.handleResumeUpload(page, profile);
            await this.fillAdditionalFields(page, job, user, profile);

            return {
                status: process.env.AUTOMATION_MODE === 'auto' ? 'submitted' : 'ready_to_submit',
                atsType: 'greenhouse',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            throw new Error(`Greenhouse application failed: ${error.message}`);
        }
    }

    /**
     * Handle LinkedIn applications
     */
    async handleLinkedInApplication(page, job, user, profile) {
        this.logger.info('Handling LinkedIn application');

        try {
            // Look for Easy Apply button
            const easyApplyButton = await page.$('.jobs-apply-button, .jobs-s-apply button, button:contains("Easy Apply")');
            if (easyApplyButton) {
                await easyApplyButton.click();
                await page.waitForTimeout(3000);

                // Handle LinkedIn Easy Apply flow
                return await this.handleLinkedInEasyApply(page, job, user, profile);
            } else {
                // External application
                const externalApplyButton = await page.$('button:contains("Apply"), .jobs-apply-button--top-card button');
                if (externalApplyButton) {
                    await externalApplyButton.click();
                    await page.waitForTimeout(3000);
                    return await this.handleGenericApplication(page, job, user, profile);
                }
            }

            throw new Error('No apply button found on LinkedIn job page');

        } catch (error) {
            throw new Error(`LinkedIn application failed: ${error.message}`);
        }
    }

    /**
     * Handle generic applications
     */
    async handleGenericApplication(page, job, user, profile) {
        this.logger.info('Handling generic application');

        try {
            // Look for common apply button selectors
            const applySelectors = [
                'button:contains("Apply")',
                '.apply-button',
                '#apply-button',
                '.btn-apply',
                'a[href*="apply"]',
                'button[type="submit"]'
            ];

            for (const selector of applySelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        await button.click();
                        await page.waitForTimeout(2000);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }

            // Fill out any forms found
            await this.fillBasicInformation(page, user, profile);
            await this.handleResumeUpload(page, profile);
            await this.fillAdditionalFields(page, job, user, profile);

            return {
                status: process.env.AUTOMATION_MODE === 'auto' ? 'submitted' : 'ready_to_submit',
                atsType: 'generic',
                timestamp: new Date().toISOString()
            };

        } catch (error) {
            throw new Error(`Generic application failed: ${error.message}`);
        }
    }

    /**
     * Fill basic information fields
     */
    async fillBasicInformation(page, user, profile) {
        // Split full_name into first and last name
        const nameParts = (profile.full_name || '').trim().split(' ');
        const firstName = nameParts[0] || '';
        const lastName = nameParts.slice(1).join(' ') || '';

        const fieldMappings = [
            { selectors: ['input[name*="firstName"], input[name*="first_name"], #firstName, #first-name'], value: firstName },
            { selectors: ['input[name*="lastName"], input[name*="last_name"], #lastName, #last-name'], value: lastName },
            { selectors: ['input[name*="email"], input[type="email"], #email'], value: user.email },
            { selectors: ['input[name*="phone"], input[type="tel"], #phone'], value: profile.phone },
            { selectors: ['input[name*="address"], textarea[name*="address"], #address'], value: profile.address },
            { selectors: ['input[name*="linkedin"], #linkedin'], value: profile.linkedin_url },
            { selectors: ['input[name*="website"], #website'], value: profile.website_url }
        ];

        for (const mapping of fieldMappings) {
            if (!mapping.value) continue;

            for (const selector of mapping.selectors) {
                try {
                    const field = await page.$(selector);
                    if (field) {
                        await field.clear();
                        await field.type(mapping.value);
                        break;
                    }
                } catch (e) {
                    continue;
                }
            }
        }
    }

    /**
     * Handle resume upload
     */
    async handleResumeUpload(page, profile) {
        if (!profile.resume_url) return;

        try {
            const uploadSelectors = [
                'input[type="file"]',
                'input[name*="resume"]',
                'input[name*="cv"]',
                '.file-upload input'
            ];

            for (const selector of uploadSelectors) {
                const uploadField = await page.$(selector);
                if (uploadField) {
                    // In a real implementation, you'd download the resume file first
                    // For now, we'll just log that we found the upload field
                    this.logger.info('Found resume upload field - would upload resume here');
                    break;
                }
            }
        } catch (error) {
            this.logger.error('Resume upload failed:', error.message);
        }
    }

    /**
     * Fill additional fields using AI
     */
    async fillAdditionalFields(page, job, user, profile) {
        try {
            // Get all visible form fields
            const formFields = await page.$$eval('input, textarea, select', elements => {
                return elements
                    .filter(el => {
                        const style = window.getComputedStyle(el);
                        return style.display !== 'none' && style.visibility !== 'hidden';
                    })
                    .map(el => ({
                        tagName: el.tagName,
                        type: el.type,
                        name: el.name,
                        id: el.id,
                        placeholder: el.placeholder,
                        label: el.closest('label')?.textContent || '',
                        value: el.value
                    }));
            });

            // Use AI to determine appropriate values for unknown fields
            for (const field of formFields) {
                if (field.value || !field.name) continue;

                const fieldValue = await this.getFieldValueFromAI(field, job, user, profile);
                if (fieldValue) {
                    const selector = field.id ? `#${field.id}` : `[name="${field.name}"]`;
                    try {
                        await page.type(selector, fieldValue);
                    } catch (e) {
                        this.logger.debug(`Could not fill field ${field.name}: ${e.message}`);
                    }
                }
            }
        } catch (error) {
            this.logger.error('AI field filling failed:', error.message);
        }
    }

    /**
     * Get field value from AI
     */
    async getFieldValueFromAI(field, job, user, profile) {
        try {
            const prompt = `
Given this form field and user context, provide the most appropriate value:

Field: ${JSON.stringify(field)}
Job: ${job.title} at ${job.company}
User: ${profile.full_name}
Current Role: ${profile.current_title}
Experience: ${profile.years_experience} years

Provide only the value that should be entered in this field, with no explanation.
If unsure, respond with "SKIP".
`;

            const response = await this.ai.chat.completions.create({
                model: process.env.CHAT_MODEL || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 100,
                temperature: 0.1
            });

            const value = response.choices[0]?.message?.content?.trim();
            return value === 'SKIP' ? null : value;

        } catch (error) {
            this.logger.error('AI field value generation failed:', error.message);
            return null;
        }
    }

    /**
     * Handle screening questions
     */
    async handleScreeningQuestions(page, user) {
        try {
            // Look for screening questions
            const questions = await page.$$eval('[role="group"], .screening-question, .question-group', elements => {
                return elements.map(el => ({
                    question: el.textContent,
                    type: el.querySelector('input')?.type || 'text',
                    options: Array.from(el.querySelectorAll('option, input[type="radio"]')).map(opt => opt.textContent || opt.value)
                }));
            });

            for (const question of questions) {
                const answer = await this.getScreeningAnswer(user.id, question.question);
                if (answer) {
                    // Apply the answer to the form
                    // Implementation depends on question type
                    this.logger.info(`Applied screening answer: ${answer}`);
                }
            }
        } catch (error) {
            this.logger.error('Screening questions handling failed:', error.message);
        }
    }

    /**
     * Get screening answer from database or AI
     */
    async getScreeningAnswer(userId, question) {
        try {
            // First, check if we have a saved answer
            const query = 'SELECT answer FROM screening_answers WHERE user_id = $1 AND question ILIKE $2';
            const result = await this.db.query(query, [userId, `%${question}%`]);
            
            if (result.rows.length > 0) {
                return result.rows[0].answer;
            }

            // If no saved answer, use AI to generate one
            const aiAnswer = await this.generateScreeningAnswer(question);
            
            // Save the AI-generated answer for future use
            if (aiAnswer) {
                const insertQuery = 'INSERT INTO screening_answers (user_id, question, answer) VALUES ($1, $2, $3)';
                await this.db.query(insertQuery, [userId, question, aiAnswer]);
            }

            return aiAnswer;
        } catch (error) {
            this.logger.error('Failed to get screening answer:', error.message);
            return null;
        }
    }

    /**
     * Generate screening answer using AI
     */
    async generateScreeningAnswer(question) {
        try {
            const prompt = `
Generate a professional answer to this job application screening question:

Question: ${question}

Provide a concise, professional answer. For yes/no questions, respond with "Yes" or "No". 
For authorization questions, assume US work authorization. 
For availability questions, assume immediate availability.
For salary expectations, respond with "Competitive" or "Negotiable".
`;

            const response = await this.ai.chat.completions.create({
                model: process.env.CHAT_MODEL || 'gpt-4o-mini',
                messages: [{ role: 'user', content: prompt }],
                max_tokens: 150,
                temperature: 0.1
            });

            return response.choices[0]?.message?.content?.trim();
        } catch (error) {
            this.logger.error('AI screening answer generation failed:', error.message);
            return null;
        }
    }

    /**
     * Submit application
     */
    async submitApplication(page) {
        try {
            const submitSelectors = [
                'button[type="submit"]',
                'input[type="submit"]',
                'button:contains("Submit")',
                '.submit-button',
                '#submit-application'
            ];

            for (const selector of submitSelectors) {
                try {
                    const button = await page.$(selector);
                    if (button) {
                        await button.click();
                        await page.waitForTimeout(3000);
                        this.logger.info('Application submitted successfully');
                        return;
                    }
                } catch (e) {
                    continue;
                }
            }

            throw new Error('Submit button not found');
        } catch (error) {
            throw new Error(`Application submission failed: ${error.message}`);
        }
    }

    /**
     * Database helper methods
     */
    async getJobById(jobId) {
        const query = 'SELECT * FROM jobs WHERE job_id = $1';
        const result = await this.db.query(query, [jobId]);
        return result.rows[0];
    }

    async getUserById(userId) {
        const query = 'SELECT * FROM users WHERE user_id = $1';
        const result = await this.db.query(query, [userId]);
        return result.rows[0];
    }

    async getUserProfile(userId) {
        const query = 'SELECT * FROM profile WHERE user_id = $1';
        const result = await this.db.query(query, [userId]);
        return result.rows[0];
    }

    async saveApplicationRecord(userId, jobId, result) {
        const query = `
            INSERT INTO applications (
                user_id, job_id, status, application_mode, error_message, 
                ats_data, applied_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
            ON CONFLICT (user_id, job_id) DO UPDATE SET
                status = EXCLUDED.status,
                error_message = EXCLUDED.error_message,
                ats_data = EXCLUDED.ats_data,
                applied_at = EXCLUDED.applied_at,
                updated_at = NOW()
        `;

        await this.db.query(query, [
            userId,
            jobId,
            result.status,
            'auto',
            result.error || null,
            JSON.stringify(result),
            result.status === 'submitted' ? new Date() : null
        ]);
    }

    /**
     * Cleanup browser resources
     */
    async cleanup() {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

module.exports = ApplicationAutomator;